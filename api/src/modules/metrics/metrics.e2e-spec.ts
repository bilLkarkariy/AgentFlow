import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';

// Mock bullmq.Queue to avoid real Redis calls
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 1, active: 2, delayed: 3 }),
    close: jest.fn(),
  })),
}));

describe('Metrics E2E', () => {
  let app: INestApplication;
  let service: MetricsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MetricsModule,
      ],
    }).compile();

    service = moduleFixture.get<MetricsService>(MetricsService);
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('/metrics should include queue_length gauge', async () => {
    // Force update
    await service.updateQueueLength();

    const res = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200);

    expect(res.text).toMatch(/queue_length\{queue="agent-run"\} 6/);
  }, 10000);
});
