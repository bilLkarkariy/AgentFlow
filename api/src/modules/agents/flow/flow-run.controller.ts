import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { FlowRunService } from './flow-run.service';
import { FlowRun } from './flow-run.entity';

@ApiTags('Flow Runs')
@Controller('agents/:id/flow')
export class FlowRunController {
  constructor(private readonly runService: FlowRunService) {}

  @Post('runs')
  @ApiOperation({ summary: 'Start a new flow run asynchronously' })
  @ApiBody({ schema: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] } })
  async start(@Param('id') agentId: string, @Body('input') input: string): Promise<FlowRun> {
    return this.runService.startRun(agentId, input);
  }
}
