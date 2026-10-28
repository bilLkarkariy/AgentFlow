# syntax=docker/dockerfile:1.7
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    METRICS_PORT=9100

WORKDIR /app

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --requirement requirements.txt

RUN useradd --system --no-log-init --uid 10001 --gid root worker

COPY __init__.py agentflow_worker.py health.py metrics.py ./

EXPOSE 9100

USER 10001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9100/healthz', timeout=4)"]

CMD ["celery", "-A", "agentflow_worker", "worker", "--loglevel=info", "--pool=threads", "--concurrency=4"]
