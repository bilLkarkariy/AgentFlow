import pytest
import os
import subprocess
import time

def test_crew_runtime_run():
    # Start the crew-runtime service in background
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    proc = subprocess.Popen(['python', 'main.py'], cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1)

    # Use grpcurl to call the gRPC endpoint
    cmd = ['grpcurl', '-plaintext', '-d', '{"prompt":"Hello"}', 'localhost:50051', 'agent.AgentService/Run']
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Ensure grpcurl succeeded
    assert result.returncode == 0, f"grpcurl failed: {result.stderr.decode()}"
    output = result.stdout.decode().strip()
    assert 'RunResponse' in output

    proc.terminate()
    proc.wait()
