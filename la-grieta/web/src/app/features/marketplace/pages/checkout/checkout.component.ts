import {  Component, OnInit , inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { StripeService } from '../../services/stripe.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Success State -->
      @if (isSuccess) {
        <mat-card>
          <mat-card-content class="!p-8 text-center">
            <mat-icon class="!text-6xl text-green-600 mb-4">check_circle</mat-icon>
            <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
              Payment Successful!
            </h1>
            <p class="text-gray-600 mb-6">
              Your order has been confirmed. You'll receive an email confirmation shortly.
            </p>
            <div class="flex gap-4 justify-center">
              <button
                mat-raised-button
                color="primary"
                routerLink="/marketplace/orders"
              >
                <mat-icon>receipt_long</mat-icon>
                View Orders
              </button>
              <button
                mat-stroked-button
                routerLink="/marketplace"
              >
                Continue Shopping
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <!-- Cancel State -->
      @if (isCancelled) {
        <mat-card>
          <mat-card-content class="!p-8 text-center">
            <mat-icon class="!text-6xl text-yellow-600 mb-4">cancel</mat-icon>
            <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
              Payment Cancelled
            </h1>
            <p class="text-gray-600 mb-6">
              Your payment was cancelled. No charges were made.
            </p>
            <button
              mat-raised-button
              color="primary"
              routerLink="/marketplace"
            >
              Back to Marketplace
            </button>
          </mat-card-content>
        </mat-card>
      }

      <!-- Checkout State -->
      @if (!isSuccess && !isCancelled) {
        <div class="mb-6">
          <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
            Checkout
          </h1>
          <p class="text-base text-gray-600">
            Review your order and complete payment
          </p>
        </div>

        <mat-card>
          <mat-card-content class="!p-6">
            @if (stripeService.loading()) {
              <div class="flex justify-center py-8">
                <app-loading-spinner />
              </div>
            } @else {
              <div class="space-y-6">
                <!-- Order Summary -->
                <div>
                  <h2 class="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-gray-700">Order ID:</span>
                      <span class="font-mono text-gray-900">{{ orderId }}</span>
                    </div>
                    <div class="flex items-center justify-between text-lg font-semibold">
                      <span class="text-gray-900">Total:</span>
                      <span class="text-primary">{{ formattedAmount }}</span>
                    </div>
                  </div>
                </div>

                <!-- Information -->
                <div class="bg-blue-50 rounded-lg p-4">
                  <div class="flex gap-3">
                    <mat-icon class="text-blue-600">info</mat-icon>
                    <div class="text-sm text-gray-700">
                      <p class="font-semibold mb-1">Secure Payment</p>
                      <p>
                        You'll be redirected to Stripe's secure checkout page to complete your payment.
                        Your payment information is never stored on our servers.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-4">
                  <button
                    mat-raised-button
                    color="primary"
                    class="!py-3 !px-6 flex-1"
                    (click)="proceedToPayment()"
                    [disabled]="!orderId || processing"
                  >
                    @if (processing) {
                      <mat-icon class="animate-spin">sync</mat-icon>
                      Processing...
                    } @else {
                      <mat-icon>payment</mat-icon>
                      Pay Now
                    }
                  </button>
                  <button
                    mat-stroked-button
                    class="!py-3 !px-6"
                    routerLink="/marketplace"
                    [disabled]="processing"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: []
})
export class CheckoutComponent implements OnInit {
  public stripeService = inject(StripeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  orderId: string | null = null;
  isSuccess = false;
  isCancelled = false;
  processing = false;
  formattedAmount = '$0.00';

  

  ngOnInit(): void {
    // Check for success/cancel routes
    const path = this.route.snapshot.url[1]?.path;
    if (path === 'success') {
      this.isSuccess = true;
      return;
    }
    if (path === 'cancel') {
      this.isCancelled = true;
      return;
    }

    // Get order ID from query params
    this.route.queryParams.subscribe(params => {
      this.orderId = params['orderId'];
      if (!this.orderId) {
        this.snackBar.open('No order ID provided', 'Close', { duration: 3000 });
        this.router.navigate(['/marketplace']);
      }
    });
  }

  proceedToPayment(): void {
    if (!this.orderId) {
      this.snackBar.open('Invalid order ID', 'Close', { duration: 3000 });
      return;
    }

    this.processing = true;

    // Create payment intent
    this.stripeService.createPaymentIntent(this.orderId).subscribe({
      next: (response) => {
        // Store amount for display
        this.formattedAmount = `$${(response.amount / 100).toFixed(2)}`;

        // The backend should return a Stripe Checkout Session URL
        // For now, redirect to a placeholder or use the clientSecret as session ID
        const checkoutUrl = response.clientSecret;

        // If backend returns a full URL, redirect to it
        if (checkoutUrl.startsWith('http')) {
          window.location.href = checkoutUrl;
        } else {
          // Otherwise, show a message that payment is being processed
          this.snackBar.open('Redirecting to payment...', 'Close', { duration: 2000 });
          this.processing = false;

          // For testing, we'll just navigate to success
          setTimeout(() => {
            this.router.navigate(['/marketplace/checkout/success']);
          }, 2000);
        }
      },
      error: () => {
        this.snackBar.open('Failed to create payment', 'Close', { duration: 3000 });
        this.processing = false;
      }
    });
  }
}
