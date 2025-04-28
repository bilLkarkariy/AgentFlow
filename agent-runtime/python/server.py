import grpc
from concurrent import futures
import proto.agent_pb2 as agent_pb2
import proto.agent_pb2_grpc as agent_pb2_grpc
from agents import Agent, Runner

class AgentServiceServicer(agent_pb2_grpc.AgentServiceServicer):
    def __init__(self):
        # Initialize a default agent
        self.agent = Agent(
            name="AgentRuntime",
            instructions="Execute the provided prompt."
        )

    def Run(self, request_iterator, context):
        for request in request_iterator:
            prompt = request.prompt
            # Synchronous execution for simplicity
            result = Runner.run_sync(self.agent, prompt)
            yield agent_pb2.RunResponse(token=result.final_output)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    agent_pb2_grpc.add_AgentServiceServicer_to_server(AgentServiceServicer(), server)
    server.add_insecure_port('[::]:50051')
    print("Agents SDK ready")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
