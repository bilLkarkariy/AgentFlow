import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookTrigger } from './webhook-trigger.entity';
import { WebhookTriggerService } from './webhook-trigger.service';
import { WebhookTriggerController } from './webhook-trigger.controller';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookTrigger]), RabbitMQModule],
  providers: [WebhookTriggerService],
  controllers: [WebhookTriggerController],
  exports: [WebhookTriggerService],
})
export class WebhookTriggerModule {}
