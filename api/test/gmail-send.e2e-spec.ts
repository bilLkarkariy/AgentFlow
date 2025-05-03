import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/modules/app.module';
import { GmailService } from '../src/modules/gmail/gmail.service';

jest.mock('uuid', () => ({ v4: () => 'test-run-id' }));

describe('Gmail Send Node (e2e)', () => {
  let app: INestApplication;
  const mockSend = { id: 'msg-id', threadId: 'thread-id' };
  const sendSpy = jest.fn().mockResolvedValue(mockSend);
  const mockStatus = { id: 'test-run-id', status: 'success', result: mockSend, error: null, createdAt: '2025-05-02T00:00:00Z', updatedAt: '2025-05-02T00:00:00Z' };
  const statusSpy = jest.fn().mockResolvedValue(mockStatus);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GmailService)
      .useValue({ sendMail: sendSpy, getStatus: statusSpy })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/POST oauth/google/nodes/gmail/send', async () => {
    const payload = { to: 'user@example.com', subject: 'Test', body: 'Hello' };
    const res = await request(app.getHttpServer())
      .post('/oauth/google/nodes/gmail/send')
      .send(payload)
      .expect(HttpStatus.CREATED);

    expect(res.body).toEqual(mockSend);
    expect(sendSpy).toHaveBeenCalledWith(payload);
  });

  it('/POST oauth/google/nodes/gmail/send async', async () => {
    const payload = { to: 'user@example.com', subject: 'Test', body: 'Hello', mode: 'async' };
    const res = await request(app.getHttpServer())
      .post('/oauth/google/nodes/gmail/send')
      .send(payload)
      .expect(HttpStatus.ACCEPTED);
    expect(res.body).toEqual({ runId: 'test-run-id' });
    expect(sendSpy).toHaveBeenCalledWith({ ...payload, runId: 'test-run-id' });
  });

  it('/GET oauth/google/nodes/gmail/send/:runId/status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/oauth/google/nodes/gmail/send/${mockStatus.id}/status`)
      .expect(HttpStatus.OK);
    expect(res.body).toEqual(mockStatus);
    expect(statusSpy).toHaveBeenCalledWith(mockStatus.id);
  });
});
