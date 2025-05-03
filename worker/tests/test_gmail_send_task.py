import os
import httpretty
import pytest
from agentflow_worker import gmail_send_task

@httpretty.activate
def test_gmail_send_task_success():
    endpoint = f"{os.getenv('API_URL', 'http://localhost:3000')}/oauth/google/nodes/gmail/send"
    httpretty.register_uri(
        httpretty.POST,
        endpoint,
        status=200,
        body='{"message":"ok"}',
        content_type="application/json",
    )
    result = gmail_send_task.run(
        "run1", "node1", "user@example.com", "Hello", "World"
    )
    assert result["message"] == "ok"

@httpretty.activate
def test_gmail_send_task_failure():
    endpoint = f"{os.getenv('API_URL', 'http://localhost:3000')}/oauth/google/nodes/gmail/send"
    httpretty.register_uri(
        httpretty.POST,
        endpoint,
        status=500,
    )
    with pytest.raises(Exception):
        gmail_send_task.run(
            "run1", "node1", "user@example.com", "Hello", "World"
        )
