import * as dotenv from 'dotenv';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app.module';

describe('UsersModule (e2e) - CRUD', () => {
  let app: INestApplication;
  let createdUserId: string;

  beforeAll(async () => {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'e2e@example.com', name: 'E2E User' })
      .expect(HttpStatus.CREATED);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('e2e@example.com');
    createdUserId = res.body.id;
  });

  it('GET /users', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .expect(HttpStatus.OK);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(u => u.id === createdUserId)).toBe(true);
  });

  it('GET /users/:id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${createdUserId}`)
      .expect(HttpStatus.OK);
    expect(res.body.id).toBe(createdUserId);
  });

  it('PATCH /users/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${createdUserId}`)
      .send({ name: 'Updated Name' })
      .expect(HttpStatus.OK);
    expect(res.body.name).toBe('Updated Name');
  });

  it('DELETE /users/:id', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${createdUserId}`)
      .expect(HttpStatus.NO_CONTENT);
  });

  it('GET /users/:id after delete', async () => {
    await request(app.getHttpServer())
      .get(`/users/${createdUserId}`)
      .expect(HttpStatus.NOT_FOUND);
  });
});
