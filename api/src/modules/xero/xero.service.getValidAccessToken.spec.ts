import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { XeroService } from './xero.service';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { XeroAuthService } from './xero-auth.service';

describe('XeroService.getValidAccessToken', () => {
  let service: XeroService;
  let authTokensService: AuthTokensService;
  let xeroAuthService: XeroAuthService;

  beforeEach(async () => {
    const authTokensMock = { findAll: jest.fn(), save: jest.fn() };
    const xeroAuthMock = { refreshToken: jest.fn() };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: HttpService, useValue: {} },
        XeroService,
        { provide: AuthTokensService, useValue: authTokensMock },
        { provide: XeroAuthService, useValue: xeroAuthMock },
      ],
    }).compile();

    service = mod.get<XeroService>(XeroService);
    authTokensService = mod.get<AuthTokensService>(AuthTokensService);
    xeroAuthService = mod.get<XeroAuthService>(XeroAuthService);
  });

  it('returns existing token when not expired', async () => {
    const tenantId = 'tenant1';
    const future = new Date(Date.now() + 10000);
    const record = { userId: tenantId, accessToken: 'old-token', refreshToken: 'rt', expiresAt: future };
    (authTokensService.findAll as jest.Mock).mockResolvedValue([record]);

    const token = await service.getValidAccessToken(tenantId);
    expect(token).toBe('old-token');
    expect(xeroAuthService.refreshToken).not.toHaveBeenCalled();
  });

  it('refreshes and saves token when expired', async () => {
    const tenantId = 'tenant2';
    const past = new Date(Date.now() - 10000);
    const record = { userId: tenantId, accessToken: 'old', refreshToken: 'rt', expiresAt: past };
    (authTokensService.findAll as jest.Mock).mockResolvedValue([record]);
    (xeroAuthService.refreshToken as jest.Mock).mockResolvedValue({ access_token: 'new', refresh_token: 'nr', expires_in: 3600 });

    const token = await service.getValidAccessToken(tenantId);
    expect(token).toBe('new');
    expect(xeroAuthService.refreshToken).toHaveBeenCalledWith('rt');
    expect(authTokensService.save).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new', refreshToken: 'nr' }));
  });

  it('throws NotFoundException when no tokens found', async () => {
    (authTokensService.findAll as jest.Mock).mockResolvedValue([]);
    await expect(service.getValidAccessToken('unknown')).rejects.toBeInstanceOf(NotFoundException);
  });
});
