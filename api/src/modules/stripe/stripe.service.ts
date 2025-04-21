import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env (monorepo) to populate STRIPE_SECRET_KEY
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

@Injectable()
export class StripeService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16',
  });

  async createCustomer(email: string) {
    return this.stripe.customers.create({ email });
  }

  async verifyWebhookSignature(rawBody: Buffer, sig: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET as string;
    if (!secret) throw new InternalServerErrorException('Missing STRIPE_WEBHOOK_SECRET');

    return this.stripe.webhooks.constructEvent(rawBody, sig ?? '', secret);
  }

  /**
   * Create a usage record for metered billing (tasks quota).
   * @param subscriptionItemId Stripe subscription item ID for the metered product.
   * @param quantity Number of tasks consumed since the last report.
   * @param timestamp Unix timestamp (seconds) — defaults to now.
   */
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp: number = Math.floor(Date.now() / 1000),
  ) {
    return this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp,
      action: 'increment',
    });
  }
}
