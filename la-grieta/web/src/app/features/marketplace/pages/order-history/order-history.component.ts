import {  Component, OnInit , inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { OrdersService } from '../../services/orders.service';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import { EmptyStateComponent } from '../../../collections/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { OrderStatus } from '@la-grieta/shared';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatSelectModule,
    MatFormFieldModule,
    OrderStatusBadgeComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
          Order History
        </h1>
        <p class="text-base text-gray-600">
          View and track your purchases
        </p>
      </div>

      <!-- Filters -->
      <div class="mb-6 flex flex-col sm:flex-row gap-4">
        <mat-form-field appearance="outline" class="sm:w-64">
          <mat-label>Filter by Status</mat-label>
          <mat-select [(ngModel)]="selectedStatus" (selectionChange)="loadOrders()">
            <mat-option [value]="undefined">All Statuses</mat-option>
            <mat-option value="PENDING_PAYMENT">Pending Payment</mat-option>
            <mat-option value="PAYMENT_HELD">Payment Held</mat-option>
            <mat-option value="SHIPPED">Shipped</mat-option>
            <mat-option value="DELIVERED">Delivered</mat-option>
            <mat-option value="COMPLETED">Completed</mat-option>
            <mat-option value="CANCELLED">Cancelled</mat-option>
          </mat-select>
        </mat-form-field>

        <button
          mat-stroked-button
          (click)="loadOrders()"
        >
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      <!-- Loading State -->
      @if (ordersService.loading() && !ordersService.hasOrders()) {
        <div class="flex justify-center py-16">
          <app-loading-spinner />
        </div>
      }

      <!-- Error State -->
      @if (ordersService.error() && !ordersService.hasOrders()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2">
            <mat-icon class="text-red-600">error</mat-icon>
            <p class="text-red-800">{{ ordersService.error() }}</p>
          </div>
        </div>
      }

      <!-- Orders List -->
      @if (ordersService.hasOrders()) {
        <div class="space-y-4">
          @for (order of ordersService.orders(); track order.id) {
            <mat-card class="hover:shadow-lg transition-shadow">
              <mat-card-content class="!p-6">
                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <!-- Order Info -->
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-3">
                      <h3 class="text-lg font-semibold text-gray-900">
                        Order #{{ order.id.substring(0, 8) }}
                      </h3>
                      <app-order-status-badge [status]="order.status" />
                    </div>

                    <!-- Listing Title -->
                    @if (order.listing) {
                      <p class="text-gray-700 font-medium mb-2">
                        {{ order.listing.title }}
                      </p>
                      @if (order.listing.description) {
                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">
                          {{ order.listing.description }}
                        </p>
                      }
                    }

                    <!-- Seller Info -->
                    @if (order.seller) {
                      <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <mat-icon class="!text-base">person</mat-icon>
                        <span>Seller: {{ order.seller.username }}</span>
                      </div>
                    }

                    <!-- Order Date -->
                    <div class="flex items-center gap-2 text-sm text-gray-600">
                      <mat-icon class="!text-base">calendar_today</mat-icon>
                      <span>Ordered: {{ formatDate(order.createdAt) }}</span>
                    </div>

                    <!-- Tracking Number -->
                    @if (order.trackingNumber) {
                      <div class="flex items-center gap-2 text-sm text-gray-600 mt-2">
                        <mat-icon class="!text-base">local_shipping</mat-icon>
                        <span>Tracking: {{ order.trackingNumber }}</span>
                      </div>
                    }
                  </div>

                  <mat-divider [vertical]="true" class="hidden lg:block h-auto" />

                  <!-- Order Pricing -->
                  <div class="lg:w-64 space-y-2">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600">Subtotal:</span>
                      <span class="font-medium">\${{ order.subtotal.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600">Shipping:</span>
                      <span class="font-medium">\${{ order.shippingCost.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600">Platform Fee:</span>
                      <span class="font-medium">\${{ order.platformFee.toFixed(2) }}</span>
                    </div>
                    <mat-divider />
                    <div class="flex justify-between">
                      <span class="font-semibold text-gray-900">Total:</span>
                      <span class="text-xl font-mono font-bold text-primary">
                        \${{ order.total.toFixed(2) }}
                      </span>
                    </div>

                    <!-- Actions -->
                    <div class="mt-4 space-y-2">
                      <button
                        mat-stroked-button
                        class="w-full"
                        (click)="viewOrderDetails(order.id)"
                      >
                        <mat-icon>receipt</mat-icon>
                        View Details
                      </button>
                      @if (order.status === 'DELIVERED') {
                        <button
                          mat-stroked-button
                          class="w-full"
                          (click)="confirmDelivery(order.id)"
                        >
                          <mat-icon>check_circle</mat-icon>
                          Confirm Delivery
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }

      <!-- Empty State -->
      @if (!ordersService.loading() && !ordersService.hasOrders()) {
        <app-empty-state
          icon="shopping_bag"
          heading="No Orders Yet"
          description="You haven't made any purchases yet. Browse the marketplace to find cards!"
          [primaryAction]="{
            label: 'Browse Marketplace',
            icon: 'storefront',
            primary: true
          }"
          (primaryActionClick)="goToMarketplace()"
        />
      }
    </div>
  `,
  styles: []
})
export class OrderHistoryComponent implements OnInit {
  public ordersService = inject(OrdersService);
  selectedStatus?: OrderStatus;

  

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.ordersService.getMyOrders({
      status: this.selectedStatus
    }).subscribe();
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  viewOrderDetails(orderId: string): void {
    alert(`Order details modal would open for order ${orderId}`);
  }

  confirmDelivery(orderId: string): void {
    const confirmed = confirm('Confirm that you received this order?');
    if (!confirmed) return;

    this.ordersService.updateOrderStatus(orderId, {
      status: OrderStatus.COMPLETED
    }).subscribe({
      next: () => {
        this.loadOrders();
      }
    });
  }

  goToMarketplace(): void {
    window.location.href = '/marketplace';
  }
}
