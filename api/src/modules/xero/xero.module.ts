import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { XeroService } from './xero.service';
import { XeroController } from './xero.controller';
import { XeroAuthService } from './xero-auth.service';
import { XeroAuthController } from './xero-auth.controller';
import { XeroRefreshService } from './xero-refresh.service';
import { AuthTokensModule } from '../auth-tokens/auth-tokens.module';
import { XeroAxiosInterceptor } from './xero-axios.interceptor';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.XERO_BASE_URL || 'https://api.xero.com/api.xro/2.0',
    }),
    AuthTokensModule,
  ],
  providers: [XeroService, XeroAuthService, XeroRefreshService, XeroAxiosInterceptor],
  controllers: [XeroController, XeroAuthController],
  exports: [XeroService, XeroAuthService],
})
export class XeroModule {}
