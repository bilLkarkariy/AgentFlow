import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/modules/app.module';
import { AgentRunProcessor } from '../src/modules/queues/agent-run.processor';
import { getQueueToken } from '@nestjs/bullmq';

// Mock Bull queue for agent-run to avoid real processing
const mockJob = { discard: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
  getJob: jest.fn().mockResolvedValue(mockJob),
};

describe('RunsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken('agent-run'))
      .useValue(mockQueue)
      .overrideProvider(AgentRunProcessor)
      .useValue({})
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /runs/:id/cancel returns cancelled=true for arbitrary id', async () => {
    const res = await request(app.getHttpServer())
      .post('/runs/nonexistent-id/cancel')
      .expect(200);
    expect(res.body).toEqual({ cancelled: true });
  });

  it('enqueues a job then cancels it', async () => {
    // enqueue via agent endpoint
    const enqueue = await request(app.getHttpServer())
      .post('/agent/run')
      .send({ flowId: 'flow1', nodeId: 'node1', input: {} })
      .expect(201);
    const jobId = enqueue.body.jobId;
    expect(jobId).toBeDefined();

    // cancel the run
    const cancelRes = await request(app.getHttpServer())
      .post(`/runs/${jobId}/cancel`)
      .expect(200);
    expect(cancelRes.body).toEqual({ cancelled: true });
  });
});
