import {  Component, OnInit, signal , inject } from '@angular/core';
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
import { StripeService } from '../../services/stripe.service';
import { EmptyStateComponent } from '../../../collections/components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { CreateShopDto, UpdateShopDto, ListingStatus } from '@la-grieta/shared';

@Component({
  selector: 'app-create-shop-modal',
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
  private fb = inject(FormBuilder);
  private shopsService = inject(ShopsService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<CreateShopModalComponent>);
  shopForm: FormGroup;

  constructor() {
    this.shopForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      slug: ['', [Validators.required, Validators.minLength(3)]],
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
  selector: 'app-my-shop',
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
      <div class="mb-6">
        <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
          My Shop
        </h1>
        <p class="text-base text-gray-600">
          Manage your shop and listings
        </p>
      </div>

      <!-- Loading State -->
      @if (shopsService.loading() && !shopsService.myShop()) {
        <div class="flex justify-center py-16">
          <app-loading-spinner />
        </div>
      }

      <!-- No Shop State -->
      @if (!shopsService.loading() && !shopsService.myShop()) {
        <app-empty-state
          icon="storefront"
          heading="No Shop Yet"
          description="Create your shop to start selling cards on the marketplace!"
          [primaryAction]="{
            label: 'Create Shop',
            icon: 'add',
            primary: true
          }"
          (primaryActionClick)="openCreateShopModal()"
        />
      }

      <!-- Shop View -->
      @if (shopsService.myShop()) {
        <div class="space-y-6">
          <!-- Shop Info Card -->
          <mat-card>
            <mat-card-content class="!p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-2xl font-heading font-bold text-gray-900 mb-1">
                    {{ shopsService.myShop()?.name }}
                  </h2>
                  <p class="text-sm text-gray-600">
                    /marketplace/shops/{{ shopsService.myShop()?.slug }}
                  </p>
                </div>
              </div>
              @if (shopsService.myShop()?.description) {
                <p class="text-gray-700 mb-4">
                  {{ shopsService.myShop()?.description }}
                </p>
              }
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <mat-icon class="!text-base">inventory_2</mat-icon>
                <span>{{ activeListingsCount() }} active listings</span>
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
              Create Listing
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
                  <app-loading-spinner />
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

  shopsService = inject(ShopsService);
  marketplaceService = inject(MarketplaceService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

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

    dialogRef.afterClosed().subscribe((result: any) => {
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
