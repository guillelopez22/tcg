import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

export interface ConnectAccountStatus {
  hasAccount: boolean;
  accountId?: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface OnboardingLinkResponse {
  url: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private api = inject(ApiService);

  // Angular Signals for state management
  private accountStatusSignal = signal<ConnectAccountStatus | null>(null);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly accountStatus = this.accountStatusSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  /**
   * Create Connect Account
   * POST /api/stripe/connect/create
   */
  createConnectAccount(): Observable<ConnectAccountStatus> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<ConnectAccountStatus>('stripe/connect/create', {}).pipe(
      tap({
        next: (status) => {
          this.accountStatusSignal.set(status);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to create Connect account');
        }
      })
    );
  }

  /**
   * Start Onboarding
   * POST /api/stripe/connect/onboard
   */
  startOnboarding(refreshUrl: string, returnUrl: string): Observable<OnboardingLinkResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<OnboardingLinkResponse>('stripe/connect/onboard', {
      refreshUrl,
      returnUrl
    }).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to start onboarding');
        }
      })
    );
  }

  /**
   * Check Onboarding Status
   * GET /api/stripe/connect/status
   */
  checkOnboardingStatus(): Observable<ConnectAccountStatus> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<ConnectAccountStatus>('stripe/connect/status').pipe(
      tap({
        next: (status) => {
          this.accountStatusSignal.set(status);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          // Don't set error if account doesn't exist (404)
          if (err.status !== 404) {
            this.errorSignal.set(err.error?.message || 'Failed to check status');
          } else {
            this.accountStatusSignal.set({
              hasAccount: false,
              chargesEnabled: false,
              payoutsEnabled: false,
              detailsSubmitted: false
            });
          }
        }
      })
    );
  }

  /**
   * Create Payment Intent
   * POST /api/stripe/payment-intent
   */
  createPaymentIntent(orderId: string): Observable<PaymentIntentResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<PaymentIntentResponse>('stripe/payment-intent', {
      orderId
    }).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to create payment intent');
        }
      })
    );
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
