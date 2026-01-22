import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ShopsService } from '../../services/shops.service';
import { MarketplaceService } from '../../services/marketplace.service';
import { EmptyStateComponent } from '../../../collections/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { CreateShopDto, UpdateShopDto, ListingStatus } from '@la-grieta/shared';

@Component({
  selector: 'lg-create-shop-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
  ],
  template: `
    <h2 mat-dialog-title>Create Your Shop</h2>
    <mat-dialog-content>
      <form [formGroup]="shopForm" class="space-y-4 py-4">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Shop Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g., Epic Cards Collection" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Shop Slug (URL)</mat-label>
          <input matInput formControlName="slug" placeholder="e.g., epic-cards" />
          <mat-hint>Used in your shop URL: /marketplace/shops/your-slug</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="3"
            placeholder="Tell buyers about your shop..."
          ></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="shopForm.invalid"
        (click)="onSubmit()"
      >
        Create Shop
      </button>
    </mat-dialog-actions>
  `
})
export class CreateShopModalComponent {
  shopForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private shopsService: ShopsService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<CreateShopModalComponent>
  ) {
    this.shopForm = this.fb.group({
      name: ['', Validators.required],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      description: ['']
    });
  }

  onSubmit(): void {
    if (this.shopForm.invalid) return;

    const dto: CreateShopDto = this.shopForm.value;
    this.shopsService.createShop(dto).subscribe({
      next: () => {
        this.snackBar.open('Shop created successfully!', 'Close', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snackBar.open('Failed to create shop', 'Close', { duration: 3000 });
      }
    });
  }
}

