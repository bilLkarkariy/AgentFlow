import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GmailService } from '../gmail/gmail.service';
import { Logger } from '@nestjs/common';

export const GMAIL_FETCH_JOB = 'fetch-emails';

@Processor('gmail')
export class GmailProcessor extends WorkerHost {
  private readonly logger = new Logger(GmailProcessor.name);

  constructor(private readonly gmail: GmailService) {
    super();
  }

  // Handle job processing
  async process(job: Job<{ userId: string }>): Promise<void> {
    const { userId } = job.data;
    this.logger.log(`Fetching emails for user ${userId}`);
    // TODO: use gmail service to list / process emails
    await new Promise((r) => setTimeout(r, 1000));
    this.logger.log(`Emails fetched for user ${userId}`);
  }
}
