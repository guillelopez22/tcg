import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Card, CardCondition, CARD_CONDITIONS, Domain } from '@la-grieta/shared';
import { ScanResponse, ScanMatch } from '../../../../core/services/scanner.service';

@Component({
  selector: 'app-scan-result',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule
  ],
  template: `
    <!-- Success Result -->
    @if (result?.success && result?.match) {
      <div class="scan-result-success animate-slide-up">
        <!-- Success Header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center animate-scale-in">
              <mat-icon class="text-white !text-2xl">check_circle</mat-icon>
            </div>
            <div>
              <h3 class="text-xl font-heading font-bold text-gray-900">
                Card Found!
              </h3>
              <p class="text-sm text-gray-600">
                {{ getConfidenceLabel(result!.match!.confidence) }}
              </p>
            </div>
          </div>
          <button mat-icon-button (click)="dismiss.emit()" aria-label="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Card Preview -->
        <div class="relative mb-6">
          @if (result!.match!.card.imageUrl) {
            <img
              [src]="result!.match!.card.imageUrl"
              [alt]="result!.match!.card.name"
              class="w-full max-w-xs mx-auto rounded-lg shadow-lg"
            />
          } @else {
            <div class="w-full max-w-xs mx-auto aspect-[2/3] bg-gray-100 rounded-lg flex items-center justify-center">
              <mat-icon class="!text-6xl text-gray-400">image</mat-icon>
            </div>
          }
          <!-- Confidence Badge -->
          <div class="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
            <mat-icon class="!text-sm">verified</mat-icon>
            {{ (result!.match!.confidence * 100).toFixed(0) }}% Match
          </div>
        </div>

        <!-- Card Details -->
        <div class="space-y-3 mb-6">
          <h4 class="text-xl font-card font-bold text-gray-900">
            {{ result!.match!.card.name }}
          </h4>

          <div class="flex flex-wrap gap-2">
            @for (domain of result!.match!.card.domains; track domain) {
              <div
                class="px-3 py-1 rounded-full text-xs font-semibold"
                [ngClass]="getDomainColor(domain)"
              >
                {{ domain }}
              </div>
            }
            <div class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              {{ result!.match!.card.rarity }}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="flex items-center gap-2">
              <mat-icon class="!text-base text-gray-600">category</mat-icon>
              <span class="text-gray-700">{{ result!.match!.card.cardType }}</span>
            </div>
            <div class="flex items-center gap-2">
              <mat-icon class="!text-base text-gray-600">stars</mat-icon>
              <span class="text-gray-700">{{ result!.match!.card.setName }}</span>
            </div>
          </div>
        </div>

        <!-- Condition Selector -->
        <div class="mb-6">
          <div class="block text-sm font-semibold text-gray-700 mb-2">
            Card Condition
          </div>
          <div class="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Card condition options">
            @for (cond of conditions; track cond) {
              <button
                mat-stroked-button
                [color]="selectedCondition() === cond ? 'primary' : ''"
                [class.mat-mdc-raised-button]="selectedCondition() === cond"
                (click)="selectedCondition.set(cond)"
                class="whitespace-nowrap"
              >
                {{ getConditionLabel(cond) }}
              </button>
            }
          </div>
        </div>

        <!-- Quantity Selector -->
        <div class="mb-6">
          <div class="block text-sm font-semibold text-gray-700 mb-2">
            Quantity
          </div>
          <div class="flex items-center gap-4" role="group" aria-label="Quantity selection">
            <button
              mat-mini-fab
              color="primary"
              (click)="decrementQuantity()"
              [disabled]="quantity() <= 1"
              aria-label="Decrease quantity"
            >
              <mat-icon>remove</mat-icon>
            </button>
            <input
              type="number"
              [ngModel]="quantity()"
              (ngModelChange)="quantity.set($event)"
              min="1"
              max="99"
              class="w-20 text-center text-2xl font-bold font-mono border-2 border-gray-300 rounded-lg p-2"
              aria-label="Quantity"
            />
            <button
              mat-mini-fab
              color="primary"
              (click)="incrementQuantity()"
              [disabled]="quantity() >= 99"
              aria-label="Increase quantity"
            >
              <mat-icon>add</mat-icon>
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            mat-raised-button
            color="primary"
            class="flex-1"
            [disabled]="adding()"
            (click)="handleAddToCollection()"
          >
            @if (adding()) {
              <mat-spinner diameter="20" class="mr-2"></mat-spinner>
            } @else {
              <mat-icon>add</mat-icon>
            }
            {{ adding() ? 'Adding...' : (mode === 'bulk' ? 'Add to Queue' : 'Add to Collection') }}
          </button>
          <button
            mat-stroked-button
            [disabled]="adding()"
            (click)="scanAnother.emit()"
          >
            <mat-icon>document_scanner</mat-icon>
            Scan Another
          </button>
        </div>

        <!-- Alternative matches hint -->
        @if (result!.alternatives && result!.alternatives.length > 0) {
          <div class="text-center mt-4">
            <button
              mat-button
              class="text-sm text-gray-600"
              (click)="showAlternatives.set(true)"
            >
              See {{ result!.alternatives!.length }} alternative match(es)
            </button>
          </div>
        }

        <!-- Not the right card? -->
        <div class="text-center mt-4">
          <button
            mat-button
            class="text-sm text-gray-600"
            (click)="reportWrong.emit()"
          >
            Not the right card?
          </button>
        </div>
      </div>
    }

    <!-- Partial Match / Multiple Results -->
    @if (result?.success && result?.alternatives && (result?.alternatives?.length ?? 0) > 0 && showAlternatives()) {
      <div class="partial-match animate-slide-up">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <mat-icon class="text-amber-600 !text-2xl">help_outline</mat-icon>
            </div>
            <div>
              <h3 class="text-xl font-heading font-bold text-gray-900">
                Multiple Matches Found
              </h3>
              <p class="text-sm text-gray-600">
                Select the correct card
              </p>
            </div>
          </div>
          <button mat-icon-button (click)="showAlternatives.set(false)" aria-label="Back">
            <mat-icon>arrow_back</mat-icon>
          </button>
        </div>

        <!-- Possible Matches -->
        <div class="space-y-3 mb-6 max-h-[50vh] overflow-y-auto">
          <!-- Primary match -->
          @if (result!.match) {
            <button
              class="match-option w-full text-left p-4 rounded-lg border-2 transition-all duration-200 hover:border-purple-500 hover:bg-purple-50"
              [class.border-purple-500]="isMatchSelected(result!.match!.card.id)"
              [class.bg-purple-50]="isMatchSelected(result!.match!.card.id)"
              (click)="selectedMatch.set(result!.match!)"
            >
              <div class="flex gap-4">
                @if (result!.match!.card.imageUrl) {
                  <img
                    [src]="result!.match!.card.imageUrl"
                    [alt]="result!.match!.card.name"
                    class="w-20 h-28 object-cover rounded-md shadow-md"
                  />
                }
                <div class="flex-1">
                  <div class="flex items-start justify-between mb-2">
                    <h4 class="text-base font-card font-bold text-gray-900">
                      {{ result!.match!.card.name }}
                    </h4>
                    <div
                      class="px-2 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white"
                    >
                      {{ (result!.match!.confidence * 100).toFixed(0) }}%
                    </div>
                  </div>
                  <p class="text-xs text-gray-600">
                    {{ result!.match!.card.cardType }} - {{ result!.match!.card.rarity }}
                  </p>
                </div>
              </div>
            </button>
          }

          <!-- Alternative matches -->
          @for (match of result!.alternatives; track match.card.id) {
            <button
              class="match-option w-full text-left p-4 rounded-lg border-2 transition-all duration-200 hover:border-purple-500 hover:bg-purple-50"
              [class.border-purple-500]="isMatchSelected(match.card.id)"
              [class.bg-purple-50]="isMatchSelected(match.card.id)"
              (click)="selectedMatch.set(match)"
            >
              <div class="flex gap-4">
                @if (match.card.imageUrl) {
                  <img
                    [src]="match.card.imageUrl"
                    [alt]="match.card.name"
                    class="w-20 h-28 object-cover rounded-md shadow-md"
                  />
                }
                <div class="flex-1">
                  <div class="flex items-start justify-between mb-2">
                    <h4 class="text-base font-card font-bold text-gray-900">
                      {{ match.card.name }}
                    </h4>
                    <div
                      class="px-2 py-1 rounded-full text-xs font-bold"
                      [class.bg-emerald-500]="match.confidence >= 0.8"
                      [class.bg-amber-100]="match.confidence >= 0.6 && match.confidence < 0.8"
                      [class.text-white]="match.confidence >= 0.8"
                      [class.text-amber-800]="match.confidence >= 0.6 && match.confidence < 0.8"
                    >
                      {{ (match.confidence * 100).toFixed(0) }}%
                    </div>
                  </div>
                  <p class="text-xs text-gray-600">
                    {{ match.card.cardType }} - {{ match.card.rarity }}
                  </p>
                </div>
              </div>
            </button>
          }
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-3">
          <button
            mat-raised-button
            color="primary"
            class="w-full"
            [disabled]="!selectedMatch()"
            (click)="confirmMatch()"
          >
            <mat-icon>check</mat-icon>
            Continue with Selected Card
          </button>
          <button
            mat-stroked-button
            class="w-full"
            (click)="scanAnother.emit()"
          >
            <mat-icon>document_scanner</mat-icon>
            None of These - Rescan
          </button>
        </div>
      </div>
    }

    <!-- No Match State -->
    @if (result && !result.success) {
      <div class="no-match animate-slide-up">
        <div class="text-center mb-6">
          <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <mat-icon class="text-gray-400 !text-5xl">help_outline</mat-icon>
          </div>
          <h3 class="text-xl font-heading font-bold text-gray-900 mb-2">
            Card Not Recognized
          </h3>
          <p class="text-sm text-gray-600">
            {{ result.error || "We couldn't identify this card in our database" }}
          </p>
        </div>

        <!-- Suggestions -->
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <h4 class="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <mat-icon class="!text-base">lightbulb</mat-icon>
            Tips for Better Results
          </h4>
          <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>Ensure good lighting (avoid shadows and glare)</li>
            <li>Hold camera steady and focus clearly</li>
            <li>Center the entire card within the frame</li>
            <li>Avoid backgrounds with similar colors</li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="space-y-3">
          <button
            mat-raised-button
            color="primary"
            class="w-full"
            (click)="scanAnother.emit()"
          >
            <mat-icon>document_scanner</mat-icon>
            Try Scanning Again
          </button>
          <button
            mat-stroked-button
            class="w-full"
            (click)="manualEntry.emit()"
          >
            <mat-icon>edit</mat-icon>
            Add Card Manually
          </button>
          <button
            mat-button
            class="w-full text-gray-600"
            (click)="dismiss.emit()"
          >
            Cancel
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slide-up {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes scale-in {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    .animate-slide-up {
      animation: slide-up 300ms ease-out;
    }

    .animate-scale-in {
      animation: scale-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  `]
})
export class ScanResultComponent {
  @Input() result: ScanResponse | null = null;
  @Input() mode: 'single' | 'bulk' = 'single';

