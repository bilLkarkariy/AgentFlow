import { Controller, Get, Query, Res, HttpCode, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { XeroAuthService } from './xero-auth.service';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { randomBytes } from 'crypto';

@Controller('oauth/xero')
export class XeroAuthController {
  constructor(
    private readonly authService: XeroAuthService,
    private readonly authTokensService: AuthTokensService,
  ) {}

  @Get('authorize')
  authorize(@Res() res: Response) {
    const state = randomBytes(16).toString('hex');
    const url = this.authService.getAuthorizationUrl(state);
    return res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.exchangeCode(code);
    const connections = await this.authService.getConnections(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    for (const conn of connections) {
      await this.authTokensService.save({
        provider: 'xero',
        userId: conn.tenantId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
    }
    return res.json({ tokens, connections });
  }

  @Get('refresh')
  @HttpCode(200)
  async refresh(@Query('tenantId') tenantId: string) {
    const list = await this.authTokensService.findAll('xero');
    const rec = list.find(t => t.userId === tenantId);
    if (!rec?.refreshToken) throw new NotFoundException('refresh_token not found for tenant');
    const newTokens = await this.authService.refreshToken(rec.refreshToken);
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
    rec.accessToken = newTokens.access_token;
    rec.refreshToken = newTokens.refresh_token;
    rec.expiresAt = expiresAt;
    await this.authTokensService.save(rec);
    return { tokens: newTokens, expiresAt };
  }
}
