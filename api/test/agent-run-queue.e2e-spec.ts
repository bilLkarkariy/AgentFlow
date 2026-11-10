/**
 * The `agent-run` BullMQ path, end to end: POST /agent/run -> Redis ->
 * AgentRunProcessor -> the real Python runner -> a fake OpenAI endpoint.
 * Needs Redis (REDIS_HOST/REDIS_PORT) and the runner's Python (see helpers).
 */
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Queue, QueueEvents } from 'bullmq';
import { register } from 'prom-client';
import request from 'supertest';
import { TaskRun } from '../src/modules/tasks/task-run.entity';
import { FakeOpenAI, startFakeOpenAI, useFakeOpenAI } from './helpers/python-runner';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
};
// A queue of its own in Redis, so that a running api does not take the jobs.
const prefix = `agent-run-e2e-${process.pid}`;

const storedFlow = {
  nodes: [
    { id: 'n1', type: 'agent', category: 'agent', positionX: 0, positionY: 0, data: { label: 'triage', prompt: 'answer' } },
  ],
  edges: [],
  mappings: [],
};

describe('agent-run queue (e2e, real Redis and real runner)', () => {
  let app: INestApplication;
  let fakeOpenAI: FakeOpenAI;
  let queue: Queue;
  let events: QueueEvents;
  const logs: { room: string; message: string }[] = [];
  const taskRuns = { save: jest.fn().mockResolvedValue(undefined) };

  const enqueue = async (body: Record<string, unknown>) =>
    (await request(app.getHttpServer()).post('/agent/run').send(body).expect(201)).body.jobId;
  /** Wait until BullMQ gives up on the job or completes it. */
  const settled = async (jobId: string) => {
    const job = await queue.getJob(jobId);
    await job.waitUntilFinished(events, 30000).catch(() => undefined);
    return queue.getJob(jobId);
  };

  beforeAll(async () => {
    fakeOpenAI = await startFakeOpenAI();
    useFakeOpenAI(fakeOpenAI);
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { AgentRunController } = require('../src/modules/agents/flow/agent-run.controller');
    const { AgentRunProcessor } = require('../src/modules/agents/flow/agent-run.processor');
    const { FlowService } = require('../src/modules/agents/flow/flow.service');
    const { FlowGateway } = require('../src/modules/agents/flow/flow.gateway');
    const { FlowEngineService } = require('../src/modules/agent-runtime/flow-engine.service');
    const { AgentPythonClientService } = require('../src/modules/agent-runtime/agent-python-client.service');
    const { AgentMetricsService } = require('../src/modules/metrics/agent-metrics.service');
    const { PricingService } = require('../src/modules/pricing/pricing.service');
    /* eslint-enable @typescript-eslint/no-var-requires */
    register.clear();

    const flows = {
      getDto: async (agentId: string) => {
        if (agentId === 'unknown') throw new NotFoundException('Agent not found');
        return storedFlow;
      },
    };
    const gateway = {
      server: { to: (room: string) => ({ emit: (_: string, log: { message: string }) => logs.push({ room, ...log }) }) },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection, prefix }),
        // Same retry policy as AgentsModule, with a backoff short enough for a test.
        BullModule.registerQueue({
          name: 'agent-run',
          defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 50 } },
        }),
      ],
      controllers: [AgentRunController],
      providers: [
        AgentRunProcessor,
        FlowEngineService,
        AgentPythonClientService,
        AgentMetricsService,
        PricingService,
        { provide: FlowService, useValue: flows },
        { provide: FlowGateway, useValue: gateway },
        { provide: getRepositoryToken(TaskRun), useValue: taskRuns },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    queue = app.get<Queue>(getQueueToken('agent-run'));
    events = new QueueEvents('agent-run', { connection, prefix });
    await events.waitUntilReady();
  }, 60000);

  afterAll(async () => {
    await events?.close();
    await queue?.obliterate({ force: true }).catch(() => undefined);
    await app?.close();
    fakeOpenAI?.stop();
  });

  it('runs the stored flow of the agent and streams it to the job room', async () => {
    const jobId = await enqueue({ agentId: 'agent-1', input: 'hi' });
    const job = await settled(jobId);

    expect(await job.getState()).toBe('completed');
    expect(job.attemptsMade).toBe(1);
    expect(logs.filter((l) => l.room === jobId).map((l) => l.message)).toEqual([
      'Agent run start',
      'Hello', ' from', ' the', ' fake', ' model',
      'Agent run complete',
    ]);
    expect(taskRuns.save).toHaveBeenCalledWith({ subscriptionItemId: jobId, taskType: 'agent' });
    expect((await fakeOpenAI.requests()).at(-1).instructions).toBe('answer');
  }, 60000);

  it('retries a failing run 3 times, then leaves the job in the failed set', async () => {
    const before = (await fakeOpenAI.requests()).length;
    // The handoff target does not exist: the SDK rejects the tool call on every attempt.
    const jobId = await enqueue({ agentId: 'agent-1', input: 'call:transfer_to_nobody:{}' });
    const job = await settled(jobId);

    expect(await job.getState()).toBe('failed');
    expect(job.attemptsMade).toBe(3);
    expect((await fakeOpenAI.requests()).length - before).toBe(3);
    expect((await queue.getFailed()).map((j) => j.id)).toContain(jobId);
  }, 60000);

  it('does not retry an unknown agent', async () => {
    const jobId = await enqueue({ agentId: 'unknown', input: 'hi' });
    const job = await settled(jobId);

    expect(await job.getState()).toBe('failed');
    expect(job.attemptsMade).toBe(1);
    expect(job.failedReason).toBe('Agent unknown not found');
  }, 60000);

  it('rejects the payload the old endpoint accepted', async () => {
    await request(app.getHttpServer())
      .post('/agent/run')
      .send({ flowId: 'flow1', nodeId: 'node1', input: {} })
      .expect(400);
  });
});
