import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { AuthTokensModule } from '../auth-tokens/auth-tokens.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { GmailTaskRun } from './gmail-task-run.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GmailTaskRun]), AuthTokensModule, RabbitMQModule],
  providers: [GmailService],
  controllers: [GmailController],
  exports: [GmailService],
})
export class GmailModule {}
