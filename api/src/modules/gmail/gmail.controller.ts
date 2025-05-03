import { Controller, Get, Query, Res, Post, Body, Param, HttpStatus } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { SendMailDto } from './dto/send-mail.dto';

@Controller('oauth/google')
export class GmailController {
  constructor(private readonly gmail: GmailService) {}

  @Get()
  auth(@Res() res: Response, @Query('state') state?: string) {
    const url = this.gmail.generateAuthUrl(state ?? '');
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    return this.gmail.handleCallback(code);
  }

  @Post('nodes/gmail/send')
  async sendMail(@Res({ passthrough: true }) res: Response, @Body() dto: SendMailDto) {
    // Async mode: queue task and return runId
    if (dto.mode === 'async') {
      const runId = dto.runId ?? uuidv4();
      // fire-and-forget
      this.gmail.sendMail({ ...dto, runId });
      res.status(HttpStatus.ACCEPTED);
      return { runId };
    }
    // Sync mode: execute and return result
    const result = await this.gmail.sendMail(dto);
    res.status(HttpStatus.CREATED);
    return result;
  }

  @Get('nodes/gmail/send/:runId/status')
  async getStatus(@Param('runId') runId: string) {
    return this.gmail.getStatus(runId);
  }
}
