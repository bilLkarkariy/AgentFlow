import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from '../tasks/task-run.entity';

export interface RoiStat {
  date: string;
  executionsCount: number;
  timeSavedMinutes: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(TaskRun)
    private readonly taskRunRepo: Repository<TaskRun>,
  ) {}

  async getRoiStats(from: string, to: string): Promise<RoiStat[]> {
    const rows = await this.taskRunRepo
      .createQueryBuilder('t')
      .select("DATE(t.executedAt)", 'date')
      .addSelect('COUNT(*)', 'executionsCount')
      .where("DATE(t.executedAt) BETWEEN :from AND :to", { from, to })
      .groupBy('date')
      .orderBy('date')
      .getRawMany<{ date: string; executionsCount: string }>();

    const timeSavedPerRun = parseFloat(
      process.env.TIME_SAVED_PER_RUN || '5',
    );

    return rows.map(r => ({
      date: r.date,
      executionsCount: +r.executionsCount,
      timeSavedMinutes: +r.executionsCount * timeSavedPerRun,
    }));
  }
}
