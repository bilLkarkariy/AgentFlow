# AgentFlow Monorepo

AgentFlow is a TypeScript-based pnpm monorepo managing multiple workspaces:
- **api**: NestJS REST API (Slack, Pennylane, Xero OAuth, Stripe, Quonto, Agents)
- **agent-runtime**: NestJS microservice for Agent Block execution (REST & gRPC) with OpenTelemetry
- **web/studio**: React low-code studio (Vite, ReactFlow, Zustand, TailwindCSS, Storybook, Playwright, Vitest)
- **web/dashboard**: React metrics dashboard (Chart.js via react-chartjs-2) with Vite & Cypress
- **worker**: Background queue processors using BullMQ
- **infra**: Infrastructure scripts (docker-compose, Terraform, Prometheus & Grafana dashboards)

## Tech Stack

**Core**: Node.js, TypeScript, pnpm workspaces, GitHub Actions CI, ESLint, Prettier, Husky

**Backend**: NestJS, axios, socket.io, TypeORM, PostgreSQL/SQLite, BullMQ, OpenTelemetry SDK & OTLP exporters, prom-client, Jest & Supertest

**Frontend (web/studio)**: React 18, Vite, Zustand, ReactFlow, TailwindCSS, Storybook, Playwright, Vitest

**Frontend (web/dashboard)**: React 18, Vite, Chart.js (react-chartjs-2), Cypress

**Worker & Infra**: NestJS workers, BullMQ, docker-compose, Terraform, Prometheus & Grafana

## Services & Interactions

### API
- Built with NestJS, provides REST and WebSocket endpoints (e.g., /oauth/xero, /agents/run, /metrics).
- Modules: Slack, Pennylane, Xero OAuth, Stripe, Quonto, Agents.
- Uses axios for external calls and TypeORM for database operations.
- Sends Agent execution requests to agent-runtime (/run) and streams logs to web/studio.
- Enqueues background tasks to worker via BullMQ (Redis broker).

### Agent Runtime
- NestJS microservice exposing HTTP REST (/run) and gRPC endpoints.
- Executes prompts via OpenAI, streams token-level logs over WebSocket.
- Instrumented with OpenTelemetry, exports traces to OTLP (Tempo).

### Worker
- Processes background jobs enqueued by API using BullMQ.
- BullMQ leverages Redis for job queues, retries, backoff, and dead-letter queues.
- Tasks include customer invoicing (Pennylane, Quonto), Slack notifications, Xero invoice sync.

### web/studio
- React low-code studio (Vite, ReactFlow) with Zustand for state and TailwindCSS for styling.
- Provides UI to compose flows with Agent Block nodes.
- Calls API and listens to WebSocket logs from agent-runtime.
- Components developed in Storybook; tested with Playwright (E2E) and Vitest (unit).

### web/dashboard
- React-based metrics dashboard (Vite, Chart.js via react-chartjs-2).
- Fetches metrics from API’s /metrics endpoints (prom-client).
- Visualizes usage and cost data; tests with Cypress.

### Infra
- Docker Compose for local dev: Postgres, Redis, API, agent-runtime, worker, Tempo, Prometheus, Grafana.
- Terraform manifests for production infrastructure.
- Prometheus scrapes metrics; Grafana dashboards visualize them.

## CI pour agent-runtime
La CI dédiée au microservice `agent-runtime` est définie dans `.github/workflows/ci-agent-runtime.yml`. Elle :
- Build & test le service NestJS (`pnpm --filter agent-runtime run build && test`)
- Builde et push l'image Docker sur GHCR
- Démarre la stack CI (`docker-compose -f docker-compose.ci.yml up -d`)
- Vérifie que l'endpoint `/metrics` retourne HTTP 200 et `text/plain`

## Observabilité (agent-runtime)
Pour démarrer la stack d’observabilité :
```bash
docker-compose -f docker-compose.observability.yml up -d
```
- **OTel Collector** (gRPC 4317, HTTP 4318)
- **Prometheus** (UI : http://localhost:9090)
- **Grafana** (UI : http://localhost:3000, user `admin`, pwd `secret`)
- **agent-runtime** exposant `/metrics` sur le port 8000

Consulter les métriques Prometheus : http://localhost:9090/targets et scrape `/metrics`.
Consulter Grafana pour vos dashboards.

## Getting Started

```bash
pnpm install
pnpm --filter api run start:dev # API
pnpm --filter agent-runtime run start:dev # Agent runtime
pnpm --filter web/studio run dev # Studio
pnpm --filter web/dashboard run dev # Dashboard
```

## Xero OAuth Integration

### Routes

- **GET** `/oauth/xero/authorize` : redirige vers la page d'autorisation Xero.
- **GET** `/oauth/xero/callback` : callback pour échanger le code contre des tokens.
- **GET** `/oauth/xero/refresh?tenantId=<tenantId>` : rafraîchit le token d'accès pour le tenant spécifié.
- **GET** `/xero/invoices?tenantId=<tenantId>` : liste les factures Xero du tenant.
- **POST** `/xero/invoices?tenantId=<tenantId>` : crée une nouvelle facture.

## Environment Variables

Ensure your `.env` file includes:
```dotenv
POSTGRES_URL=postgres://...
REDIS_HOST=localhost
REDIS_PORT=6379

# Xero OAuth
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=http://localhost:3000/oauth/xero/callback
XERO_SCOPES="openid profile email accounting.transactions accounting.settings offline_access"
XERO_BASE_URL=https://api.xero.com/api.xro/2.0

# Slack Connector
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...

# Pennylane Connector
PENNYLANE_API_TOKEN=...
PENNYLANE_CLIENT_SECRET=...

# Quonto Connector
QUONTO_CLIENT_ID=...
QUONTO_CLIENT_SECRET=...
QUONTO_REDIRECT_URI=http://localhost:3000/oauth/quonto/callback
```

## Available Routes

### Xero
- GET `/oauth/xero/authorize`: Redirect to Xero authorization page.
- GET `/oauth/xero/callback`: OAuth callback to exchange code for tokens and persist them.
- GET `/oauth/xero/refresh?tenantId=<tenantId>`: Refresh access token for specified tenant.
- GET `/xero/invoices?tenantId=<tenantId>`: List invoices for the tenant.
- POST `/xero/invoices?tenantId=<tenantId>`: Create a new invoice.

### (Slack, Pennylane, Quonto routes coming soon)

## Documentation

Refer to `docs/xero.md`, `docs/slack.md`, `docs/pennylane.md`, and `docs/quonto.md` for connector-specific guides.
