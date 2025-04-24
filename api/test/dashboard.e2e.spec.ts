import * as dotenv from 'dotenv';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/modules/app.module';
import { DashboardAggregatorService } from '../src/modules/dashboard/dashboard.aggregator.service';

describe('DashboardModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Load env
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    // Run initial ROI aggregation to populate metrics
    const aggregator = app.get(DashboardAggregatorService);
    await aggregator.handleCron();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /dashboard/roi should return stats for seeded data', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request(app.getHttpServer())
      .get(`/dashboard/roi?from=${today}&to=${today}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
    const stat = response.body[0];
    expect(stat).toHaveProperty('date');
    expect(stat).toHaveProperty('executionsCount');
    expect(stat).toHaveProperty('timeSavedMinutes');
  });
});
