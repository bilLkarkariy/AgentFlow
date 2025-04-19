import { Controller, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentsService } from './agents.service';
import { EXECUTE_AGENT_JOB } from '../queues/execute.processor';

@Controller('agents')
export class ExecutionController {
  constructor(
    private readonly agents: AgentsService,
    @InjectQueue('agents') private readonly execQueue: Queue,
  ) {}

  @Post('execute/:id')
  async execute(@Param('id') id: string) {
    const agent = await this.agents.findOne(id);
    if (!agent) {
      return { error: 'Agent not found' };
    }
    await this.execQueue.add(EXECUTE_AGENT_JOB, {
      agentId: id,
      dsl: agent.dsl,
    });
    return { status: 'queued', agentId: id };
  }
}
