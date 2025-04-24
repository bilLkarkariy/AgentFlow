import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/modules/app.module';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

describe.skip('FlowController (e2e)', () => {
  let app: INestApplication;
  let mockQueue: Partial<Queue>;

  beforeAll(async () => {
    // Mock the execute-agent queue
    mockQueue = { add: jest.fn().mockResolvedValue({ id: 'test-job-1' }) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // mock all Bull queues to prevent open Redis connections
      .overrideProvider(getQueueToken('execute-agent')).useValue(mockQueue)
      .overrideProvider(getQueueToken('gmail')).useValue(mockQueue)
      .overrideProvider(getQueueToken('agents')).useValue(mockQueue)
      .overrideProvider(getQueueToken('alert-slack')).useValue(mockQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /agents/:id/flow/execute should enqueue job and return runId', async () => {
    const agentId = 'agent-1';
    const res = await request(app.getHttpServer())
      .post(`/agents/${agentId}/flow/execute`)
      .expect(201);

    expect(mockQueue.add).toHaveBeenCalledWith('execute-agent', { agentId });
    expect(res.body).toEqual({ status: 'queued', runId: 'test-job-1' });
  });
});
