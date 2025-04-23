import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRun } from './task-run.entity';
import { RunsController } from './runs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaskRun])],
  controllers: [RunsController],
  exports: [TypeOrmModule],
})
export class TasksModule {}
