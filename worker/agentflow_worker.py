from celery import Celery
import os

broker_url = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
app = Celery("agentflow", broker=broker_url)

@app.task
def echo(value: str):
    print(f"Echo: {value}")
    return value
