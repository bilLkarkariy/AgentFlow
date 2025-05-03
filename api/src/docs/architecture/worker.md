# Worker & Orchestrator Architecture

This document describes how **agent** tasks are handled via BullMQ and gRPC within the Worker/Orchestrator.

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
   - Measures duration with a **Histogram** (`agent_duration_seconds`).
   - Counts tokens with a **Counter** (`agent_tokens_total`).
   - Calls `AgentRuntimeService.run(flowId, input)` (gRPC streaming).
   - Saves a `TaskRun` record to the DB (`taskType: 'agent'`).

## 3. Metrics Collection

- Implemented in `api/src/modules/metrics/metrics.service.ts`.
- Cron job every 5s to poll the `agent-run` queue:
  ```ts
  const queue = new Queue('agent-run', { /* Redis options */ });
  const counts = await queue.getJobCounts('waiting','active','delayed');
  queueLengthGauge.set({ queue: 'agent-run' }, counts.waiting + counts.active + counts.delayed);
  await queue.close();
  ```
- Exposes `queue_length{queue="agent-run"}` gauge for Prometheus.

## 4. Prometheus Endpoint

- All metrics (default + histograms + counters + queue_length) are exposed on `GET /metrics` by `MetricsController`.

## 5. Testing

- **Unit tests**: `agent-run.processor.spec.ts` (>80% coverage).
- **Integration tests**: Enqueue an `agent-run` job and assert:
  1. WebSocket logs via `FlowGateway`.
  2. A new `TaskRun` row is saved.
  3. Metrics are updated.

*Last updated: 2025-04-29*