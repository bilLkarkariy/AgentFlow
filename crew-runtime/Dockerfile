# Dockerfile for crew-runtime service
FROM python:3.10-slim AS builder
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# generate gRPC Python code
RUN pip install --no-cache-dir grpcio-tools \
    && python -m grpc_tools.protoc -Iproto --python_out=. --grpc_python_out=. proto/agent.proto

FROM python:3.10-slim AS runner
WORKDIR /app
COPY --from=builder /app .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 50051
CMD ["python", "main.py"]
