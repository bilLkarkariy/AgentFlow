import json
import urllib.error
import urllib.request

import pytest
from prometheus_client import REGISTRY

import health
import metrics
from agentflow_worker import app

UNREACHABLE_BROKER = "amqp://127.0.0.1:1//"


class _FakeTask:
    name = "unit_test_task"


@pytest.fixture()
def base_url():
    """A running health server pointed at a broker that is not there."""
    original_broker = app.conf.broker_url
    app.conf.broker_url = UNREACHABLE_BROKER
    server = health.start(0)  # port 0 -> a free port, so tests never clash
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        health.stop()
        app.conf.broker_url = original_broker


def _get(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def test_metric_families_are_registered():
    names = set(REGISTRY._names_to_collectors)
    assert "agentflow_worker_tasks_total" in names
    assert "agentflow_worker_task_duration_seconds" in names
    assert "agentflow_worker_up" in names


def test_task_signals_feed_the_counters():
    task = _FakeTask()
    before = REGISTRY.get_sample_value(
        "agentflow_worker_tasks_total", {"task": task.name, "status": "success"}
    ) or 0.0

    metrics.on_task_prerun(task_id="test-1", task=task)
    metrics.on_task_postrun(task_id="test-1", task=task, state="SUCCESS")
    metrics.on_task_failure(task_id="test-2", sender=task)
    metrics.on_task_retry(sender=task)

    after = REGISTRY.get_sample_value(
        "agentflow_worker_tasks_total", {"task": task.name, "status": "success"}
    )
    assert after == before + 1
    assert REGISTRY.get_sample_value(
        "agentflow_worker_tasks_total", {"task": task.name, "status": "failure"}
    ) == 1
    assert REGISTRY.get_sample_value(
        "agentflow_worker_tasks_total", {"task": task.name, "status": "retry"}
    ) == 1
    assert REGISTRY.get_sample_value(
        "agentflow_worker_task_duration_seconds_count", {"task": task.name}
    ) == 1


def test_metrics_endpoint_exposes_the_families(base_url):
    status, body = _get(f"{base_url}/metrics")
    text = body.decode()

    assert status == 200
    assert "agentflow_worker_tasks_total" in text
    assert "agentflow_worker_task_duration_seconds" in text
    assert "agentflow_worker_up" in text


def test_healthz_is_503_without_a_broker(base_url):
    status, body = _get(f"{base_url}/healthz")

    assert status == 503
    assert json.loads(body)["status"] == "unavailable"


def test_unknown_path_is_404(base_url):
    status, _ = _get(f"{base_url}/nope")

    assert status == 404
