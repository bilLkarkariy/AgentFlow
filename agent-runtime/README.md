# Agent Runtime

Microservice NestJS pour exécuter un Block « Summarize » via CrewAI (OpenAI).

## Configuration

Copier `.env.example` en `.env` et définir :
```
OPENAI_API_KEY=your_openai_key
MODEL_NAME=o4-mini
PORT=8000
AGENT_LOG_LEVEL=info
```

## Installation

```bash
cd agent-runtime
pnpm install
```

## Lancer en local

```bash
pnpm run start:dev
```

## Docker

```bash
docker build -t agent-runtime .
docker run --rm \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -p 8000:8000 agent-runtime
```

## API REST

**Swagger UI**: http://localhost:8000/api

### POST /run

**Request**
```json
{
  "prompt": "hello world",
  "parameters": {}
}
```

**Response**
```json
{
  "output": [
    { "content": [ { "text": "résumé ou réponse" } ] }
  ]
}
```

## gRPC (streaming)

Service `AgentService.Run` (package `agent`, proto `proto/agent.proto`).

**grpcurl**
```bash
grpcurl -plaintext -d '{"prompt":"hello world"}' localhost:50051 agent.AgentService.Run
```

## Tests

```bash
pnpm test       # unitaires & e2e
pnpm test:e2e
```
