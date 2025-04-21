import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { SlackService } from './slack.service';

@Controller('slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  @Post('message')
  async sendMessage(
    @Body() payload: { channel: string; text: string }
  ) {
    return this.slackService.postMessage(payload.channel, payload.text);
  }

  @Get('messages')
  async getMessages(
    @Query('channel') channel: string,
    @Query('limit') limit = '10',
  ) {
    return this.slackService.getMessages(channel, parseInt(limit, 10));
  }
}
