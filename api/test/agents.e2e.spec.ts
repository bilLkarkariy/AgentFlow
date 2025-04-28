import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/modules/app.module';
import { AgentPythonClientService } from '../src/modules/agent-runtime/agent-python-client.service';
import { AgentRuntimeService } from '../src/modules/agent-runtime/agent-runtime.service';
import { of } from 'rxjs';
import request from 'supertest';

describe('AgentsModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JEST_WORKER_ID = '1';
    // stub gRPC client for AgentRunProcessor
    const mockGrpcClient = {
      getService: (_serviceName: string) => ({
        run: (_req: any) =>
          of(
            { content: [{ text: 'chunk1' }] },
            { content: [{ text: 'chunk2' }] },
          ),
      }),
    };
    // stub AgentPythonClientService for ExecutionController
    const mockAgentPython = {
      runAgent: (_req: any) =>
        of({ token: 'chunk1' }, { token: 'chunk2' }),
    };
    const mockAgentRuntimeService = { run: async (_prompt: string, _params: any) => ['chunk1', 'chunk2'] };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('AGENT_RUNTIME')
      .useValue(mockGrpcClient)
      .overrideProvider(AgentRuntimeService)
      .useValue(mockAgentRuntimeService)
      .overrideProvider(AgentPythonClientService)
      .useValue(mockAgentPython)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agents/from-prompt (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/agents/from-prompt')
      .send({ prompt: 'Quand je reçois un email de bob@example.com, lis le sujet' })
      .expect(201);
    expect(res.body.name).toEqual('Email bob@example.com → Sujet');
  });

  it('/agents/execute/:id (POST)', async () => {
    // create agent from prompt
    const createRes = await request(app.getHttpServer())
      .post('/agents/from-prompt')
      .send({ prompt: 'Quand je reçois un email de test@example.com, lis le sujet' })
      .expect(201);
    const id = createRes.body.id;
    // execute flow
    const execRes = await request(app.getHttpServer())
      .post(`/agents/execute/${id}`)
      .expect(200);
    expect(execRes.body).toHaveProperty('result');
    expect(execRes.body.result).toEqual(['chunk1', 'chunk2']);
  });
});
