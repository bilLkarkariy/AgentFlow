# AgentFlow API (NestJS)

Skeleton NestJS REST API — created in Sprint 0.

## Environment variables
- `POSTGRES_URL`: database URL for tests (E2E)
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_TRACE_API_KEY`: (optional) OTEL trace exporter key
- `AGENT_TIMEOUT_MS`: agent execution timeout (ms, default 30000)

## Usage
1. Install & dev server
```bash
pnpm install
pnpm run start:dev
```
2. Execute a flow (SSE)
```bash
curl -N -H "Content-Type: application/json" \
  "http://localhost:3000/agents/{id}/flow/run?input=Hello" \
  -d '{"nodes":[...],"edges":[...],"mappings":[]}'
```
3. Swagger UI: `http://localhost:3000/api`

## Microservice Agent Runtime

Pour la documentation du micro-service Agent Runtime :
- README : [agent-runtime/README.md](../agent-runtime/README.md)
- Swagger UI : [http://localhost:8000/api](http://localhost:8000/api)
