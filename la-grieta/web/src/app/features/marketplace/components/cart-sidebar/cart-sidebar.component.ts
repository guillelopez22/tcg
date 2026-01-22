import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CartService } from '../../services/cart.service';
import { ConditionBadgeComponent } from '../../../collections/components/condition-badge/condition-badge.component';

@Component({
  selector: 'lg-cart-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    ConditionBadgeComponent
  ],
  template: `
    <mat-drawer-container class="h-full" autosize>
      <mat-drawer
        #drawer
        mode="over"
        position="end"
        class="!w-full sm:!w-96"
        [opened]="cartService.isOpen()"
        (closedStart)="cartService.closeCart()"
      >
        <div class="h-full flex flex-col bg-gray-50">
          <!-- Header -->
          <div class="bg-primary text-white p-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <mat-icon>shopping_cart</mat-icon>
              <h2 class="text-xl font-heading font-bold">
                Shopping Cart
              </h2>
            </div>
            <button
              mat-icon-button
              (click)="cartService.closeCart()"
              aria-label="Close cart"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Cart Items -->
          <div class="flex-1 overflow-y-auto p-4">
            @if (cartService.hasItems()) {
              <div class="space-y-4">
                @for (item of cartService.cartItems(); track item.listing.id) {
                  <div class="bg-white rounded-lg border p-3">
                    <div class="flex gap-3">
                      <!-- Image -->
                      <div class="w-16 h-20 bg-gradient-to-br from-purple-100 to-green-100 rounded flex-shrink-0 flex items-center justify-center">
                        @if (item.listing.items && item.listing.items.length > 0 && item.listing.items[0].card?.imageUrl) {
                          <img
                            [src]="item.listing.items[0].card!.imageUrl"
                            [alt]="item.listing.title"
                            class="w-full h-full object-cover rounded"
                          />
                        } @else {
                          <mat-icon class="text-gray-400">shopping_bag</mat-icon>
                        }
                      </div>

                      <!-- Details -->
                      <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">
                          {{ item.listing.title }}
                        </h4>
                        @if (item.listing.items && item.listing.items.length > 0) {
                          <lg-condition-badge
                            [condition]="item.listing.items[0].condition"
                            size="sm"
                            class="mb-1"
                          />
                        }
                        <p class="text-lg font-mono font-bold text-primary">
                          {{ formatPrice(item.listing.price || item.listing.buyNowPrice || 0) }}
                        </p>
                      </div>

                      <!-- Remove Button -->
                      <button
                        mat-icon-button
                        color="warn"
                        (click)="removeItem(item.listing.id)"
                        aria-label="Remove from cart"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <!-- Empty State -->
              <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
                <mat-icon class="!text-[64px] text-gray-300 mb-4">shopping_cart</mat-icon>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">
                  Your cart is empty
                </h3>
                <p class="text-sm text-gray-600 mb-4">
                  Browse the marketplace to find cards
                </p>
                <button
                  mat-raised-button
                  color="primary"
                  routerLink="/marketplace"
                  (click)="cartService.closeCart()"
                >
                  Browse Marketplace
                </button>
              </div>
            }
          </div>

          <!-- Footer with Total and Checkout -->
          @if (cartService.hasItems()) {
            <div class="border-t bg-white p-4">
              <!-- Subtotal -->
              <div class="flex justify-between items-center mb-4">
                <span class="text-gray-700 font-medium">Subtotal:</span>
                <span class="text-2xl font-mono font-bold text-primary">
                  {{ formatPrice(cartService.subtotal()) }}
                </span>
              </div>

              <mat-divider class="mb-4" />

              <!-- Checkout Button -->
              <button
                mat-raised-button
                color="primary"
                class="w-full !py-3 !text-lg"
                (click)="proceedToCheckout()"
              >
                <mat-icon>payment</mat-icon>
                Proceed to Checkout
              </button>

              <!-- Clear Cart -->
              <button
                mat-stroked-button
                color="warn"
                class="w-full mt-2"
                (click)="confirmClearCart()"
              >
                Clear Cart
              </button>
            </div>
          }
        </div>
      </mat-drawer>

      <mat-drawer-content>
        <ng-content></ng-content>
      </mat-drawer-content>
    </mat-drawer-container>
  `,
  styles: []
})
export class CartSidebarComponent {
  cartService = inject(CartService);

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  removeItem(listingId: string): void {
    this.cartService.removeFromCart(listingId);
  }

  confirmClearCart(): void {
    const confirmed = confirm('Are you sure you want to clear your cart?');
    if (confirmed) {
      this.cartService.clearCart();
    }
  }

  proceedToCheckout(): void {
    // For now, just close the cart and show a message
    // In a real implementation, this would navigate to a checkout page
    alert('Checkout functionality coming soon! For now, view individual listings to purchase.');
    this.cartService.closeCart();
  }
}
