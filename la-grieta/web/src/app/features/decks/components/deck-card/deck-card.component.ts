import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { DeckListResponseDto } from '@la-grieta/shared';

@Component({
  selector: 'lg-deck-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  template: `
    <mat-card class="h-full hover:shadow-lg transition-shadow duration-200 cursor-pointer"
              [routerLink]="['/decks', deck.id]">
      <mat-card-content class="!p-4">
        <!-- Legend Image / Placeholder -->
        <div class="relative mb-4 aspect-[3/4] bg-gradient-to-br from-purple-600 to-indigo-800 rounded-lg overflow-hidden">
          @if (deck.legend?.imageUrl) {
            <img
              [src]="deck.legend!.imageUrl"
              [alt]="deck.legend!.name"
              class="w-full h-full object-cover"
            />
          } @else {
            <div class="w-full h-full flex items-center justify-center">
              <mat-icon class="!text-6xl text-white/50">auto_awesome</mat-icon>
            </div>
          }

          <!-- Card Count Badge -->
          <div class="absolute top-2 right-2 bg-black/75 text-white px-2 py-1 rounded-full text-xs font-bold">
            {{ deck.cardCount }} cards
          </div>

          <!-- Public/Private Badge -->
          @if (deck.isPublic) {
            <div class="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <mat-icon class="!text-sm">public</mat-icon>
              Public
            </div>
          }
        </div>

        <!-- Deck Name -->
        <h3 class="text-lg font-heading font-bold text-gray-900 mb-1 truncate">
          {{ deck.name }}
        </h3>

        <!-- Legend Name -->
        @if (deck.legend) {
          <p class="text-sm text-purple-600 font-medium mb-2 truncate">
            {{ deck.legend.name }}
          </p>
        }

        <!-- Description -->
        @if (deck.description) {
          <p class="text-sm text-gray-600 line-clamp-2 mb-3">
            {{ deck.description }}
          </p>
        }

        <!-- Actions -->
        <div class="flex items-center justify-between pt-2 border-t">
          <span class="text-xs text-gray-500">
            Updated {{ formatDate(deck.updatedAt) }}
          </span>
          <button
            mat-icon-button
            [matMenuTriggerFor]="menu"
            (click)="$event.stopPropagation(); $event.preventDefault()"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #menu="matMenu">
            <button mat-menu-item [routerLink]="['/decks', deck.id]">
              <mat-icon>edit</mat-icon>
              <span>Edit Deck</span>
            </button>
            <button mat-menu-item (click)="onDelete($event)">
              <mat-icon color="warn">delete</mat-icon>
              <span class="text-red-600">Delete</span>
            </button>
          </mat-menu>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class DeckCardComponent {
  @Input({ required: true }) deck!: DeckListResponseDto;
  @Output() delete = new EventEmitter<DeckListResponseDto>();

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.delete.emit(this.deck);
  }
}