@Component({
  selector: 'lg-my-shop',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
            My Shop
          </h1>
          <p class="text-base text-gray-600">
            Manage your seller profile and listings
          </p>
        </div>
      </div>

      <!-- Loading State -->
      @if (shopsService.loading() && !shopsService.myShop()) {
        <div class="flex justify-center py-16">
          <lg-loading-spinner />
        </div>
      }

      <!-- No Shop - Create One -->
      @if (!shopsService.loading() && !shopsService.myShop()) {
        <lg-empty-state
          icon="storefront"
          heading="Create Your Shop"
          description="Start selling cards by setting up your shop. You'll be able to list items and manage orders from here."
          [primaryAction]="{
            label: 'Create Shop',
            icon: 'add_business',
            primary: true
          }"
          (primaryActionClick)="openCreateShopModal()"
        />
      }

      <!-- Shop Dashboard -->
      @if (shopsService.myShop(); as shop) {
        <div class="space-y-6">
          <!-- Shop Info Card -->
          <mat-card>
            <mat-card-content class="!p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ shop.name }}</h2>
                  @if (shop.description) {
                    <p class="text-gray-600">{{ shop.description }}</p>
                  }
                  <p class="text-sm text-gray-500 mt-2">
                    Shop URL: /marketplace/shops/{{ shop.slug }}
                  </p>
                </div>
                <button
                  mat-stroked-button
                  [routerLink]="['/marketplace/shops', shop.id]"
                >
                  <mat-icon>visibility</mat-icon>
                  View Public Profile
                </button>
              </div>

              <!-- Shop Stats -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div class="text-center">
                  <p class="text-3xl font-mono font-bold text-primary">{{ shop.totalSales }}</p>
                  <p class="text-sm text-gray-600">Total Sales</p>
                </div>
                <div class="text-center">
                  <p class="text-3xl font-mono font-bold text-yellow-600">{{ shop.rating.toFixed(1) }}</p>
                  <p class="text-sm text-gray-600">Rating</p>
                </div>
                <div class="text-center">
                  <p class="text-3xl font-mono font-bold text-green-600">{{ activeListingsCount() }}</p>
                  <p class="text-sm text-gray-600">Active Listings</p>
                </div>
                <div class="text-center">
                  @if (shop.isVerified) {
                    <mat-icon class="!text-4xl text-blue-600">verified</mat-icon>
                    <p class="text-sm text-gray-600">Verified</p>
                  } @else {
                    <mat-icon class="!text-4xl text-gray-400">pending</mat-icon>
                    <p class="text-sm text-gray-600">Not Verified</p>
                  }
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Quick Actions -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              mat-raised-button
              color="primary"
              class="!py-6 !text-lg"
              routerLink="/marketplace/listings/create"
            >
              <mat-icon>add</mat-icon>
              Create New Listing
            </button>
            <button
              mat-raised-button
              class="!py-6 !text-lg"
              routerLink="/marketplace/sales"
            >
              <mat-icon>receipt_long</mat-icon>
              View Sales
            </button>
            <button
              mat-stroked-button
              class="!py-6 !text-lg"
              (click)="editShop()"
            >
              <mat-icon>edit</mat-icon>
              Edit Shop
            </button>
          </div>

          <!-- Recent Listings -->
          <mat-card>
            <mat-card-content class="!p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-semibold text-gray-900">
                  Your Active Listings
                </h3>
                <button
                  mat-stroked-button
                  (click)="loadMyListings()"
                >
                  <mat-icon>refresh</mat-icon>
                  Refresh
                </button>
              </div>

              @if (marketplaceService.loading()) {
                <div class="flex justify-center py-8">
                  <lg-loading-spinner />
                </div>
              } @else if (marketplaceService.hasListings()) {
                <div class="space-y-3">
                  @for (listing of marketplaceService.listings(); track listing.id) {
                    <div class="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <h4 class="font-semibold text-gray-900">{{ listing.title }}</h4>
                          <p class="text-sm text-gray-600 mt-1">{{ listing.description || 'No description' }}</p>
                          <div class="flex items-center gap-4 mt-2 text-sm">
                            <span class="text-primary font-mono font-bold">
                              \${{ listing.price || listing.buyNowPrice || listing.startingBid || 0 }}
                            </span>
                            <span class="text-gray-500">{{ listing.type }}</span>
                          </div>
                        </div>
                        <div class="flex gap-2">
                          <button
                            mat-icon-button
                            [routerLink]="['/marketplace/listings', listing.id]"
                          >
                            <mat-icon>visibility</mat-icon>
                          </button>
                          <button
                            mat-icon-button
                            color="warn"
                            (click)="deleteListing(listing.id)"
                          >
                            <mat-icon>delete</mat-icon>
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center py-8 text-gray-500">
                  <mat-icon class="!text-4xl mb-2">inventory_2</mat-icon>
                  <p>No active listings yet</p>
                </div>
              }
            </mat-card-content>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: []
})
export class MyShopComponent implements OnInit {
  activeListingsCount = signal(0);

  constructor(
    public shopsService: ShopsService,
    public marketplaceService: MarketplaceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.shopsService.getMyShop().subscribe({
      next: () => {
        this.loadMyListings();
      }
    });
  }

  loadMyListings(): void {
    const shopId = this.shopsService.myShop()?.id;
    if (!shopId) return;

    this.marketplaceService.browseListings({
      shopId,
      status: ListingStatus.ACTIVE
    }).subscribe({
      next: () => {
        this.activeListingsCount.set(this.marketplaceService.listingsCount());
      }
    });
  }

  openCreateShopModal(): void {
    const dialogRef = this.dialog.open(CreateShopModalComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.shopsService.getMyShop().subscribe();
      }
    });
  }

  editShop(): void {
    this.snackBar.open('Edit shop functionality coming soon!', 'Close', { duration: 3000 });
  }

  deleteListing(id: string): void {
    const confirmed = confirm('Are you sure you want to delete this listing?');
    if (!confirmed) return;

    this.marketplaceService.deleteListing(id).subscribe({
      next: () => {
        this.snackBar.open('Listing deleted', 'Close', { duration: 2000 });
        this.loadMyListings();
      },
      error: () => {
        this.snackBar.open('Failed to delete listing', 'Close', { duration: 3000 });
      }
    });
  }
}
