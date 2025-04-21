import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthToken } from './auth-token.entity';
import { google } from 'googleapis';

@Injectable()
export class AuthTokensService {
  constructor(
    @InjectRepository(AuthToken)
    private readonly repo: Repository<AuthToken>,
  ) {}

  async getValidToken(provider: string, userId: string): Promise<AuthToken | null> {
    const now = new Date();
    const token = await this.repo.findOne({ where: { provider, userId } });
    if (!token) return null;
    if (token.expiresAt && token.expiresAt.getTime() - now.getTime() < 60_000) {
      return this.refresh(token);
    }
    return token;
  }

  async findAll(provider: string): Promise<AuthToken[]> {
    return this.repo.find({ where: { provider } });
  }

  async save(token: Partial<AuthToken>) {
    // Update existing record if id provided
    if ('id' in token && token.id) {
      await this.repo.update(token.id, token);
      return;
    }
    // Upsert by provider and userId to avoid duplicates
    if (token.provider && token.userId) {
      const existing = await this.repo.findOne({ where: { provider: token.provider, userId: token.userId } });
      if (existing) {
        await this.repo.update(existing.id, token);
        return;
      }
    }
    // Create new token
    await this.repo.save(token as AuthToken);
  }

  private async refresh(token: AuthToken): Promise<AuthToken> {
    if (!token.refreshToken) return token;
    if (token.provider !== 'gmail') return token;
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ refresh_token: token.refreshToken });
    const { credentials } = await oauth2.refreshAccessToken();
    token.accessToken = credentials.access_token as string;
    token.expiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    await this.repo.save(token);
    return token;
  }
}
