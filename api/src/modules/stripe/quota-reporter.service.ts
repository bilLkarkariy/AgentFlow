import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskRun } from '../tasks/task-run.entity';
import { StripeService } from './stripe.service';

@Injectable()
export class QuotaReporterService {
  private readonly logger = new Logger(QuotaReporterService.name);

  constructor(
    @InjectRepository(TaskRun) private readonly repo: Repository<TaskRun>,
    private readonly stripe: StripeService,
  ) {}

  // Every day at 01:00 UTC report usage to Stripe
  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'stripe-usage-report',
  })
  async reportDailyUsage() {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 1);
    const runs = await this.repo.find({ where: { executedAt: MoreThan(since) } });

    // Aggregate by subscriptionItemId
    const map = new Map<string, number>();
    for (const r of runs) {
      map.set(r.subscriptionItemId, (map.get(r.subscriptionItemId) ?? 0) + 1);
    }

    for (const [subItemId, qty] of map.entries()) {
      try {
        await this.stripe.createUsageRecord(subItemId, qty);
        this.logger.log(`Reported ${qty} tasks for ${subItemId}`);
      } catch (err) {
        this.logger.error(`Failed to report usage for ${subItemId}`, err as Error);
      }
    }
  }
}
