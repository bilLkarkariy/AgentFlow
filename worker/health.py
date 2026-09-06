"""Metrics and health HTTP endpoint for the AgentFlow Celery worker.

Celery workers have no HTTP server of their own, so a small threaded
``http.server`` is started on ``METRICS_PORT`` (9100 by default) when the
worker becomes ready. It serves:

* ``GET /metrics``  -> Prometheus exposition of the families in ``metrics.py``
* ``GET /healthz``  -> 200 when the broker answers, 503 otherwise
"""

import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from celery.signals import worker_ready, worker_shutdown
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

logger = logging.getLogger(__name__)

DEFAULT_METRICS_PORT = 9100
BIND_HOST = "0.0.0.0"  # noqa: S104 - the container needs to be reachable

_server = None
_server_lock = threading.Lock()


def _celery_app():
    # Imported lazily: agentflow_worker imports this module at load time.
    from agentflow_worker import app

    return app


def broker_reachable():
    """Return True when the Celery broker accepts a connection."""
    try:
        with _celery_app().connection() as connection:
            connection.ensure_connection(max_retries=1)
        return True
    except Exception as exc:  # noqa: BLE001 - any failure means "not ready"
        logger.warning("broker health check failed: %s", exc)
        return False


class _RequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "agentflow-worker"

    def do_GET(self):  # noqa: N802 - http.server API
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path == "/metrics":
            self._respond(200, CONTENT_TYPE_LATEST, generate_latest())
        elif path == "/healthz":
            healthy = broker_reachable()
            body = json.dumps(
                {"status": "ok" if healthy else "unavailable", "broker": healthy}
            ).encode()
            self._respond(200 if healthy else 503, "application/json", body)
        else:
            self._respond(404, "text/plain; charset=utf-8", b"not found\n")

    def _respond(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # noqa: A002 - http.server API
        logger.debug("health server: %s", fmt % args)


def start(port=None):
    """Start the metrics/health server in a daemon thread and return it.

    Calling it twice is a no-op: the already running server is returned.
    """
    global _server
    with _server_lock:
        if _server is not None:
            return _server
        if port is None:
            port = int(os.getenv("METRICS_PORT", DEFAULT_METRICS_PORT))
        server = ThreadingHTTPServer((BIND_HOST, int(port)), _RequestHandler)
        server.daemon_threads = True
        threading.Thread(
            target=server.serve_forever,
            name="agentflow-worker-health",
            daemon=True,
        ).start()
        _server = server
        logger.info(
            "metrics and health server listening on %s:%s",
            BIND_HOST,
            server.server_address[1],
        )
        return server


def stop():
    """Shut the server down. Mainly useful for tests."""
    global _server
    with _server_lock:
        server = _server
        _server = None
    if server is not None:
        server.shutdown()
        server.server_close()


@worker_ready.connect
def on_worker_ready(**_kwargs):
    # Never let a port clash take the worker down: it still consumes tasks.
    try:
        start()
    except OSError as exc:
        logger.error("could not start the metrics and health server: %s", exc)


@worker_shutdown.connect
def on_worker_shutdown(**_kwargs):
    stop()
