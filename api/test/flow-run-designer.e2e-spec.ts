/// <reference types="jest" />
// The studio's Run button, end to end: POST /agents/:id/flow/runs,
// FlowRunConsumer, the real FlowEngineService serializer, and the tokens/logs
// a Socket.IO client gets in the run's room on /ws/flow. The Python runner is
// replaced, and RabbitMQ is an in-process fake (as in flow-run-consumer): the
// real `agentflow.flow-run` queue is shared by every api attached to the
// broker, any of which could take the test's runs.
jest.setTimeout(30000);

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { Subject, of, throwError } from 'rxjs';

import { TestAppModule } from './test-app.module';
import { FlowEngineService } from '../src/modules/agent-runtime/flow-engine.service';
import { RabbitMQService } from '../src/modules/rabbitmq/rabbitmq.service';
import { FlowService } from '../src/modules/agents/flow/flow.service';
import { FlowDto } from '../src/modules/agents/flow/flow.dto';
import { RUN_LOG_NODE_ID } from '../src/modules/agents/flow/flow-run.consumer';
import { FlowRun } from '../src/modules/agents/flow/flow-run.entity';
import { Agent } from '../src/modules/agents/agent.entity';
import { FlowLogEvent, FlowLogsGateway } from '../src/modules/flow-logs/flow-logs.gateway';

// Shaped like the studio's save (DesignerPage): settings live under `data`.
const studioFlow = {
  nodes: [
    {
      id: 'triage',
      type: 'agent',
      positionX: 0,
      positionY: 0,
      data: { label: 'Tri', prompt: 'Classe la demande', model: 'gpt-4o-mini' },
    },
    {
      id: 'reply',
      type: 'agent',
      positionX: 300,
      positionY: 0,
      data: { name: 'Réponse', instructions: 'Rédige la réponse' },
    },
  ],
  edges: [{ id: 'e1', source: 'triage', target: 'reply' }],
  mappings: [],
} as unknown as FlowDto;

interface RunStream {
  tokens: string[];
  logs: FlowLogEvent[];
}

