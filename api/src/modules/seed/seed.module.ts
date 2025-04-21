import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskRun } from '../tasks/task-run.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskRun])],
  providers: [SeedService],
})
export class SeedModule {}
