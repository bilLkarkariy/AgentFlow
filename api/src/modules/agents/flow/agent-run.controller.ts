import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { AgentRunDto } from '../dto/agent-run.dto';

@ApiTags('Agent')
@Controller('agent')
export class AgentRunController {
  constructor(
    @InjectQueue('agent-run') private readonly agentQueue: Queue,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('run')
  @ApiOperation({ summary: "Queue a run of an agent's stored flow (BullMQ, retried on failure)" })
  @ApiResponse({ status: 201, description: 'Agent job enqueued', schema: { properties: { jobId: { type: 'string' } } } })
  async run(@Body() dto: AgentRunDto) {
    const job = await this.agentQueue.add('default', { agentId: dto.agentId, input: dto.input });
    return { jobId: job.id.toString() };
  }
}
