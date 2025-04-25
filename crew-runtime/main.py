import os
import grpc
from concurrent import futures
import agent_pb2
import agent_pb2_grpc
from openai import OpenAI

class AgentService(agent_pb2_grpc.AgentServiceServicer):
    def Run(self, request_iterator, context):
        client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        prompt = None
        for req in request_iterator:
            if prompt is None:
                prompt = req.prompt
        # call OpenAI chat
        completion = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'o4-mini-2025-04-16'),
            messages=[{'role': 'user', 'content': prompt}],
            max_completion_tokens=256,
        )
        summary = completion.choices[0].message.content
        # stream tokens
        for token in summary.split():
            yield agent_pb2.RunResponse(token=token)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    agent_pb2_grpc.add_AgentServiceServicer_to_server(AgentService(), server)
    port = os.getenv('CREW_GRPC_PORT', '50051')
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    print(f'Crew runtime gRPC listening on {port}')
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
