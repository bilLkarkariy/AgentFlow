import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Observabilité metrics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/metrics returns Prometheus metrics', async () => {
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .expect('Content-Type', /text\/plain/)
      .expect(200);
    const body: string = res.text;
    expect(body).toMatch(/http_server_duration_seconds/);
    expect(body).toMatch(/prompt_tokens_total/);
    expect(body).toMatch(/completion_tokens_total/);
    expect(body).toMatch(/price_usd_total/);
  });
});
