import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { createInterface } from 'readline';

export const PYTHON_DIR = path.resolve(__dirname, '../../python');
const VENV_PYTHON = path.join(PYTHON_DIR, '.venv/bin/python');
/** A Python that has api/python/requirements.txt: PYTHON_BIN, or api/python/.venv. */
export const PYTHON_BIN = process.env.PYTHON_BIN ?? (existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3');

export interface FakeOpenAI {
  url: string;
  /** Every request body the endpoint received so far. */
  requests(): Promise<any[]>;
  stop(): void;
}

/** Start api/python/tests/fake_openai.py and wait for the port it listens on. */
export async function startFakeOpenAI(): Promise<FakeOpenAI> {
  const proc: ChildProcessWithoutNullStreams = spawn(PYTHON_BIN, [
    '-u',
    path.join(PYTHON_DIR, 'tests/fake_openai.py'),
  ]);
  const firstLine = await new Promise<string>((resolve, reject) => {
    createInterface({ input: proc.stdout }).once('line', resolve);
    proc.once('error', reject);
    proc.once('exit', (code) => reject(new Error(`fake_openai.py exited with ${code}`)));
  });
  const url = `http://127.0.0.1:${JSON.parse(firstLine).port}`;
  return {
    url,
    requests: async () => (await fetch(`${url}/_requests`)).json(),
    stop: () => void proc.kill(),
  };
}

/**
 * Point the Python runner at the fake endpoint. The worker pool snapshots
 * process.env when it is first imported: call this before requiring it.
 */
export function useFakeOpenAI(fake: FakeOpenAI, extraEnv: Record<string, string> = {}): void {
  Object.assign(process.env, {
    PYTHON_BIN,
    PYTHON_SCRIPTS_DIR: PYTHON_DIR,
    OPENAI_API_KEY: 'dummy',
    OPENAI_BASE_URL: `${fake.url}/v1`,
    OPENAI_AGENTS_DISABLE_TRACING: '1',
    ...extraEnv,
  });
}
