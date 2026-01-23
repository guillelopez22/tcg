import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';

@Controller('stripe/webhook')
export class StripeWebhookController {
  constructor(private stripeService: StripeService) {}

  /**
   * Handle Stripe webhook events with signature verification
   */
  @Post()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Get raw body for signature verification
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    // Verify webhook signature and construct event
    const event = this.stripeService.constructWebhookEvent(rawBody, signature);

    // Handle the event
    await this.stripeService.handleWebhookEvent(event);

    return { received: true };
  }
}
