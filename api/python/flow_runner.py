#!/usr/bin/env python3
"""Dynamic multi-agent flow runner – ND-JSON streaming over stdin/stdout"""
import sys, json, asyncio, logging, os
from agents import Agent, Runner, function_tool, RunConfig, set_tracing_export_api_key
from openai.types.responses import ResponseTextDeltaEvent

# Optionally exporter de traces
TRACE_API_KEY = os.getenv("OPENAI_TRACE_API_KEY")
if TRACE_API_KEY:
    set_tracing_export_api_key(TRACE_API_KEY)

import requests

# Ensure function_tool.from_dict exists for monkeypatching
if not hasattr(function_tool, "from_dict"):
    def _from_dict(t):
        return function_tool(t["name"], lambda **kwargs: None)
    function_tool.from_dict = _from_dict

# GenericBackendTool for HTTP-based backend tools
class GenericBackendTool:
    """
    A callable backend tool that POSTs to NestJS /internal/tools/:toolId.
    Provides error handling and configurable timeouts.
    """
    def __init__(self, tool: dict, timeout: float = None):
        self.tool = tool
        self.base = os.getenv("API_URL", "http://localhost:3000")
        # timeout in seconds
        self.timeout = timeout or float(os.getenv("API_TIMEOUT", "30"))
    def __call__(self, **kwargs):
        url = f"{self.base}/internal/tools/{self.tool['toolId']}"
        try:
            resp = requests.post(url, json=kwargs, timeout=self.timeout)
            resp.raise_for_status()
        except requests.RequestException as e:
            logging.error(f"Error calling backend tool {self.tool['toolId']}: {e}")
            raise
        return resp.json()

# Alias for compatibility
def mk_backend_tool(tool: dict, timeout: float = None):
    """Create a GenericBackendTool callable for the given tool definition."""
    return GenericBackendTool(tool, timeout)

async def build_agent_map(payload: dict) -> dict[str, Agent]:
    """Construire un mapping id→Agent avec outils et handoffs"""
    id_to_agent: dict[str, Agent] = {}
    for a in payload.get("agents", []):
        # Prepare tools: backend tools call NestJS, others use function_tool.from_dict
        tools_list = []
        for t in a.get("tools", []):
            if t.get("toolType") == "backend":
                tools_list.append(mk_backend_tool(t))
            else:
                tools_list.append(function_tool.from_dict(t))
        id_to_agent[a["id"]] = Agent(
            name=a.get("name", a["id"]),
            instructions=a.get("instructions", ""),
            model=a.get("model", None),
            tools=tools_list
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
