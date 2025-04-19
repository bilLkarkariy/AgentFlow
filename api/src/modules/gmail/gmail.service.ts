import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

dotenv.config();

@Injectable()
export class GmailService {
  private oauth2 = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/google/callback',
  });

  constructor(
    private readonly tokens: AuthTokensService,
    private readonly bus: RabbitMQService,
  ) {}

  generateAuthUrl(state: string) {
    return this.oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      state,
      prompt: 'consent',
    });
  }

  async handleCallback(code: string) {
    try {
      const { tokens } = await this.oauth2.getToken(code);
      if (!tokens.access_token) throw new Error('No token');
      await this.tokens.save({
        provider: 'gmail',
        userId: tokens.id_token ?? 'unknown',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      });
      this.bus.publish('gmail.token_saved', { userId: tokens.id_token ?? 'unknown' });
      return { success: true };
    } catch (e) {
      throw new InternalServerErrorException('Google OAuth failed', e instanceof Error ? e.message : String(e));
    }
  }
}
