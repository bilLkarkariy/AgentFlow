import { createPool, Factory, Pool } from 'generic-pool';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Logger } from '@nestjs/common';
import path from 'path';
import { INTERNAL_TOOLS_TOKEN } from '../../common/internal-token';

// PYTHON_SCRIPTS_DIR / PYTHON_BIN are set by the container image; the defaults keep dev behaviour.
const SCRIPTS_DIR = process.env.PYTHON_SCRIPTS_DIR ?? path.resolve(__dirname, '../../../python');
const SCRIPT = path.join(SCRIPTS_DIR, 'flow_runner.py');
const PYTHON_BIN = process.env.PYTHON_BIN ?? 'python';
const PY_ARGS = ['-u', SCRIPT];           // '-u' => unbuffered stdout
// The token is what lets a runner call back POST /internal/tools/:toolId.
const ENV = { ...process.env, PYTHONUNBUFFERED: '1', INTERNAL_TOOLS_TOKEN };

const logger = new Logger('PythonWorkerPool');

/** A worker can take a run: it was spawned, has not exited, and its stdin is open. */
export function isWorkerAlive(proc: ChildProcessWithoutNullStreams): boolean {
  return (
    proc.pid !== undefined &&
    proc.exitCode === null &&
    proc.signalCode === null &&
    !proc.killed &&
    proc.stdin.writable
  );
}

const factory: Factory<ChildProcessWithoutNullStreams> = {
  create: (): Promise<ChildProcessWithoutNullStreams> =>
    new Promise((resolve, reject) => {
      const proc = spawn(PYTHON_BIN, PY_ARGS, { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
      proc.once('spawn', () => resolve(proc));
      proc.once('error', reject);
      // Attached once per process, for its whole life: the runner logs on stderr.
      proc.stderr.on('data', (d) => logger.warn(`[PY ${proc.pid}] ${d.toString().trim()}`));
      // A write to a worker that just died must not crash the API.
      proc.stdin.on('error', (e) => logger.warn(`[PY ${proc.pid}] stdin: ${e.message}`));
      proc.on('error', (e) => logger.error(`[PY ${proc.pid}] ${e.message}`));
    }),
  destroy(proc: ChildProcessWithoutNullStreams) {
    return new Promise<void>((res) => {
      // Already gone: 'close' has fired and would never fire again.
      if (proc.exitCode !== null || proc.signalCode !== null) return res();
      proc.once('close', () => res());
      proc.kill('SIGKILL');
    });
  },
  // Run on every acquire (testOnBorrow): a worker that died while idle is
  // destroyed and replaced instead of being handed to a run.
  validate: async (proc: ChildProcessWithoutNullStreams) => isWorkerAlive(proc),
};

// adjust pool size in test environment to prevent spawning python processes
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

export const pythonWorkerPool: Pool<ChildProcessWithoutNullStreams> =
  createPool(factory, {
    // disable min child processes and auto-start in test env
    min: isTest ? 0 : 2,
    autostart: !isTest,
    max: 10,
    testOnBorrow: true,
    // Fail the run instead of waiting forever when no worker can be spawned.
    acquireTimeoutMillis: 10 * 1000,
    idleTimeoutMillis: 5 * 60 * 1000,
    evictionRunIntervalMillis: 30 * 1000,
  });

pythonWorkerPool.on('factoryCreateError', (e) => logger.error(`Cannot spawn ${PYTHON_BIN}: ${e.message}`));
