import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';

// Mock bullmq.Queue to avoid real Redis calls
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    getJobCounts: jest
      .fn()
      .mockResolvedValue({ waiting: 1, active: 2, delayed: 3, failed: 4 }),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
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

  async function scrape(): Promise<string> {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200);
    return res.text;
  }

  it('exposes agentflow_queue_depth per state', async () => {
    await service.updateQueueDepth();
    const body = await scrape();

    expect(body).toMatch(/agentflow_queue_depth\{queue="agent-run",state="waiting"\} 1/);
    expect(body).toMatch(/agentflow_queue_depth\{queue="agent-run",state="active"\} 2/);
    expect(body).toMatch(/agentflow_queue_depth\{queue="agent-run",state="delayed"\} 3/);
    expect(body).toMatch(/agentflow_queue_depth\{queue="agent-run",state="failed"\} 4/);
  }, 10000);

  it('exposes the Annexe F metric contract with build info', async () => {
    const body = await scrape();

    const families = new Set(
      body
        .split('\n')
        .filter(line => line.startsWith('# TYPE agentflow_'))
        .map(line => line.split(' ')[2]),
    );
    expect(families.size).toBeGreaterThanOrEqual(8);
    for (const name of [
      'agentflow_agent_runs_total',
      'agentflow_agent_run_duration_seconds',
      'agentflow_llm_tokens_total',
      'agentflow_llm_cost_usd_total',
      'agentflow_queue_depth',
      'agentflow_python_runner_failures_total',
      'agentflow_python_runner_circuit_state',
      'agentflow_build_info',
    ]) {
      expect(families).toContain(name);
    }
    expect(body).toMatch(/agentflow_build_info\{version="[^"]+",commit="[^"]+"\} 1/);
    // Circuit breaker starts closed.
    expect(body).toMatch(/agentflow_python_runner_circuit_state 0/);
  }, 10000);

  it('exposes node runtime metrics and no per-job label', async () => {
    const body = await scrape();

    expect(body).toContain('process_cpu_user_seconds_total');
    expect(body).not.toContain('jobId');
    // the legacy un-prefixed gauge is gone
    expect(body).not.toMatch(/^queue_/m);
  }, 10000);
});
