import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  Order,
  OrderWithDetails,
  OrderFiltersDto,
  UpdateOrderStatusDto,
} from '@la-grieta/shared';

export interface PaginatedOrders {
  orders: OrderWithDetails[];
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
export class OrdersService {
  private api = inject(ApiService);

  // Angular Signals for state management
  private ordersSignal = signal<OrderWithDetails[]>([]);
  private salesSignal = signal<OrderWithDetails[]>([]);
  private currentOrderSignal = signal<OrderWithDetails | null>(null);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly orders = this.ordersSignal.asReadonly();
  readonly sales = this.salesSignal.asReadonly();
  readonly currentOrder = this.currentOrderSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed values
  readonly hasOrders = computed(() => this.ordersSignal().length > 0);
  readonly hasSales = computed(() => this.salesSignal().length > 0);
  readonly ordersCount = computed(() => this.ordersSignal().length);
  readonly salesCount = computed(() => this.salesSignal().length);

  /**
   * Get My Orders (Purchases)
   * GET /api/marketplace/orders
   */
  getMyOrders(filters?: OrderFiltersDto): Observable<PaginatedOrders> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<PaginatedOrders>('marketplace/orders', filters).pipe(
      tap({
        next: (response) => {
          this.ordersSignal.set(response.orders);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load orders');
        }
      })
    );
  }

  /**
   * Get My Sales
   * GET /api/marketplace/orders/sales
   */
  getMySales(filters?: OrderFiltersDto): Observable<PaginatedOrders> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<PaginatedOrders>('marketplace/orders/sales', filters).pipe(
      tap({
        next: (response) => {
          this.salesSignal.set(response.orders);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load sales');
        }
      })
    );
  }

  /**
   * Get Single Order
   * GET /api/marketplace/orders/:id
   */
  getOrder(id: string): Observable<OrderWithDetails> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<OrderWithDetails>(`marketplace/orders/${id}`).pipe(
      tap({
        next: (order) => {
          this.currentOrderSignal.set(order);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load order');
        }
      })
    );
  }

  /**
   * Update Order Status (Seller only)
   * PUT /api/marketplace/orders/:id/status
   */
  updateOrderStatus(id: string, dto: UpdateOrderStatusDto): Observable<OrderWithDetails> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.put<OrderWithDetails>(`marketplace/orders/${id}/status`, dto).pipe(
      tap({
        next: (order) => {
          this.loadingSignal.set(false);
          if (this.currentOrderSignal()?.id === id) {
            this.currentOrderSignal.set(order);
          }
          // Update in sales array if exists
          const salesIndex = this.salesSignal().findIndex(s => s.id === id);
          if (salesIndex !== -1) {
            const updatedSales = [...this.salesSignal()];
            updatedSales[salesIndex] = order;
            this.salesSignal.set(updatedSales);
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to update order');
        }
      })
    );
  }

  /**
   * Confirm Receipt (Buyer)
   * POST /api/marketplace/orders/:id/confirm
   */
  confirmReceipt(orderId: string): Observable<OrderWithDetails> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<OrderWithDetails>(`marketplace/orders/${orderId}/confirm`, {}).pipe(
      tap({
        next: (order) => {
          this.loadingSignal.set(false);
          if (this.currentOrderSignal()?.id === orderId) {
            this.currentOrderSignal.set(order);
          }
          // Update in orders array if exists
          const orderIndex = this.ordersSignal().findIndex(o => o.id === orderId);
          if (orderIndex !== -1) {
            const updatedOrders = [...this.ordersSignal()];
            updatedOrders[orderIndex] = order;
            this.ordersSignal.set(updatedOrders);
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to confirm receipt');
        }
      })
    );
  }

  /**
   * Cancel Order (Buyer)
   * POST /api/marketplace/orders/:id/cancel
   */
  cancelOrder(orderId: string): Observable<OrderWithDetails> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<OrderWithDetails>(`marketplace/orders/${orderId}/cancel`, {}).pipe(
      tap({
        next: (order) => {
          this.loadingSignal.set(false);
          if (this.currentOrderSignal()?.id === orderId) {
            this.currentOrderSignal.set(order);
          }
          // Update in orders array if exists
          const orderIndex = this.ordersSignal().findIndex(o => o.id === orderId);
          if (orderIndex !== -1) {
            const updatedOrders = [...this.ordersSignal()];
            updatedOrders[orderIndex] = order;
            this.ordersSignal.set(updatedOrders);
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to cancel order');
        }
      })
    );
  }

  /**
   * Clear current order
   */
  clearCurrentOrder(): void {
    this.currentOrderSignal.set(null);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
