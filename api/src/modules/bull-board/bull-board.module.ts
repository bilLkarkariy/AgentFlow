import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { DlqRetryService } from './dlq-retry.service';
import { DlqAlertService } from './dlq-alert.service';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [SlackModule],
  providers: [DlqRetryService, DlqAlertService]
})
export class BullBoardModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Initialize BullMQ queues for Slack alerts, flow execution, and agents DLQ
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
    const alertSlackQueue = new Queue('alert-slack', { connection });
    const executeQueue = new Queue('execute-agent', { connection });
    const agentsQueue = new Queue('agents', { connection });

    // Set up Bull Board UI under /admin/queues
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({
      queues: [
        new BullMQAdapter(alertSlackQueue),
        new BullMQAdapter(executeQueue),
        new BullMQAdapter(agentsQueue),
      ],
      serverAdapter,
    });

    // Mount the Bull Board router
    consumer
      .apply(serverAdapter.getRouter())
      .forRoutes('/admin/queues');
  }
}
