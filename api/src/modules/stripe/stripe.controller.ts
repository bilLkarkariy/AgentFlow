import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request, Response } from 'express';

interface RawBodyRequest extends Request {
  rawBody: Buffer;
}

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  @Post('customer')
  async createCustomer(@Body('email') email: string) {
    return this.stripe.createCustomer(email);
  }

  @Post('webhook')
  async webhook(@Headers('stripe-signature') sig: string, @Req() req: RawBodyRequest, @Res() res: Response) {
    try {
      const event = await this.stripe.verifyWebhookSignature(req.rawBody, sig);
      console.log('Finish Event:', event);
      // TODO: handle event types
      return res.json({ received: true });
    } catch (e) {
      return res.status(400).send(`Webhook Error: ${(e as Error).message}`);
    }
  }
}
