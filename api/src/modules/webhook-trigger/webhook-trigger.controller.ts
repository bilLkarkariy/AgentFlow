import { Controller, Post, Param, Body, Headers, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { WebhookTriggerService } from './webhook-trigger.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import * as crypto from 'crypto';

@Controller('triggers/webhook')
export class WebhookTriggerController {
  constructor(
    private readonly triggerService: WebhookTriggerService,
    private readonly rabbit: RabbitMQService,
  ) {}

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async handle(@Param('id') id: string, @Headers('x-signature') sig: string, @Body() body: any) {
    const trigger = await this.triggerService.findOne(id);
    const payload = JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', trigger.secret).update(payload).digest('hex');
    if (!sig || sig !== hmac) {
      return { status: 'unauthorized' };
    }
    // publish to RabbitMQ
    this.rabbit.publish('webhook.received', body);
    return { status: 'ok' };
  }
}
