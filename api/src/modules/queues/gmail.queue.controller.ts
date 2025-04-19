import { Controller, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('gmail')
export class GmailQueueController {
  constructor(@InjectQueue('gmail') private readonly gmailQueue: Queue) {}

  /**
   * Enqueue a job to fetch latest emails for the given user.
   * Example: POST /gmail/fetch/123
   */
  @Post('fetch/:userId')
  async fetchEmails(@Param('userId') userId: string) {
    await this.gmailQueue.add('fetch-emails', { userId });
    return { status: 'queued', userId };
  }
}
