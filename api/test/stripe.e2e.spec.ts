import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/modules/app.module';

describe('StripeModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/stripe/customer (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/stripe/customer')
      .send({ email: 'bob@example.com' })
      .expect(201);
    expect(res.body.id).toBeDefined();
  });
});
