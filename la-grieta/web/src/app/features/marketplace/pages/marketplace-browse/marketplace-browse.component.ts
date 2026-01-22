import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatBadgeModule } from '@angular/material/badge';
import { MarketplaceService } from '../../services/marketplace.service';
import { CartService } from '../../services/cart.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { PriceFilterComponent, PriceRange } from '../../components/price-filter/price-filter.component';
import { EmptyStateComponent } from '../../../collections/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ListingStatus, ListingType } from '@la-grieta/shared';

@Component({
  selector: 'lg-marketplace-browse',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatPaginatorModule,
    MatBadgeModule,
    ListingCardComponent,
    PriceFilterComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header Section -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
            Marketplace
          </h1>
          <p class="text-base text-gray-600">
            Browse and purchase cards from sellers
          </p>
        </div>
        <button
          mat-icon-button
          [matBadge]="cartService.itemCount()"
          matBadgeColor="accent"
          [matBadgeHidden]="!cartService.hasItems()"
          (click)="cartService.openCart()"
          class="!w-14 !h-14"
          aria-label="Open cart"
        >
          <mat-icon class="!text-3xl">shopping_cart</mat-icon>
        </button>
      </div>

      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Filters Sidebar -->
        <aside class="lg:w-80 space-y-6">
          <!-- Search -->
          <div class="bg-white rounded-lg border p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <mat-icon>search</mat-icon>
              Search
            </h3>
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Search listings</mat-label>
              <input
                matInput
                [(ngModel)]="searchQuery"
                (keyup.enter)="applyFilters()"
                placeholder="Card name, description..."
              />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>

          <!-- Type Filter -->
          <div class="bg-white rounded-lg border p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <mat-icon>category</mat-icon>
              Listing Type
            </h3>
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="selectedType">
                <mat-option [value]="undefined">All Types</mat-option>
                <mat-option value="FIXED_PRICE">Fixed Price</mat-option>
                <mat-option value="AUCTION">Auction</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Price Filter -->
          <lg-price-filter (filterChange)="onPriceFilterChange($event)" />

          <!-- Apply Filters Button -->
          <button
            mat-raised-button
            color="primary"
            class="w-full"
            (click)="applyFilters()"
          >
            <mat-icon>filter_list</mat-icon>
            Apply Filters
          </button>

          @if (hasActiveFilters()) {
            <button
              mat-stroked-button
              class="w-full"
              (click)="clearAllFilters()"
            >
              <mat-icon>clear</mat-icon>
              Clear All Filters
            </button>
          }
        </aside>

        <!-- Main Content -->
        <main class="flex-1">
          <!-- Active Filters Chips -->
          @if (hasActiveFilters()) {
            <div class="mb-4 flex flex-wrap gap-2">
              @if (searchQuery) {
                <mat-chip
                  class="!bg-primary-100"
                  (removed)="searchQuery = ''; applyFilters()"
                >
                  Search: "{{ searchQuery }}"
                  <button matChipRemove>
                    <mat-icon>cancel</mat-icon>
                  </button>
                </mat-chip>
              }
              @if (selectedType) {
                <mat-chip
                  class="!bg-primary-100"
                  (removed)="selectedType = undefined; applyFilters()"
                >
                  Type: {{ selectedType }}
                  <button matChipRemove>
                    <mat-icon>cancel</mat-icon>
                  </button>
                </mat-chip>
              }
              @if (priceRange.minPrice !== undefined || priceRange.maxPrice !== undefined) {
                <mat-chip
                  class="!bg-primary-100"
                  (removed)="priceRange = {}; applyFilters()"
                >
                  Price: {{ formatPriceRange() }}
                  <button matChipRemove>
                    <mat-icon>cancel</mat-icon>
                  </button>
                </mat-chip>
              }
            </div>
          }

          <!-- Loading State -->
          @if (marketplaceService.loading() && !marketplaceService.hasListings()) {
            <div class="flex justify-center py-16">
              <lg-loading-spinner />
            </div>
          }

          <!-- Error State -->
          @if (marketplaceService.error() && !marketplaceService.hasListings()) {
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div class="flex items-center gap-2">
                <mat-icon class="text-red-600">error</mat-icon>
                <p class="text-red-800">{{ marketplaceService.error() }}</p>
              </div>
            </div>
          }

          <!-- Results Count -->
          @if (marketplaceService.hasListings()) {
            <div class="mb-4 text-sm text-gray-600">
              Showing {{ marketplaceService.listings().length }} of {{ marketplaceService.pagination().total }} results
            </div>
          }

          <!-- Listings Grid -->
          @if (marketplaceService.hasListings()) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
              @for (listing of marketplaceService.listings(); track listing.id) {
                <lg-listing-card [listing]="listing" />
              }
            </div>

            <!-- Pagination -->
            @if (marketplaceService.pagination().totalPages > 1) {
              <div class="flex justify-center">
                <mat-paginator
                  [length]="marketplaceService.pagination().total"
                  [pageSize]="marketplaceService.pagination().limit"
                  [pageIndex]="marketplaceService.pagination().page - 1"
                  [pageSizeOptions]="[10, 20, 50, 100]"
                  (page)="onPageChange($event)"
                  showFirstLastButtons
                />
              </div>
            }
          }

          <!-- Empty State -->
          @if (!marketplaceService.loading() && !marketplaceService.hasListings()) {
            <lg-empty-state
              icon="storefront"
              heading="No Listings Found"
              [description]="getEmptyStateMessage()"
            />
          }
        </main>
      </div>
    </div>
  `,
  styles: []
})
export class MarketplaceBrowseComponent implements OnInit {
  searchQuery = '';
  selectedType?: ListingType;
  priceRange: PriceRange = {};
  currentPage = 1;
  pageSize = 20;

  constructor(
    public marketplaceService: MarketplaceService,
    public cartService: CartService
  ) {}

  ngOnInit(): void {
    this.loadListings();
  }

  loadListings(): void {
    this.marketplaceService.browseListings({
      status: ListingStatus.ACTIVE,
      search: this.searchQuery || undefined,
      type: this.selectedType,
      minPrice: this.priceRange.minPrice,
      maxPrice: this.priceRange.maxPrice,
      page: this.currentPage,
      limit: this.pageSize
    }).subscribe();
  }

  applyFilters(): void {
    this.currentPage = 1; // Reset to first page
    this.loadListings();
  }

  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedType = undefined;
    this.priceRange = {};
    this.applyFilters();
  }

  onPriceFilterChange(range: PriceRange): void {
    this.priceRange = range;
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadListings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchQuery ||
      this.selectedType ||
      this.priceRange.minPrice !== undefined ||
      this.priceRange.maxPrice !== undefined
    );
  }

  formatPriceRange(): string {
    const min = this.priceRange.minPrice;
    const max = this.priceRange.maxPrice;

    if (min !== undefined && max !== undefined) {
      return `$${min} - $${max}`;
    } else if (min !== undefined) {
      return `$${min}+`;
    } else if (max !== undefined) {
      return `Up to $${max}`;
    }
    return '';
  }

  getEmptyStateMessage(): string {
    if (this.hasActiveFilters()) {
      return 'No listings match your search criteria. Try adjusting your filters.';
    }
    return 'No active listings available at the moment. Check back soon!';
  }
}
