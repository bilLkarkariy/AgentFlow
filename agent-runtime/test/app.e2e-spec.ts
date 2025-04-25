import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Agent Runtime (e2e)', () => {
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

  it('/run (POST) should return a valid JSON schema response', () => {
    return request(app.getHttpServer())
      .post('/run')
      .send({ prompt: 'Test subscription for AcmeCorp starting 2025-05-01' })
      .expect(201)
      .then((res) => {
        expect(res.body).toHaveProperty('output');
        expect(Array.isArray(res.body.output)).toBe(true);
        const output = res.body.output[0];
        expect(output).toBeDefined();
        const content = output.content[0];
        expect(typeof content.text).toBe('string');
        const obj = JSON.parse(content.text);
        expect(obj).toHaveProperty('platform');
        expect(obj).toHaveProperty('startDate');
        expect(obj).toHaveProperty('renewalDate');
        expect(obj).toHaveProperty('manageUrl');
      });
  });
});
