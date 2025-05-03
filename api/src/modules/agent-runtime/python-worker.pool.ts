import { createPool, Factory, Pool } from 'generic-pool';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';

const SCRIPT = path.resolve(__dirname, '../../../python/flow_runner.py');
const PY_ARGS = ['-u', SCRIPT];           // '-u' => unbuffered stdout
const ENV = { ...process.env, PYTHONUNBUFFERED: '1' };

const factory: Factory<ChildProcessWithoutNullStreams> = {
  create: async (): Promise<ChildProcessWithoutNullStreams> => {
    return spawn('python', PY_ARGS, { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
  },
  destroy(proc: ChildProcessWithoutNullStreams) {
    return new Promise<void>((res) => {
      if (proc.killed) return res();
      proc.once('close', res);
      proc.kill('SIGKILL');
    });
  },
};

// adjust pool size in test environment to prevent spawning python processes
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

export const pythonWorkerPool: Pool<ChildProcessWithoutNullStreams> =
  createPool(factory, {
    // disable min child processes and auto-start in test env
    min: isTest ? 0 : 2,
    autostart: !isTest,
    max: 10,
    idleTimeoutMillis: 5 * 60 * 1000,
    evictionRunIntervalMillis: 30 * 1000,
  });
