import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlackService } from '../slack/slack.service';
import { Queue } from 'bullmq';

@Injectable()
export class DlqAlertService {
  private readonly logger = new Logger(DlqAlertService.name);
  private readonly queue: Queue;
  private alertSent = false;
  private readonly threshold: number;

  constructor(private readonly slackService: SlackService) {
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    };
    this.queue = new Queue('alert-slack', { connection });
    this.threshold = parseInt(process.env.DLQ_ALERT_THRESHOLD || '10', 10);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleDlqAlert() {
    const failedCount = await this.queue.getFailedCount();
    if (failedCount > this.threshold) {
      if (!this.alertSent) {
        const channel = process.env.SLACK_ALERT_CHANNEL || '#e2e';
        const msg = `:warning: DLQ alert-slack contient ${failedCount} messages en erreur (> ${this.threshold}).`;
        await this.slackService.postMessage(channel, msg);
        this.alertSent = true;
        this.logger.warn(`DLQ alert sent: ${failedCount} errors`);
      }
    } else if (this.alertSent) {
      this.alertSent = false;
      this.logger.log('DLQ alert reset (count below threshold)');
    }
  }
}
