import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Listing, ListingStatus, ListingType } from '@la-grieta/shared';
import { ConditionBadgeComponent } from '../../../collections/components/condition-badge/condition-badge.component';

@Component({
  selector: 'lg-listing-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    ConditionBadgeComponent
  ],
  template: `
    <mat-card class="h-full flex flex-col hover:shadow-lg transition-shadow duration-200">
      <mat-card-content class="!p-4 flex-1 flex flex-col">
        <!-- Card Image Placeholder -->
        <div class="w-full aspect-[3/4] bg-gradient-to-br from-purple-100 to-green-100 rounded-lg mb-3 flex items-center justify-center">
          @if (listing.items && listing.items.length > 0 && listing.items[0].card?.imageUrl) {
            <img
              [src]="listing.items[0].card!.imageUrl"
              [alt]="listing.title"
              class="w-full h-full object-cover rounded-lg"
            />
          } @else {
            <mat-icon class="!text-[4rem] text-gray-400">shopping_bag</mat-icon>
          }
        </div>

        <!-- Type Badge -->
        <div class="mb-2">
          @if (listing.type === 'AUCTION') {
            <mat-chip class="!bg-orange-500 !text-white !text-xs !h-6">
              <mat-icon class="!text-base mr-1">gavel</mat-icon>
              Auction
            </mat-chip>
          } @else {
            <mat-chip class="!bg-blue-500 !text-white !text-xs !h-6">
              <mat-icon class="!text-base mr-1">shopping_cart</mat-icon>
              Fixed Price
            </mat-chip>
          }
        </div>

        <!-- Title -->
        <h3 class="text-lg font-card font-bold text-gray-900 mb-2 line-clamp-2 min-h-[3.5rem]">
          {{ listing.title }}
        </h3>

        <!-- Condition & Quantity -->
        @if (listing.items && listing.items.length > 0) {
          <div class="flex items-center gap-2 mb-3">
            <lg-condition-badge [condition]="listing.items[0].condition" size="sm" />
            <span class="text-xs text-gray-600">
              Qty: {{ getTotalQuantity() }}
            </span>
          </div>
        }

        <!-- Price -->
        <div class="mt-auto">
          @if (listing.type === 'AUCTION') {
            <div class="mb-1">
              <p class="text-xs text-gray-600">Current Bid</p>
              <p class="text-2xl font-mono font-bold text-primary">
                {{ formatPrice(listing.currentBid || listing.startingBid || 0) }}
              </p>
            </div>
            @if (listing.buyNowPrice) {
              <p class="text-xs text-gray-600">
                Buy Now: {{ formatPrice(listing.buyNowPrice) }}
              </p>
            }
            @if (listing.endsAt) {
              <p class="text-xs text-red-600 mt-1">
                <mat-icon class="!text-xs align-middle">schedule</mat-icon>
                Ends {{ formatTimeRemaining(listing.endsAt) }}
              </p>
            }
          } @else {
            <p class="text-xs text-gray-600 mb-1">Price</p>
            <p class="text-2xl font-mono font-bold text-primary">
              {{ formatPrice(listing.price || listing.buyNowPrice || 0) }}
            </p>
          }
        </div>

        <!-- Action Button -->
        <div class="mt-4">
          <button
            mat-raised-button
            color="primary"
            class="w-full"
            [routerLink]="['/marketplace/listings', listing.id]"
          >
            <mat-icon>visibility</mat-icon>
            View Details
          </button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: []
})
export class ListingCardComponent {
  @Input() listing!: Listing;

  getTotalQuantity(): number {
    if (!this.listing.items) return 0;
    return this.listing.items.reduce((sum, item) => sum + item.quantity, 0);
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

    if (diff < 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h`;
    return 'Soon';
  }
}
