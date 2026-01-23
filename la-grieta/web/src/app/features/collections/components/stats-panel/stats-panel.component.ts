import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CollectionStatsResponseDto } from '@la-grieta/shared';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (stats) {
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <!-- Main Stats Row -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <!-- Unique Cards -->
          <div class="text-center sm:text-left">
            <div class="flex items-center justify-center sm:justify-start gap-2 mb-2">
              <mat-icon class="text-primary">style</mat-icon>
              <p class="text-sm text-gray-600 font-medium">Unique Cards</p>
            </div>
            <p class="text-3xl font-mono font-bold text-gray-900">
              {{ stats.totalUniqueCards }}
            </p>
          </div>

          <!-- Total Cards -->
          <div class="text-center sm:text-left">
            <div class="flex items-center justify-center sm:justify-start gap-2 mb-2">
              <mat-icon class="text-primary">inventory_2</mat-icon>
              <p class="text-sm text-gray-600 font-medium">Total Cards</p>
            </div>
            <p class="text-3xl font-mono font-bold text-gray-900">
              {{ stats.totalQuantity }}
            </p>
          </div>

          <!-- Estimated Value -->
          <div class="text-center sm:text-left">
            <div class="flex items-center justify-center sm:justify-start gap-2 mb-2">
              <mat-icon class="text-accent">attach_money</mat-icon>
              <p class="text-sm text-gray-600 font-medium">Estimated Value</p>
            </div>
            <p class="text-3xl font-mono font-bold text-accent">
              {{ formatCurrency(stats.estimatedMarketValue) }}
            </p>
          </div>
        </div>

        <!-- Breakdown Section -->
        <div class="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Rarity Breakdown -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <mat-icon class="!text-base">stars</mat-icon>
              By Rarity
            </h3>
            <div class="space-y-2">
              @for (entry of getRarityEntries(); track entry.key) {
                <div class="flex justify-between items-center">
                  <span class="text-sm text-gray-700 capitalize">{{ entry.key.toLowerCase() }}</span>
                  <span class="text-sm font-mono font-semibold" [class]="getRarityColorClass(entry.key)">
                    {{ entry.value }}
                  </span>
                </div>
              }
              @if (getRarityEntries().length === 0) {
                <p class="text-sm text-gray-500 italic">No rarity data</p>
              }
            </div>
          </div>

          <!-- Type Breakdown -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <mat-icon class="!text-base">category</mat-icon>
              By Type
            </h3>
            <div class="space-y-2">
              @for (entry of getTypeEntries(); track entry.key) {
                <div class="flex justify-between items-center">
                  <span class="text-sm text-gray-700 capitalize">{{ entry.key.toLowerCase() }}</span>
                  <span class="text-sm font-mono font-semibold text-gray-900">
                    {{ entry.value }}
                  </span>
                </div>
              }
              @if (getTypeEntries().length === 0) {
                <p class="text-sm text-gray-500 italic">No type data</p>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: []
})
export class StatsPanelComponent {
  @Input() stats: CollectionStatsResponseDto | null = null;

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  getRarityEntries(): Array<{ key: string; value: number }> {
    if (!this.stats?.cardsByRarity) return [];
    return Object.entries(this.stats.cardsByRarity)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);
  }

  getTypeEntries(): Array<{ key: string; value: number }> {
    if (!this.stats?.cardsByType) return [];
    return Object.entries(this.stats.cardsByType)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);
  }

  getRarityColorClass(rarity: string): string {
    switch (rarity.toUpperCase()) {
      case 'COMMON':
        return 'text-gray-600';
      case 'RARE':
        return 'text-blue-600';
      case 'EPIC':
        return 'text-purple-600';
      case 'LEGENDARY':
        return 'text-yellow-600';
      default:
        return 'text-gray-900';
    }
  }
}
