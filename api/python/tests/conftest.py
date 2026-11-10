import json
import os
import subprocess
import sys

import pytest

import fake_openai

RUNNER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "flow_runner.py"))


@pytest.fixture
def openai_server():
    """A fake OpenAI endpoint; `server.requests` holds the bodies it received."""
    server = fake_openai.start()
    yield server
    fake_openai.stop(server)


@pytest.fixture
def run_runner(openai_server):
    """Run the real flow_runner.py process against the fake endpoint.

    Feeds one stdin line per payload and returns (events, returncode, stderr).
    """
    def run(*payloads: dict, env: dict | None = None, timeout: float = 60):
        proc = subprocess.run(
            [sys.executable, "-u", RUNNER],
            input="".join(json.dumps(p) + "\n" for p in payloads).encode(),
            capture_output=True,
            timeout=timeout,
            env={
                **os.environ,
                "OPENAI_API_KEY": "dummy",
                "OPENAI_BASE_URL": f"http://127.0.0.1:{openai_server.server_port}/v1",
                "OPENAI_AGENTS_DISABLE_TRACING": "1",
                **(env or {}),
            },
        )
        events = [json.loads(line) for line in proc.stdout.decode().splitlines() if line.strip()]
        return events, proc.returncode, proc.stderr.decode()
    return run
