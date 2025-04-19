import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { AuthTokensModule } from '../auth-tokens/auth-tokens.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  providers: [GmailService],
  exports: [GmailService],
  imports: [AuthTokensModule, RabbitMQModule],
})
export class GmailModule {}
