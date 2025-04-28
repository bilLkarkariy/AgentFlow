import os
import asyncio
from concurrent import futures

import grpc
from agents import Agent, Runner
from pydantic import BaseModel

import proto.agent_pb2 as agent_pb2
import proto.agent_pb2_grpc as agent_pb2_grpc

PORT = int(os.getenv("AGENT_SDK_PORT", 50052))


class SummarizeOutput(BaseModel):
    summary: str


class AgentService(agent_pb2_grpc.AgentServiceServicer):
    def __init__(self):
        self.summarizer = Agent(
            name="Summarizer",
            instructions="Return JSON with key 'summary' that summarizes the given text in max 3 sentences.",
            output_type=SummarizeOutput,
        )

    async def _async_run(self, prompt: str):
        result = await Runner.run(self.summarizer, input=prompt)
        return result.final_output.model_dump_json()

    def Run(self, request_iterator, context):  # noqa: N802 (gRPC naming)
        async def handle(prompt):
            return await self._async_run(prompt)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        prompt = None
        for req in request_iterator:
            if prompt is None:
                prompt = req.prompt
        if prompt is None:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Prompt missing")
            return
        try:
            output_json = loop.run_until_complete(handle(prompt))
            for token in output_json.split():
                yield agent_pb2.RunResponse(token=token)
        finally:
            loop.close()


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    agent_pb2_grpc.add_AgentServiceServicer_to_server(AgentService(), server)
    server.add_insecure_port(f"[::]:{PORT}")
    server.start()
    print(f"Agent bridge gRPC server running on :{PORT}")
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
