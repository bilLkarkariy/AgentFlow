import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from './metric.entity';

export interface RoiStat {
  date: string;
  executionsCount: number;
  timeSavedMinutes: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Metric)
    private readonly metricRepo: Repository<Metric>,
  ) {}

  async getRoiStats(from: string, to: string): Promise<RoiStat[]> {
    const perRun = parseInt(process.env.TIME_SAVED_PER_RUN ?? '0', 10);
    const raw = await this.metricRepo.createQueryBuilder('t')
      .select('t.date', 'date')
      .addSelect('SUM(t.executionsCount)', 'executionsCount')
      .where('t.date BETWEEN :from AND :to', { from, to })
      .groupBy('t.date')
      .orderBy('t.date', 'ASC')
      .getRawMany();
    return raw.map(r => ({
      date: r.date,
      executionsCount: parseInt(r.executionsCount, 10),
      timeSavedMinutes: parseInt(r.executionsCount, 10) * perRun,
    }));
  }
}
