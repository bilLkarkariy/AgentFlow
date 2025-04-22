import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';

@Injectable()
export class DlqRetryService {
  private readonly logger = new Logger(DlqRetryService.name);
  private readonly queue: Queue;

  constructor() {
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    };
    this.queue = new Queue('alert-slack', { connection });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDlqRetry() {
    const failedJobs = await this.queue.getFailed(0, -1);
    for (const job of failedJobs) {
      this.logger.log(`Retrying failed job ${job.id}`);
      await job.retry();
    }
  }
}
