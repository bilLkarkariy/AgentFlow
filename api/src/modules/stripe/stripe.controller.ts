import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateCustomerDto } from './dto/create-customer.dto';

interface RawBodyRequest extends Request {
  rawBody: Buffer;
}

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripe: StripeService) {}

  @ApiOperation({ summary: 'Create a new Stripe customer' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({ status: 201, description: 'Customer created' })
  @Post('customer')
  async createCustomer(@Body() dto: CreateCustomerDto) {
    return this.stripe.createCustomer(dto.email);
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
