import * as path from 'path';
import * as dotenv from 'dotenv';

// charger .env racine pour PENNYLANE
dotenv.config({ path: path.resolve(__dirname,'../../.env') });

// ensure API token present
const token = process.env.PENNYLANE_API_TOKEN!;
if (!token) throw new Error('PENNYLANE_API_TOKEN not set in .env');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app.module';

describe('PennylaneModule (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /pennylane/invoices', async () => {
    const res = await request(app.getHttpServer())
      .get('/pennylane/invoices')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // E2E test for creating a company customer
  it('POST /pennylane/company_customers should create and return a company customer', async () => {
    // include required fields: ledger_account and phone
    const companyData = {
      name: 'E2E Company',
      vat_number: 'FR12345678901',
      reg_no: 'REG456',
      billing_address: { address: '123 Main St', city: 'Paris', postal_code: '75001', country_alpha2: 'FR' },
      phone: '0123456789',
      ledger_account: null,
    };
    const res = await request(app.getHttpServer())
      .post('/pennylane/company_customers')
      .send(companyData)
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });

  // E2E test for creating an individual customer
  it('POST /pennylane/individual_customers should create and return an individual customer', async () => {
    const individualData = {
      first_name: 'John',
      last_name: 'Doe',
      billing_address: { address: '456 Elm St', city: 'Lyon', postal_code: '69000', country_alpha2: 'FR' }
    };
    const res = await request(app.getHttpServer())
      .post('/pennylane/individual_customers')
      .send(individualData)
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });
});