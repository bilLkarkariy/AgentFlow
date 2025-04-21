import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as qs from 'querystring';

@Injectable()
export class XeroAuthService {
  private clientId = process.env.XERO_CLIENT_ID!;
  private clientSecret = process.env.XERO_CLIENT_SECRET!;
  private redirectUri = process.env.XERO_REDIRECT_URI!;
  private scopes = process.env.XERO_SCOPES!;
  private authorizeEndpoint = 'https://login.xero.com/identity/connect/authorize';
  private tokenEndpoint = 'https://identity.xero.com/connect/token';
  private connectionsEndpoint = 'https://api.xero.com/connections';

  constructor(private readonly httpService: HttpService) {}

  getAuthorizationUrl(state: string): string {
    const params = qs.stringify({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
      state,
    });
    return `${this.authorizeEndpoint}?${params}`;
  }

  async exchangeCode(code: string): Promise<any> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const body = qs.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });
    const response = await firstValueFrom(
      this.httpService.post(this.tokenEndpoint, body, {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );
    return response.data;
  }

  async getConnections(accessToken: string): Promise<any[]> {
    const response = await firstValueFrom(
      this.httpService.get(this.connectionsEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      }),
    );
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<any> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const body = qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
    });
    const response = await firstValueFrom(
      this.httpService.post(this.tokenEndpoint, body, {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );
    return response.data;
  }
}
