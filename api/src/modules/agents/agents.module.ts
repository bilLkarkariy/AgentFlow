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

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, AgentFlow, AgentFlowNode, AgentFlowEdge]),
    QueuesModule,
  ],
  controllers: [AgentsController, ExecutionController, FlowController],
  providers: [AgentsService, DslParserService, FlowService, FlowGateway],
  exports: [FlowGateway],
})
export class AgentsModule {}