import {  Component, OnInit , inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { OrdersService } from '../../services/orders.service';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import { EmptyStateComponent } from '../../../collections/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { OrderStatus } from '@la-grieta/shared';

@Component({
  selector: 'app-ship-order-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
  ],
  template: `
    <h2 mat-dialog-title>Mark Order as Shipped</h2>
    <mat-dialog-content>
      <div class="py-4">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Tracking Number</mat-label>
          <input matInput [(ngModel)]="trackingNumber" placeholder="Enter tracking number" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!trackingNumber"
        (click)="onSubmit()"
      >
        Mark as Shipped
      </button>
    </mat-dialog-actions>
  `
})
export class ShipOrderModalComponent {
  private dialogRef = inject(MatDialogRef<ShipOrderModalComponent>);
  trackingNumber = '';

  

  onSubmit(): void {
    this.dialogRef.close(this.trackingNumber);
  }
}

@Component({
  selector: 'app-sales-dashboard',
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
    MatSnackBarModule,
    OrderStatusBadgeComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
          Sales Dashboard
        </h1>
        <p class="text-base text-gray-600">
          Manage your sales and fulfill orders
        </p>
      </div>

      <!-- Stats Overview -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <mat-card>
          <mat-card-content class="!p-4 text-center">
            <p class="text-3xl font-mono font-bold text-primary">{{ getTotalSales() }}</p>
            <p class="text-sm text-gray-600">Total Sales</p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content class="!p-4 text-center">
            <p class="text-3xl font-mono font-bold text-yellow-600">{{ getPendingSales() }}</p>
            <p class="text-sm text-gray-600">Pending</p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content class="!p-4 text-center">
            <p class="text-3xl font-mono font-bold text-blue-600">{{ getShippedSales() }}</p>
            <p class="text-sm text-gray-600">Shipped</p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content class="!p-4 text-center">
            <p class="text-3xl font-mono font-bold text-green-600">{{ getCompletedSales() }}</p>
            <p class="text-sm text-gray-600">Completed</p>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Filters -->
      <div class="mb-6 flex flex-col sm:flex-row gap-4">
        <mat-form-field appearance="outline" class="sm:w-64">
          <mat-label>Filter by Status</mat-label>
          <mat-select [(ngModel)]="selectedStatus" (selectionChange)="loadSales()">
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
          (click)="loadSales()"
        >
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      <!-- Loading State -->
      @if (ordersService.loading() && !ordersService.hasSales()) {
        <div class="flex justify-center py-16">
          <app-loading-spinner />
        </div>
      }

      <!-- Error State -->
      @if (ordersService.error() && !ordersService.hasSales()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2">
            <mat-icon class="text-red-600">error</mat-icon>
            <p class="text-red-800">{{ ordersService.error() }}</p>
          </div>
        </div>
      }

      <!-- Sales List -->
      @if (ordersService.hasSales()) {
        <div class="space-y-4">
          @for (sale of ordersService.sales(); track sale.id) {
            <mat-card class="hover:shadow-lg transition-shadow">
              <mat-card-content class="!p-6">
                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <!-- Sale Info -->
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-3">
                      <h3 class="text-lg font-semibold text-gray-900">
                        Sale #{{ sale.id.substring(0, 8) }}
                      </h3>
                      <app-order-status-badge [status]="sale.status" />
                    </div>

                    <!-- Listing Title -->
                    @if (sale.listing) {
                      <p class="text-gray-700 font-medium mb-2">
                        {{ sale.listing.title }}
                      </p>
                      @if (sale.listing.description) {
                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">
                          {{ sale.listing.description }}
                        </p>
                      }
                    }

                    <!-- Buyer Info -->
                    @if (sale.buyer) {
                      <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <mat-icon class="!text-base">person</mat-icon>
                        <span>Buyer: {{ sale.buyer.username }} ({{ sale.buyer.email }})</span>
                      </div>
                    }

                    <!-- Shipping Address -->
                    <div class="bg-gray-50 rounded-lg p-3 mt-3 text-sm">
                      <p class="font-medium text-gray-900 mb-1">Shipping Address:</p>
                      <p class="text-gray-700">{{ sale.shippingAddress.fullName }}</p>
                      <p class="text-gray-700">{{ sale.shippingAddress.addressLine1 }}</p>
                      @if (sale.shippingAddress.addressLine2) {
                        <p class="text-gray-700">{{ sale.shippingAddress.addressLine2 }}</p>
                      }
                      <p class="text-gray-700">
                        {{ sale.shippingAddress.city }}, {{ sale.shippingAddress.state }} {{ sale.shippingAddress.postalCode }}
                      </p>
                      <p class="text-gray-700">{{ sale.shippingAddress.country }}</p>
                      @if (sale.shippingAddress.phone) {
                        <p class="text-gray-700">Phone: {{ sale.shippingAddress.phone }}</p>
                      }
                    </div>

                    <!-- Tracking Number -->
                    @if (sale.trackingNumber) {
                      <div class="flex items-center gap-2 text-sm text-gray-600 mt-3">
                        <mat-icon class="!text-base">local_shipping</mat-icon>
                        <span>Tracking: {{ sale.trackingNumber }}</span>
                      </div>
                    }

                    <!-- Order Date -->
                    <div class="flex items-center gap-2 text-sm text-gray-600 mt-2">
                      <mat-icon class="!text-base">calendar_today</mat-icon>
                      <span>Ordered: {{ formatDate(sale.createdAt) }}</span>
                    </div>
                  </div>

                  <mat-divider [vertical]="true" class="hidden lg:block h-auto" />

                  <!-- Sale Pricing & Actions -->
                  <div class="lg:w-64 space-y-2">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600">Subtotal:</span>
                      <span class="font-medium">\${{ sale.subtotal.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600">Shipping:</span>
                      <span class="font-medium">\${{ sale.shippingCost.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-sm text-red-600">
                      <span>Platform Fee:</span>
                      <span class="font-medium">-\${{ sale.platformFee.toFixed(2) }}</span>
                    </div>
                    <mat-divider />
                    <div class="flex justify-between">
                      <span class="font-semibold text-gray-900">Your Payout:</span>
                      <span class="text-xl font-mono font-bold text-green-600">
                        \${{ (sale.total - sale.platformFee).toFixed(2) }}
                      </span>
                    </div>

                    <!-- Actions -->
                    <div class="mt-4 space-y-2">
                      @if (sale.status === 'PAYMENT_HELD') {
                        <button
                          mat-raised-button
                          color="primary"
                          class="w-full"
                          (click)="markAsShipped(sale.id)"
                        >
                          <mat-icon>local_shipping</mat-icon>
                          Mark as Shipped
                        </button>
                      }
                      @if (sale.status === 'SHIPPED' || sale.status === 'DELIVERED') {
                        <div class="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                          <mat-icon class="!text-base align-middle">info</mat-icon>
                          Payment will be released after delivery confirmation
                        </div>
                      }
                      <button
                        mat-stroked-button
                        class="w-full"
                        (click)="viewSaleDetails(sale.id)"
                      >
                        <mat-icon>receipt</mat-icon>
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }

      <!-- Empty State -->
      @if (!ordersService.loading() && !ordersService.hasSales()) {
        <app-empty-state
          icon="receipt_long"
          heading="No Sales Yet"
          description="You haven't made any sales yet. Create listings to start selling!"
          [primaryAction]="{
            label: 'Create Listing',
            icon: 'add',
            primary: true
          }"
          (primaryActionClick)="goToCreateListing()"
        />
      }
    </div>
  `,
  styles: []
})
export class SalesDashboardComponent implements OnInit {
  selectedStatus?: OrderStatus;

  ordersService = inject(OrdersService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadSales();
  }

  loadSales(): void {
    this.ordersService.getMySales({
      status: this.selectedStatus
    }).subscribe();
  }

  getTotalSales(): number {
    return this.ordersService.salesCount();
  }

  getPendingSales(): number {
    return this.ordersService.sales().filter((s: any) =>
      s.status === OrderStatus.PENDING_PAYMENT || s.status === OrderStatus.PAYMENT_HELD
    ).length;
  }

  getShippedSales(): number {
    return this.ordersService.sales().filter((s: any) => s.status === OrderStatus.SHIPPED).length;
  }

  getCompletedSales(): number {
    return this.ordersService.sales().filter((s: any) => s.status === OrderStatus.COMPLETED).length;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  markAsShipped(saleId: string): void {
    const dialogRef = this.dialog.open(ShipOrderModalComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe((trackingNumber: string) => {
      if (trackingNumber) {
        this.ordersService.updateOrderStatus(saleId, {
          status: OrderStatus.SHIPPED,
          trackingNumber
        }).subscribe({
          next: () => {
            this.snackBar.open('Order marked as shipped!', 'Close', { duration: 3000 });
            this.loadSales();
          },
          error: () => {
            this.snackBar.open('Failed to update order', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  viewSaleDetails(saleId: string): void {
    alert(`Sale details modal would open for sale ${saleId}`);
  }

  goToCreateListing(): void {
    window.location.href = '/marketplace/listings/create';
  }
}
