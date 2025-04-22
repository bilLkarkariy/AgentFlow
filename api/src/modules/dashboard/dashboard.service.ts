import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
    const metrics = await this.metricRepo.find({
      where: { date: Between(from, to) },
      order: { date: 'ASC' },
    });
    return metrics.map(m => ({
      date: m.date,
      executionsCount: m.executionsCount,
      timeSavedMinutes: m.timeSavedMinutes,
    }));
  }
}
