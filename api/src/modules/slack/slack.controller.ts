import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { SlackMessageDto } from './dto/slack-message.dto';

@ApiTags('Slack')
@Controller('slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  @ApiOperation({ summary: 'Send a message to a Slack channel or user' })
  @ApiBody({ type: SlackMessageDto })
  @ApiResponse({ status: 201, description: 'Message sent to Slack successfully' })
  @Post('message')
  async sendMessage(@Body() payload: SlackMessageDto) {
    return this.slackService.postMessage(payload.channel, payload.text);
  }

  @ApiOperation({ summary: 'Get messages from a Slack channel or user' })
  @ApiQuery({ name: 'channel', required: true, description: 'Channel name or ID', example: '#general' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of messages to retrieve', example: 10 })
  @ApiResponse({ status: 200, description: 'Array of messages' })
  @Get('messages')
  async getMessages(
    @Query('channel') channel: string,
    @Query('limit') limit = '10',
  ) {
    return this.slackService.getMessages(channel, parseInt(limit, 10));
  }
}
