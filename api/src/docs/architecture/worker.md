# Worker & Orchestrator Architecture

This document describes how **agent** tasks are handled via BullMQ and the
Python runner within the Worker/Orchestrator.

## 1. Queue Registration

- **Queue name**: `agent-run`
- Registered in `QueuesModule` alongside other queues:
  ```ts
  BullModule.registerQueue({ name: 'agent-run' });
  ```

## 2. AgentRunProcessor

Located at `api/src/modules/queues/agent-run.processor.ts`:

1. **@Processor('agent-run')** binds it to the `agent-run` queue.
2. **Process handler**:
   - Receives `job.data = { flowId, nodeId, input }` and `job.id` as `jobId`.
   - Emits WebSocket logs via `FlowGateway.server.to(jobId).emit('log', { message })`:
     - `Agent run start`
     - One log per runtime chunk
     - `Agent run complete`
   - Calls `AgentRuntimeService.run(flowId, input)`.
   - Saves a `TaskRun` record to the DB (`taskType: 'agent'`).
3. **No metric is emitted here.** Duration, tokens and spend used to carry a
   `jobId` label, which is unbounded cardinality; they now live in
   `AgentPythonClientService`.

## 3. Metrics contract

All application metrics are prefixed `agentflow_` and exposed on `GET /metrics`.
Labels are bounded: `model` is normalized by `PricingService` to a key of
`src/pricing.json` (or `other`), and there is no per-job label anywhere.

| metric | type | labels | emitted by |
|---|---|---|---|
| `agentflow_agent_runs_total` | counter | `model`, `status` (`success`/`failure`/`timeout`/`circuit_open`) | `AgentPythonClientService` |
| `agentflow_agent_run_duration_seconds` | histogram (0.5 → 60 s) | `model` | `AgentPythonClientService` |
| `agentflow_llm_tokens_total` | counter | `model`, `type` (`output`) | `AgentPythonClientService` |
| `agentflow_llm_cost_usd_total` | counter | `model` | `AgentPythonClientService` |
| `agentflow_queue_depth` | gauge | `queue`, `state` (`waiting`/`active`/`delayed`/`failed`) | `MetricsService` |
| `agentflow_python_runner_failures_total` | counter | `reason` (`timeout`/`exit`/`error`/`circuit_open`) | `AgentPythonClientService` |
| `agentflow_python_runner_circuit_state` | gauge | — (0 closed, 1 half-open, 2 open) | `AgentPythonClientService` |
| `agentflow_build_info` | gauge | `version`, `commit` | `AgentMetricsService` (startup) |

Token counts are **approximated from streamed chunks** (one chunk ≈ one output
token); the cost is `tokens / 1000 * outputPer1k` with the illustrative rates of
`src/pricing.json`.

### Queue depth collection

Implemented in `api/src/modules/metrics/metrics.service.ts`. A single long
lived BullMQ `Queue` is opened in the constructor and closed on
`onModuleDestroy`; a 5 s cron reads the counts:

```ts
const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
for (const state of states) metrics.setQueueDepth('agent-run', state, counts[state]);
```

Redis being unreachable only logs a warning: the api stays up and the probes
stay green.

## 4. Prometheus Endpoint

`MetricsController` serves the prom-client default registry on `GET /metrics`:
Node runtime defaults (`collectDefaultMetrics`, registered once by
`MetricsModule`) plus the `agentflow_*` families above. The endpoint is excluded
from tracing and from request logging.

## 5. Testing

- **Unit tests**: `agent-run.processor.spec.ts`, `agent-python-client.service.spec.ts`.
- **Endpoint test**: `src/modules/metrics/metrics.e2e-spec.ts` asserts the eight
  metric families, the queue depth per state and the absence of any `jobId`
  label.

*Last updated: 2026-09-06*
