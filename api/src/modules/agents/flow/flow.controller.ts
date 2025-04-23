import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FlowService } from './flow.service';
import { FlowDto } from './flow.dto';

@Controller('agents/:id/flow')
export class FlowController {
  constructor(
    private readonly service: FlowService,
    @InjectQueue('execute-agent') private readonly execQueue: Queue,
  ) {}

  @Get()
  get(@Param('id') agentId: string) {
    return this.service.getDto(agentId);
  }

  @Put()
  save(@Param('id') agentId: string, @Body() body: FlowDto) {
    return this.service.save(agentId, body);
  }

  @Post('execute')
  async execute(@Param('id') agentId: string) {
    const job = await this.execQueue.add('execute-agent', { agentId });
    return { status: 'queued', runId: job.id };
  }
}
