import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Queue } from 'bullmq';

@ApiTags('Agent')
@Controller('agent')
export class AgentController {
  constructor(
    @InjectQueue('agent-run') private readonly agentQueue: Queue,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('run')
  @ApiOperation({ summary: 'Run an agent task via HTTP as fallback' })
  @ApiBody({ schema: {
      properties: {
        flowId: { type: 'string' },
        nodeId: { type: 'string' },
        input: { type: 'object' },
      },
      required: ['flowId', 'nodeId', 'input'],
    }})
  @ApiResponse({ status: 201, description: 'Agent job enqueued', schema: { properties: { jobId: { type: 'string' } } } })
  async run(@Body() dto: { flowId: string; nodeId: string; input: any }) {
    const job = await this.agentQueue.add('default', dto);
    return { jobId: job.id.toString() };
  }
}
