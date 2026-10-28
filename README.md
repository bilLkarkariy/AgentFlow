# AgentFlow

[![CI](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/ci.yml)
[![Build & Publish Images](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/build-images.yml/badge.svg?branch=main)](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/build-images.yml)
[![Deploy Validation](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/deploy-validate.yml/badge.svg?branch=main)](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/deploy-validate.yml)
[![Terraform CI](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/terraform-ci.yml/badge.svg?branch=main)](https://github.com/bilLkarkariy/AgentFlow/actions/workflows/terraform-ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

AgentFlow is a monorepo for designing, running and observing LLM agent
workflows. It contains:

- the application: a NestJS API that runs multi-agent flows through the
  OpenAI Agents SDK, a React workflow studio, an operations dashboard and a
  Python worker;
- the platform it runs on, from the same repository: Helm charts, Argo CD
  GitOps, and Terraform for a local kind cluster or an ephemeral AWS EKS
  environment, observed with OpenTelemetry, Prometheus and Grafana.

## Contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start (Docker Compose)](#quick-start-docker-compose)
- [Development from source](#development-from-source)
- [Tests](#tests)
- [Kubernetes platform on your laptop (kind)](#kubernetes-platform-on-your-laptop-kind)
- [Ephemeral AWS EKS demo](#ephemeral-aws-eks-demo)
- [Observability](#observability)
- [CI/CD](#cicd)
- [Project status](#project-status)
- [Documentation](#documentation)
- [License](#license)

## Architecture

```mermaid
flowchart LR
    Studio["Studio<br/>React Flow editor"]
    Dashboard["Dashboard<br/>ROI and DLQ views"]

    subgraph apiContainer["api container"]
        Nest["NestJS API<br/>REST, SSE, Socket.IO"]
        Runner["Python flow runners<br/>OpenAI Agents SDK"]
    end

    Postgres[("PostgreSQL")]
    Redis[("Redis<br/>BullMQ")]
    RabbitMQ[("RabbitMQ")]
    Worker["Celery worker<br/>Python"]
    OpenAI["OpenAI API"]
    SaaS["Gmail, Slack, HubSpot<br/>Xero, Stripe<br/>Pennylane, Qonto"]

    Studio --> Nest
    Dashboard --> Nest
    Nest --> Postgres
    Nest <--> Redis
    Nest <--> RabbitMQ
    Nest -- "JSON lines over stdin / stdout" --> Runner
    Runner --> OpenAI
    Runner -- "backend tools" --> Nest
    RabbitMQ -- "gmail_send" --> Worker
    Worker -- "HTTP callback" --> Nest
    Nest --> SaaS
```

How a flow runs:

- The studio stores a flow as a graph of nodes and edges
  (`PUT /agents/:id/flow`). The API turns every node into an agent and
  every edge into a handoff, and validates the payload with Zod
  (`api/src/common/schemas/flow-payload.zod.ts`).
- The payload goes to a pool of `api/python/flow_runner.py` processes that
  the API spawns: 2 warm, 10 at most. The runner drives
  `Runner.run_streamed` from the OpenAI Agents SDK and streams JSON chunks
  back. On the Node side the call has a timeout and a circuit breaker.
- A flow can run:
  - synchronously, streamed as Server-Sent Events:
    `POST /agents/:id/flow/run` with the flow in the body, or
    `GET /agents/:id/flow/execute` for the stored flow;
  - asynchronously through RabbitMQ: `POST /agents/:id/flow/runs`
    publishes `flow.run`, and the API consumes the `agentflow.flow-run`
    queue, then stores the streamed output with token and cost statistics.
- Agents can call back into the API through backend tools
  (`POST /internal/tools/:toolId`).
- BullMQ queues on Redis carry the background jobs that run inside the API:
  `agent-run` (3 attempts with exponential backoff, logs pushed over
  Socket.IO), Slack alerts on 5xx responses, HubSpot webhook events and
  Gmail jobs.
- The Celery worker consumes RabbitMQ. It runs asynchronous Gmail sends
  (`gmail_send`), which call back into the API, and exposes Prometheus
  metrics and a health check on port 9100.

## Tech stack

| Layer | Technologies |
|---|---|
| API | NestJS 11, TypeScript, TypeORM (PostgreSQL; in-memory SQLite in tests), BullMQ, amqplib, Socket.IO, Swagger, Zod |
| Agents | Python 3.12, OpenAI Agents SDK, run as child processes of the API |
| Worker | Celery 5 on RabbitMQ, prometheus-client |
| Frontends | React 18, Vite, React Flow, TanStack Query, Zustand, Tailwind CSS, Chart.js |
| Data and messaging | PostgreSQL 16, Redis 7, RabbitMQ 3 |
| Observability | OpenTelemetry, Prometheus (prom-client), pino JSON logs, Grafana, Loki, Tempo, Alloy |
| Platform | Kubernetes 1.34 (kind, EKS), Argo CD 3.5, Helm, Istio 1.30, Argo Rollouts, Kyverno, External Secrets, cert-manager, CloudNativePG |
| Infrastructure as code | Terraform (S3 backend with native locking, GitHub OIDC), AWS EKS, RDS, IRSA |
| Delivery | GitHub Actions, GHCR, multi-arch images (amd64/arm64), Trivy, cosign, SPDX SBOM, Dependabot |
| Tests | Jest, Vitest, Testing Library, Supertest, pytest |

## Repository layout

```text
api/              NestJS API, TypeORM migrations, unit and e2e tests
api/python/       Python flow runners (OpenAI Agents SDK), spawned by the API
worker/           Celery worker (Gmail sends), Prometheus metrics, health check
web/studio/       Workflow editor (React Flow), French UI
web/dashboard/    ROI dashboard and dead-letter queue console
deploy/           GitOps tree: Argo CD applications, platform components, Helm charts, per-environment values
infra/            Terraform: bootstrap (state, budgets, OIDC), envs/local (kind), envs/aws-demo (EKS)
scripts/, mk/     Lifecycle scripts behind the make targets
docs/             Operations runbooks, ADRs, RFC, working notes
```

## Quick start (Docker Compose)

Requirements: Docker with Compose v2.

```bash
git clone https://github.com/bilLkarkariy/AgentFlow.git
cd AgentFlow
```

```bash
docker compose up -d --build
```

This builds the four images and starts PostgreSQL, Redis and RabbitMQ.
A one-shot `migrate` container applies the TypeORM migrations, and then
the API, the worker, the studio and the dashboard start. To run agents,
export `OPENAI_API_KEY` before `docker compose up`; the API passes it on to
the Python runners.

| Service | URL |
|---|---|
| Studio | http://localhost:5174 |
| Dashboard | http://localhost:5173 |
| API, Swagger UI | http://localhost:3000/api |
| API readiness (PostgreSQL, Redis, RabbitMQ) | http://localhost:3000/health/ready |
| API metrics | http://localhost:3000/metrics |
| Bull Board | http://localhost:3000/admin/queues |
| RabbitMQ management (`guest` / `guest`) | http://localhost:15672 |
| Worker metrics and health | http://localhost:9100/metrics, http://localhost:9100/healthz |

PostgreSQL listens on `localhost:5433`. Stop the stack and delete its
volumes with:

```bash
docker compose down -v
```

## Development from source

Requirements: Node.js 24 or later, pnpm 8 (`corepack enable` picks up the
version pinned in `package.json`; Node.js 25 and later no longer bundle
Corepack, so run `npm install -g corepack` first), Python 3.12, Docker.

Start the backing services and install the dependencies:

```bash
pnpm install
docker compose up -d postgres redis rabbitmq
python3 -m venv .venv
.venv/bin/pip install -r api/python/requirements.txt
```

Configure the API. `PYTHON_BIN` and `PYTHON_SCRIPTS_DIR` tell it where the
flow runners are; the container image sets them for you.

```bash
export POSTGRES_URL=postgres://postgres:postgres@localhost:5433/postgres
export REDIS_HOST=localhost REDIS_PORT=6379
export PYTHON_BIN=$PWD/.venv/bin/python PYTHON_SCRIPTS_DIR=$PWD/api/python
export OTEL_SDK_DISABLED=true   # or OTEL_EXPORTER_OTLP_ENDPOINT=http://<collector>:4318
export OPENAI_API_KEY=sk-...    # only needed to run agents
```

Apply the migrations, then start each app in its own terminal:

```bash
pnpm --filter @agentflow/api run migration:run
```

```bash
pnpm --filter @agentflow/api run start:dev    # http://localhost:3000
```

```bash
pnpm --filter studio run dev                  # http://localhost:5174
```

```bash
pnpm --filter dashboard run dev               # http://localhost:5173
```

The worker is a Celery app; run it from its own virtualenv:

```bash
cd worker
pip install -r requirements.txt
celery -A agentflow_worker worker --pool=threads --concurrency=4
```

The other API settings (OAuth clients for Google, Xero and HubSpot,
connector tokens, Stripe keys) are read from the environment or from a
`.env` file. See [`.env.example`](.env.example).

## Tests

These are the checks CI runs.

```bash
pnpm lint
pnpm --filter @agentflow/api run build
pnpm --filter studio run build
pnpm --filter dashboard run build
```

```bash
pnpm --filter @agentflow/api run test:unit
pnpm --filter studio run test:unit
pnpm --filter dashboard run test:unit
```

The API end-to-end suite boots the Nest application with Supertest. Most
suites use an in-memory SQLite database. The flow streaming suite needs a
real PostgreSQL database that it can drop, and the queues need Redis.

```bash
docker compose up -d postgres redis rabbitmq
docker compose exec -T postgres createdb -U postgres agentflow_test
REDIS_HOST=localhost REDIS_PORT=6379 pnpm --filter @agentflow/api run test:e2e --runInBand
```

The Stripe, Slack, Qonto and Pennylane suites call the real third-party
APIs. They are skipped unless their credentials (`STRIPE_SECRET_KEY`,
`SLACK_BOT_TOKEN`, `QUONTO_CLIENT_ID` and `QUONTO_CLIENT_SECRET`,
`PENNYLANE_API_TOKEN`) are set.

The two Python suites run in separate virtualenvs, as in CI:

```bash
cd api/python
pip install -r requirements-dev.txt
OPENAI_API_KEY=dummy pytest -q
```

```bash
cd worker
pip install -r requirements-dev.txt
pytest -q
```

## Kubernetes platform on your laptop (kind)

The whole platform runs on a kind cluster. Terraform creates the cluster
and installs Argo CD; Argo CD installs everything else from `deploy/`.

Requirements: Docker with at least 9 GiB of memory for its VM (10 GiB and
6 CPUs recommended), plus kind, kubectl, helm, kustomize, istioctl,
terraform and yq. `make check-tools` checks all of this, and `make help`
lists every target.

```bash
make local-up       # kind cluster + Argo CD, then waits for every Application (about 15 min on a cold cache)
make local-ui       # prints the URLs and the credentials
make local-status   # nodes, Argo CD Applications, pods that are not Running
make local-down     # destroys the cluster
```

What `make local-up` does:

1. Terraform (`infra/envs/local`) creates the kind cluster (one control
   plane, one worker, ports 80 and 443 on 127.0.0.1). It installs Argo CD
   with Helm, plus a single root Application.
2. The root Application renders `deploy/platform/bootstrap`. That is an
   app-of-apps that installs the platform in sync waves: cert-manager,
   Istio, Argo Rollouts, kube-prometheus-stack, Loki, Alloy, Tempo, the
   OpenTelemetry Collector, Kiali, Kyverno, External Secrets and network
   policies.
3. The last wave deploys the application from `deploy/argocd/envs/local`:
   - the `agentflow-infra` chart: a CloudNativePG PostgreSQL cluster,
     Redis and RabbitMQ;
   - an ApplicationSet that deploys the api, worker, studio and dashboard
     with the golden-path chart `agentflow-service`.

The images come from GHCR, at the tag CI last wrote into
`deploy/envs/local`. `make local-images` builds the images from your
working tree and loads them into kind instead.

The UIs are served through the Istio gateway on `*.127.0.0.1.sslip.io`:
Argo CD (`admin` / `admin`), Grafana, Kiali, Argo Rollouts, Prometheus,
Alertmanager, the studio, the dashboard and the API.

| Concern | Implementation | Where |
|---|---|---|
| GitOps | Argo CD: root Application, app-of-apps with sync waves, ApplicationSet for the services | `deploy/argocd`, `deploy/platform/bootstrap` |
| Packaging | `agentflow-service`: one chart for the four services, with a Deployment or Rollout, HPA, PDB, Istio routing and a pre-sync migration job. `agentflow-infra`: PostgreSQL, Redis, RabbitMQ | `deploy/charts` |
| Service mesh | Istio sidecars with STRICT mTLS, Kiali | `deploy/platform/istio`, `deploy/platform/kiali` |
| Progressive delivery | Argo Rollouts canary at 10 / 50 / 100 %. On the api, a Prometheus AnalysisRun requires a success rate of at least 95 % and a p95 under 1 s | `deploy/platform/argo-rollouts`, `deploy/envs/base/api.yaml` |
| Policy | Kyverno: no `latest` tag, non-root, resource limits, cosign signature verification (Audit on kind, Enforce on EKS) | `deploy/platform/kyverno` |
| Secrets | External Secrets Operator: AWS Secrets Manager through IRSA on EKS, an in-cluster secret store on kind | `deploy/platform/external-secrets` |
| TLS and DNS | cert-manager with a private CA, `sslip.io` hostnames | `deploy/platform/cert-manager` |
| Versions | Kubernetes, Argo CD and every platform chart are pinned in one file | `deploy/versions.yaml` |

`make demo-break` shows a canary being rolled back automatically. It
commits an api release with `CHAOS_ERROR_RATE=0.3`; the analysis fails and
the rollout aborts. `make demo-fix` removes the fault. Both targets commit
and push to Git, because Git is the only way to change the cluster.

## Ephemeral AWS EKS demo

The same platform runs on AWS for the length of a demo session. Run
`make aws-up` to create it, `make aws-down` when you are done, and let the
cost guard catch anything left running.

| Stack | What it creates |
|---|---|
| `infra/bootstrap` (once per account) | S3 state bucket (versioned, native locking), AWS Budgets (15 USD a month, 3 USD a day), Cost Anomaly Detection, the GitHub OIDC role, the Secrets Manager entries for the app |
| `infra/envs/aws-demo` (per session, `eu-west-1`) | VPC with public subnets and no NAT gateway; EKS 1.34 with a node group of 2 Graviton spot instances; RDS PostgreSQL 16 (`db.t4g.micro`); IRSA roles; two Elastic IPs for the load balancer; Argo CD |

```bash
make aws-bootstrap ALERT_EMAIL=you@example.com   # once per account
make aws-up             # about 25 min, about 0.24 USD per hour
make aws-ui             # port-forwards Argo CD, Grafana and Kiali, prints the credentials
make aws-down           # destroys everything, then audits the account
make aws-check-clean    # exits 1 if anything that costs money is still there
make aws-cost           # month-to-date cost of the Project=agentflow tag, plus the current session
```

The same lifecycle is available from GitHub Actions, as three manually
started workflows:

- **AWS up** and **AWS down** run in the `aws-demo` GitHub environment.
  They authenticate with OIDC through the repository variable
  `AWS_ROLE_ARN`, so no AWS key is stored.
- **Promote to AWS** needs no AWS access. It opens a pull request that
  moves `deploy/envs/aws` to the image tag running locally.

**Cost guard.** `.github/workflows/aws-guard.yml` runs every 6 hours. The
run fails, and GitHub sends a failure email, when an EKS cluster, an EC2
instance, a load balancer or an RDS instance is still running. Started by hand with
`auto_destroy=true`, it tears the environment down. Without `AWS_ROLE_ARN`,
for example in a fork or with no AWS account attached, the job is skipped.

[`docs/ops/cost.md`](docs/ops/cost.md) breaks the hourly cost down, and
[`docs/ops/runbook-aws.md`](docs/ops/runbook-aws.md) covers the recovery
paths.

## Observability

**In the application code:**

- The API starts the OpenTelemetry Node SDK before Nest
  (`api/src/otel-sdk.ts`). Auto-instrumentation produces traces, which are
  exported over OTLP/HTTP; `/health` and `/metrics` are not traced.
- `GET /metrics` exposes Prometheus metrics: agent runs and their duration,
  LLM tokens and estimated cost (from `api/src/pricing.json`), BullMQ queue
  depth, Python runner failures and circuit-breaker state, and build info.
- Logs are pino JSON lines with the request id and the trace and span ids.
- The worker exposes its own task counters and durations on `:9100/metrics`.

**On the cluster:**

- Prometheus scrapes the annotated pods and the Istio telemetry.
- The OpenTelemetry Collector forwards traces to Tempo, and Alloy ships
  logs to Loki.
- Grafana links the three: from a log line to its trace, and from a trace
  to its logs and metrics.
- Dashboards shipped in Git: *AgentFlow / Overview*, *AgentFlow / LLM costs*
  and *AgentFlow / Canary*, plus the Argo Rollouts, Istio and Argo CD
  dashboards.
- Alert rules: daily LLM spend above 5 USD, agent run failure ratio, queue
  backlog, API error rate and p95 latency, an open runner circuit breaker,
  and the worker being down.

## CI/CD

| Workflow | Runs on | What it checks or does |
|---|---|---|
| [CI](.github/workflows/ci.yml) | pushes and pull requests touching application code | Lint; build the api, studio and dashboard; unit tests (api, studio, dashboard); api e2e tests against PostgreSQL, Redis and RabbitMQ; pytest for `api/python` and `worker` |
| [Build & Publish Images](.github/workflows/build-images.yml) | the same, for image inputs | Build the four images for amd64 and arm64. On `main` it also: pushes a multi-arch image to GHCR, runs a Trivy scan that blocks on CRITICAL, signs with cosign (keyless), attaches an SPDX SBOM attestation, then commits the new tag to `deploy/envs/local` for Argo CD |
| [Deploy Validation](.github/workflows/deploy-validate.yml) | changes under `deploy/` | `helm lint`; `kubeconform` on every rendered manifest; `kyverno test`; `promtool`; `istioctl analyze` |
| [Terraform CI](.github/workflows/terraform-ci.yml) | changes under `infra/` and to the AWS scripts | `terraform fmt` and `validate`; `tflint`; Trivy config scan; `shellcheck` and `actionlint`; a dry run of `aws-up` and `aws-down` |
| AWS up / AWS down / Promote to AWS | manual | See [Ephemeral AWS EKS demo](#ephemeral-aws-eks-demo) |
| [AWS guard](.github/workflows/aws-guard.yml) | every 6 hours | Cost guard |

Dependabot opens grouped weekly pull requests for minor and patch updates
(npm, pip, Docker base images, GitHub Actions, Terraform). Major versions
are ignored: they are migrations, done on purpose in their own pull request.

## Project status

AgentFlow is a portfolio project. The platform and the delivery chain are
complete: CI validates every manifest and Terraform stack, and builds,
scans and signs the images. Unit and end-to-end tests cover the API core.
Parts of the product surface are still prototypes:

- Several studio pages (billing, team, workspace settings, marketplace,
  help) are placeholders.
- Some integrations are partial: the Stripe webhook handler, the Gmail
  fetch processor and the generic webhook trigger stop at a `TODO` or have
  no consumer.
- The studio ships Storybook stories, but no Storybook configuration.

## Documentation

- [`docs/ops/README.md`](docs/ops/README.md): operations hub, with the
  runbooks (kind, AWS), cost, security and a 10-minute demo script
- [`docs/adr/README.md`](docs/adr/README.md): ten architecture decision
  records, each with the alternatives considered
- [`deploy/README.md`](deploy/README.md) and
  [`infra/README.md`](infra/README.md): the GitOps tree and the Terraform
  stacks
- [`docs/flow-payload.schema.json`](docs/flow-payload.schema.json): JSON
  Schema of the payload sent to the flow runners
- [`docs/rfc/agent_dsl_rfc.md`](docs/rfc/agent_dsl_rfc.md): early RFC for
  the trigger/action DSL behind `POST /agents/from-prompt` (in French)
- [`docs/notes/`](docs/notes/README.md): working notes kept from the build
  (product requirements, design notes)

## License

[MIT](LICENSE) © 2025-2026 Billel Helali
