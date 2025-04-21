import { XeroAxiosInterceptor } from './xero-axios.interceptor';
import { HttpService } from '@nestjs/axios';
import { XeroService } from './xero.service';

describe('XeroAxiosInterceptor', () => {
  let interceptor: XeroAxiosInterceptor;
  let fakeAxios: any;
  let httpService: HttpService;
  let xeroService: XeroService;

  beforeEach(() => {
    fakeAxios = {
      interceptors: { response: { use: jest.fn() } },
      request: jest.fn(),
    };
    httpService = { axiosRef: fakeAxios } as any;
    xeroService = { getValidAccessToken: jest.fn().mockResolvedValue('new-token') } as any;
    interceptor = new XeroAxiosInterceptor(httpService, xeroService);
    interceptor.onModuleInit();
  });

  it('registers response interceptor', () => {
    expect(fakeAxios.interceptors.response.use).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('refreshes token and retries request on 401 error', async () => {
    const errorCb = fakeAxios.interceptors.response.use.mock.calls[0][1];
    const config: any = { headers: { 'xero-tenant-id': 'tenant123' } };
    const error = { response: { status: 401 }, config };
    (fakeAxios.request as jest.Mock).mockResolvedValue('ok');

    const result = await errorCb(error);

    expect(xeroService.getValidAccessToken).toHaveBeenCalledWith('tenant123');
    expect(config.headers.Authorization).toBe('Bearer new-token');
    expect(fakeAxios.request).toHaveBeenCalledWith(config);
    expect(result).toBe('ok');
  });

  it('rejects non-401 errors', async () => {
    const errorCb = fakeAxios.interceptors.response.use.mock.calls[0][1];
    const otherError = new Error('fail');
    await expect(errorCb(otherError)).rejects.toBe(otherError);
  });
});
