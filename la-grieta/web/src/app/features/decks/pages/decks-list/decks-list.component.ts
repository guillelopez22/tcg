import {  Component, OnInit , inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DecksService } from '../../../../core/services/decks.service';
import { DeckCardComponent } from '../../components/deck-card/deck-card.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { DeckListResponseDto } from '@la-grieta/shared';

@Component({
  selector: 'app-decks-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    DeckCardComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8">
      <!-- Header Section -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
            My Decks
          </h1>
          <p class="text-base text-gray-600">
            Build and manage your Riftbound decks
          </p>
        </div>
        <a
          mat-raised-button
          color="primary"
          routerLink="/decks/new"
          class="flex items-center gap-2"
        >
          <mat-icon>add</mat-icon>
          <span>New Deck</span>
        </a>
      </div>

      <!-- Loading State -->
      @if (decksService.loading() && !decksService.hasDecks()) {
        <div class="flex justify-center py-16">
          <app-loading-spinner />
        </div>
      }

      <!-- Error State -->
      @if (decksService.error() && !decksService.hasDecks()) {
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-2">
            <mat-icon class="text-red-600">error</mat-icon>
            <p class="text-red-800">{{ decksService.error() }}</p>
          </div>
        </div>
      }

      <!-- Decks Grid -->
      @if (decksService.hasDecks()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          @for (deck of decksService.decks(); track deck.id) {
            <app-deck-card
              [deck]="deck"
              (delete)="confirmDelete($event)"
            />
          }
        </div>
      }

      <!-- Empty State -->
      @if (!decksService.loading() && !decksService.hasDecks()) {
        <div class="text-center py-16">
          <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
            <mat-icon class="!text-5xl text-purple-600">style</mat-icon>
          </div>
          <h2 class="text-2xl font-heading font-bold text-gray-900 mb-2">
            Build Your First Deck
          </h2>
          <p class="text-gray-600 mb-6 max-w-md mx-auto">
            Create a Riftbound deck by selecting a Legend card and building your Main Deck, Rune Deck, and Battlefield.
          </p>
          <a
            mat-raised-button
            color="primary"
            routerLink="/decks/new"
            class="inline-flex items-center gap-2"
          >
            <mat-icon>add</mat-icon>
            Create Your First Deck
          </a>

          <!-- Info Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-3xl mx-auto">
            <div class="bg-white rounded-lg p-4 border border-gray-200 text-left">
              <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                <mat-icon class="text-purple-600">auto_awesome</mat-icon>
              </div>
              <h3 class="font-bold text-gray-900 mb-1">Choose a Legend</h3>
              <p class="text-sm text-gray-600">
                Your Legend defines your deck's domains and strategy
              </p>
            </div>
            <div class="bg-white rounded-lg p-4 border border-gray-200 text-left">
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <mat-icon class="text-blue-600">layers</mat-icon>
              </div>
              <h3 class="font-bold text-gray-900 mb-1">Build Three Zones</h3>
              <p class="text-sm text-gray-600">
                Main Deck (30-40), Rune Deck (10-12), Battlefield (1)
              </p>
            </div>
            <div class="bg-white rounded-lg p-4 border border-gray-200 text-left">
              <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <mat-icon class="text-green-600">check_circle</mat-icon>
              </div>
              <h3 class="font-bold text-gray-900 mb-1">Validate & Play</h3>
              <p class="text-sm text-gray-600">
                Real-time validation ensures your deck is tournament-ready
              </p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class DecksListComponent implements OnInit {
  public decksService = inject(DecksService);
  private snackBar = inject(MatSnackBar);
  

  ngOnInit(): void {
    this.loadDecks();
  }

  loadDecks(): void {
    this.decksService.loadDecks().subscribe({
      error: () => {
        this.snackBar.open(
          'Failed to load decks',
          'Close',
          { duration: 3000, panelClass: 'error-snackbar' }
        );
      }
    });
  }

  confirmDelete(deck: DeckListResponseDto): void {
    const confirmed = confirm(
      `Are you sure you want to delete "${deck.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      this.decksService.deleteDeck(deck.id).subscribe({
        next: () => {
          this.snackBar.open(
            'Deck deleted successfully',
            'Close',
            { duration: 3000 }
          );
        },
        error: () => {
          this.snackBar.open(
            'Failed to delete deck',
            'Close',
            { duration: 3000, panelClass: 'error-snackbar' }
          );
        }
      });
    }
  }
}
