import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CollectionsService } from '../../../../core/services/collections.service';
import { CollectionCardComponent } from '../../components/collection-card/collection-card.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { CollectionFormModalComponent } from '../../components/collection-form-modal/collection-form-modal.component';
import { CollectionWithCount } from '@la-grieta/shared';

@Component({
  selector: 'app-collections-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    CollectionCardComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header Section -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
            Collections
          </h1>
          <p class="text-base text-gray-600">
            Manage your card collections
          </p>
        </div>
        <button
          mat-raised-button
          color="primary"
          class="flex items-center gap-2"
          (click)="openCreateModal()"
          [disabled]="collectionsService.loading()"
        >
          <mat-icon>add</mat-icon>
          <span>New Collection</span>
        </button>
      </div>

      <!-- Loading State -->
      @if (collectionsService.loading() && !collectionsService.hasCollections()) {
        <div class="flex justify-center py-16">
          <app-loading-spinner />
        </div>
      }

      <!-- Error State -->
      @if (collectionsService.error() && !collectionsService.hasCollections()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2">
            <mat-icon class="text-red-600">error</mat-icon>
            <p class="text-red-800">{{ collectionsService.error() }}</p>
          </div>
        </div>
      }

      <!-- Collections Grid -->
      @if (collectionsService.hasCollections()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          @for (collection of collectionsService.collections(); track collection.id) {
            <app-collection-card
              [collection]="collection"
              (edit)="openEditModal($event)"
              (delete)="confirmDelete($event)"
            />
          }
        </div>
      }

      <!-- Empty State -->
      @if (!collectionsService.loading() && !collectionsService.hasCollections()) {
        <app-empty-state
          icon="collections_bookmark"
          heading="Start Your First Collection"
          description="Collections help you organize your cards by deck, rarity, or any way you choose. Create your first collection to get started!"
          [primaryAction]="{
            label: 'Create Collection',
            icon: 'add',
            primary: true
          }"
          [showInfoCards]="true"
          (primaryActionClick)="openCreateModal()"
        />
      }
    </div>
  `,
  styles: []
})
export class CollectionsListComponent implements OnInit {
  collectionsService = inject(CollectionsService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadCollections();
  }

  loadCollections(): void {
    this.collectionsService.loadCollections().subscribe({
      error: (err) => {
        this.snackBar.open(
          'Failed to load collections',
          'Close',
          { duration: 3000, panelClass: 'error-snackbar' }
        );
      }
    });
  }

  openCreateModal(): void {
    const dialogRef = this.dialog.open(CollectionFormModalComponent, {
      width: '500px',
      data: { mode: 'create' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open(
          'Collection created successfully!',
          'Close',
          { duration: 3000 }
        );
      }
    });
  }

  openEditModal(collection: CollectionWithCount): void {
    const dialogRef = this.dialog.open(CollectionFormModalComponent, {
      width: '500px',
      data: {
        mode: 'edit',
        collection: collection
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open(
          'Collection updated successfully!',
          'Close',
          { duration: 3000 }
        );
      }
    });
  }

  confirmDelete(collection: CollectionWithCount): void {
    const confirmed = confirm(
      `Are you sure you want to delete "${collection.name}"? This will remove all ${collection.itemCount} card(s) from the collection.`
    );

    if (confirmed) {
      this.collectionsService.deleteCollection(collection.id).subscribe({
        next: () => {
          this.snackBar.open(
            'Collection deleted successfully',
            'Close',
            { duration: 3000 }
          );
        },
        error: (err) => {
          this.snackBar.open(
            'Failed to delete collection',
            'Close',
            { duration: 3000, panelClass: 'error-snackbar' }
          );
        }
      });
    }
  }
}
