import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { of } from 'rxjs';
import { AppModule } from '../src/modules/app.module';
import { FlowEngineService } from '../src/modules/agent-runtime/flow-engine.service';

describe('FlowController SSE (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mockFlowEngine = {
      runFlow: jest.fn().mockReturnValue(of('chunk1', 'chunk2', 'chunk3')),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FlowEngineService)
      .useValue(mockFlowEngine)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should stream tokens via SSE', async () => {
    const agentId = 'test-agent';
    // Initialize flow for agent
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

    const text = res.text;
    expect(text).toContain('data: chunk1');
    expect(text).toContain('data: chunk2');
    expect(text).toContain('data: chunk3');
  });
});
