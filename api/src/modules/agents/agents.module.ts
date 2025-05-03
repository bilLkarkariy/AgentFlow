import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent } from './agent.entity';
import { AgentFlow } from './flow/agent-flow.entity';
import { AgentFlowNode } from './flow/agent-flow-node.entity';
import { AgentFlowEdge } from './flow/agent-flow-edge.entity';
import { DslParserService } from './dsl-parser.service';
import { ExecutionController } from './execution.controller';
import { QueuesModule } from '../queues/queues.module';
import { FlowController } from './flow/flow.controller';
import { FlowService } from './flow/flow.service';
import { FlowGateway } from './flow/flow.gateway';
import { FlowRunController } from './flow/flow-run.controller';
import { FlowRunService } from './flow/flow-run.service';
import { FlowRun } from './flow/flow-run.entity';
import { FlowRunNode } from './flow/flow-run-node.entity';
import { FlowRunConsumer } from './flow/flow-run.consumer';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, AgentFlow, AgentFlowNode, AgentFlowEdge, FlowRun, FlowRunNode]),
    QueuesModule,
    RabbitMQModule,
    AgentRuntimeModule,
  ],
  controllers: [AgentsController, ExecutionController, FlowController, FlowRunController],
  providers: [AgentsService, DslParserService, FlowService, FlowGateway, FlowRunService, FlowRunConsumer],
  exports: [FlowGateway],
})
export class AgentsModule {}