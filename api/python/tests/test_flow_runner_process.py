"""The real flow_runner.py process, against the fake OpenAI endpoint."""
import json

import pytest
from agents import function_tool

import flow_runner
from flow_runner import sdk_trace_id

FLOW = {
    "runId": "r1",
    "input": "hi",
    "agents": [{"id": "triage", "instructions": "answer", "tools": []}],
    "edges": [],
}


def test_run_streams_chunks_then_end(run_runner, openai_server):
    events, code, stderr = run_runner(FLOW)
    assert code == 0, stderr
    assert [e["kind"] for e in events] == ["chunk"] * 5 + ["end"]
    assert "".join(e["data"] for e in events[:-1]) == "Hello from the fake model"
    assert len(openai_server.requests) == 1


def test_max_turns_reaches_the_sdk(run_runner):
    # A handoff needs two model turns: with max_turns=1 the SDK must stop the run.
    flow = {
        "input": "call:transfer_to_b:{}",
        "agents": [
            {"id": "a", "name": "a", "instructions": "first", "tools": []},
            {"id": "b", "name": "b", "instructions": "second", "tools": []},
        ],
        "edges": [["a", "b"]],
    }
    events, code, stderr = run_runner({**flow, "config": {"max_turns": 1}})
    assert code == 0, stderr
    assert events == [{"kind": "error", "message": "MaxTurnsExceeded: Max turns (1) exceeded"}]

    events, code, stderr = run_runner({**flow, "config": {"max_turns": 2}})
    assert code == 0, stderr
    assert events[-1] == {"kind": "end"}


def test_worker_serves_ten_runs_in_a_row(run_runner, openai_server):
    events, code, stderr = run_runner(*[{**FLOW, "runId": f"r{i}"} for i in range(10)])
    assert code == 0, stderr
    assert [e["kind"] for e in events] == (["chunk"] * 5 + ["end"]) * 10
    assert len(openai_server.requests) == 10


def test_a_failed_run_does_not_kill_the_worker(run_runner):
    # The first two lines are what the old BullMQ path and a broken client sent.
    events, code, stderr = run_runner({"prompt": "x", "parameters": {}}, "not a flow", FLOW)
    assert code == 0, stderr
    assert events[0] == {"kind": "error", "message": "ValueError: No root agent found"}
    assert events[1] == {"kind": "error", "message": "Invalid JSON: payload must be a JSON object"}
    assert [e["kind"] for e in events[2:]] == ["chunk"] * 5 + ["end"]


def test_worker_exits_when_stdin_closes(run_runner):
    events, code, _ = run_runner()
    assert (events, code) == ([], 0)


SUMMARIZE = {
    "name": "summarize",
    "description": "Summarize a text",
    "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
    "toolType": "backend",
    "toolId": "summarize-block",
}


def test_backend_tool_call_end_to_end(run_runner, openai_server, backend_server):
    flow = {
        "input": 'call:summarize:{"text": "a long text"}',
        "agents": [{"id": "a", "instructions": "use the tool", "tools": [SUMMARIZE]}],
        "edges": [],
    }
    events, code, stderr = run_runner(
        flow,
        env={
            "API_URL": f"http://127.0.0.1:{backend_server.server_port}",
            "INTERNAL_TOOLS_TOKEN": "secret-token",
        },
    )
    assert code == 0, stderr

    # 1. the model was offered the tool, with the schema of the flow
    first, second = openai_server.requests
    assert [(t["name"], t["parameters"]) for t in first["tools"]] == [
        ("summarize", SUMMARIZE["parameters"])
    ]
    # 2. its call reached the API tool endpoint, with the internal token
    assert backend_server.calls == [("/internal/tools/summarize-block", {"text": "a long text"})]
    assert backend_server.tokens == ["secret-token"]
    # 3. the tool output went back to the model
    assert json.loads(second["input"][-1]["output"]) == {"summary": "short a long text"}
    # 4. and the model's final answer is streamed
    assert events[-1] == {"kind": "end"}
    assert "".join(e["data"] for e in events[:-1]) == 'tool said: {"summary": "short a long text"}'


def test_backend_tool_failure_is_reported_to_the_model(run_runner, openai_server):
    flow = {
        "input": 'call:summarize:{"text": "x"}',
        "agents": [{"id": "a", "instructions": "use the tool", "tools": [SUMMARIZE]}],
        "edges": [],
    }
    # Nothing listens on port 9: the POST fails, the run still ends cleanly.
    events, code, stderr = run_runner(flow, env={"API_URL": "http://127.0.0.1:9"})
    assert code == 0, stderr
    assert events[-1] == {"kind": "end"}
    assert openai_server.requests[1]["input"][-1]["output"].startswith("Error calling tool summarize:")


@pytest.mark.asyncio
async def test_function_tool_call_in_process(openai_server, monkeypatch, capsys):
    @function_tool
    def shout(text: str) -> str:
        """Upper-case a text."""
        return text.upper()

    monkeypatch.setitem(flow_runner.LOCAL_TOOLS, "shout", shout)
    monkeypatch.setenv("OPENAI_API_KEY", "dummy")
    monkeypatch.setenv("OPENAI_BASE_URL", f"http://127.0.0.1:{openai_server.server_port}/v1")
    monkeypatch.setenv("OPENAI_AGENTS_DISABLE_TRACING", "1")

    await flow_runner.run_flow({
        "input": 'call:shout:{"text": "abc"}',
        "agents": [{"id": "a", "instructions": "", "tools": [
            {"name": "shout", "description": "", "parameters": {}, "toolType": "function", "toolId": "shout"},
        ]}],
        "edges": [],
    })
    chunks = [json.loads(line)["data"] for line in capsys.readouterr().out.splitlines()]
    assert "".join(chunks) == "tool said: ABC"


def test_trace_id_uses_the_sdk_format():
    assert sdk_trace_id("0af7651916cd43dd8448eb211c80319c") == "trace_0af7651916cd43dd8448eb211c80319c"
    assert sdk_trace_id("trace_abc") == "trace_abc"
    assert sdk_trace_id(None) is None
