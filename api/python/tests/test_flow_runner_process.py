"""The real flow_runner.py process, against the fake OpenAI endpoint."""
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


def test_trace_id_uses_the_sdk_format():
    assert sdk_trace_id("0af7651916cd43dd8448eb211c80319c") == "trace_0af7651916cd43dd8448eb211c80319c"
    assert sdk_trace_id("trace_abc") == "trace_abc"
    assert sdk_trace_id(None) is None
