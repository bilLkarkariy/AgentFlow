import * as path from 'path';
import * as dotenv from 'dotenv';
// charger .env racine pour Quonto E2E
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/modules/app.module';

// Récupère account ID depuis .env
const accountId = process.env.QUONTO_ACCOUNT_ID || process.env.QUONTO_CLIENT_ID;
const describeQuonto = describe;

describeQuonto('QuontoModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /quonto/transactions?accountId=xxx retourne un array', async () => {
    const res = await request(app.getHttpServer())
      .get('/quonto/transactions')
      .query({ accountId })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
