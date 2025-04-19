import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthTokensService } from './auth-tokens.service';

// Runs every 5 minutes and ensures Gmail tokens remain fresh
@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);

  constructor(private readonly tokens: AuthTokensService) {}

  // Cron expression: every 5 minutes
  @Cron('*/5 * * * *')
  async handleCron() {
    const gmailTokens = await this.tokens.findAll('gmail');
    for (const token of gmailTokens) {
      try {
        // getValidToken() will auto‑refresh if required
        await this.tokens.getValidToken(token.provider, token.userId);
      } catch (err: unknown) {
        this.logger.error(
          `Failed to refresh token for user ${token.userId}`,
          err instanceof Error && err.stack ? err.stack : String(err),
        );
      }
    }
  }
}
