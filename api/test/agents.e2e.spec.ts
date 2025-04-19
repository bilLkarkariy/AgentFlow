import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/modules/app.module';

describe('AgentsModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JEST_WORKER_ID = '1';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agents/from-prompt (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/agents/from-prompt')
      .send({ prompt: 'Quand je reçois un email de bob@example.com, lis le sujet' })
      .expect(201);
    expect(res.body.name).toEqual('Email bob@example.com → Sujet');
  });
});
