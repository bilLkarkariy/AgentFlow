import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { XeroService } from './xero.service';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { XeroAuthService } from './xero-auth.service';

describe('XeroService', () => {
  let service: XeroService;
  let http: HttpService;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        XeroService,
        { provide: AuthTokensService, useValue: {} },
        { provide: XeroAuthService, useValue: {} },
      ],
    }).compile();
    service = mod.get<XeroService>(XeroService);
    jest.spyOn(service, 'getValidAccessToken').mockResolvedValue('tok');
    http = mod.get<HttpService>(HttpService);
  });

  it('listInvoices()', async () => {
    const fake = { data: [{ id: 'inv1' }] };
    jest.spyOn(http, 'get').mockReturnValue(of(fake as any));
    const out = await service.listInvoices('tok');
    expect(out).toEqual(fake.data);
    expect(http.get).toHaveBeenCalledWith('/Invoices', {
      headers: {
        Authorization: 'Bearer tok',
        Accept: 'application/json',
        'xero-tenant-id': 'tok',
      },
    });
  });

  it('createInvoice()', async () => {
    const payload = { sample: 1 };
    const fake = { data: { id: 'new' } };
    jest.spyOn(http, 'post').mockReturnValue(of(fake as any));
    const out = await service.createInvoice('tok', payload);
    expect(out).toEqual(fake.data);
    expect(http.post).toHaveBeenCalledWith(
      '/Invoices',
      { Invoices: [payload] },
      {
        headers: {
          Authorization: 'Bearer tok',
          'Content-Type': 'application/json',
          'xero-tenant-id': 'tok',
        },
      },
    );
  });
});