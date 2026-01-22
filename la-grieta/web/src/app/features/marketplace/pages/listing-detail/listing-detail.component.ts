import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarketplaceService } from '../../services/marketplace.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ConditionBadgeComponent } from '../../../collections/components/condition-badge/condition-badge.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ListingType } from '@la-grieta/shared';

@Component({
  selector: 'lg-listing-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule,
    MatDividerModule,
    MatSnackBarModule,
    ConditionBadgeComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Back Button -->
      <button
        mat-stroked-button
        routerLink="/marketplace"
        class="mb-6"
      >
        <mat-icon>arrow_back</mat-icon>
        Back to Marketplace
      </button>

      <!-- Loading State -->
      @if (marketplaceService.loading() && !marketplaceService.currentListing()) {
        <div class="flex justify-center py-16">
          <lg-loading-spinner />
        </div>
      }

      <!-- Error State -->
      @if (marketplaceService.error() && !marketplaceService.currentListing()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2">
            <mat-icon class="text-red-600">error</mat-icon>
            <p class="text-red-800">{{ marketplaceService.error() }}</p>
          </div>
        </div>
      }

      <!-- Listing Detail -->
      @if (marketplaceService.currentListing(); as listing) {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Left Column - Image Gallery -->
          <div>
            <mat-card>
              <mat-card-content class="!p-6">
                @if (listing.items && listing.items.length > 0 && listing.items[0].card?.imageUrl) {
                  <img
                    [src]="listing.items[0].card!.imageUrl"
                    [alt]="listing.title"
                    class="w-full rounded-lg shadow-lg"
                  />
                } @else {
                  <div class="w-full aspect-[3/4] bg-gradient-to-br from-purple-100 to-green-100 rounded-lg flex items-center justify-center">
                    <mat-icon class="!text-[8rem] text-gray-400">shopping_bag</mat-icon>
                  </div>
                }
              </mat-card-content>
            </mat-card>

            <!-- Cards in Listing -->
            @if (listing.items && listing.items.length > 0) {
              <mat-card class="mt-4">
                <mat-card-content class="!p-6">
                  <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    Cards Included
                  </h3>
                  <div class="space-y-3">
                    @for (item of listing.items; track item.id) {
                      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div class="flex-1">
                          <p class="font-medium text-gray-900">
                            {{ item.card?.name || 'Card' }}
                          </p>
                          <div class="flex items-center gap-2 mt-1">
                            <lg-condition-badge [condition]="item.condition" size="sm" />
                            <span class="text-sm text-gray-600">Qty: {{ item.quantity }}</span>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>
            }
          </div>

          <!-- Right Column - Details & Actions -->
          <div>
            <mat-card>
              <mat-card-content class="!p-6">
                <!-- Type Badge -->
                <div class="mb-4">
                  @if (listing.type === 'AUCTION') {
                    <mat-chip class="!bg-orange-500 !text-white">
                      <mat-icon class="!text-base mr-1">gavel</mat-icon>
                      Auction
                    </mat-chip>
                  } @else {
                    <mat-chip class="!bg-blue-500 !text-white">
                      <mat-icon class="!text-base mr-1">shopping_cart</mat-icon>
                      Fixed Price
                    </mat-chip>
                  }
                </div>

                <!-- Title -->
                <h1 class="text-3xl font-heading font-bold text-gray-900 mb-4">
                  {{ listing.title }}
                </h1>

                <!-- Description -->
                @if (listing.description) {
                  <p class="text-gray-700 mb-6 whitespace-pre-wrap">
                    {{ listing.description }}
                  </p>
                } @else {
                  <p class="text-gray-400 italic mb-6">
                    No description provided
                  </p>
                }

                <mat-divider class="my-6" />

                <!-- Pricing -->
                @if (listing.type === 'AUCTION') {
                  <div class="mb-6">
                    <p class="text-sm text-gray-600 mb-2">Current Bid</p>
                    <p class="text-4xl font-mono font-bold text-primary mb-4">
                      {{ formatPrice(listing.currentBid || listing.startingBid || 0) }}
                    </p>
                    @if (listing.buyNowPrice) {
                      <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p class="text-sm text-gray-600">Buy Now Price</p>
                        <p class="text-2xl font-mono font-bold text-green-600">
                          {{ formatPrice(listing.buyNowPrice) }}
                        </p>
                      </div>
                    }
                    @if (listing.endsAt) {
                      <div class="mt-4 flex items-center gap-2 text-red-600">
                        <mat-icon>schedule</mat-icon>
                        <span class="font-medium">
                          Auction ends {{ formatTimeRemaining(listing.endsAt) }}
                        </span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="mb-6">
                    <p class="text-sm text-gray-600 mb-2">Price</p>
                    <p class="text-4xl font-mono font-bold text-primary">
                      {{ formatPrice(listing.price || listing.buyNowPrice || 0) }}
                    </p>
                  </div>
                }

                <mat-divider class="my-6" />

                <!-- Action Buttons -->
                @if (!isOwnListing()) {
                  <div class="space-y-3">
                    @if (listing.type === 'FIXED_PRICE' || listing.buyNowPrice) {
                      <button
                        mat-raised-button
                        color="primary"
                        class="w-full !py-4 !text-lg"
                        (click)="buyNow()"
                      >
                        <mat-icon>payment</mat-icon>
                        Buy Now
                      </button>
                    }
                    @if (listing.type === 'AUCTION') {
                      <button
                        mat-raised-button
                        color="accent"
                        class="w-full !py-4 !text-lg"
                        (click)="placeBid()"
                      >
                        <mat-icon>gavel</mat-icon>
                        Place Bid
                      </button>
                    }
                    <button
                      mat-stroked-button
                      class="w-full"
                      (click)="addToCart()"
                      [disabled]="cartService.isInCart(listing.id)"
                    >
                      <mat-icon>{{ cartService.isInCart(listing.id) ? 'check' : 'add_shopping_cart' }}</mat-icon>
                      {{ cartService.isInCart(listing.id) ? 'In Cart' : 'Add to Cart' }}
                    </button>
                  </div>
                } @else {
                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <mat-icon class="text-blue-600 mb-2">info</mat-icon>
                    <p class="text-blue-800 font-medium">
                      This is your listing
                    </p>
                  </div>
                }

                <!-- Seller Info -->
                <div class="mt-6 pt-6 border-t">
                  <h3 class="text-sm font-semibold text-gray-700 mb-2">Seller</h3>
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-gray-500">person</mat-icon>
                    <span class="text-gray-900">Seller ID: {{ listing.sellerId }}</span>
                  </div>
                  @if (listing.shopId) {
                    <button
                      mat-stroked-button
                      class="mt-3 w-full"
                      [routerLink]="['/marketplace/shops', listing.shopId]"
                    >
                      <mat-icon>storefront</mat-icon>
                      Visit Shop
                    </button>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class ListingDetailComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public marketplaceService: MarketplaceService,
    public cartService: CartService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.marketplaceService.getListing(id).subscribe({
        error: () => {
          this.snackBar.open('Failed to load listing', 'Close', { duration: 3000 });
        }
      });
    }
  }

  isOwnListing(): boolean {
    const listing = this.marketplaceService.currentListing();
    const user = this.authService.currentUser();
    return !!(listing && user && listing.sellerId === user.id);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  formatTimeRemaining(endsAt: Date): string {
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();

    if (diff < 0) return 'ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  }

  buyNow(): void {
    const listing = this.marketplaceService.currentListing();
    if (!listing) return;

    // In a real implementation, this would open a checkout modal
    this.snackBar.open(
      'Checkout functionality coming soon! This would process your purchase.',
      'Close',
      { duration: 5000 }
    );
  }

  placeBid(): void {
    // In a real implementation, this would open a bid placement modal
    this.snackBar.open(
      'Bidding functionality coming soon! This would allow you to place a bid.',
      'Close',
      { duration: 5000 }
    );
  }

  addToCart(): void {
    const listing = this.marketplaceService.currentListing();
    if (!listing) return;

    this.cartService.addToCart(listing);
    this.snackBar.open('Added to cart!', 'Close', { duration: 2000 });
  }
}
