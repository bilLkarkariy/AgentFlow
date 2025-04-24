import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class GmailService {
  private oauth2: any;

  constructor(
    private readonly tokens: AuthTokensService,
    private readonly bus: RabbitMQService,
    private readonly config: ConfigService,
  ) {
    this.oauth2 = new google.auth.OAuth2({
      clientId: this.config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.config.get<string>('GOOGLE_REDIRECT_URI') ?? 'http://localhost:3000/oauth/google/callback',
    });
  }

  // Get the latest email subject from Gmail for the given sender
  async getLatestEmailSubject(from: string): Promise<string> {
    try {
      // Retrieve stored tokens
      const tokensList = await this.tokens.findAll('gmail');
      if (tokensList.length === 0) {
        throw new BadRequestException('Aucun token Gmail trouvé');
      }
      // Get valid token (refresh if needed)
      const tokenRecord = await this.tokens.getValidToken('gmail', tokensList[0].userId);
      if (!tokenRecord) {
        throw new BadRequestException('Token Gmail invalide');
      }
      // Set OAuth2 credentials
      this.oauth2.setCredentials({
        access_token: tokenRecord.accessToken,
        refresh_token: tokenRecord.refreshToken,
      });
      // Initialize Gmail API client
      const gmailClient = google.gmail({ version: 'v1', auth: this.oauth2 });
      // List messages from the sender
      const listRes = await gmailClient.users.messages.list({
        userId: 'me',
        q: `from:${from}`,
        maxResults: 1,
      });
      const msg = listRes.data.messages?.[0];
      if (!msg?.id) return 'Aucun email trouvé';
      // Fetch message metadata for Subject header
      const getRes = await gmailClient.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject'],
      });
      const headers = getRes.data.payload?.headers;
      const subjectHdr = headers?.find(h => h.name === 'Subject');
      return subjectHdr?.value ?? 'Sans sujet';
    } catch (error) {
      // Publish error event
      this.bus.publish('gmail.error', { from, error: error instanceof Error ? error.message : String(error) });
      throw new InternalServerErrorException('Échec de lecture du sujet', error instanceof Error ? error.message : String(error));
    }
  }

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
      if (!tokens.access_token) throw new BadRequestException('No token');
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
