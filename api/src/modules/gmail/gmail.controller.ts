import { Controller, Get, Query, Res } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { Response } from 'express';

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
}
