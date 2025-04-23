import { Controller, Get, Param, Post, Delete } from '@nestjs/common';
import { DLQBullService } from './dlq-bull.service';
import { Job } from 'bullmq';

@Controller('api/dlq/bull')
export class DLQBullController {
  constructor(private readonly service: DLQBullService) {}

  @Get(':queueName')
  async getFailed(@Param('queueName') queueName: string): Promise<Job[]> {
    return this.service.getFailed(queueName);
  }

  @Post(':queueName/:jobId/retry')
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<void> {
    return this.service.retryJob(queueName, jobId);
  }

  @Delete(':queueName/:jobId')
  async removeJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<void> {
    return this.service.removeJob(queueName, jobId);
  }
}
