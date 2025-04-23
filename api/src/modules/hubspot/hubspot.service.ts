import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HubspotCredential } from './hubspot-credential.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HubspotService {
  constructor(
    @InjectRepository(HubspotCredential)
    private readonly repo: Repository<HubspotCredential>,
    private readonly httpService: HttpService,
  ) {}

  getAuthorizationUrl(agentId: string): string {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
    const scope = process.env.HUBSPOT_SCOPE;
    const state = agentId;
    return `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }

  async handleCallback(agentId: string, code: string): Promise<HubspotCredential> {
    const tokenRes = await this.exchangeCodeForToken(code);
    const { access_token, refresh_token, expires_in, scope } = tokenRes;
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    let cred = await this.repo.findOne({ where: { agent: { id: agentId } }, relations: ['agent'] });
    if (!cred) {
      cred = this.repo.create({
        agent: { id: agentId } as any,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scope,
      });
    } else {
      cred.accessToken = access_token;
      cred.refreshToken = refresh_token;
      cred.expiresAt = expiresAt;
      cred.scope = scope;
    }
    return this.repo.save(cred);
  }

  private async exchangeCodeForToken(code: string): Promise<any> {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    const response$ = this.httpService.post(
      'https://api.hubapi.com/oauth/v1/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const response = await firstValueFrom(response$);
    return response.data;
  }

  async getCredentials(agentId: string): Promise<HubspotCredential> {
    return this.repo.findOne({ where: { agent: { id: agentId } } });
  }

  async removeCredentials(agentId: string): Promise<void> {
    const cred = await this.repo.findOne({ where: { agent: { id: agentId } } });
    if (cred) await this.repo.remove(cred);
  }

  /**
   * Ensure our HubSpot app is subscribed to the given event type. This is idempotent.
   * HubSpot API: POST /settings/v3/subscriptions
   */
  async subscribeAppWebhook(eventType: string): Promise<void> {
    const appId = process.env.HUBSPOT_APP_ID;
    const accessToken = process.env.HUBSPOT_PRIVATE_ACCESS_TOKEN;
    if (!appId || !accessToken) {
      // not configured -> skip (useful for local dev)
      return;
    }
    try {
      const body = {
        eventType,
        active: true,
        url: process.env.HUBSPOT_WEBHOOK_URL,
      };
      const response$ = this.httpService.post(
        `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions`,
        body,
        {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        },
      );
      await firstValueFrom(response$);
    } catch (err) {
      // ignore 409 conflict or unauth etc.
      console.error(err);
    }
  }
}
