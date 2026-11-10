import { EventEmitter } from 'events';
import { register } from 'prom-client';
import { AgentPythonClientService } from './agent-python-client.service';
import { pythonWorkerPool } from './python-worker.pool';
import { AgentMetricsService } from '../metrics/agent-metrics.service';
import { PricingService } from '../pricing/pricing.service';

// Mock the pythonWorkerPool
jest.mock('./python-worker.pool', () => ({
  pythonWorkerPool: {
    acquire: jest.fn(),
    release: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('AgentPythonClientService', () => {
  let service: AgentPythonClientService;
  let metrics: AgentMetricsService;
  let fakeWorker: any;

  beforeEach(() => {
    // Fresh Prometheus registry so the metric guards create new instruments
    register.clear();
    // Setup fake worker process
    fakeWorker = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: { write: jest.fn(), end: jest.fn() },
      kill: jest.fn(),
    });
    // Mock acquire to return fake worker
    (pythonWorkerPool.acquire as jest.Mock).mockResolvedValue(fakeWorker);
    (pythonWorkerPool.release as jest.Mock).mockClear();
    (pythonWorkerPool.destroy as jest.Mock).mockClear();
    // The circuit breaker is static: start every test closed.
    Object.assign(AgentPythonClientService, { state: 'closed', failureCount: 0, nextAttemptTime: 0 });
    metrics = new AgentMetricsService(new PricingService());
    service = new AgentPythonClientService(metrics, new PricingService());
  });

  it('emits tokens from python runner and completes', done => {
    const tokens: string[] = [];
    service.run({ agents: [{ model: 'gpt-4o-mini' }] }).subscribe({
      next: tok => tokens.push(tok),
      complete: async () => {
        expect(tokens).toEqual(['tok1', 'tok2']);
        expect(pythonWorkerPool.acquire).toHaveBeenCalled();

        const scrape = await register.metrics();
        expect(scrape).toMatch(
          /agentflow_agent_runs_total\{model="gpt-4o-mini",status="success"\} 1/,
        );
        expect(scrape).toMatch(
          /agentflow_llm_tokens_total\{model="gpt-4o-mini",type="output"\} 2/,
        );
        expect(scrape).toContain('agentflow_llm_cost_usd_total{model="gpt-4o-mini"}');
        done();
      },
    });
    // Schedule emits after subscription and acquire resolution
    setImmediate(() => {
      fakeWorker.stdout.emit('data', Buffer.from(JSON.stringify({ kind: 'chunk', data: 'tok1' }) + '\n'));
      fakeWorker.stdout.emit('data', Buffer.from(JSON.stringify({ kind: 'chunk', data: 'tok2' }) + '\n'));
      fakeWorker.stdout.emit('data', Buffer.from(JSON.stringify({ kind: 'end' }) + '\n'));
    });
  });

  it('handles JSON parse errors gracefully and records a failure', done => {
    service.run({}).subscribe({
      next: () => fail('should not emit'),
      error: async err => {
        expect(err).toBeInstanceOf(Error);
        const scrape = await register.metrics();
        expect(scrape).toMatch(
          /agentflow_agent_runs_total\{model="other",status="failure"\} 1/,
        );
        expect(scrape).toMatch(
          /agentflow_python_runner_failures_total\{reason="error"\} 1/,
        );
        done();
      },
    });
    setImmediate(() => {
      fakeWorker.stdout.emit('data', Buffer.from('invalid-json\n'));
    });
  });

  it('records an unknown model as "other"', done => {
    service.run({ model: 'llama-3' }).subscribe({
      complete: async () => {
        const scrape = await register.metrics();
        expect(scrape).toMatch(
          /agentflow_agent_runs_total\{model="other",status="success"\} 1/,
        );
        done();
      },
    });
    setImmediate(() => {
      fakeWorker.stdout.emit('data', Buffer.from(JSON.stringify({ kind: 'end' }) + '\n'));
    });
  });

  const send = (evt: Record<string, unknown>) =>
    fakeWorker.stdout.emit('data', Buffer.from(JSON.stringify(evt) + '\n'));
  /** Listeners this run left on the worker. */
  const listeners = () =>
    fakeWorker.stdout.listenerCount('data') +
    fakeWorker.stderr.listenerCount('data') +
    fakeWorker.listenerCount('close') +
    fakeWorker.listenerCount('error');

  it('releases the worker exactly once after `end` and leaves no listener on it', done => {
    service.run({}).subscribe({
      complete: () => {
        // The worker stays alive: a later `close` must not release it again.
        fakeWorker.emit('close', 0, null);
        expect(pythonWorkerPool.release).toHaveBeenCalledTimes(1);
        expect(pythonWorkerPool.release).toHaveBeenCalledWith(fakeWorker);
        expect(pythonWorkerPool.destroy).not.toHaveBeenCalled();
        expect(listeners()).toBe(0);
        done();
      },
    });
    setImmediate(() => send({ kind: 'end' }));
  });

  it('surfaces a runner `error` event and keeps the worker', done => {
    service.run({}).subscribe({
      error: async err => {
        expect(err.message).toBe('ValueError: No root agent found');
        expect(pythonWorkerPool.release).toHaveBeenCalledTimes(1);
        expect(pythonWorkerPool.destroy).not.toHaveBeenCalled();
        expect(await register.metrics()).toMatch(
          /agentflow_python_runner_failures_total\{reason="error"\} 1/,
        );
        done();
      },
    });
    setImmediate(() => send({ kind: 'error', message: 'ValueError: No root agent found' }));
  });

  it('destroys a worker that exits in the middle of a run', done => {
    service.run({}).subscribe({
      error: async err => {
        expect(err.message).toBe('Worker exit 1');
        expect(pythonWorkerPool.destroy).toHaveBeenCalledTimes(1);
        expect(pythonWorkerPool.release).not.toHaveBeenCalled();
        expect(await register.metrics()).toMatch(
          /agentflow_python_runner_failures_total\{reason="exit"\} 1/,
        );
        done();
      },
    });
    setImmediate(() => fakeWorker.emit('close', 1, null));
  });

  it('destroys the worker when the subscriber leaves mid-run', async () => {
    const sub = service.run({}).subscribe();
    await new Promise(setImmediate);
    sub.unsubscribe();
    expect(pythonWorkerPool.destroy).toHaveBeenCalledTimes(1);
    expect(pythonWorkerPool.release).not.toHaveBeenCalled();
    expect(listeners()).toBe(0);
  });

  describe('timeout', () => {
    const timeoutMs = (AgentPythonClientService as any).TIMEOUT_MS;
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }));
    afterEach(() => jest.useRealTimers());

    it('fails the run and destroys the worker', async () => {
      const error = jest.fn();
      service.run({}).subscribe({ error });
      await new Promise(setImmediate);
      jest.advanceTimersByTime(timeoutMs);

      expect(error.mock.calls[0][0].message).toBe(`Agent runner timeout after ${timeoutMs}ms`);
      expect(pythonWorkerPool.destroy).toHaveBeenCalledTimes(1);
      expect(pythonWorkerPool.release).not.toHaveBeenCalled();
      expect(await register.metrics()).toMatch(
        /agentflow_agent_runs_total\{model="other",status="timeout"\} 1/,
      );
    });

    it('is cancelled when the run ends', async () => {
      const error = jest.fn();
      const complete = jest.fn();
      service.run({}).subscribe({ error, complete });
      await new Promise(setImmediate);
      send({ kind: 'end' });
      jest.advanceTimersByTime(timeoutMs * 2);

      expect(jest.getTimerCount()).toBe(0);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
      expect(pythonWorkerPool.destroy).not.toHaveBeenCalled();
      expect(await register.metrics()).not.toMatch(/status="timeout"/);
    });
  });

  it('opens the circuit after repeated failures and rejects without a worker', async () => {
    const threshold = (AgentPythonClientService as any).CB_FAILURE_THRESHOLD;
    for (let i = 0; i < threshold; i++) {
      const failed = new Promise(resolve => service.run({}).subscribe({ error: resolve }));
      await new Promise(setImmediate);
      fakeWorker.emit('close', 1, null);
      await failed;
    }
    (pythonWorkerPool.acquire as jest.Mock).mockClear();

    const err: Error = await new Promise(resolve => service.run({}).subscribe({ error: resolve }));
    expect(err.message).toBe('Circuit breaker is open');
    expect(pythonWorkerPool.acquire).not.toHaveBeenCalled();
    expect(await register.metrics()).toMatch(/agentflow_python_runner_circuit_state 2/);
  });
});
