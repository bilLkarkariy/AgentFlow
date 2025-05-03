import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GmailProcessor } from './gmail.processor';
import { GmailModule } from '../gmail/gmail.module';
import { GmailQueueController } from './gmail.queue.controller';
import { SlackAlertProcessor } from './slack-alert.processor';
import { SlackModule } from '../slack/slack.module';
import { FlowGateway } from '../agents/flow/flow.gateway';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { AgentRunProcessor } from './agent-run.processor';
import { AgentController } from './agent.controller';
import { TasksModule } from '../tasks/tasks.module';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';

@Module({
  imports: [
    ...(process.env.JEST_WORKER_ID ? [] : []),
    BullModule.registerQueue({ name: 'gmail' }),
    BullModule.registerQueue({ name: 'agents' }),
    BullModule.registerQueue({ name: 'agent-run', defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } }),
    BullModule.registerQueue({ name: 'alert-slack' }),
    GmailModule,
    SlackModule,
    TasksModule,
    RabbitMQModule,
    AgentRuntimeModule,
  ],
  providers: [GmailProcessor, SlackAlertProcessor, FlowGateway, AgentRunProcessor],
  controllers: [GmailQueueController, AgentController],
  exports: [
    BullModule.registerQueue({ name: 'agents' })
  ],
})
export class QueuesModule {}
