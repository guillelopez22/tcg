import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  Shop,
  ShopWithListings,
  CreateShopDto,
  UpdateShopDto,
} from '@la-grieta/shared';

@Injectable({
  providedIn: 'root'
})
export class ShopsService {
  private api = inject(ApiService);

  // Angular Signals for state management
  private shopsSignal = signal<Shop[]>([]);
  private currentShopSignal = signal<ShopWithListings | null>(null);
  private myShopSignal = signal<Shop | null>(null);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly shops = this.shopsSignal.asReadonly();
  readonly currentShop = this.currentShopSignal.asReadonly();
  readonly myShop = this.myShopSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed values
  readonly hasShops = computed(() => this.shopsSignal().length > 0);
  readonly hasMyShop = computed(() => this.myShopSignal() !== null);

  /**
   * Get All Shops
   * GET /api/marketplace/shops
   */
  getShops(): Observable<{ shops: Shop[]; pagination: any }> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<{ shops: Shop[]; pagination: any }>('marketplace/shops').pipe(
      tap({
        next: (response) => {
          this.shopsSignal.set(response.shops);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load shops');
        }
      })
    );
  }

  /**
   * Get Shop by ID
   * GET /api/marketplace/shops/:id
   */
  getShop(id: string): Observable<ShopWithListings> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<ShopWithListings>(`marketplace/shops/${id}`).pipe(
      tap({
        next: (shop) => {
          this.currentShopSignal.set(shop);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load shop');
        }
      })
    );
  }

  /**
   * Get My Shop
   * GET /api/marketplace/shops/my
   */
  getMyShop(): Observable<Shop> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<Shop>('marketplace/shops/my').pipe(
      tap({
        next: (shop) => {
          this.myShopSignal.set(shop);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          // Don't set error if shop doesn't exist (404)
          if (err.status !== 404) {
            this.errorSignal.set(err.error?.message || 'Failed to load your shop');
          } else {
            this.myShopSignal.set(null);
          }
        }
      })
    );
  }

  /**
   * Create Shop
   * POST /api/marketplace/shops
   */
  createShop(dto: CreateShopDto): Observable<Shop> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<Shop>('marketplace/shops', dto).pipe(
      tap({
        next: (shop) => {
          this.myShopSignal.set(shop);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to create shop');
        }
      })
    );
  }

  /**
   * Update Shop
   * PUT /api/marketplace/shops/:id
   */
  updateShop(id: string, dto: UpdateShopDto): Observable<Shop> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.put<Shop>(`marketplace/shops/${id}`, dto).pipe(
      tap({
        next: (shop) => {
          this.loadingSignal.set(false);
          // Update my shop if it's the one being edited
          if (this.myShopSignal()?.id === id) {
            this.myShopSignal.set(shop);
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to update shop');
        }
      })
    );
  }

  /**
   * Clear current shop
   */
  clearCurrentShop(): void {
    this.currentShopSignal.set(null);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
