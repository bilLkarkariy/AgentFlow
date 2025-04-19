import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRun } from './task-run.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaskRun])],
  exports: [TypeOrmModule],
})
export class TasksModule {}
