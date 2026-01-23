import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stripe')
@UseGuards(JwtAuthGuard)
export class StripeController {
  constructor(private stripeService: StripeService) {}

  /**
   * Create a Stripe Connect account for the authenticated user
   */
  @Post('connect/create')
  async createConnectAccount(@Request() req) {
    const userId = req.user.id;
    const email = req.user.email;

    const account = await this.stripeService.createConnectAccount(userId, email);

    return {
      accountId: account.id,
      message: 'Stripe Connect account created successfully',
    };
  }

  /**
   * Get onboarding link for Stripe Connect
   */
  @Post('connect/onboard')
  async getOnboardingLink(@Request() req, @Body() body: { returnUrl: string; refreshUrl: string }) {
    const { returnUrl, refreshUrl } = body;

    if (!returnUrl || !refreshUrl) {
      throw new BadRequestException('returnUrl and refreshUrl are required');
    }

    const userId = req.user.id;
    const accountLink = await this.stripeService.createAccountLink(userId, returnUrl, refreshUrl);

    return {
      url: accountLink.url,
    };
  }

  /**
   * Check Stripe Connect account status
   */
  @Get('connect/status')
  async getAccountStatus(@Request() req) {
    const userId = req.user.id;
    const status = await this.stripeService.checkAccountStatus(userId);

    return status;
  }

  /**
   * Create a payment intent for checkout
   */
  @Post('payment-intent')
  async createPaymentIntent(
    @Request() req,
    @Body() body: { orderId: string; amount: number; sellerStripeAccountId: string; platformFee: number },
  ) {
    const { orderId, amount, sellerStripeAccountId, platformFee } = body;

    if (!orderId || !amount || !sellerStripeAccountId || platformFee === undefined) {
      throw new BadRequestException('orderId, amount, sellerStripeAccountId, and platformFee are required');
    }

    const paymentIntent = await this.stripeService.createPaymentIntent(
      orderId,
      amount,
      sellerStripeAccountId,
      platformFee,
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }
}
