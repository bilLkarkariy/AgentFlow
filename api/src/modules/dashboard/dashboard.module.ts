import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRun } from '../tasks/task-run.entity';
import { Metric } from './metric.entity';
import { DashboardAggregatorService } from './dashboard.aggregator.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskRun, Metric])],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardAggregatorService],
})
export class DashboardModule {}
