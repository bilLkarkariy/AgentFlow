import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRun } from '../tasks/task-run.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskRun])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
