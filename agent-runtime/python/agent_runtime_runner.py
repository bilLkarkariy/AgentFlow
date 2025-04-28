import os
import json
import asyncio
from celery import Celery
from agents import Agent, Runner

# Configure broker and backend via env vars
broker_url = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
backend_url = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
app = Celery(
    "agent_runtime_runner",
    broker=broker_url,
    backend=backend_url,
)

@app.task(name="agent_runtime_runner.execute_flow")
def execute_flow(prompt: str, parameters: dict = None) -> str:
    """
    Celery task to execute a flow using the OpenAI Agents SDK.
    :param prompt: initial prompt or serialized flow instructions
    :param parameters: optional parameters dict
    :returns: JSON string of final output
    """
    params = parameters or {}
    # Build a simple agent using the prompt as instructions
    agent = Agent(
        name="FlowAgent",
        instructions=prompt,
        tools=[]
    )
    # Run asynchronously via asyncio
    result = asyncio.run(Runner.run(agent, input=prompt, parameters=params))
    output = result.final_output
    # Serialize output
    if hasattr(output, "model_dump_json"):
        return output.model_dump_json()
    return json.dumps(output)
