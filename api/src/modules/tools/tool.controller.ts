import { Controller, Post, Body, Param } from '@nestjs/common';
import { SummarizeService } from './summarize.service';
import { GmailService } from '../gmail/gmail.service';
import { SendMailDto } from '../gmail/dto/send-mail.dto';

@Controller('internal/tools')
export class ToolController {
  constructor(
    private readonly summarize: SummarizeService,
    private readonly gmailService: GmailService,
  ) {}

  @Post(':toolId')
  async execute(@Param('toolId') toolId: string, @Body() payload: any) {
    switch (toolId) {
      case 'summarize-block':
        return this.summarize.run(payload);
      case 'gmail-send':
        return this.gmailService.sendMail(payload as SendMailDto);
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }
}
