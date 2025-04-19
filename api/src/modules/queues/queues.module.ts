import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GmailProcessor } from './gmail.processor';
import { GmailModule } from '../gmail/gmail.module';
import { GmailQueueController } from './gmail.queue.controller';
import { ExecuteProcessor } from './execute.processor';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'gmail',
    }),
    BullModule.registerQueue({ name: 'agents' }),
    GmailModule,
    TasksModule,
  ],
  providers: [GmailProcessor, ExecuteProcessor],
  controllers: [GmailQueueController],
  exports: [
    BullModule.registerQueue({ name: 'agents' })
  ],
})
export class QueuesModule {}
