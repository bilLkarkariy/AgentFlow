from celery import Celery
import os
import requests

broker_url = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
app = Celery("agentflow", broker=broker_url)

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
