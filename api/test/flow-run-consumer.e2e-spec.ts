/// <reference types="jest" />
// jest globals provided
// Increase timeout for async operations
jest.setTimeout(30000);

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { of } from 'rxjs';

import { TestAppModule } from './test-app.module';
import { FlowService } from '../src/modules/agents/flow/flow.service';
import { FlowEngineService } from '../src/modules/agent-runtime/flow-engine.service';
import { RabbitMQService } from '../src/modules/rabbitmq/rabbitmq.service';
import { FlowRun } from '../src/modules/agents/flow/flow-run.entity';
import { FlowRunNode } from '../src/modules/agents/flow/flow-run-node.entity';
import { Agent } from '../src/modules/agents/agent.entity';
import { AgentFlow } from '../src/modules/agents/flow/agent-flow.entity';

// scheduling disabled in AppModule when NODE_ENV=test

describe('FlowRun (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let runRepo;
  let runNodeRepo;
  let agentRepo;
  let flowRepo;

  beforeAll(async () => {
    const mockFlowService = {
      getDto: jest.fn().mockResolvedValue({
        nodes: [ { id: 'n1', type: 'test', category: 'agent', positionX: 0, positionY: 0, data: {} } ],
        edges: [],
        mappings: []
      }),
    };
    const mockFlowEngine = { runFlow: jest.fn().mockReturnValue(of('a', 'b')) };
    const fakeRabbit = {
      subscribers: {} as Record<string, Function>,
      subscribe(event: string, handler: Function) { this.subscribers[event] = handler; },
      publish(event: string, payload: any) { if (this.subscribers[event]) this.subscribers[event](payload); }
    };

    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [TestAppModule] })
      .overrideProvider(FlowService).useValue(mockFlowService)
      .overrideProvider(FlowEngineService).useValue(mockFlowEngine)
      .overrideProvider(RabbitMQService).useValue(fakeRabbit)
      .compile();

    app = moduleRef.createNestApplication();
    app.enableShutdownHooks();
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    runRepo = dataSource.getRepository<FlowRun>(FlowRun);
    runNodeRepo = dataSource.getRepository<FlowRunNode>(FlowRunNode);
    agentRepo = dataSource.getRepository<Agent>(Agent);
    flowRepo = dataSource.getRepository<AgentFlow>(AgentFlow);

    // seed a test agent and flow with fixed id
    await agentRepo.insert({ id: 'agent1', name: 'Test', dsl: {}, active: true });
    const agent = await agentRepo.findOne({ where: { id: 'agent1' } });
    const flow = flowRepo.create({ agent, version: 1, name: '', mappings: [] });
    await flowRepo.save(flow);
  });

  afterAll(async () => {
    // clean up application and database connection
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should start run and process tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/agents/agent1/flow/runs')
      .send({ input: 'hello' })
      .expect(201);
    const { id: runId, status, stats } = res.body;
    expect(status).toBe('pending');
    expect(stats).toBeNull();

    // allow consumer to process
    await new Promise(r => setTimeout(r, 50));

    const run = await runRepo.findOne({ where: { id: runId } });
    expect(run.status).toBe('completed');
    expect(run.stats.tokens).toBe(2);
    expect(run.stats.euros).toBeCloseTo(0.002);

    const nodes = await runNodeRepo.find({ where: { run: { id: runId } } });
    expect(nodes).toHaveLength(2);
    // ensure correct outputs regardless of creation order
    const outputs = nodes.map(n => n.output).sort();
    expect(outputs).toEqual(['a', 'b']);
  });
});
