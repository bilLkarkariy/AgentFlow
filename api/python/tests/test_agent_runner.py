import sys
import subprocess
import json
import os
import pytest
from dotenv import load_dotenv, find_dotenv

# Load .env for OPENAI_API_KEY
load_dotenv(find_dotenv())

@pytest.mark.skipif(
    'OPENAI_API_KEY' not in os.environ,
    reason='Requires OPENAI_API_KEY for real agent execution'
)
def test_agent_runner_stdout():
    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'agent_runner.py')
    )
    input_payload = {"text": "test input"}
    result = subprocess.run(
        [sys.executable, script_path],
        input=json.dumps(input_payload).encode(),
        capture_output=True,
    )
    assert result.returncode == 0
    # Parse ND-JSON lines
    lines = result.stdout.decode().splitlines()
    events = [json.loads(line) for line in lines]
    assert len(events) >= 2, f"Unexpected events: {events}"
    assert events[-1].get("kind") == "end"
    for ev in events[:-1]:
        assert ev.get("kind") == "chunk"
        assert isinstance(ev.get("data"), str)