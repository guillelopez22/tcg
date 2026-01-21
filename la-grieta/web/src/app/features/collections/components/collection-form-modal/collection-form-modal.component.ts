import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CollectionsService } from '../../../../core/services/collections.service';
import { Collection, CreateCollectionDto, UpdateCollectionDto } from '@la-grieta/shared';

export interface CollectionFormData {
  mode: 'create' | 'edit';
  collection?: Collection;
}

@Component({
  selector: 'lg-collection-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-heading font-bold text-gray-900">
          {{ isEditMode ? 'Edit Collection' : 'Create Collection' }}
        </h2>
        <button
          mat-icon-button
          (click)="onCancel()"
          aria-label="Close dialog"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form -->
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Name Field -->
        <mat-form-field class="w-full mb-4" appearance="outline">
          <mat-label>Collection Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g., My Rare Cards"
            maxlength="100"
            required
          />
          <mat-icon matPrefix>collections_bookmark</mat-icon>
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>Collection name is required</mat-error>
          }
          @if (form.get('name')?.hasError('maxlength')) {
            <mat-error>Maximum 100 characters</mat-error>
          }
        </mat-form-field>

        <!-- Description Field -->
        <mat-form-field class="w-full mb-6" appearance="outline">
          <mat-label>Description (Optional)</mat-label>
          <textarea
            matInput
            formControlName="description"
            placeholder="Add a description for your collection"
            rows="4"
            maxlength="500"
          ></textarea>
          <mat-icon matPrefix>description</mat-icon>
          <mat-hint align="end">
            {{ form.get('description')?.value?.length || 0 }} / 500
          </mat-hint>
          @if (form.get('description')?.hasError('maxlength')) {
            <mat-error>Maximum 500 characters</mat-error>
          }
        </mat-form-field>

        <!-- Error Message -->
        @if (collectionsService.error()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div class="flex items-center gap-2">
              <mat-icon class="text-red-600 !text-base">error</mat-icon>
              <p class="text-sm text-red-800">{{ collectionsService.error() }}</p>
            </div>
          </div>
        }

        <!-- Actions -->
        <div class="flex gap-3 justify-end">
          <button
            mat-button
            type="button"
            (click)="onCancel()"
            [disabled]="collectionsService.loading()"
          >
            Cancel
          </button>
          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="form.invalid || collectionsService.loading()"
          >
            @if (collectionsService.loading()) {
              <mat-icon class="animate-spin">refresh</mat-icon>
            }
            {{ isEditMode ? 'Update' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }
  `]
})
export class CollectionFormModalComponent {
  form: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    public collectionsService: CollectionsService,
    private dialogRef: MatDialogRef<CollectionFormModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CollectionFormData
  ) {
    this.isEditMode = data.mode === 'edit';

    this.form = this.fb.group({
      name: [
        data.collection?.name || '',
        [Validators.required, Validators.maxLength(100)]
      ],
      description: [
        data.collection?.description || '',
        [Validators.maxLength(500)]
      ]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.collectionsService.clearError();

    if (this.isEditMode && this.data.collection) {
      const dto: UpdateCollectionDto = {
        name: this.form.value.name.trim(),
        description: this.form.value.description?.trim() || undefined
      };

      this.collectionsService.updateCollection(this.data.collection.id, dto).subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          // Error handled by service
        }
      });
    } else {
      const dto: CreateCollectionDto = {
        name: this.form.value.name.trim(),
        description: this.form.value.description?.trim() || undefined
      };

      this.collectionsService.createCollection(dto).subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          // Error handled by service
        }
      });
    }
  }

  onCancel(): void {
    this.collectionsService.clearError();
    this.dialogRef.close(false);
  }
}
