import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { XeroAuthService } from './xero-auth.service';

@Injectable()
export class XeroService {
  constructor(
    private readonly http: HttpService,
    private readonly authTokensService: AuthTokensService,
    private readonly xeroAuthService: XeroAuthService,
  ) {}

  async getValidAccessToken(tenantId: string): Promise<string> {
    const list = await this.authTokensService.findAll('xero');
    const rec = list.find(t => t.userId === tenantId);
    if (!rec || !rec.refreshToken) {
      throw new NotFoundException(`No Xero tokens found for tenant ${tenantId}`);
    }
    if (rec.expiresAt.getTime() <= Date.now()) {
      const newTokens = await this.xeroAuthService.refreshToken(rec.refreshToken);
      rec.accessToken = newTokens.access_token;
      rec.refreshToken = newTokens.refresh_token;
      rec.expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await this.authTokensService.save(rec);
    }
    return rec.accessToken;
  }

  /** List invoices from Xero */
  async listInvoices(tenantId: string, providedToken?: string): Promise<any> {
    const accessToken = providedToken ?? await this.getValidAccessToken(tenantId);
    const response = await lastValueFrom(
      this.http.get('/Invoices', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'xero-tenant-id': tenantId,
        },
      }),
    );
    return response.data;
  }

  /** Create a new invoice in Xero */
  async createInvoice(tenantId: string, invoice: any, providedToken?: string): Promise<any> {
    const accessToken = providedToken ?? await this.getValidAccessToken(tenantId);
    const response = await lastValueFrom(
      this.http.post('/Invoices', { Invoices: [invoice] }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'xero-tenant-id': tenantId,
        },
      }),
    );
    return response.data;
  }
}
