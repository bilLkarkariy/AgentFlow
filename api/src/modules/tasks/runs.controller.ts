import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRun } from './task-run.entity';

@Controller('runs')
export class RunsController {
  constructor(
    @InjectRepository(TaskRun)
    private readonly repo: Repository<TaskRun>,
  ) {}

  /**
   * List the last 100 runs ordered by executedAt desc.
   */
  @Get()
  async list() {
    return this.repo.find({ order: { executedAt: 'DESC' }, take: 100 });
  }
}
