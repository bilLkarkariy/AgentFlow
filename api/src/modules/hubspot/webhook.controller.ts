import { Body, Controller, Headers, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import crypto from 'crypto';

@Controller('api/hubspot/webhook')
export class HubspotWebhookController {
  constructor(@InjectQueue('hubspot-events') private readonly queue: Queue) {}

  @Post()
  async handleWebhook(@Headers('x-hubspot-signature') signature: string, @Body() payload: any) {
    // minimal signature check
    const secret = process.env.HUBSPOT_CLIENT_SECRET;
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    if (expected !== signature) {
      // ignore for now but log
      return { status: 'invalid' };
    }
    await this.queue.add('event', payload);
    return { status: 'queued' };
  }
}
