import { EventEmitter } from 'events';
import { register } from 'prom-client';
import { AgentPythonClientService } from './agent-python-client.service';
import { pythonWorkerPool } from './python-worker.pool';

// Clear Prometheus metrics before each test
beforeEach(() => { register.clear(); });
// Mock the pythonWorkerPool
jest.mock('./python-worker.pool', () => ({
  pythonWorkerPool: {
    acquire: jest.fn(),
    release: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('AgentPythonClientService', () => {
  let service: AgentPythonClientService;
  let fakeWorker: any;

  beforeEach(() => {
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
    service = new AgentPythonClientService();
  });

  it('emits tokens from python runner and completes', done => {
    const tokens: string[] = [];
    service.run({ foo: 'bar' }).subscribe({
      next: tok => tokens.push(tok),
      complete: () => {
        expect(tokens).toEqual(['tok1', 'tok2']);
        expect(pythonWorkerPool.acquire).toHaveBeenCalled();
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

  it('handles JSON parse errors gracefully', done => {
    service.run({}).subscribe({
      next: () => fail('should not emit'),
      error: err => {
        expect(err).toBeInstanceOf(Error);
        done();
      },
    });
    setImmediate(() => {
      fakeWorker.stdout.emit('data', Buffer.from('invalid-json\n'));
    });
  });

});
