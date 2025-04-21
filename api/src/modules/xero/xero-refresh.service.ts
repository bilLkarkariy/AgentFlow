import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { XeroAuthService } from './xero-auth.service';

@Injectable()
export class XeroRefreshService {
  private readonly logger = new Logger(XeroRefreshService.name);

  constructor(
    private readonly authTokensService: AuthTokensService,
    private readonly xeroAuthService: XeroAuthService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.log('Running Xero token refresh job');
    const list = await this.authTokensService.findAll('xero');
    const now = Date.now();
    const threshold = 5 * 60 * 1000; // 5 minutes before expiration
    for (const rec of list) {
      if (rec.expiresAt.getTime() - now <= threshold) {
        try {
          this.logger.log(`Refreshing token for tenant ${rec.userId}`);
          const newTokens = await this.xeroAuthService.refreshToken(rec.refreshToken);
          rec.accessToken = newTokens.access_token;
          rec.refreshToken = newTokens.refresh_token;
          rec.expiresAt = new Date(now + newTokens.expires_in * 1000);
          await this.authTokensService.save(rec);
        } catch (err) {
          const errData = (err as any).response?.data
            ? JSON.stringify((err as any).response.data)
            : err instanceof Error
            ? err.message
            : String(err);
          this.logger.error(
            `Failed to refresh token for tenant ${rec.userId}: ${errData}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }
    }
  }
}
