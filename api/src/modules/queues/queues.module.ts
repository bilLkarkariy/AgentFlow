import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GmailProcessor } from './gmail.processor';
import { GmailModule } from '../gmail/gmail.module';
import { GmailQueueController } from './gmail.queue.controller';
import { SlackAlertProcessor } from './slack-alert.processor';
import { SlackModule } from '../slack/slack.module';
import { FlowGateway } from '../agents/flow/flow.gateway';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ...(process.env.JEST_WORKER_ID ? [] : []),
    BullModule.registerQueue({ name: 'gmail' }),
    BullModule.registerQueue({ name: 'agents' }),
    BullModule.registerQueue({ name: 'alert-slack' }),
    GmailModule,
    SlackModule,
    RabbitMQModule,
  ],
  providers: [GmailProcessor, SlackAlertProcessor, FlowGateway],
  controllers: [GmailQueueController],
  exports: [
    BullModule.registerQueue({ name: 'agents' })
  ],
})
export class QueuesModule {}
