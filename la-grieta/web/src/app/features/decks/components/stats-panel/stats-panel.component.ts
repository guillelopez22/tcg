import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DeckStatsResponse } from '@la-grieta/shared';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="rounded-lg border border-gray-200 bg-white p-4">
      <h3 class="font-heading font-bold mb-4 flex items-center gap-2">
        <mat-icon class="text-indigo-600">analytics</mat-icon>
        Deck Statistics
      </h3>

      @if (stats) {
        <div class="space-y-4">
          <!-- Total Cards -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Total Cards</span>
            <span class="font-mono font-bold">{{ stats.totalCards }}</span>
          </div>

          <!-- Cards by Zone -->
          <div>
            <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">By Zone</h4>
            <div class="grid grid-cols-3 gap-2">
              <div class="text-center p-2 bg-blue-50 rounded">
                <p class="text-lg font-bold text-blue-700">{{ stats.cardsByZone.MAIN }}</p>
                <p class="text-xs text-blue-600">Main</p>
              </div>
              <div class="text-center p-2 bg-purple-50 rounded">
                <p class="text-lg font-bold text-purple-700">{{ stats.cardsByZone.RUNE }}</p>
                <p class="text-xs text-purple-600">Rune</p>
              </div>
              <div class="text-center p-2 bg-amber-50 rounded">
                <p class="text-lg font-bold text-amber-700">{{ stats.cardsByZone.BATTLEFIELD }}</p>
                <p class="text-xs text-amber-600">Battlefield</p>
              </div>
            </div>
          </div>

          <!-- Mana Curve -->
          @if (hasManaData) {
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Mana Curve</h4>
              <div class="flex items-end gap-1 h-20">
                @for (cost of manaCosts; track cost) {
                  <div class="flex-1 flex flex-col items-center">
                    <div
                      class="w-full bg-indigo-500 rounded-t transition-all"
                      [style.height.%]="getManaBarHeight(cost)"
                    ></div>
                    <span class="text-xs text-gray-500 mt-1">{{ cost }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Domain Distribution -->
          @if (hasDomainData) {
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Domains</h4>
              <div class="space-y-1">
                @for (domain of domainEntries; track domain[0]) {
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                        [style.width.%]="getDomainPercent(domain[1])"
                      ></div>
                    </div>
                    <span class="text-xs text-gray-600 w-16 truncate">{{ domain[0] }}</span>
                    <span class="text-xs font-mono">{{ domain[1] }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Estimated Value -->
          @if (stats.estimatedValue > 0) {
            <div class="flex items-center justify-between pt-3 border-t">
              <span class="text-sm text-gray-600">Estimated Value</span>
              <span class="font-mono font-bold text-green-600">
                {{ formatPrice(stats.estimatedValue) }}
              </span>
            </div>
          }
        </div>
      } @else {
        <p class="text-sm text-gray-500 text-center py-4">
          Add cards to see deck statistics
        </p>
      }
    </div>
  `,
  styles: []
})
export class StatsPanelComponent {
  @Input() stats: DeckStatsResponse | null = null;

  get hasManaData(): boolean {
    return !!(this.stats?.manaCurve && Object.keys(this.stats.manaCurve).length > 0);
  }

  get hasDomainData(): boolean {
    return !!(this.stats?.domainDistribution && Object.keys(this.stats.domainDistribution).length > 0);
  }

  get manaCosts(): number[] {
    if (!this.stats?.manaCurve) return [];
    const costs = Object.keys(this.stats.manaCurve).map(Number).sort((a, b) => a - b);
    // Fill in gaps up to 7+
    const result: number[] = [];
    for (let i = 0; i <= Math.max(7, ...costs); i++) {
      result.push(i);
    }
    return result;
  }

  get domainEntries(): [string, number][] {
    if (!this.stats?.domainDistribution) return [];
    return Object.entries(this.stats.domainDistribution)
      .sort((a, b) => b[1] - a[1]);
  }

  get maxManaCount(): number {
    if (!this.stats?.manaCurve) return 1;
    return Math.max(1, ...Object.values(this.stats.manaCurve));
  }

  getManaBarHeight(cost: number): number {
    if (!this.stats?.manaCurve) return 0;
    const count = this.stats.manaCurve[cost] || 0;
    return (count / this.maxManaCount) * 100;
  }

  getDomainPercent(count: number): number {
    if (!this.stats?.totalCards || this.stats.totalCards === 0) return 0;
    return (count / this.stats.totalCards) * 100;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }
}
