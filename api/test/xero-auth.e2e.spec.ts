import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app.module';
import { XeroAuthService } from '../src/modules/xero/xero-auth.service';
import { AuthTokensService } from '../src/modules/auth-tokens/auth-tokens.service';

describe('Xero OAuth Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.XERO_CLIENT_ID = 'fake-client-id';
    process.env.XERO_CLIENT_SECRET = 'fake-secret';
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/oauth/xero/callback';
    process.env.XERO_SCOPES = 'openid profile email accounting.transactions accounting.settings';

    // Stub XeroAuthService and AuthTokensService
    const mockAuthService: Partial<XeroAuthService> = {
      getAuthorizationUrl: (state: string) =>
        `https://login.xero.com/identity/connect/authorize?state=${state}&client_id=fake-client-id&redirect_uri=${encodeURIComponent(
          'http://localhost:3000/oauth/xero/callback',
        )}&scope=${encodeURIComponent(process.env.XERO_SCOPES!)}`,
      exchangeCode: jest.fn().mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 1800,
      }),
      getConnections: jest.fn().mockResolvedValue([{ tenantId: 'tid1' }]),
      refreshToken: jest.fn().mockResolvedValue({
        access_token: 'at2',
        refresh_token: 'rt2',
        expires_in: 1800,
      }),
    };
    const mockAuthTokensService: Partial<AuthTokensService> = {
      findAll: jest.fn().mockResolvedValue([{ userId: 'tid1', refreshToken: 'rt' }]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const moduleBuilder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(XeroAuthService)
      .useValue(mockAuthService)
      .overrideProvider(AuthTokensService)
      .useValue(mockAuthTokensService);
    const moduleFixture = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/oauth/xero/authorize redirects to Xero', async () => {
    const res = await request(app.getHttpServer())
      .get('/oauth/xero/authorize')
      .expect(302);

    const loc = res.header.location;
    expect(loc).toMatch(/^https:\/\/login\.xero\.com\/identity\/connect\/authorize\?/);
    expect(loc).toContain('client_id=fake-client-id');
    expect(loc).toContain(
      encodeURIComponent('http://localhost:3000/oauth/xero/callback'),
    );
  });

  it('/oauth/xero/refresh returns refreshed tokens', async () => {
    const res = await request(app.getHttpServer())
      .get('/oauth/xero/refresh')
      .query({ tenantId: 'tid1' })
      .expect(200);
    expect(res.body.tokens.access_token).toBe('at2');
    expect(res.body.tokens.refresh_token).toBe('rt2');
    expect(res.body.expiresAt).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });
});
