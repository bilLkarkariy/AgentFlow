import { Controller, Post, Body } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('session')
  @ApiOperation({ summary: 'Create a Stripe customer portal session' })
  @ApiBody({ type: CreatePortalSessionDto })
  @ApiResponse({ status: 200, description: 'Session URL returned', schema: { example: { url: 'https://example.com/session/xyz' } } })
  async createPortalSession(@Body() dto: CreatePortalSessionDto) {
    const { customerId, returnUrl } = dto;
    const session = await this.stripeService.createCustomerPortalSession(
      customerId,
      returnUrl,
    );
    return { url: session.url };
  }
}
