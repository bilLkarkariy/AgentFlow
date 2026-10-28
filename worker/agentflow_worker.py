import os

import requests
from celery import Celery
from celery._state import get_current_task
from celery.signals import after_setup_logger, after_setup_task_logger

try:  # python-json-logger >= 3.1
    from pythonjsonlogger.json import JsonFormatter
except ImportError:  # pragma: no cover - older python-json-logger
    from pythonjsonlogger.jsonlogger import JsonFormatter

broker_url = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
app = Celery("agentflow", broker=broker_url)

# Imported for their side effects: Prometheus metrics and the /metrics,
# /healthz HTTP endpoint both hook into Celery signals.
import health  # noqa: E402,F401  isort:skip
import metrics  # noqa: E402,F401  isort:skip

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"
LOG_FIELD_NAMES = {"asctime": "timestamp", "levelname": "level", "name": "logger"}


class TaskJsonFormatter(JsonFormatter):
    """JSON log lines, enriched with the current task name and id."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        task = get_current_task()
        if task is not None and getattr(task, "request", None) is not None:
            log_record["task"] = task.name
            log_record["task_id"] = task.request.id


def _use_json_logging(logger):
    if logger is None:
        return
    formatter = TaskJsonFormatter(LOG_FORMAT, rename_fields=LOG_FIELD_NAMES)
    for handler in logger.handlers:
        handler.setFormatter(formatter)


@after_setup_logger.connect
def setup_worker_logging(logger=None, **_kwargs):
    _use_json_logging(logger)


@after_setup_task_logger.connect
def setup_task_logging(logger=None, **_kwargs):
    _use_json_logging(logger)


@app.task
def echo(value: str):
    print(f"Echo: {value}")
    return value


@app.task(name='gmail_send')
def gmail_send_task(run_id: str, node_id: str, to: str, subject: str, body: str):
    """Task to send email via NestJS Gmail endpoint"""
    base = os.getenv('API_URL', 'http://localhost:3000')
    url = f"{base}/oauth/google/nodes/gmail/send"
    payload = {'runId': run_id, 'nodeId': node_id, 'to': to, 'subject': subject, 'body': body}
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()
