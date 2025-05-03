import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from '../tasks/task-run.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(TaskRun)
    private readonly taskRunRepo: Repository<TaskRun>,
  ) {}

  async onModuleInit() {
    const isTestDb = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
    if (isTestDb) {
      this.logger.log('Test environment detected, skipping TaskRun seeding');
      return;
    }
    const count = await this.taskRunRepo.count();
    if (count === 0) {
      const now = new Date();
      const seeds: TaskRun[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        seeds.push(
          this.taskRunRepo.create({
            subscriptionItemId: `seed-${i}`,
            executedAt: date,
          }),
        );
      }
      await this.taskRunRepo.save(seeds);
      this.logger.log(`Seeded ${seeds.length} TaskRun records.`);
    } else {
      this.logger.log(`Database has ${count} TaskRun records, skipping seeding.`);
    }
  }
}