  @Output() addToCollection = new EventEmitter<{ card: Card; quantity: number; condition: string }>();
  @Output() addToQueue = new EventEmitter<{ card: Card; quantity: number; condition: string; confidence: number }>();
  @Output() scanAnother = new EventEmitter<void>();
  @Output() manualEntry = new EventEmitter<void>();
  @Output() reportWrong = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  // State
  selectedCondition = signal<CardCondition>(CardCondition.NEAR_MINT);
  quantity = signal(1);
  adding = signal(false);
  showAlternatives = signal(false);
  selectedMatch = signal<ScanMatch | null>(null);

  conditions = CARD_CONDITIONS;

  isMatchSelected(cardId: string): boolean {
    const match = this.selectedMatch();
    return match !== null && match.card.id === cardId;
  }

  incrementQuantity(): void {
    if (this.quantity() < 99) {
      this.quantity.set(this.quantity() + 1);
    }
  }

  decrementQuantity(): void {
    if (this.quantity() > 1) {
      this.quantity.set(this.quantity() - 1);
    }
  }

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

  getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.95) return 'Perfect match';
    if (confidence >= 0.85) return 'High confidence match';
    if (confidence >= 0.7) return 'Good match';
    return 'Possible match';
  }

  getDomainColor(domain: Domain | string): string {
    const domainColors: Record<string, string> = {
      [Domain.FURY]: 'bg-red-500 text-white',
      [Domain.CALM]: 'bg-blue-500 text-white',
      [Domain.MIND]: 'bg-purple-500 text-white',
      [Domain.BODY]: 'bg-green-500 text-white',
      [Domain.CHAOS]: 'bg-orange-500 text-white',
      [Domain.ORDER]: 'bg-amber-500 text-white'
    };
    return domainColors[domain] || 'bg-gray-500 text-white';
  }

  handleAddToCollection(): void {
    const match = this.result?.match;
    if (!match) return;

    this.adding.set(true);

    if (this.mode === 'bulk') {
      this.addToQueue.emit({
        card: match.card,
        quantity: this.quantity(),
        condition: this.selectedCondition(),
        confidence: match.confidence
      });
      this.adding.set(false);
    } else {
      this.addToCollection.emit({
        card: match.card,
        quantity: this.quantity(),
        condition: this.selectedCondition()
      });
      // Parent component will set adding to false when complete
    }
  }

  confirmMatch(): void {
    const match = this.selectedMatch();
    if (!match) return;

    // Create a new result with the selected match
    if (this.result) {
      this.result = {
        ...this.result,
        match: match,
        alternatives: []
      };
    }
    this.showAlternatives.set(false);
  }

  setAdding(value: boolean): void {
    this.adding.set(value);
  }

  resetState(): void {
    this.selectedCondition.set(CardCondition.NEAR_MINT);
    this.quantity.set(1);
    this.adding.set(false);
    this.showAlternatives.set(false);
    this.selectedMatch.set(null);
  }
}
