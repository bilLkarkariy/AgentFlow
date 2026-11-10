# AGENTS.md

How to work in this repository. Written for coding agents; it is also the
shortest onboarding for a person.

Parts of this repository, the platform layer in particular, were built
with coding agents working on scoped tasks: one owner per set of files,
shared contracts, and verification commands that have to pass.
[`.claude/agents/ops-implementer.md`](.claude/agents/ops-implementer.md) is
the sub-agent definition used for the platform tasks. The rules below are
what keeps that way of working honest.

## Layout

| Path | What it is |
|---|---|
| `api/` | NestJS API (TypeScript), TypeORM migrations, Jest unit and e2e tests |
| `api/python/` | `flow_runner.py`, the Python agent runner the API spawns, and its pytest suite |
| `web/studio/`, `web/dashboard/` | React + Vite front ends |
| `worker/` | Celery worker (Python), its own virtualenv and pytest suite |
| `deploy/` | Helm charts, per-environment values, Argo CD applications, platform catalogue |
| `infra/` | Terraform: kind (local), EKS demo, account bootstrap |
| `docs/ops/` | Runbooks and [`architecture.md`](docs/ops/architecture.md), whose section 4 holds the contracts shared by every part (names, ports, probes, secrets, environment) |
| `docs/adr/` | Architecture decision records |

## Setup

Node 24 and pnpm 8.15 (see `packageManager`), Python 3.12, Docker.

```bash
pnpm install --frozen-lockfile
python3.12 -m venv api/python/.venv
api/python/.venv/bin/pip install -r api/python/requirements-dev.txt
docker compose up -d postgres redis rabbitmq
docker compose exec -T postgres createdb -U postgres agentflow_test
```

## Checks to run before you say a change is done

```bash
pnpm lint
pnpm typecheck
pnpm --filter @agentflow/api run build
pnpm --filter @agentflow/api run test:unit
REDIS_HOST=localhost REDIS_PORT=6379 pnpm --filter @agentflow/api run test:e2e --runInBand
(cd api/python && .venv/bin/pytest -q)
pnpm --filter studio run test:unit
pnpm --filter dashboard run test:unit
```

For a change under `deploy/` or `infra/`: `make lint-deploy`, and
`terraform fmt -check` / `terraform validate` in the stack you touched.
`make help` lists every target.

Report what you ran and what it printed. If a check could not run, say so;
do not describe it as passing.

## The agent runtime, in one page

- A flow (nodes and edges from the studio) becomes a payload validated by
  `api/src/common/schemas/flow-payload.zod.ts`: one agent per node, one
  handoff per edge.
- `AgentPythonClientService` takes a worker from `python-worker.pool.ts`
  and writes the payload as one JSON line on its stdin.
- `api/python/flow_runner.py` is a long-lived worker. It answers on stdout
  with ND-JSON events: `{"kind":"chunk","data":...}` for each text delta,
  then exactly one terminal event, `{"kind":"end"}` or
  `{"kind":"error","message":...}`. Then it waits for the next line.
- stdout carries events and nothing else. Logs go to stderr.
- A worker is released to the pool after a terminal event and destroyed
  after a timeout, a crash or an abandoned run. Keep it to one return per
  run.
- Tools are SDK `FunctionTool` objects. A `backend` tool POSTs the model's
  arguments to `POST /internal/tools/:toolId`, with the `X-Internal-Token`
  the pool put in the runner's environment (`api/src/common/internal-token.ts`);
  a `function` tool is looked up in `flow_runner.LOCAL_TOOLS`.
- `openai-agents` and `openai` are pinned in `api/python/requirements.txt`.
  Bump them on purpose, with the tests.

## Rules

- **Test the real thing.** The runtime has tests that start the real
  `flow_runner.py` against a fake OpenAI endpoint
  (`api/python/tests/fake_openai.py`): `api/test/python-runner.e2e-spec.ts`,
  `api/test/agent-run-queue.e2e-spec.ts` and
  `api/python/tests/test_flow_runner_process.py`. A change to the runner,
  the pool or the payload needs a test at that level. Do not replace the
  object under test by a stub to make a test pass.
- **Do not skip a test to get a green run.** A suite that needs a
  third-party credential may be skipped when the credential is absent;
  nothing else.
- **Keep the documentation true.** If a change makes a sentence of
  `README.md` or of a document under `docs/` false, fix the sentence in the
  same change.
- **Comments describe the code.** No reference to a plan, a ticket or a
  task list that is not in this repository, and no absolute path from
  someone's machine. `scripts/check-repo-hygiene.sh` checks it in CI.
- **No secret in the repository.** `gitleaks detect` has to stay clean; an
  accepted finding goes in `.gitleaksignore` with the reason.
- **Stay in scope.** Change what the task asks for. Report what you saw
  next to it instead of fixing it silently.
- **Pin versions** of images, charts, providers and Python packages.
  `deploy/versions.yaml` is the source for chart versions.
- **Do not push, merge or open a pull request** unless the repository owner
  asked for it in the current task.

## Known limits

Read the "Project status" section of [`README.md`](README.md) before
describing what the product does. Do not present a prototype as finished.
