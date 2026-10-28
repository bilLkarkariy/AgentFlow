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
    fakeWorker = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: { write: jest.fn(), end: jest.fn() },
      once: jest.fn(),
      kill: jest.fn(),
    };
    // Mock acquire to return fake worker
    (pythonWorkerPool.acquire as jest.Mock).mockResolvedValue(fakeWorker);
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
});
