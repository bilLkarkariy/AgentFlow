import { Test, TestingModule } from '@nestjs/testing';
import * as path from 'path';
import * as dotenv from 'dotenv';
// Load root .env for Slack E2E channel
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app.module';

// Ensure SLACK_BOT_TOKEN and SLACK_E2E_CHANNEL are set in your .env
const channel = process.env.SLACK_E2E_CHANNEL || '#e2e';
const text = `E2E test ${Date.now()}`;

describe('SlackModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /slack/message then GET /slack/messages', async () => {
    // Send a test message
    const postRes = await request(app.getHttpServer())
      .post('/slack/message')
      .send({ channel, text })
      .expect(201);
    expect(postRes.body.ok).toBe(true);

    // Wait for propagation
    await new Promise((r) => setTimeout(r, 1000));

    // Retrieve messages
    const getRes = await request(app.getHttpServer())
      .get('/slack/messages')
      .query({ channel, limit: 5 })
      .expect(200);
    const messages: any[] = getRes.body;

    expect(Array.isArray(messages)).toBe(true);
    expect(messages.some((m) => m.text === text)).toBe(true);
  });
});
