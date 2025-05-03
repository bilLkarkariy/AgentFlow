#!/usr/bin/env python3
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())
import sys, json, asyncio
from agents import Agent, Runner
from openai.types.responses import ResponseTextDeltaEvent

async def main():
    payload = json.loads(sys.stdin.readline())
    agent = Agent(name="Assistant", instructions="Réponds brièvement et poliment.")

    stream = Runner.run_streamed(agent, payload.get("text", ""))
    async for event in stream.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                print(json.dumps({"kind":"chunk","data":event.data.delta}), flush=True)
    print(json.dumps({"kind":"end"}), flush=True)

if __name__ == "__main__":
    asyncio.run(main())
