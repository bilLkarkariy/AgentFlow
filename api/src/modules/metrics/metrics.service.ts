import { Injectable, OnModuleInit } from '@nestjs/common';
import { Gauge, register } from 'prom-client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

@Injectable()
export class MetricsService implements OnModuleInit {
  private queueLengthGauge: Gauge<'queue'>;

  constructor(private configService: ConfigService) {
    this.queueLengthGauge = new Gauge({
      name: 'queue_length',
      help: 'Current length of the queue',
      labelNames: ['queue'] as const,
      registers: [register],
    });
  }

  onModuleInit() {
    // Default metrics are already collected in MetricsController
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async updateQueueLength() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
    const queue = new Queue('agent-run', { connection: { host, port } });
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
    const total = counts.waiting + counts.active + counts.delayed;
    this.queueLengthGauge.set({ queue: 'agent-run' }, total);
    await queue.close();
  }
}
