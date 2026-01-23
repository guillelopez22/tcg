import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  /**
   * Create a Stripe Connect account for a seller
   */
  async createConnectAccount(userId: string, email: string) {
    try {
      // Check if user already has a Stripe account
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.stripeAccountId) {
        throw new BadRequestException('User already has a Stripe account');
      }

      // Create Connect Express account
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      // Update user with Stripe account ID
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          stripeAccountId: account.id,
          stripeOnboarded: false,
        },
      });

      return account;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create Stripe account');
    }
  }

  /**
   * Create an onboarding link for a Connect account
   */
  async createAccountLink(userId: string, returnUrl: string, refreshUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeAccountId) {
      throw new BadRequestException('User does not have a Stripe account');
    }

    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return accountLink;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create account link');
    }
  }

  /**
   * Check if a Connect account is fully onboarded
   */
  async checkAccountStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeAccountId) {
      return { hasAccount: false, onboarded: false, accountId: null };
    }

    try {
      const account = await this.stripe.accounts.retrieve(user.stripeAccountId);

      const onboarded =
        account.charges_enabled &&
        account.payouts_enabled &&
        account.details_submitted;

      // Update user onboarding status if changed
      if (onboarded !== user.stripeOnboarded) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { stripeOnboarded: onboarded },
        });
      }

      return {
        hasAccount: !!user.stripeAccountId,
        onboarded,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to check account status');
    }
  }

  /**
   * Create a payment intent for an order
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
    sellerStripeAccountId: string,
    platformFee: number,
  ) {
    try {
      // Convert to cents
      const amountInCents = Math.round(amount * 100);
      const platformFeeInCents = Math.round(platformFee * 100);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        application_fee_amount: platformFeeInCents,
        transfer_data: {
          destination: sellerStripeAccountId,
        },
        metadata: {
          orderId,
        },
      });

      // Update order with payment intent ID
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          stripePaymentId: paymentIntent.id,
        },
      });

      return paymentIntent;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create payment intent');
    }
  }

  /**
   * Transfer funds to seller after order completion
   */
  async transferToSeller(orderId: string, amount: number, sellerStripeAccountId: string) {
    try {
      // Convert to cents
      const amountInCents = Math.round(amount * 100);

      const transfer = await this.stripe.transfers.create({
        amount: amountInCents,
        currency: 'usd',
        destination: sellerStripeAccountId,
        metadata: {
          orderId,
        },
      });

      // Update order with transfer ID
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          stripeTransferId: transfer.id,
        },
      });

      return transfer;
    } catch (error) {
      throw new InternalServerErrorException('Failed to transfer funds to seller');
    }
  }

  /**
   * Verify webhook signature
   */
  constructWebhookEvent(payload: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        // Unhandled event type
        break;
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAYMENT_HELD',
        escrowHeldAt: new Date(),
      },
    });
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  private async handleAccountUpdated(account: Stripe.Account) {
    const user = await this.prisma.user.findFirst({
      where: { stripeAccountId: account.id },
    });

    if (!user) return;

    const onboarded =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { stripeOnboarded: onboarded },
    });
  }
}
