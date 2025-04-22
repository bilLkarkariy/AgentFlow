import { Controller, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('Gmail')
@Controller('gmail')
export class GmailQueueController {
  constructor(@InjectQueue('gmail') private readonly gmailQueue: Queue) {}

  /**
   * Enqueue a job to fetch latest emails for the given user.
   * Example: POST /gmail/fetch/123
   */
  @Post('fetch/:userId')
  @ApiOperation({ summary: 'Enqueue job to fetch latest emails for a user' })
  @ApiParam({ name: 'userId', type: String, description: 'User ID', example: '123' })
  @ApiResponse({ status: 201, description: 'Email fetch job queued', schema: { example: { status: 'queued', userId: '123' } } })
  async fetchEmails(@Param('userId') userId: string) {
    await this.gmailQueue.add('fetch-emails', { userId });
    return { status: 'queued', userId };
  }
}
