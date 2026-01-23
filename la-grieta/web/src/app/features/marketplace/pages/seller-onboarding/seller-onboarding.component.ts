import {  Component, OnInit , inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StripeService } from '../../services/stripe.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-seller-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
          Seller Onboarding
        </h1>
        <p class="text-base text-gray-600">
          Connect your Stripe account to start accepting payments
        </p>
      </div>

      <!-- Loading State -->
      @if (stripeService.loading() && !stripeService.accountStatus()) {
        <div class="flex justify-center py-16">
          <app-loading-spinner />
        </div>
      }

      <!-- Connection Status Card -->
      @if (stripeService.accountStatus(); as status) {
        <mat-card>
          <mat-card-content class="!p-6">
            <div class="space-y-6">
              <!-- Header Section -->
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  @if (status.chargesEnabled && status.payoutsEnabled) {
                    <mat-icon class="!text-5xl text-green-600">check_circle</mat-icon>
                    <div>
                      <h2 class="text-2xl font-bold text-gray-900">Connected</h2>
                      <p class="text-gray-600">Your Stripe account is fully set up</p>
                    </div>
                  } @else if (status.hasAccount) {
                    <mat-icon class="!text-5xl text-yellow-600">pending</mat-icon>
                    <div>
                      <h2 class="text-2xl font-bold text-gray-900">Pending</h2>
                      <p class="text-gray-600">Complete your Stripe onboarding</p>
                    </div>
                  } @else {
                    <mat-icon class="!text-5xl text-gray-400">account_balance</mat-icon>
                    <div>
                      <h2 class="text-2xl font-bold text-gray-900">Not Connected</h2>
                      <p class="text-gray-600">Connect your Stripe account to start selling</p>
                    </div>
                  }
                </div>
              </div>

              <!-- Status Details -->
              <div class="border-t pt-4">
                <h3 class="text-lg font-semibold mb-3 text-gray-900">Account Status</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="flex items-center gap-2">
                    @if (status.hasAccount) {
                      <mat-icon class="text-green-600">check_circle</mat-icon>
                      <span class="text-gray-900">Account Created</span>
                    } @else {
                      <mat-icon class="text-gray-400">radio_button_unchecked</mat-icon>
                      <span class="text-gray-500">No Account</span>
                    }
                  </div>
                  <div class="flex items-center gap-2">
                    @if (status.detailsSubmitted) {
                      <mat-icon class="text-green-600">check_circle</mat-icon>
                      <span class="text-gray-900">Details Submitted</span>
                    } @else {
                      <mat-icon class="text-gray-400">radio_button_unchecked</mat-icon>
                      <span class="text-gray-500">Details Pending</span>
                    }
                  </div>
                  <div class="flex items-center gap-2">
                    @if (status.chargesEnabled) {
                      <mat-icon class="text-green-600">check_circle</mat-icon>
                      <span class="text-gray-900">Payments Enabled</span>
                    } @else {
                      <mat-icon class="text-gray-400">radio_button_unchecked</mat-icon>
                      <span class="text-gray-500">Payments Disabled</span>
                    }
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="border-t pt-4">
                @if (!status.hasAccount) {
                  <button
                    mat-raised-button
                    color="primary"
                    class="!py-3 !px-6"
                    (click)="connectStripe()"
                    [disabled]="stripeService.loading()"
                  >
                    <mat-icon>link</mat-icon>
                    Connect with Stripe
                  </button>
                } @else if (!status.chargesEnabled || !status.payoutsEnabled) {
                  <button
                    mat-raised-button
                    color="primary"
                    class="!py-3 !px-6"
                    (click)="continueOnboarding()"
                    [disabled]="stripeService.loading()"
                  >
                    <mat-icon>arrow_forward</mat-icon>
                    Continue Onboarding
                  </button>
                } @else {
                  <div class="flex gap-4">
                    <button
                      mat-raised-button
                      color="primary"
                      routerLink="/marketplace/shops/my"
                    >
                      <mat-icon>storefront</mat-icon>
                      Go to My Shop
                    </button>
                    <button
                      mat-stroked-button
                      (click)="refreshStatus()"
                    >
                      <mat-icon>refresh</mat-icon>
                      Refresh Status
                    </button>
                  </div>
                }
              </div>

              <!-- Information Section -->
              <div class="border-t pt-4 bg-blue-50 rounded-lg p-4">
                <div class="flex gap-3">
                  <mat-icon class="text-blue-600">info</mat-icon>
                  <div class="text-sm text-gray-700">
                    <p class="font-semibold mb-1">What is Stripe Connect?</p>
                    <p>
                      Stripe Connect allows you to receive payments securely.
                      You'll be redirected to Stripe to complete your account setup.
                      This process typically takes 5-10 minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: []
})
export class SellerOnboardingComponent implements OnInit {
  public stripeService = inject(StripeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  

  ngOnInit(): void {
    // Check for return from Stripe onboarding
    this.route.queryParams.subscribe(params => {
      if (params['success'] === 'true') {
        this.snackBar.open('Onboarding in progress. Checking status...', 'Close', { duration: 3000 });
      } else if (params['error']) {
        this.snackBar.open('Onboarding was cancelled or failed', 'Close', { duration: 5000 });
      }
    });

    // Load account status
    this.stripeService.checkOnboardingStatus().subscribe();
  }

  connectStripe(): void {
    // Create account first
    this.stripeService.createConnectAccount().subscribe({
      next: () => {
        // Then start onboarding
        this.startOnboardingFlow();
      },
      error: () => {
        this.snackBar.open('Failed to create Stripe account', 'Close', { duration: 3000 });
      }
    });
  }

  continueOnboarding(): void {
    this.startOnboardingFlow();
  }

  private startOnboardingFlow(): void {
    const baseUrl = window.location.origin;
    const refreshUrl = `${baseUrl}/marketplace/seller-onboarding?error=true`;
    const returnUrl = `${baseUrl}/marketplace/seller-onboarding?success=true`;

    this.stripeService.startOnboarding(refreshUrl, returnUrl).subscribe({
      next: (response) => {
        // Redirect to Stripe onboarding
        window.location.href = response.url;
      },
      error: () => {
        this.snackBar.open('Failed to start onboarding', 'Close', { duration: 3000 });
      }
    });
  }

  refreshStatus(): void {
    this.stripeService.checkOnboardingStatus().subscribe({
      next: () => {
        this.snackBar.open('Status refreshed', 'Close', { duration: 2000 });
      }
    });
  }
}
