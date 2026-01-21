import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CollectionsService } from '../../../../core/services/collections.service';
import { CollectionItemCardComponent } from '../../components/collection-item-card/collection-item-card.component';
import { StatsPanelComponent } from '../../components/stats-panel/stats-panel.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { CollectionFormModalComponent } from '../../components/collection-form-modal/collection-form-modal.component';
import { AddCardsModalComponent } from '../../components/add-cards-modal/add-cards-modal.component';
import { CollectionItem, UpdateCollectionItemDto } from '@la-grieta/shared';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'lg-collection-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    CollectionItemCardComponent,
    StatsPanelComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      @if (collectionsService.currentCollection(); as collection) {
        <!-- Breadcrumb/Back -->
        <div class="flex items-center gap-2 mb-4">
          <button mat-icon-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <span class="text-sm text-gray-600">Back to Collections</span>
        </div>

        <!-- Header Section -->
        <div class="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
          <!-- Collection Info -->
          <div class="flex-1">
            <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
              {{ collection.name }}
            </h1>
            @if (collection.description) {
              <p class="text-base text-gray-600 max-w-2xl">
                {{ collection.description }}
              </p>
            } @else {
              <p class="text-base text-gray-400 italic">No description</p>
            }
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2 flex-wrap">
            <button
              mat-raised-button
              color="primary"
              (click)="openAddCardsModal()"
              [disabled]="collectionsService.loading()"
            >
              <mat-icon>add</mat-icon>
              Add Cards
            </button>

            <button
              mat-button
              [matMenuTriggerFor]="menu"
              aria-label="Collection options"
            >
              <mat-icon>more_vert</mat-icon>
            </button>
          </div>
        </div>

        <!-- Statistics Panel -->
        @if (collectionsService.collectionStats()) {
          <lg-stats-panel [stats]="collectionsService.collectionStats()" />
        }

        <!-- Cards Grid -->
        @if (collection.items && collection.items.length > 0) {
          <div class="mb-4">
            <h2 class="text-xl font-heading font-semibold text-gray-800 mb-4">
              Cards ({{ collection.items.length }})
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              @for (item of collection.items; track item.id) {
                <lg-collection-item-card
                  [item]="item"
                  (updateQuantity)="openUpdateQuantityDialog($event)"
                  (remove)="confirmRemoveCard($event)"
                  (incrementQuantity)="incrementQuantity($event)"
                  (decrementQuantity)="decrementQuantity($event)"
                  (changeCondition)="openChangeConditionDialog($event)"
                />
              }
            </div>
          </div>
        } @else {
          <lg-empty-state
            icon="style"
            heading="No Cards in Collection"
            description="Start adding cards to your collection to track their value and condition."
            [primaryAction]="{
              label: 'Add Cards',
              icon: 'add',
              primary: true
            }"
            (primaryActionClick)="openAddCardsModal()"
          />
        }

        <!-- Dev Tools (only in development) -->
        @if (!isProduction && collection.items.length === 0) {
          <div class="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-sm text-yellow-800 mb-2 font-semibold">Development Tools</p>
            <button
              mat-button
              color="accent"
              (click)="seedCollection()"
              [disabled]="collectionsService.loading()"
            >
              <mat-icon>science</mat-icon>
              Seed with Test Data
            </button>
          </div>
        }

        <!-- Collection Menu -->
        <mat-menu #menu="matMenu">
          <button mat-menu-item (click)="openEditModal()">
            <mat-icon>edit</mat-icon>
            <span>Edit Collection</span>
          </button>
          <button mat-menu-item (click)="refreshStats()">
            <mat-icon>refresh</mat-icon>
            <span>Refresh Statistics</span>
          </button>
          @if (!isProduction) {
            <button mat-menu-item (click)="seedCollection()">
              <mat-icon>science</mat-icon>
              <span>Seed Test Data</span>
            </button>
          }
          <button mat-menu-item (click)="confirmDelete()" class="text-red-600">
            <mat-icon class="text-red-600">delete</mat-icon>
            <span>Delete Collection</span>
          </button>
        </mat-menu>
      }

      <!-- Loading State -->
      @if (collectionsService.loading() && !collectionsService.currentCollection()) {
        <div class="flex justify-center py-16">
          <lg-loading-spinner />
        </div>
      }

      <!-- Error State -->
      @if (collectionsService.error() && !collectionsService.currentCollection()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center gap-2">
            <mat-icon class="text-red-600">error</mat-icon>
            <p class="text-red-800">{{ collectionsService.error() }}</p>
          </div>
          <button mat-button (click)="goBack()" class="mt-2">
            Go Back
          </button>
        </div>
      }
    </div>
  `,
  styles: []
})
export class CollectionDetailComponent implements OnInit, OnDestroy {
  collectionId!: string;
  isProduction = environment.production;

  constructor(
    public collectionsService: CollectionsService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.collectionId = this.route.snapshot.paramMap.get('id')!;
    this.loadCollection();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.collectionsService.clearCurrentCollection();
  }

  loadCollection(): void {
    this.collectionsService.loadCollection(this.collectionId).subscribe({
      error: (err) => {
        this.snackBar.open(
          'Failed to load collection',
          'Close',
          { duration: 3000, panelClass: 'error-snackbar' }
        );
      }
    });
  }

  loadStats(): void {
    this.collectionsService.loadCollectionStats(this.collectionId).subscribe();
  }

  refreshStats(): void {
    this.loadStats();
    this.snackBar.open('Statistics refreshed', 'Close', { duration: 2000 });
  }

  goBack(): void {
    this.location.back();
  }

  openEditModal(): void {
    const collection = this.collectionsService.currentCollection();
    if (!collection) return;

    const dialogRef = this.dialog.open(CollectionFormModalComponent, {
      width: '500px',
      data: {
        mode: 'edit',
        collection: collection
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Collection updated successfully!', 'Close', { duration: 3000 });
      }
    });
  }

  openAddCardsModal(): void {
    const dialogRef = this.dialog.open(AddCardsModalComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: { collectionId: this.collectionId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Card added successfully!', 'Close', { duration: 3000 });
        this.loadStats();
      }
    });
  }

  openUpdateQuantityDialog(item: CollectionItem): void {
    const newQuantity = prompt(`Update quantity for ${item.card?.name}`, item.quantity.toString());
    if (newQuantity && !isNaN(Number(newQuantity))) {
      const quantity = Number(newQuantity);
      if (quantity > 0 && quantity <= 999) {
        const dto: UpdateCollectionItemDto = { quantity };
        this.collectionsService.updateCollectionItem(this.collectionId, item.id, dto).subscribe({
          next: () => {
            this.snackBar.open('Quantity updated', 'Close', { duration: 2000 });
          },
          error: () => {
            this.snackBar.open('Failed to update quantity', 'Close', { duration: 3000 });
          }
        });
      } else {
        this.snackBar.open('Quantity must be between 1 and 999', 'Close', { duration: 3000 });
      }
    }
  }

  openChangeConditionDialog(item: CollectionItem): void {
    // For now, use a simple prompt. Can be enhanced with a proper dialog
    const conditions = ['MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'PLAYED', 'POOR'];
    const newCondition = prompt(
      `Change condition for ${item.card?.name}\nOptions: ${conditions.join(', ')}`,
      item.condition
    );
    if (newCondition && conditions.includes(newCondition.toUpperCase())) {
      const dto: UpdateCollectionItemDto = { condition: newCondition.toUpperCase() };
      this.collectionsService.updateCollectionItem(this.collectionId, item.id, dto).subscribe({
        next: () => {
          this.snackBar.open('Condition updated', 'Close', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Failed to update condition', 'Close', { duration: 3000 });
        }
      });
    }
  }

  incrementQuantity(item: CollectionItem): void {
    const dto: UpdateCollectionItemDto = { quantity: item.quantity + 1 };
    this.collectionsService.updateCollectionItem(this.collectionId, item.id, dto).subscribe({
      next: () => {
        this.snackBar.open('Quantity increased', 'Close', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to update quantity', 'Close', { duration: 3000 });
      }
    });
  }

  decrementQuantity(item: CollectionItem): void {
    if (item.quantity > 1) {
      const dto: UpdateCollectionItemDto = { quantity: item.quantity - 1 };
      this.collectionsService.updateCollectionItem(this.collectionId, item.id, dto).subscribe({
        next: () => {
          this.snackBar.open('Quantity decreased', 'Close', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Failed to update quantity', 'Close', { duration: 3000 });
        }
      });
    }
  }

  confirmRemoveCard(item: CollectionItem): void {
    const confirmed = confirm(`Remove ${item.card?.name} from collection?`);
    if (confirmed) {
      this.collectionsService.removeCardFromCollection(this.collectionId, item.id).subscribe({
        next: () => {
          this.snackBar.open('Card removed', 'Close', { duration: 2000 });
          this.loadStats();
        },
        error: () => {
          this.snackBar.open('Failed to remove card', 'Close', { duration: 3000 });
        }
      });
    }
  }

  confirmDelete(): void {
    const collection = this.collectionsService.currentCollection();
    if (!collection) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${collection.name}"? This will remove all ${collection.items.length} card(s).`
    );

    if (confirmed) {
      this.collectionsService.deleteCollection(this.collectionId).subscribe({
        next: () => {
          this.snackBar.open('Collection deleted', 'Close', { duration: 3000 });
          this.router.navigate(['/collections']);
        },
        error: () => {
          this.snackBar.open('Failed to delete collection', 'Close', { duration: 3000 });
        }
      });
    }
  }

  seedCollection(): void {
    const confirmed = confirm('Add test cards to this collection? (Development only)');
    if (confirmed) {
      this.collectionsService.seedCollection(this.collectionId).subscribe({
        next: () => {
          this.snackBar.open('Collection seeded with test data!', 'Close', { duration: 3000 });
          this.loadStats();
        },
        error: () => {
          this.snackBar.open('Failed to seed collection', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
