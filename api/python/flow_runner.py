#!/usr/bin/env python3
"""Dynamic multi-agent flow runner – ND-JSON streaming over stdin/stdout"""
import sys, json, asyncio, logging, os
from agents import Agent, Runner, FunctionTool, RunConfig, set_tracing_export_api_key
from openai.types.responses import ResponseTextDeltaEvent

# Optionally exporter de traces
TRACE_API_KEY = os.getenv("OPENAI_TRACE_API_KEY")
if TRACE_API_KEY:
    set_tracing_export_api_key(TRACE_API_KEY)

import requests

# In-process tools (`toolType: "function"`), keyed by toolId. A flow can only
# name a tool registered here, e.g. one built with the SDK's @function_tool.
LOCAL_TOOLS: dict[str, FunctionTool] = {}

def mk_backend_tool(tool: dict, timeout: float = None) -> FunctionTool:
    """
    A backend tool (`toolType: "backend"`): when the model calls it, the
    arguments are POSTed to NestJS /internal/tools/:toolId and the JSON reply
    is the tool output.
    """
    base = os.getenv("API_URL", "http://localhost:3000")
    # timeout in seconds
    timeout = timeout or float(os.getenv("API_TIMEOUT", "30"))
    url = f"{base}/internal/tools/{tool['toolId']}"

    async def on_invoke_tool(_ctx, arguments: str) -> str:
        try:
            # requests is blocking: keep the event loop free while the API answers.
            resp = await asyncio.to_thread(
                requests.post, url, json=json.loads(arguments or "{}"), timeout=timeout
            )
            resp.raise_for_status()
            return json.dumps(resp.json())
        except (requests.RequestException, ValueError) as e:
            logging.error(f"Error calling backend tool {tool['toolId']}: {e}")
            # Like a failing @function_tool: the model gets the error and the run goes on.
            return f"Error calling tool {tool['name']}: {e}"

    return FunctionTool(
        name=tool["name"],
        description=tool.get("description", ""),
        params_json_schema=tool.get("parameters") or {"type": "object", "properties": {}},
        on_invoke_tool=on_invoke_tool,
        # The schema comes from the flow: it is not required to fit strict mode.
        strict_json_schema=False,
    )

def mk_tool(tool) -> FunctionTool:
    """Turn one tool entry of the payload into an SDK tool."""
    if not isinstance(tool, dict):
        raise ValueError(f"Unsupported tool definition: {tool!r}")
    if tool.get("toolType") == "backend":
        return mk_backend_tool(tool)
    if tool.get("toolId") not in LOCAL_TOOLS:
        raise ValueError(f"Unknown function tool: {tool.get('toolId')!r}")
    return LOCAL_TOOLS[tool["toolId"]]

async def build_agent_map(payload: dict) -> dict[str, Agent]:
    """Construire un mapping id→Agent avec outils et handoffs"""
    id_to_agent: dict[str, Agent] = {}
    for a in payload.get("agents", []):
        id_to_agent[a["id"]] = Agent(
            name=a.get("name", a["id"]),
            instructions=a.get("instructions", ""),
            model=a.get("model", None),
            tools=[mk_tool(t) for t in a.get("tools") or []],
        )
    # Configurer les handoffs
    for src, dst in payload.get("edges", []):
        id_to_agent[src].handoffs.append(id_to_agent[dst])
    return id_to_agent

def sdk_trace_id(trace_id: str | None) -> str | None:
    """The API sends its OpenTelemetry trace id (32 hex chars); the SDK wants `trace_<32 chars>`."""
    if not trace_id or trace_id.startswith("trace_"):
        return trace_id
    return f"trace_{trace_id}"

def emit(event: dict) -> None:
    """Write one ND-JSON event; stdout carries nothing else."""
    print(json.dumps(event), flush=True)

async def run_flow(payload: dict) -> None:
    """Run one flow and stream its text deltas as `chunk` events."""
    agents = await build_agent_map(payload)
    # Trouver l'agent racine (pas de edge d'entrée)
    root_id = next((aid for aid in agents if all(aid != dst for _, dst in payload.get("edges", []))), None)
    if not root_id:
        raise ValueError("No root agent found")

    # Configuration du run. `max_turns` is an argument of the run, not a RunConfig field.
    run_cfg = RunConfig(trace_id=sdk_trace_id(payload.get("traceId")))
    stream = Runner.run_streamed(
        agents[root_id],
        payload.get("input", ""),
        max_turns=(payload.get("config") or {}).get("max_turns", 8),
        run_config=run_cfg,
    )

    # Streaming des événements
    async for ev in stream.stream_events():
        if ev.type == "raw_response_event" and isinstance(ev.data, ResponseTextDeltaEvent):
            emit({"kind": "chunk", "data": ev.data.delta})

async def main():
    """Worker loop: one JSON payload per stdin line, until stdin closes.

    Every run ends with exactly one terminal event, `end` or `error`, and the
    worker then waits for the next payload: a failed run does not kill it. All
    runs share one event loop, so the SDK's HTTP client is reused between runs.
    """
    while True:
        line = await asyncio.to_thread(sys.stdin.readline)
        if not line:
            return
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise ValueError("payload must be a JSON object")
        except Exception as e:
            emit({"kind": "error", "message": f"Invalid JSON: {e}"})
            continue
        try:
            await run_flow(payload)
        except Exception as e:
            logging.exception("Flow run failed")
            emit({"kind": "error", "message": f"{type(e).__name__}: {e}"})
        else:
            # Signaler la fin
            emit({"kind": "end"})

if __name__ == "__main__":
    # stderr is forwarded to the API log as warnings: keep per-request INFO lines out.
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(main())
