import { Injectable, BadRequestException, InternalServerErrorException, NotImplementedException, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
const celery = require('celery-node');
import { ConfigService } from '@nestjs/config';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { SendMailDto } from './dto/send-mail.dto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GmailTaskRun } from './gmail-task-run.entity';

@Injectable()
export class GmailService {
  private celeryClient: any;
  private oauth2: any;

  constructor(
    private readonly tokens: AuthTokensService,
    private readonly bus: RabbitMQService,
    private readonly config: ConfigService,
    @InjectRepository(GmailTaskRun)
    private readonly runRepo: Repository<GmailTaskRun>,
  ) {
    this.oauth2 = new google.auth.OAuth2({
      clientId: this.config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.config.get<string>('GOOGLE_REDIRECT_URI') ?? 'http://localhost:3000/oauth/google/callback',
    });
    const brokerUrl = this.config.get<string>('CELERY_BROKER_URL') || 'amqp://localhost';
    const backendUrl = this.config.get<string>('CELERY_RESULT_BACKEND') || brokerUrl;
    this.celeryClient = celery.createClient(brokerUrl, backendUrl);
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

  async sendMail(dto: SendMailDto) {
    if (dto.mode === 'async') {
      const runId = dto.runId!;
      // Persist pending task
      await this.runRepo.save({ id: runId, status: 'pending' });
      // Queue Celery task
      this.celeryClient.sendTask('gmail_send', [runId, dto.nodeId, dto.to, dto.subject, dto.body]);
      return { runId };
    }
    const tokensList = await this.tokens.findAll('gmail');
    if (tokensList.length === 0) {
      throw new BadRequestException('Aucun token Gmail trouvé');
    }
    const tokenRecord = await this.tokens.getValidToken('gmail', tokensList[0].userId);
    if (!tokenRecord) {
      throw new BadRequestException('Token Gmail invalide');
    }
    this.oauth2.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
    });
    const gmailClient = google.gmail({ version: 'v1', auth: this.oauth2 });
    const raw = this.makeRawMessage(dto.to, dto.subject, dto.body);
    try {
      const res = await gmailClient.users.messages.send({ userId: 'me', requestBody: { raw } });
      // If called as async follow-up (runId provided), update record
      if (dto.runId) {
        await this.runRepo.update(dto.runId, { status: 'success', result: res.data as any });
      }
      return res.data;
    } catch (e: any) {
      // On error, update record if async
      if (dto.runId) {
        await this.runRepo.update(dto.runId, { status: 'failed', error: e.message });
      }
      this.bus.publish('gmail.error', { error: e.message });
      throw new InternalServerErrorException('Échec envoi email', e.message);
    }
  }

  // Get status of an async Gmail send task
  async getStatus(runId: string): Promise<any> {
    const record = await this.runRepo.findOne({ where: { id: runId } });
    if (!record) {
      throw new NotFoundException(`Task ${runId} not found`);
    }
    const { status, result, error, createdAt, updatedAt } = record;
    return { id: runId, status, result, error, createdAt, updatedAt };
  }

  private makeRawMessage(to: string, subject: string, body: string): string {
    const message = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      body,
    ].join('\n');
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
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
