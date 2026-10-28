"""Prometheus metrics for the AgentFlow Celery worker.

Importing this module registers the Celery signal handlers that keep the
metric families below up to date. The values are exposed over HTTP by
``health.py`` on ``/metrics``.
"""

import threading
import time

from celery.signals import (
    task_failure,
    task_postrun,
    task_prerun,
    task_retry,
    worker_ready,
    worker_shutdown,
)
from prometheus_client import Counter, Gauge, Histogram

TASKS_TOTAL = Counter(
    "agentflow_worker_tasks_total",
    "Celery tasks processed by the worker, by task name and outcome.",
    ["task", "status"],
)

TASK_DURATION_SECONDS = Histogram(
    "agentflow_worker_task_duration_seconds",
    "Celery task execution time in seconds.",
    ["task"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
)

WORKER_UP = Gauge(
    "agentflow_worker_up",
    "1 when the Celery worker is ready to consume tasks, 0 otherwise.",
)
WORKER_UP.set(0)

_UNKNOWN_TASK = "unknown"

# The threads pool runs several tasks concurrently, so guard the start times.
_start_times = {}
_start_times_lock = threading.Lock()


def _task_name(task=None, sender=None):
    """Best-effort task name from whatever a Celery signal hands over."""
    for candidate in (task, sender):
        name = getattr(candidate, "name", None)
        if name:
            return name
        if isinstance(candidate, str) and candidate:
            return candidate
    return _UNKNOWN_TASK


@task_prerun.connect
def on_task_prerun(task_id=None, task=None, sender=None, **_kwargs):
    if task_id is not None:
        with _start_times_lock:
            _start_times[task_id] = time.monotonic()


@task_postrun.connect
def on_task_postrun(task_id=None, task=None, sender=None, state=None, **_kwargs):
    name = _task_name(task, sender)
    with _start_times_lock:
        started = _start_times.pop(task_id, None)
    if started is not None:
        TASK_DURATION_SECONDS.labels(task=name).observe(time.monotonic() - started)
    # Failures and retries are counted by their own signals, which fire first.
    if state == "SUCCESS":
        TASKS_TOTAL.labels(task=name, status="success").inc()


@task_failure.connect
def on_task_failure(task_id=None, sender=None, **_kwargs):
    TASKS_TOTAL.labels(task=_task_name(sender=sender), status="failure").inc()


@task_retry.connect
def on_task_retry(sender=None, **_kwargs):
    TASKS_TOTAL.labels(task=_task_name(sender=sender), status="retry").inc()


@worker_ready.connect
def on_worker_ready(**_kwargs):
    WORKER_UP.set(1)


@worker_shutdown.connect
def on_worker_shutdown(**_kwargs):
    WORKER_UP.set(0)
