import * as dotenv from 'dotenv';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app.module';

jest.setTimeout(30000);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Billing (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /billing/session', async () => {
    const testEmail = `e2e-${Date.now()}@example.com`;
    const createRes = await request(app.getHttpServer())
      .post('/stripe/customer')
      .send({ email: testEmail })
      .expect(HttpStatus.CREATED);
    const customerId = createRes.body.id;
    const returnUrl = 'http://localhost:3000';
    const res = await request(app.getHttpServer())
      .post('/billing/session')
      .send({ customerId, returnUrl })
      .expect(HttpStatus.CREATED);

    expect(res.body.url).toBeDefined();
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url).toContain('stripe.com');
  });
});
