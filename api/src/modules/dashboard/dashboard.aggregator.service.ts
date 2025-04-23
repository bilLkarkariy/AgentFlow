import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from '../tasks/task-run.entity';
import { Metric } from './metric.entity';

@Injectable()
export class DashboardAggregatorService implements OnModuleInit {
  private readonly logger = new Logger(DashboardAggregatorService.name);

  constructor(
    @InjectRepository(TaskRun)
    private readonly taskRunRepo: Repository<TaskRun>,
    @InjectRepository(Metric)
    private readonly metricRepo: Repository<Metric>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Starting ROI metrics aggregation');
    const lastMetric = await this.metricRepo.findOne({ where: {}, order: { date: 'DESC' } });
    const startDate = lastMetric ? lastMetric.date : process.env.START_AGGREGATION_DATE || '1970-01-01';
    const endDate = new Date().toISOString().slice(0, 10);

    const rows = await this.taskRunRepo
      .createQueryBuilder('t')
      .select('DATE(t.executedAt)', 'date')
      .addSelect('COUNT(*)', 'executionsCount')
      .where('DATE(t.executedAt) > :startDate AND DATE(t.executedAt) <= :endDate', { startDate, endDate })
      .groupBy('date')
      .orderBy('date')
      .getRawMany<{ date: string; executionsCount: string }>();

    const timeSavedPerRun = parseFloat(process.env.TIME_SAVED_PER_RUN || '5');
    const metrics = rows.map(r => {
      const m = new Metric();
      m.date = r.date;
      const count = parseInt(r.executionsCount, 10);
      m.executionsCount = count;
      m.timeSavedMinutes = count * timeSavedPerRun;
      return m;
    });

    if (metrics.length) {
      await this.metricRepo.save(metrics);
      this.logger.log(`Aggregated ${metrics.length} new metrics`);
    } else {
      this.logger.log('No new metrics to aggregate');
    }
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Running initial ROI metrics aggregation');
    try {
      await this.handleCron();
    } catch (error) {
      this.logger.error('Initial ROI aggregation failed', (error as Error).message);
    }
  }
}
