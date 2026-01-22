import { Injectable, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  Listing,
  CreateListingDto,
  UpdateListingDto,
  ListingFiltersDto,
} from '@la-grieta/shared';

export interface PaginatedListings {
  listings: Listing[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MarketplaceService {
  // Angular Signals for state management
  private listingsSignal = signal<Listing[]>([]);
  private currentListingSignal = signal<Listing | null>(null);
  private paginationSignal = signal<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  });
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly listings = this.listingsSignal.asReadonly();
  readonly currentListing = this.currentListingSignal.asReadonly();
  readonly pagination = this.paginationSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed values
  readonly hasListings = computed(() => this.listingsSignal().length > 0);
  readonly listingsCount = computed(() => this.listingsSignal().length);

  constructor(private api: ApiService) {}

  /**
   * Browse Listings with Filters
   * GET /api/marketplace/listings
   */
  browseListings(filters?: ListingFiltersDto): Observable<PaginatedListings> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<PaginatedListings>('marketplace/listings', filters).pipe(
      tap({
        next: (response) => {
          this.listingsSignal.set(response.listings);
          this.paginationSignal.set({
            total: response.pagination.total,
            page: response.pagination.page,
            limit: response.pagination.limit,
            totalPages: response.pagination.totalPages
          });
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load listings');
        }
      })
    );
  }

  /**
   * Get Single Listing
   * GET /api/marketplace/listings/:id
   */
  getListing(id: string): Observable<Listing> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<Listing>(`marketplace/listings/${id}`).pipe(
      tap({
        next: (listing) => {
          this.currentListingSignal.set(listing);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load listing');
        }
      })
    );
  }

  /**
   * Create Listing
   * POST /api/marketplace/listings
   */
  createListing(dto: CreateListingDto): Observable<Listing> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<Listing>('marketplace/listings', dto).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to create listing');
        }
      })
    );
  }

  /**
   * Update Listing
   * PUT /api/marketplace/listings/:id
   */
  updateListing(id: string, dto: UpdateListingDto): Observable<Listing> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.put<Listing>(`marketplace/listings/${id}`, dto).pipe(
      tap({
        next: (updated) => {
          this.loadingSignal.set(false);
          if (this.currentListingSignal()?.id === id) {
            this.currentListingSignal.set(updated);
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to update listing');
        }
      })
    );
  }

  /**
   * Delete Listing
   * DELETE /api/marketplace/listings/:id
   */
  deleteListing(id: string): Observable<{ message: string }> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.delete<{ message: string }>(`marketplace/listings/${id}`).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
          if (this.currentListingSignal()?.id === id) {
            this.currentListingSignal.set(null);
          }
          // Remove from listings array
          const updated = this.listingsSignal().filter(l => l.id !== id);
          this.listingsSignal.set(updated);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to delete listing');
        }
      })
    );
  }

  /**
   * Purchase Listing
   * POST /api/marketplace/listings/:id/purchase
   */
  purchaseListing(id: string, shippingAddress: any): Observable<any> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<any>(`marketplace/listings/${id}/purchase`, { shippingAddress }).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to complete purchase');
        }
      })
    );
  }

  /**
   * Clear current listing
   */
  clearCurrentListing(): void {
    this.currentListingSignal.set(null);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
