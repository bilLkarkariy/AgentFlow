/**
 * POST /internal/tools/:toolId is only for the Python runners: without the
 * internal token nothing runs, and `gmail-send` sends no mail.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INTERNAL_TOKEN_HEADER, INTERNAL_TOOLS_TOKEN } from '../src/common/internal-token';
import { GmailService } from '../src/modules/gmail/gmail.service';
import { SummarizeService } from '../src/modules/tools/summarize.service';
import { ToolController } from '../src/modules/tools/tool.controller';

describe('Internal tools (e2e)', () => {
  let app: INestApplication;
  const sendMail = jest.fn().mockResolvedValue({ id: 'msg-id' });
  const mail = { to: 'someone@example.com', subject: 'Hi', body: 'Hello' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ToolController],
      providers: [SummarizeService, { provide: GmailService, useValue: { sendMail } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses gmail-send without the internal token, and sends nothing', async () => {
    await request(app.getHttpServer()).post('/internal/tools/gmail-send').send(mail).expect(401);
    await request(app.getHttpServer())
      .post('/internal/tools/gmail-send')
      .set(INTERNAL_TOKEN_HEADER, 'not-the-token')
      .send(mail)
      .expect(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('refuses every other tool the same way', async () => {
    await request(app.getHttpServer())
      .post('/internal/tools/summarize-block')
      .send({ text: 'x' })
      .expect(401);
  });

  it('runs the tool for a caller that has the token', async () => {
    await request(app.getHttpServer())
      .post('/internal/tools/gmail-send')
      .set(INTERNAL_TOKEN_HEADER, INTERNAL_TOOLS_TOKEN)
      .send(mail)
      .expect(201, { id: 'msg-id' });
    expect(sendMail).toHaveBeenCalledWith(mail);
  });
});