describe('Designer run over /ws/flow (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let agentId: string;
  let runRepo: Repository<FlowRun>;
  let gateway: FlowLogsGateway;
  const sockets: ClientSocket[] = [];
  const pythonClient = { run: jest.fn() };
  const fakeRabbit = {
    subscribers: {} as Record<string, (payload: any) => unknown>,
    subscribe(event: string, handler: (payload: any) => unknown) { this.subscribers[event] = handler; },
    publish(event: string, payload: any) { this.subscribers[event]?.(payload); },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] })
      .overrideProvider(FlowEngineService)
      .useFactory({ factory: () => new FlowEngineService(pythonClient as any) })
      .overrideProvider(RabbitMQService)
      .useValue(fakeRabbit)
      .compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    baseUrl = `http://localhost:${app.getHttpServer().address().port}`;

    const dataSource = app.get<DataSource>(getDataSourceToken());
    runRepo = dataSource.getRepository(FlowRun);
    gateway = app.get(FlowLogsGateway);
    const agent = await dataSource.getRepository(Agent).save({ name: 'Designer', dsl: null, active: true });
    agentId = agent.id;
    await app.get(FlowService).save(agentId, studioFlow);
  });

  afterEach(() => {
    sockets.splice(0).forEach(s => s.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  async function startRun(body: Record<string, unknown>): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/agents/${agentId}/flow/runs`)
      .send(body)
      .expect(201);
    expect(res.body.status).toBe('pending');
    return res.body.id;
  }

  /** Join the run's room the way the studio does, collecting until the run ends. */
  function watchRun(runId: string) {
    const socket = ClientIO(`${baseUrl}/ws/flow`, { transports: ['websocket'] });
    sockets.push(socket);
    const stream: RunStream = { tokens: [], logs: [] };
    const ended = new Promise<RunStream>(resolve => {
      socket.on('tokens', (token: string) => stream.tokens.push(token));
      socket.on('log', (event: FlowLogEvent) => {
        stream.logs.push(event);
        if (event.nodeId === RUN_LOG_NODE_ID && event.status !== 'info') resolve(stream);
      });
    });
    const joined = new Promise<void>(resolve => {
      socket.on('connect', () => socket.emit('join', { runId }, () => resolve()));
    });
    return { joined, ended };
  }

  async function until(condition: () => boolean) {
    while (!condition()) await new Promise(r => setTimeout(r, 20));
  }

  it('streams a studio flow run live to the room, with the agents read from node data', async () => {
    const chunks = new Subject<string>();
    let payload: any;
    pythonClient.run.mockImplementationOnce(p => {
      payload = p;
      return chunks;
    });

    const runId = await startRun({ input: 'Bonjour' });
    const { joined, ended } = watchRun(runId);
    await joined;
    await until(() => payload !== undefined);
    chunks.next('Bon');
    chunks.next('jour');
    chunks.complete();
    const stream = await ended;

    expect(payload.input).toBe('Bonjour');
    expect(payload.agents).toEqual([
      { id: 'triage', name: 'Tri', instructions: 'Classe la demande', model: 'gpt-4o-mini', tools: [] },
      { id: 'reply', name: 'Réponse', instructions: 'Rédige la réponse', tools: [] },
    ]);
    expect(payload.edges).toEqual([['triage', 'reply']]);

    expect(stream.tokens).toEqual(['Bon', 'jour']);
    expect(stream.logs.map(l => [l.nodeId, l.status, l.message])).toEqual([
      [RUN_LOG_NODE_ID, 'info', 'Exécution démarrée'],
      ['triage', 'success', 'Bonjour'],
      [RUN_LOG_NODE_ID, 'success', 'Exécution terminée · 2 jetons'],
    ]);
    expect(stream.logs.every(l => l.runId === runId)).toBe(true);

    const run = await runRepo.findOneBy({ id: runId });
    expect(run.status).toBe('completed');
    expect(run.stats).toMatchObject({ tokens: 2, model: 'gpt-4o-mini' });
  });

  it('replays the whole run to a client that joins after it ended', async () => {
    const endRun = jest.spyOn(gateway, 'endRun');
    pythonClient.run.mockReturnValueOnce(of('a', 'b'));

    const runId = await startRun({ input: 'x' });
    await until(() => endRun.mock.calls.some(([id]) => id === runId));
    const stream = await watchRun(runId).ended;

    expect(stream.tokens).toEqual(['a', 'b']);
    expect(stream.logs.map(l => [l.nodeId, l.status])).toEqual([
      [RUN_LOG_NODE_ID, 'info'],
      ['triage', 'success'],
      [RUN_LOG_NODE_ID, 'success'],
    ]);
    endRun.mockRestore();
  });

  it('reports a runner failure on the room and fails the run', async () => {
    pythonClient.run.mockReturnValueOnce(throwError(() => new Error('runner down')));

    const runId = await startRun({ input: 'x' });
    const stream = await watchRun(runId).ended;

    expect(stream.tokens).toEqual([]);
    expect(stream.logs.at(-1)).toMatchObject({
      nodeId: RUN_LOG_NODE_ID,
      status: 'error',
      message: "Échec de l'exécution : runner down",
    });
    expect((await runRepo.findOneBy({ id: runId })).status).toBe('failed');
  });

  it('fails the run instead of leaving it running when the payload is rejected', async () => {
    pythonClient.run.mockClear();
    // no input: the FlowPayload schema throws while serializing
    const runId = await startRun({});
    const stream = await watchRun(runId).ended;

    expect(stream.logs.at(-1)).toMatchObject({ nodeId: RUN_LOG_NODE_ID, status: 'error' });
    expect((await runRepo.findOneBy({ id: runId })).status).toBe('failed');
    expect(pythonClient.run).not.toHaveBeenCalled();
  });
});
