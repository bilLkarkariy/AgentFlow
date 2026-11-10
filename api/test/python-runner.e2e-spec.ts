/**
 * Integration: AgentPythonClientService -> the real worker pool -> the real
 * flow_runner.py -> a fake OpenAI endpoint (api/python/tests/fake_openai.py).
 * Nothing is mocked on the way.
 *
 * Needs a Python that has api/python/requirements.txt installed: PYTHON_BIN,
 * or the api/python/.venv virtualenv.
 */
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { existsSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import { createInterface } from 'readline';
import { register } from 'prom-client';
import { lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import type { Pool } from 'generic-pool';
import type { AgentPythonClientService } from '../src/modules/agent-runtime/agent-python-client.service';
import type { FlowEngineService } from '../src/modules/agent-runtime/flow-engine.service';
import { SummarizeBlock } from '../src/modules/agents/blocks/summarize-block';

const PYTHON_DIR = path.resolve(__dirname, '../python');
const VENV_PYTHON = path.join(PYTHON_DIR, '.venv/bin/python');
const PYTHON_BIN = process.env.PYTHON_BIN ?? (existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3');

const flow = (input: string, runId = 'run') => ({
  runId,
  input,
  agents: [{ id: 'triage', name: 'triage', instructions: 'answer', model: 'gpt-4o-mini', tools: [] }],
  edges: [],
});

describe('Python runner (integration, real process)', () => {
  let fakeOpenAI: ChildProcessWithoutNullStreams;
  let openAIUrl: string;
  let pool: Pool<ChildProcessWithoutNullStreams>;
  let Client: typeof AgentPythonClientService;
  let service: AgentPythonClientService;
  let engine: FlowEngineService;
  // Stands for the API's POST /internal/tools/:toolId, which backend tools call.
  let toolBackend: Server;
  const toolCalls: { url: string; body: any }[] = [];

  const run = async (payload: Record<string, any>): Promise<string> =>
    (await lastValueFrom(service.run(payload).pipe(toArray()))).join('');
  const openAIRequests = async (): Promise<any[]> =>
    (await fetch(`${openAIUrl}/_requests`)).json();
  const until = async (condition: () => boolean) => {
    for (let i = 0; i < 100 && !condition(); i++) await new Promise((r) => setTimeout(r, 50));
    expect(condition()).toBe(true);
  };

  beforeAll(async () => {
    fakeOpenAI = spawn(PYTHON_BIN, ['-u', path.join(PYTHON_DIR, 'tests/fake_openai.py')]);
    const firstLine = await new Promise<string>((resolve, reject) => {
      createInterface({ input: fakeOpenAI.stdout }).once('line', resolve);
      fakeOpenAI.once('error', reject);
      fakeOpenAI.once('exit', (code) => reject(new Error(`fake_openai.py exited with ${code}`)));
    });
    openAIUrl = `http://127.0.0.1:${JSON.parse(firstLine).port}`;

    toolBackend = createServer((req, res) => {
      let raw = '';
      req.on('data', (d) => (raw += d));
      req.on('end', () => {
        const body = JSON.parse(raw);
        toolCalls.push({ url: req.url, body });
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ summary: `short ${body.text}` }));
      });
    });
    await new Promise<void>((resolve) => toolBackend.listen(0, '127.0.0.1', resolve));

    // The pool snapshots process.env when it is first imported: set it up before.
    Object.assign(process.env, {
      API_URL: `http://127.0.0.1:${(toolBackend.address() as AddressInfo).port}`,
      PYTHON_BIN,
      PYTHON_SCRIPTS_DIR: PYTHON_DIR,
      OPENAI_API_KEY: 'dummy',
      OPENAI_BASE_URL: `${openAIUrl}/v1`,
      OPENAI_AGENTS_DISABLE_TRACING: '1',
    });
    /* eslint-disable @typescript-eslint/no-var-requires */
    pool = require('../src/modules/agent-runtime/python-worker.pool').pythonWorkerPool;
    Client = require('../src/modules/agent-runtime/agent-python-client.service').AgentPythonClientService;
    const { AgentMetricsService } = require('../src/modules/metrics/agent-metrics.service');
    const { PricingService } = require('../src/modules/pricing/pricing.service');
    const { FlowEngineService: Engine } = require('../src/modules/agent-runtime/flow-engine.service');
    /* eslint-enable @typescript-eslint/no-var-requires */
    register.clear();
    service = new Client(new AgentMetricsService(new PricingService()), new PricingService());
    engine = new Engine(service);
  }, 60000);

  afterAll(async () => {
    await service?.onModuleDestroy();
    fakeOpenAI?.kill();
    toolBackend?.close();
  });

  it('serves 10 runs in a row on the same worker', async () => {
    for (let i = 0; i < 10; i++) {
      expect(await run(flow('hi', `run-${i}`))).toBe('Hello from the fake model');
    }
    expect(pool.size).toBe(1);
    expect(pool.borrowed).toBe(0);
    expect(await openAIRequests()).toHaveLength(10);
    expect(await register.metrics()).toMatch(
      /agentflow_agent_runs_total\{model="gpt-4o-mini",status="success"\} 10/,
    );
  }, 60000);

  it('serves concurrent runs, one worker each', async () => {
    const outputs = await Promise.all(Array.from({ length: 5 }, (_, i) => run(flow('hi', `c-${i}`))));
    expect(outputs).toEqual(Array(5).fill('Hello from the fake model'));
    expect(pool.size).toBe(5);
    expect(pool.borrowed).toBe(0);
  }, 60000);

  it('fails a run the runner rejects, and the worker takes the next one', async () => {
    await expect(run({ prompt: 'hi', parameters: {} })).rejects.toThrow('No root agent found');
    expect(pool.borrowed).toBe(0);
    expect(await run(flow('hi'))).toBe('Hello from the fake model');
  });

  it('replaces a worker that died while idle', async () => {
    const sizeBefore = pool.size;
    const idle = await pool.acquire();
    const closed = new Promise((resolve) => idle.once('close', resolve));
    idle.kill('SIGKILL');
    await closed;
    await pool.release(idle);

    for (let i = 0; i < sizeBefore + 1; i++) {
      expect(await run(flow('hi'))).toBe('Hello from the fake model');
    }
    expect(pool.borrowed).toBe(0);
  });

  it('times out a hung run, destroys its worker and keeps serving', async () => {
    const sizeBefore = pool.size;
    const timeoutMs = (Client as any).TIMEOUT_MS;
    (Client as any).TIMEOUT_MS = 1000;
    try {
      await expect(run(flow('hang'))).rejects.toThrow('Agent runner timeout after 1000ms');
    } finally {
      (Client as any).TIMEOUT_MS = timeoutMs;
    }
    await until(() => pool.size === sizeBefore - 1);
    expect(pool.borrowed).toBe(0);
    expect(await run(flow('hi'))).toBe('Hello from the fake model');
    expect(await register.metrics()).toMatch(
      /agentflow_agent_runs_total\{model="gpt-4o-mini",status="timeout"\} 1/,
    );
  });

  it('destroys the worker of a run the client abandons', async () => {
    const sizeBefore = pool.size;
    const sub = service.run(flow('hang')).subscribe();
    await until(() => pool.borrowed === 1);
    sub.unsubscribe();
    await until(() => pool.size === sizeBefore - 1);
    expect(pool.borrowed).toBe(0);
    expect(await run(flow('hi'))).toBe('Hello from the fake model');
  });

  it('executes a backend tool call end to end, from a studio flow', async () => {
    const before = (await openAIRequests()).length;
    const node = (id: string, data: Record<string, any>) =>
      ({ id, type: 'agent', category: 'agent', positionX: 0, positionY: 0, data });
    const studioFlow = {
      nodes: [
        node('writer', {
          label: 'writer',
          prompt: 'Summarize what the user sends',
          tools: [new SummarizeBlock('summarize', 'Summarize a text')],
        }),
      ],
      edges: [],
      mappings: [],
    };

    const output = (
      await lastValueFrom(
        engine.runFlow(studioFlow, 'call:summarize:{"text": "a long text"}').pipe(toArray()),
      )
    ).join('');

    const [offer, followUp] = (await openAIRequests()).slice(before);
    // The model was offered the tool with the block's schema...
    expect(offer.tools.map((t: any) => [t.name, t.parameters.required])).toEqual([
      ['summarize', ['text']],
    ]);
    // ...its call reached the API tool endpoint...
    expect(toolCalls).toEqual([
      { url: '/internal/tools/summarize-block', body: { text: 'a long text' } },
    ]);
    // ...and the tool output went back to the model, whose answer is streamed.
    expect(JSON.parse(followUp.input.at(-1).output)).toEqual({ summary: 'short a long text' });
    expect(output).toBe('tool said: {"summary": "short a long text"}');
  });

  it('hands off between two agents of a flow', async () => {
    const before = (await openAIRequests()).length;
    const output = await run({
      runId: 'handoff',
      input: 'call:transfer_to_billing:{}',
      agents: [
        { id: 'n1', name: 'triage', instructions: 'route', tools: [] },
        { id: 'n2', name: 'billing', instructions: 'answer billing questions', tools: [] },
      ],
      edges: [['n1', 'n2']],
    });
    const [first, second] = (await openAIRequests()).slice(before);
    expect(first.instructions).toBe('route');
    expect(second.instructions).toBe('answer billing questions');
    expect(output).toBe('tool said: {"assistant": "billing"}');
  });
});
