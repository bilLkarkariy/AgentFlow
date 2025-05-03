import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRun } from './task-run.entity';
import { RunsController } from './runs.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskRun]),
    BullModule.registerQueue({ name: 'agent-run' }),
  ],
  controllers: [RunsController],
  exports: [TypeOrmModule],
})
export class TasksModule {}
