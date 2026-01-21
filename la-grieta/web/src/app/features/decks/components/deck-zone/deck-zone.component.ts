import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DeckCard, DeckZone } from '@la-grieta/shared';

@Component({
  selector: 'lg-deck-zone',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="rounded-lg border-2 p-4"
         [class]="zoneClasses">
      <!-- Zone Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <mat-icon [class]="iconClasses">{{ zoneIcon }}</mat-icon>
          <h3 class="font-heading font-bold text-lg">{{ zoneName }}</h3>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-mono px-2 py-1 rounded"
                [class]="countClasses">
            {{ currentCount }}/{{ maxCount }}
          </span>
          <button
            mat-icon-button
            color="primary"
            (click)="addCard.emit()"
            [matTooltip]="'Add card to ' + zoneName"
          >
            <mat-icon>add_circle</mat-icon>
          </button>
        </div>
      </div>

      <!-- Zone Description -->
      <p class="text-sm text-gray-600 mb-4">{{ zoneDescription }}</p>

      <!-- Cards Grid -->
      @if (cards.length > 0) {
        <div class="grid gap-2"
             [class]="zone === 'BATTLEFIELD' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'">
          @for (deckCard of cards; track deckCard.id) {
            <div class="relative group bg-white rounded-lg border border-gray-200 p-2 hover:border-gray-400 transition-colors">
              <!-- Card Image -->
              @if (deckCard.card?.imageUrl) {
                <img
                  [src]="deckCard.card!.imageUrl"
                  [alt]="deckCard.card!.name"
                  class="w-full aspect-[2/3] object-cover rounded mb-2"
                />
              } @else {
                <div class="w-full aspect-[2/3] bg-gray-100 rounded mb-2 flex items-center justify-center">
                  <mat-icon class="text-gray-400">image</mat-icon>
                </div>
              }

              <!-- Card Info -->
              <p class="text-xs font-medium truncate">{{ deckCard.card?.name || 'Unknown' }}</p>

              <!-- Quantity Badge -->
              @if (deckCard.quantity > 1) {
                <div class="absolute top-1 right-1 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                  x{{ deckCard.quantity }}
                </div>
              }

              <!-- Hover Actions -->
              <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                @if (zone !== 'BATTLEFIELD' && deckCard.quantity < 3) {
                  <button
                    mat-icon-button
                    class="!bg-white/90 !w-8 !h-8"
                    (click)="incrementQuantity.emit(deckCard)"
                    matTooltip="Add copy"
                  >
                    <mat-icon class="!text-lg">add</mat-icon>
                  </button>
                }
                @if (deckCard.quantity > 1) {
                  <button
                    mat-icon-button
                    class="!bg-white/90 !w-8 !h-8"
                    (click)="decrementQuantity.emit(deckCard)"
                    matTooltip="Remove copy"
                  >
                    <mat-icon class="!text-lg">remove</mat-icon>
                  </button>
                }
                <button
                  mat-icon-button
                  class="!bg-red-100 !w-8 !h-8"
                  (click)="removeCard.emit(deckCard)"
                  matTooltip="Remove from deck"
                >
                  <mat-icon class="!text-lg text-red-600">delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <!-- Empty State -->
        <div class="text-center py-8 border-2 border-dashed rounded-lg"
             [class]="emptyBorderClasses">
          <mat-icon class="!text-4xl text-gray-400 mb-2">{{ emptyIcon }}</mat-icon>
          <p class="text-sm text-gray-500">{{ emptyMessage }}</p>
          <button
            mat-stroked-button
            color="primary"
            class="mt-3"
            (click)="addCard.emit()"
          >
            <mat-icon>add</mat-icon>
            Add Cards
          </button>
        </div>
      }
    </div>
  `,
  styles: []
})
export class DeckZoneComponent {
  @Input({ required: true }) zone!: DeckZone | string;
  @Input() cards: DeckCard[] = [];
  @Input() minCount: number = 0;
  @Input() maxCount: number = 40;

  @Output() addCard = new EventEmitter<void>();
  @Output() removeCard = new EventEmitter<DeckCard>();
  @Output() incrementQuantity = new EventEmitter<DeckCard>();
  @Output() decrementQuantity = new EventEmitter<DeckCard>();

  get currentCount(): number {
    return this.cards.reduce((sum, c) => sum + c.quantity, 0);
  }

  get zoneName(): string {
    switch (this.zone) {
      case 'MAIN': return 'Main Deck';
      case 'RUNE': return 'Rune Deck';
      case 'BATTLEFIELD': return 'Battlefield';
      default: return 'Unknown Zone';
    }
  }

  get zoneIcon(): string {
    switch (this.zone) {
      case 'MAIN': return 'layers';
      case 'RUNE': return 'auto_fix_high';
      case 'BATTLEFIELD': return 'landscape';
      default: return 'help';
    }
  }

  get zoneDescription(): string {
    switch (this.zone) {
      case 'MAIN': return 'Your primary deck of cards (30-40 cards)';
      case 'RUNE': return 'Special rune cards for powerful effects (10-12 cards)';
      case 'BATTLEFIELD': return 'Your starting battlefield card (exactly 1)';
      default: return '';
    }
  }

  get zoneClasses(): string {
    switch (this.zone) {
      case 'MAIN': return 'border-blue-200 bg-blue-50/50';
      case 'RUNE': return 'border-purple-200 bg-purple-50/50';
      case 'BATTLEFIELD': return 'border-amber-200 bg-amber-50/50';
      default: return 'border-gray-200 bg-gray-50';
    }
  }

  get iconClasses(): string {
    switch (this.zone) {
      case 'MAIN': return 'text-blue-600';
      case 'RUNE': return 'text-purple-600';
      case 'BATTLEFIELD': return 'text-amber-600';
      default: return 'text-gray-600';
    }
  }

  get countClasses(): string {
    const isValid = this.currentCount >= this.minCount && this.currentCount <= this.maxCount;
    if (!isValid) {
      return 'bg-red-100 text-red-700';
    }
    switch (this.zone) {
      case 'MAIN': return 'bg-blue-100 text-blue-700';
      case 'RUNE': return 'bg-purple-100 text-purple-700';
      case 'BATTLEFIELD': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  get emptyBorderClasses(): string {
    switch (this.zone) {
      case 'MAIN': return 'border-blue-200';
      case 'RUNE': return 'border-purple-200';
      case 'BATTLEFIELD': return 'border-amber-200';
      default: return 'border-gray-200';
    }
  }

  get emptyIcon(): string {
    switch (this.zone) {
      case 'MAIN': return 'style';
      case 'RUNE': return 'auto_fix_high';
      case 'BATTLEFIELD': return 'terrain';
      default: return 'add_box';
    }
  }

  get emptyMessage(): string {
    switch (this.zone) {
      case 'MAIN': return 'No cards in main deck yet';
      case 'RUNE': return 'No rune cards added yet';
      case 'BATTLEFIELD': return 'No battlefield card selected';
      default: return 'No cards added';
    }
  }
}
