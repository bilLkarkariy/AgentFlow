import { Module } from '@nestjs/common';
import { DlqRetryService } from './dlq-retry.service';

@Module({
  providers: [DlqRetryService],
})
export class DlqRetryModule {}
