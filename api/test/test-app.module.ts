import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { FlowRunController } from '../src/modules/agents/flow/flow-run.controller';
import { FlowRunConsumer } from '../src/modules/agents/flow/flow-run.consumer';
import { FlowRunService } from '../src/modules/agents/flow/flow-run.service';
import { FlowService } from '../src/modules/agents/flow/flow.service';
import { FlowEngineService } from '../src/modules/agent-runtime/flow-engine.service';
import { RabbitMQService } from '../src/modules/rabbitmq/rabbitmq.service';
import { Agent } from '../src/modules/agents/agent.entity';
import { AgentFlow } from '../src/modules/agents/flow/agent-flow.entity';
import { AgentFlowNode } from '../src/modules/agents/flow/agent-flow-node.entity';
import { AgentFlowEdge } from '../src/modules/agents/flow/agent-flow-edge.entity';
import { FlowRun } from '../src/modules/agents/flow/flow-run.entity';
import { FlowRunNode } from '../src/modules/agents/flow/flow-run-node.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'sqlite',
        database: ':memory:',
        autoLoadEntities: true,
        synchronize: true,
        dropSchema: true,
      }),
    }),
    TypeOrmModule.forFeature([Agent, AgentFlow, AgentFlowNode, AgentFlowEdge, FlowRun, FlowRunNode]),
  ],
  controllers: [FlowRunController],
  providers: [
    FlowRunService,
    FlowRunConsumer,
    FlowService,
    FlowEngineService,
    RabbitMQService,
  ],
})
export class TestAppModule {}
