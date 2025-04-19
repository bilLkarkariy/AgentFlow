import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthToken } from './auth-token.entity';
import { AuthTokensService } from './auth-tokens.service';
import { TokenRefreshService } from './token-refresh.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuthToken])],
  providers: [AuthTokensService, TokenRefreshService],
  exports: [AuthTokensService],
})
export class AuthTokensModule {}
