import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { QuotaReporterService } from './quota-reporter.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  providers: [StripeService, QuotaReporterService],
  controllers: [StripeController],
  exports: [StripeService],
})
export class StripeModule {}
