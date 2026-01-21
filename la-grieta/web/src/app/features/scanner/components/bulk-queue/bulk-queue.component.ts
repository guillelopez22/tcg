import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ScannedCard } from '../../../../core/services/scanner.service';
import { CardCondition } from '@la-grieta/shared';

@Component({
  selector: 'lg-bulk-queue',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  template: `
    <!-- Minimized Queue Indicator -->
    @if (!expanded()) {
      <div
        class="queue-indicator fixed top-20 right-4 z-40 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 cursor-pointer hover:shadow-xl transition-shadow"
        (click)="expanded.set(true)"
        role="button"
        aria-label="Open scan queue"
      >
        <mat-icon class="text-purple-600 !text-base">inventory_2</mat-icon>
        <span class="font-mono font-bold text-purple-600">{{ queue.length }}</span>
        <span class="text-xs text-gray-600">cards</span>
        <mat-icon class="text-gray-400 !text-base">expand_more</mat-icon>
      </div>
    }

    <!-- Expanded Queue Sheet -->
    @if (expanded()) {
      <div class="queue-overlay fixed inset-0 bg-black/50 z-50" (click)="expanded.set(false)"></div>

      <div class="queue-sheet fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[60vh] overflow-hidden flex flex-col animate-slide-up">
        <!-- Header -->
        <div class="queue-header sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <mat-icon class="text-purple-600">inventory_2</mat-icon>
            <div>
              <h3 class="font-heading font-bold text-lg text-gray-900">
                Scanned Cards
              </h3>
              <p class="text-xs text-gray-600">
                {{ queue.length }} cards ready to add
              </p>
            </div>
          </div>
          <button mat-icon-button (click)="expanded.set(false)" aria-label="Minimize queue">
            <mat-icon>expand_more</mat-icon>
          </button>
        </div>

        <!-- Queue List -->
        <div class="queue-list flex-1 overflow-y-auto p-4">
          @if (queue.length === 0) {
            <div class="text-center py-8">
              <mat-icon class="!text-6xl text-gray-300 mb-4">inventory_2</mat-icon>
              <p class="text-gray-600">No cards in queue</p>
              <p class="text-sm text-gray-500 mt-2">Scan cards to add them here</p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (item of queue; track $index) {
                <div class="queue-item bg-gray-50 rounded-lg p-3 flex gap-3">
                  <!-- Card Thumbnail -->
                  @if (item.card.imageUrl) {
                    <img
                      [src]="item.card.imageUrl"
                      [alt]="item.card.name"
                      class="w-16 h-22 object-cover rounded shadow-sm"
                    />
                  } @else {
                    <div class="w-16 h-22 bg-gray-200 rounded flex items-center justify-center">
                      <mat-icon class="text-gray-400">image</mat-icon>
                    </div>
                  }

                  <!-- Card Info -->
                  <div class="flex-1 min-w-0">
                    <h4 class="font-card font-bold text-sm text-gray-900 truncate">
                      {{ item.card.name }}
                    </h4>
                    <p class="text-xs text-gray-600 mb-1">
                      {{ item.card.cardType }} - {{ item.card.rarity }}
                    </p>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-600">Qty:</span>
                      <span class="font-mono font-bold text-sm text-gray-900">
                        {{ item.quantity }}
                      </span>
                      <span class="text-xs text-gray-600">-</span>
                      <span class="text-xs text-gray-600">
                        {{ getConditionLabel(item.condition) }}
                      </span>
                    </div>
                    <div class="mt-1 flex items-center gap-1">
                      <mat-icon class="!text-xs text-emerald-500">verified</mat-icon>
                      <span class="text-xs text-gray-500">{{ (item.confidence * 100).toFixed(0) }}% match</span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex flex-col gap-1">
                    <button
                      mat-icon-button
                      (click)="onEditItem.emit($index)"
                      aria-label="Edit card details"
                      class="!w-8 !h-8"
                    >
                      <mat-icon class="!text-base">edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      (click)="onRemoveItem.emit($index)"
                      aria-label="Remove from queue"
                      class="!w-8 !h-8"
                    >
                      <mat-icon class="!text-base text-red-600">delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Actions Footer -->
        <div class="queue-footer sticky bottom-0 bg-white border-t p-4 flex gap-3">
          <button
            mat-stroked-button
            class="flex-1"
            (click)="onContinueScan.emit()"
          >
            <mat-icon>document_scanner</mat-icon>
            Scan More
          </button>
          <button
            mat-raised-button
            color="primary"
            class="flex-1"
            [disabled]="queue.length === 0 || adding()"
            (click)="onAddAll.emit(queue)"
          >
            @if (adding()) {
              <mat-spinner diameter="20" class="mr-2"></mat-spinner>
              Adding...
            } @else {
              <ng-container>
                <mat-icon>add</mat-icon>
                Add All ({{ queue.length }})
              </ng-container>
            }
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slide-up {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .animate-slide-up {
      animation: slide-up 300ms ease-out;
    }

    .h-22 {
      height: 5.5rem;
    }
  `]
})
export class BulkQueueComponent {
  @Input() queue: ScannedCard[] = [];

  @Output() onEditItem = new EventEmitter<number>();
  @Output() onRemoveItem = new EventEmitter<number>();
  @Output() onAddAll = new EventEmitter<ScannedCard[]>();
  @Output() onContinueScan = new EventEmitter<void>();

  // State
  expanded = signal(false);
  adding = signal(false);

  getConditionLabel(condition: string): string {
    const labels: Record<string, string> = {
      [CardCondition.MINT]: 'Mint',
      [CardCondition.NEAR_MINT]: 'Near Mint',
      [CardCondition.EXCELLENT]: 'Excellent',
      [CardCondition.GOOD]: 'Good',
      [CardCondition.PLAYED]: 'Played',
      [CardCondition.POOR]: 'Poor'
    };
    return labels[condition] || condition;
  }

  setAdding(value: boolean): void {
    this.adding.set(value);
  }

  expand(): void {
    this.expanded.set(true);
  }

  collapse(): void {
    this.expanded.set(false);
  }
}
