import { Controller, Get, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from './task-run.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Runs')
@Controller('runs')
export class RunsController {
  constructor(
    @InjectRepository(TaskRun)
    private readonly repo: Repository<TaskRun>,
    @InjectQueue('agent-run') private readonly agentQueue: Queue,
  ) {}

  /**
   * List the last 100 runs ordered by executedAt desc.
   */
  @Get()
  async list() {
    return this.repo.find({ order: { executedAt: 'DESC' }, take: 100 });
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a run' })
  @ApiResponse({ status: 200, description: 'Run cancelled' })
  async cancel(@Param('id') id: string) {
    const job = await this.agentQueue.getJob(id);
    if (job) {
      try {
        await job.discard();
        await job.remove();
      } catch (error) {
        // ignore errors if job is locked or cannot be removed
        console.error(error);
      }
    }
    return { cancelled: true };
  }
}
