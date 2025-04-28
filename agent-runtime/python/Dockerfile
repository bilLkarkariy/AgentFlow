# Dockerfile for Python Celery runner
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY agent_runtime_runner.py ./

# Environment variables (can be overridden via .env or docker-compose)
ENV CELERY_BROKER_URL="${CELERY_BROKER_URL:-amqp://guest:guest@localhost:5672//}"
ENV CELERY_RESULT_BACKEND="${CELERY_RESULT_BACKEND:-redis://localhost:6379/0}"

# Default command: start Celery worker
CMD ["celery", "-A", "agent_runtime_runner", "worker", "--loglevel=info"]
