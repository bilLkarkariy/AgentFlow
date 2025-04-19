import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent } from './agent.entity';
import { DslParserService } from './dsl-parser.service';
import { ExecutionController } from './execution.controller';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [TypeOrmModule.forFeature([Agent]), QueuesModule,],
  controllers: [AgentsController, ExecutionController],
  providers: [AgentsService, DslParserService],
})
export class AgentsModule {}