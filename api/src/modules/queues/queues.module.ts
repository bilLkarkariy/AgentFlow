import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GmailProcessor } from './gmail.processor';
import { GmailModule } from '../gmail/gmail.module';
import { GmailQueueController } from './gmail.queue.controller';
import { ExecuteProcessor } from './execute.processor';
import { TasksModule } from '../tasks/tasks.module';
import { SlackAlertProcessor } from './slack-alert.processor';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'gmail' }),
    BullModule.registerQueue({ name: 'agents' }),
    BullModule.registerQueue({ name: 'alert-slack' }),
    GmailModule,
    SlackModule,
    TasksModule,
  ],
  providers: [GmailProcessor, ExecuteProcessor, SlackAlertProcessor],
  controllers: [GmailQueueController],
  exports: [
    BullModule.registerQueue({ name: 'agents' })
  ],
})
export class QueuesModule {}
