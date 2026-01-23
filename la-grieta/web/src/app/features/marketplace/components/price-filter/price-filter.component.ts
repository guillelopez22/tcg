import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface PriceRange {
  minPrice?: number;
  maxPrice?: number;
}

@Component({
  selector: 'app-price-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="bg-white rounded-lg border p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <mat-icon>attach_money</mat-icon>
        Price Range
      </h3>

      <div class="flex gap-2 items-start">
        <!-- Min Price -->
        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Min</mat-label>
          <input
            matInput
            type="number"
            [(ngModel)]="minPrice"
            placeholder="0"
            min="0"
            step="0.01"
          />
          <span matTextPrefix>$</span>
        </mat-form-field>

        <span class="text-gray-400 mt-3">-</span>

        <!-- Max Price -->
        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Max</mat-label>
          <input
            matInput
            type="number"
            [(ngModel)]="maxPrice"
            placeholder="Any"
            min="0"
            step="0.01"
          />
          <span matTextPrefix>$</span>
        </mat-form-field>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2 mt-2">
        <button
          mat-raised-button
          color="primary"
          class="flex-1"
          (click)="applyFilter()"
        >
          Apply
        </button>
        <button
          mat-stroked-button
          (click)="clearFilter()"
          [disabled]="!hasFilter()"
        >
          Clear
        </button>
      </div>

      <!-- Quick Filters -->
      <div class="mt-4 pt-4 border-t">
        <p class="text-sm text-gray-600 mb-2">Quick filters:</p>
        <div class="flex flex-wrap gap-2">
          <button
            mat-stroked-button
            class="!text-xs"
            (click)="setRange(0, 10)"
          >
            Under $10
          </button>
          <button
            mat-stroked-button
            class="!text-xs"
            (click)="setRange(10, 50)"
          >
            $10 - $50
          </button>
          <button
            mat-stroked-button
            class="!text-xs"
            (click)="setRange(50, 100)"
          >
            $50 - $100
          </button>
          <button
            mat-stroked-button
            class="!text-xs"
            (click)="setRange(100, undefined)"
          >
            $100+
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class PriceFilterComponent {
  @Output() filterChange = new EventEmitter<PriceRange>();

  minPrice?: number;
  maxPrice?: number;

  setRange(min?: number, max?: number): void {
    this.minPrice = min;
    this.maxPrice = max;
    this.applyFilter();
  }

  applyFilter(): void {
    this.filterChange.emit({
      minPrice: this.minPrice,
      maxPrice: this.maxPrice
    });
  }

  clearFilter(): void {
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.filterChange.emit({});
  }

  hasFilter(): boolean {
    return this.minPrice !== undefined || this.maxPrice !== undefined;
  }
}
