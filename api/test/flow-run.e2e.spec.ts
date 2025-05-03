/// <reference types="jest" />
// Force using Postgres for E2E
process.env.POSTGRES_URL = process.env.POSTGRES_URL ?? 'postgres://postgres:postgres@localhost:5433/agentflow_test';
delete process.env.JEST_WORKER_ID;
process.env.NODE_ENV = 'development';

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

jest.mock(
  '../src/modules/agent-runtime/python-worker.pool',
  () => ({
    createPool: () => ({
      acquire: async () => ({}),
      destroy: async () => Promise.resolve(),
      drain: async () => Promise.resolve(),
      clear: async () => Promise.resolve(),
    }),
  }),
);

import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { of } from 'rxjs';
import { AppModule } from '../src/modules/app.module';
import { FlowEngineService } from '../src/modules/agent-runtime/flow-engine.service';
import { AgentRuntimeService } from '../src/modules/agent-runtime/agent-runtime.service';
import { AgentPythonClientService } from '../src/modules/agent-runtime/agent-python-client.service';
import { FlowService } from '../src/modules/agents/flow/flow.service';

describe('FlowController SSE (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const mockFlowEngine = {
      runFlow: jest.fn().mockReturnValue(of('chunk1', 'chunk2', 'chunk3')),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FlowEngineService)
      .useValue(mockFlowEngine)
      .overrideProvider(AgentRuntimeService)
      .useValue({})
      .overrideProvider(AgentPythonClientService)
      .useValue({ run: jest.fn() })
      .overrideProvider(FlowService)
      .useValue({ save: jest.fn().mockResolvedValue({ nodes: [], edges: [], mappings: [] }), getDto: jest.fn().mockResolvedValue({ nodes: [], edges: [], mappings: [] }) })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await dataSource.destroy();
    await app.close();
  });

  it('should stream tokens via SSE', async () => {
    const agentId = 'test-agent';
    await request(app.getHttpServer())
      .put(`/agents/${agentId}/flow`)
      .send({ nodes: [], edges: [], mappings: [] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/agents/${agentId}/flow/execute?input=hello`)
      .set('Accept', 'text/event-stream')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', chunk => { data += chunk.toString(); });
        res.on('end', () => cb(null, data));
      })
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);

    const text = res.body;
    expect(text).toContain('data: chunk1');
    expect(text).toContain('data: chunk2');
    expect(text).toContain('data: chunk3');
  });

  it('should stream tokens via POST /run SSE', async () => {
    const agentId = 'test-agent';
    const payload = { nodes: [], edges: [], mappings: [] };
    const res = await request(app.getHttpServer())
      .post(`/agents/${agentId}/flow/run?input=hello`)
      .set('Accept', 'text/event-stream')
      .send(payload)
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', chunk => { data += chunk.toString(); });
        res.on('end', () => cb(null, data));
      })
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);
    const text = res.body;
    expect(text).toContain('data: chunk1');
    expect(text).toContain('data: chunk2');
    expect(text).toContain('data: chunk3');
  });
});
