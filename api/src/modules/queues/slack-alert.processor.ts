import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SlackService } from '../slack/slack.service';

@Processor('alert-slack')
@Injectable()
export class SlackAlertProcessor extends WorkerHost {
  constructor(private readonly slackService: SlackService) {
    super();
  }

  async process(job: Job<Record<string, any>>): Promise<void> {
    const { path, method, errorMessage, timestamp } = job.data;
    const channel = process.env.SLACK_ALERT_CHANNEL || '#alerts';
    const message = `:warning: *Error Alert* - ${method} ${path} at ${timestamp}\n>${errorMessage}`;
    await this.slackService.postMessage(channel, message);
  }
}
