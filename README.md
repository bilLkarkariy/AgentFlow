# AgentFlow

AgentFlow is a fullstack monorepo for building, running, and observing agentic workflows in production.

## What it does

- Compose and run agent workflows
- Execute flows via API/runtime services
- Monitor usage, execution logs, and operational metrics
- Connect business systems (OAuth/integrations)

## Monorepo structure

- `api/`: NestJS API (REST/WebSocket, integrations, orchestration)
- `agent-runtime/`: execution runtime service (REST + gRPC)
- `web/studio/`: flow editor and operator UI
- `web/dashboard/`: metrics and analytics dashboard
- `worker/`: async background processing
- `infra/`: local/dev infrastructure definitions

## Tech stack

- TypeScript, Node.js, pnpm workspaces
- NestJS, BullMQ, PostgreSQL/SQLite
- React + Vite (studio/dashboard)
- OpenTelemetry + Prometheus/Grafana
- Jest/Vitest/Playwright/Cypress testing

## Security and compliance notes

- Secrets are injected through environment variables.
- Terraform state, local kube configs, and private keys must never be versioned.
- All historical state artifacts were removed from this publicized history.

## Quick start

```bash
pnpm install
pnpm --filter api run start:dev
pnpm --filter agent-runtime run start:dev
pnpm --filter web/studio run dev
```

## Testing

```bash
pnpm --filter api run test
pnpm --filter web/studio run test
pnpm --filter web/dashboard run test
```

## Status

Public technical showcase repository focused on architecture, reliability, and production-ready agent workflow patterns.
