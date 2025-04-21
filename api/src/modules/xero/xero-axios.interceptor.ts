import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { XeroService } from './xero.service';

@Injectable()
export class XeroAxiosInterceptor implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    private readonly xeroService: XeroService,
  ) {}

  onModuleInit() {
    const axios = this.httpService.axiosRef;
    axios.interceptors.response.use(
      response => response,
      async error => {
        const { config, response } = error;
        if (
          response &&
          response.status === 401 &&
          config.headers['xero-tenant-id']
        ) {
          const tenantId = config.headers['xero-tenant-id'];
          const accessToken = await this.xeroService.getValidAccessToken(
            tenantId,
          );
          config.headers['Authorization'] = `Bearer ${accessToken}`;
          return axios.request(config);
        }
        return Promise.reject(error);
      },
    );
  }
}
