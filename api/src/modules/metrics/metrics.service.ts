import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { AgentMetricsService } from './agent-metrics.service';

const QUEUE_NAME = 'agent-run';
const QUEUE_STATES = ['waiting', 'active', 'delayed', 'failed'] as const;

/**
 * Publishes `agentflow_queue_depth{queue,state}`.
 *
 * The BullMQ queue is created once and kept for the lifetime of the process:
 * the previous implementation opened and closed a Redis connection every five
 * seconds, which showed up as a connection storm on the Redis dashboards.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly queue: Queue;

  constructor(
    private readonly configService: ConfigService,
    private readonly metrics: AgentMetricsService,
  ) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: {
        host: this.configService.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number(this.configService.get<string>('REDIS_PORT') ?? 6379),
      },
    });
    // Redis being down must never take the api down: probes stay green.
    this.queue.on('error', err =>
      this.logger.warn(`agent-run queue connection error: ${err.message}`),
    );
    // Publish the series immediately, before the first cron tick.
    for (const state of QUEUE_STATES) {
      this.metrics.setQueueDepth(QUEUE_NAME, state, 0);
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async updateQueueDepth(): Promise<void> {
    try {
      const counts = await this.queue.getJobCounts(...QUEUE_STATES);
      for (const state of QUEUE_STATES) {
        this.metrics.setQueueDepth(QUEUE_NAME, state, counts[state] ?? 0);
      }
    } catch (err) {
      this.logger.warn(
        `Unable to read ${QUEUE_NAME} job counts: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => undefined);
  }
}
