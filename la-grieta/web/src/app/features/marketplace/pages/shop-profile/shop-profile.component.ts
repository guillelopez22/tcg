import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ShopsService } from '../../services/shops.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { EmptyStateComponent } from '../../../collections/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'lg-shop-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatSnackBarModule,
    ListingCardComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Loading State -->
      @if (shopsService.loading() && !shopsService.currentShop()) {
        <div class="flex justify-center py-16">
          <lg-loading-spinner />
        </div>
      }

      <!-- Error State -->
      @if (shopsService.error() && !shopsService.currentShop()) {
        <div class="container mx-auto px-4 py-6">
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center gap-2">
              <mat-icon class="text-red-600">error</mat-icon>
              <p class="text-red-800">{{ shopsService.error() }}</p>
            </div>
          </div>
        </div>
      }

      @if (shopsService.currentShop(); as shop) {
        <!-- Shop Banner -->
        <div class="bg-gradient-to-r from-purple-600 to-green-600 h-48 md:h-64">
          @if (shop.bannerUrl) {
            <img [src]="shop.bannerUrl" [alt]="shop.name" class="w-full h-full object-cover" />
          }
        </div>

        <!-- Shop Header -->
        <div class="container mx-auto px-4 -mt-16 md:-mt-20 mb-8">
          <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex flex-col md:flex-row items-start md:items-center gap-6">
              <!-- Shop Logo/Avatar -->
              <div class="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                @if (shop.logoUrl) {
                  <img [src]="shop.logoUrl" [alt]="shop.name" class="w-full h-full rounded-full object-cover" />
                } @else {
                  <mat-icon class="!text-[4rem] text-primary">storefront</mat-icon>
                }
              </div>

              <!-- Shop Info -->
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h1 class="text-3xl font-heading font-bold text-gray-900">
                    {{ shop.name }}
                  </h1>
                  @if (shop.isVerified) {
                    <mat-chip class="!bg-blue-500 !text-white !h-7">
                      <mat-icon class="!text-base">verified</mat-icon>
                      Verified
                    </mat-chip>
                  }
                </div>

                @if (shop.description) {
                  <p class="text-gray-600 mb-4">{{ shop.description }}</p>
                }

                <!-- Shop Stats -->
                <div class="flex flex-wrap gap-6 text-sm">
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-yellow-500">star</mat-icon>
                    <span class="font-semibold">{{ shop.rating.toFixed(1) }}</span>
                    <span class="text-gray-600">Rating</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-green-600">shopping_bag</mat-icon>
                    <span class="font-semibold">{{ shop.totalSales }}</span>
                    <span class="text-gray-600">Sales</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-gray-600">inventory_2</mat-icon>
                    <span class="font-semibold">{{ shop.listings?.length || 0 }}</span>
                    <span class="text-gray-600">Active Listings</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-2">
                <button
                  mat-stroked-button
                  routerLink="/marketplace"
                >
                  <mat-icon>arrow_back</mat-icon>
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Shop Listings -->
        <div class="container mx-auto px-4 pb-8">
          <div class="mb-6">
            <h2 class="text-2xl font-heading font-bold text-gray-900">
              Listings
            </h2>
          </div>

          @if (shop.listings && shop.listings.length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              @for (listing of shop.listings; track listing.id) {
                <lg-listing-card [listing]="listing" />
              }
            </div>
          } @else {
            <lg-empty-state
              icon="inventory_2"
              heading="No Active Listings"
              description="This shop doesn't have any active listings at the moment."
            />
          }
        </div>
      }
    </div>
  `,
  styles: []
})
export class ShopProfileComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    public shopsService: ShopsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.shopsService.getShop(id).subscribe({
        error: () => {
          this.snackBar.open('Failed to load shop', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
