import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecksService } from '../../../../core/services/decks.service';
import { CardsService } from '../../../../core/services/cards.service';
import { DeckZoneComponent } from '../../components/deck-zone/deck-zone.component';
import { ValidationPanelComponent } from '../../components/validation-panel/validation-panel.component';
import { StatsPanelComponent } from '../../components/stats-panel/stats-panel.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { DeckCard, DeckZone, Card, CreateDeckDto, AddCardToDeckDto, UpdateDeckCardDto } from '@la-grieta/shared';

@Component({
  selector: 'lg-deck-builder',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    DeckZoneComponent,
    ValidationPanelComponent,
    StatsPanelComponent,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <div class="bg-white border-b sticky top-0 z-10">
        <div class="container mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <a mat-icon-button routerLink="/decks">
                <mat-icon>arrow_back</mat-icon>
              </a>
              @if (isEditMode) {
                <h1 class="text-xl font-heading font-bold">Edit Deck</h1>
              } @else {
                <h1 class="text-xl font-heading font-bold">New Deck</h1>
              }
            </div>
            <div class="flex items-center gap-2">
              @if (decksService.saving()) {
                <mat-spinner diameter="24"></mat-spinner>
              }
              <button
                mat-stroked-button
                routerLink="/decks"
              >
                Cancel
              </button>
              <button
                mat-raised-button
                color="primary"
                [disabled]="decksService.saving()"
                (click)="saveDeck()"
              >
                <mat-icon>save</mat-icon>
                Save Deck
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="container mx-auto px-4 py-6">
        @if (decksService.loading()) {
          <div class="flex justify-center py-16">
            <lg-loading-spinner />
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <!-- Left Sidebar - Deck Info & Stats -->
            <div class="lg:col-span-1 space-y-4">
              <!-- Deck Info Form -->
              <div class="bg-white rounded-lg border p-4">
                <h3 class="font-heading font-bold mb-4 flex items-center gap-2">
                  <mat-icon class="text-gray-600">info</mat-icon>
                  Deck Info
                </h3>
                <form [formGroup]="deckForm" class="space-y-4">
                  <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Deck Name</mat-label>
                    <input matInput formControlName="name" placeholder="My Awesome Deck">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Description</mat-label>
                    <textarea matInput formControlName="description" rows="3" placeholder="Optional description..."></textarea>
                  </mat-form-field>
                </form>
              </div>

              <!-- Legend Selection -->
              <div class="bg-white rounded-lg border p-4">
                <h3 class="font-heading font-bold mb-4 flex items-center gap-2">
                  <mat-icon class="text-purple-600">auto_awesome</mat-icon>
                  Legend Card
                </h3>
                @if (selectedLegend()) {
                  <div class="relative">
                    @if (selectedLegend()!.imageUrl) {
                      <img
                        [src]="selectedLegend()!.imageUrl"
                        [alt]="selectedLegend()!.name"
                        class="w-full rounded-lg"
                      />
                    }
                    <div class="mt-2">
                      <p class="font-bold">{{ selectedLegend()!.name }}</p>
                      <p class="text-sm text-purple-600">
                        Domains: {{ getLegendDomains() }}
                      </p>
                    </div>
                    <button
                      mat-stroked-button
                      class="w-full mt-2"
                      (click)="openLegendSelector()"
                    >
                      Change Legend
                    </button>
                  </div>
                } @else {
                  <div class="text-center py-4">
                    <mat-icon class="!text-4xl text-gray-400 mb-2">person_search</mat-icon>
                    <p class="text-sm text-gray-600 mb-3">Select a Legend to define your deck's domains</p>
                    <button
                      mat-raised-button
                      color="primary"
                      (click)="openLegendSelector()"
                    >
                      Select Legend
                    </button>
                  </div>
                }
              </div>

              <!-- Validation Panel -->
              <lg-validation-panel [validation]="decksService.validationResult()" />

              <!-- Stats Panel -->
              <lg-stats-panel [stats]="decksService.deckStats()" />
            </div>

            <!-- Main Content - Deck Zones -->
            <div class="lg:col-span-3 space-y-6">
              @if (!selectedLegend() && !isEditMode) {
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-yellow-600">info</mat-icon>
                    <p class="text-yellow-800">Select a Legend card first to start building your deck</p>
                  </div>
                </div>
              }

              <!-- Main Deck Zone -->
              <lg-deck-zone
                zone="MAIN"
                [cards]="decksService.mainDeckCards()"
                [minCount]="30"
                [maxCount]="40"
                (addCard)="openCardSelector('MAIN')"
                (removeCard)="removeCard($event)"
                (incrementQuantity)="incrementCard($event)"
                (decrementQuantity)="decrementCard($event)"
              />

              <!-- Rune Deck Zone -->
              <lg-deck-zone
                zone="RUNE"
                [cards]="decksService.runeDeckCards()"
                [minCount]="10"
                [maxCount]="12"
                (addCard)="openCardSelector('RUNE')"
                (removeCard)="removeCard($event)"
                (incrementQuantity)="incrementCard($event)"
                (decrementQuantity)="decrementCard($event)"
              />

              <!-- Battlefield Zone -->
              <lg-deck-zone
                zone="BATTLEFIELD"
                [cards]="decksService.battlefieldCards()"
                [minCount]="1"
                [maxCount]="1"
                (addCard)="openCardSelector('BATTLEFIELD')"
                (removeCard)="removeCard($event)"
                (incrementQuantity)="incrementCard($event)"
                (decrementQuantity)="decrementCard($event)"
              />
            </div>
          </div>
        }
      </div>

      <!-- Card Selector Overlay -->
      @if (showCardSelector()) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="p-4 border-b flex items-center justify-between">
              <h2 class="text-xl font-heading font-bold">
                Add Card to {{ getZoneName(currentZone()) }}
              </h2>
              <button mat-icon-button (click)="closeCardSelector()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Search -->
            <div class="p-4 border-b">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Search cards</mat-label>
                <input matInput [formControl]="searchControl" placeholder="Search by name...">
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>
            </div>

            <!-- Cards Grid -->
            <div class="flex-1 overflow-y-auto p-4">
              @if (filteredCards().length > 0) {
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  @for (card of filteredCards(); track card.id) {
                    <div
                      class="cursor-pointer rounded-lg border-2 border-transparent hover:border-primary-500 transition-colors p-2"
                      (click)="addCardToDeck(card)"
                    >
                      @if (card.imageUrl) {
                        <img [src]="card.imageUrl" [alt]="card.name" class="w-full rounded" />
                      } @else {
                        <div class="w-full aspect-[2/3] bg-gray-100 rounded flex items-center justify-center">
                          <mat-icon class="text-gray-400">image</mat-icon>
                        </div>
                      }
                      <p class="text-sm font-medium mt-1 truncate">{{ card.name }}</p>
                      <p class="text-xs text-gray-500">{{ card.cardType }}</p>
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center py-8">
                  <mat-icon class="!text-4xl text-gray-400">search_off</mat-icon>
                  <p class="text-gray-600 mt-2">No cards found</p>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class DeckBuilderComponent implements OnInit, OnDestroy {
  deckForm!: FormGroup;
  isEditMode = false;
  deckId: string | null = null;

  selectedLegend = signal<Card | null>(null);
  showCardSelector = signal<boolean>(false);
  currentZone = signal<DeckZone | string>('MAIN');
  availableCards = signal<Card[]>([]);
  filteredCards = signal<Card[]>([]);
  searchControl = new FormControl<string>('', { nonNullable: true });

  constructor(
    public decksService: DecksService,
    private cardsService: CardsService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.deckForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      description: ['']
    });
  }

  ngOnInit(): void {
    // Check if editing existing deck
    this.deckId = this.route.snapshot.paramMap.get('id');
    if (this.deckId && this.deckId !== 'new') {
      this.isEditMode = true;
      this.loadDeck(this.deckId);
    }

    // Load available cards
    this.loadCards();

    // Setup search filtering
    this.searchControl.valueChanges.subscribe(term => {
      this.filterCards(term || '');
    });
  }

  ngOnDestroy(): void {
    this.decksService.clearCurrentDeck();
  }

  loadDeck(id: string): void {
    this.decksService.loadDeck(id).subscribe({
      next: (deck) => {
        this.deckForm.patchValue({
          name: deck.name,
          description: deck.description || ''
        });
        if (deck.legend) {
          this.selectedLegend.set(deck.legend);
        }
        // Load validation and stats
        this.decksService.validateDeck(id).subscribe();
        this.decksService.loadDeckStats(id).subscribe();
      },
      error: () => {
        this.snackBar.open('Failed to load deck', 'Close', { duration: 3000 });
        this.router.navigate(['/decks']);
      }
    });
  }

  loadCards(): void {
    this.cardsService.getCards({}, 0, 1000).subscribe({
      next: (response) => {
        this.availableCards.set(response.cards);
        this.filteredCards.set(response.cards);
      }
    });
  }

  filterCards(term: string): void {
    const cards = this.availableCards();
    if (!term) {
      this.filteredCards.set(this.filterByZoneAndDomain(cards));
      return;
    }
    const filtered = cards.filter(c =>
      c.name.toLowerCase().includes(term.toLowerCase())
    );
    this.filteredCards.set(this.filterByZoneAndDomain(filtered));
  }

  filterByZoneAndDomain(cards: Card[]): Card[] {
    const zone = this.currentZone();

    // Filter by card type for zone
    let filtered = cards;
    if (zone === 'RUNE') {
      filtered = cards.filter(c => c.cardType === 'RUNE');
    } else if (zone === 'BATTLEFIELD') {
      filtered = cards.filter(c => c.cardType === 'BATTLEFIELD');
    } else if (zone === 'MAIN') {
      filtered = cards.filter(c => c.cardType !== 'RUNE' && c.cardType !== 'BATTLEFIELD');
    }

    // TODO: Filter by legend domains when domain filtering is implemented
    return filtered;
  }

  getLegendDomains(): string {
    const legend = this.selectedLegend();
    if (!legend?.domains) return 'None';
    return legend.domains.join(', ');
  }

  openLegendSelector(): void {
    // For now, show card selector filtered to LEGEND type
    this.currentZone.set('LEGEND');
    this.filteredCards.set(
      this.availableCards().filter(c => c.cardType === 'LEGEND')
    );
    this.showCardSelector.set(true);
  }

  openCardSelector(zone: DeckZone | string): void {
    this.currentZone.set(zone);
    this.searchControl.setValue('');
    this.filterCards('');
    this.showCardSelector.set(true);
  }

  closeCardSelector(): void {
    this.showCardSelector.set(false);
  }

  getZoneName(zone: DeckZone | string): string {
    switch (zone) {
      case 'MAIN': return 'Main Deck';
      case 'RUNE': return 'Rune Deck';
      case 'BATTLEFIELD': return 'Battlefield';
      case 'LEGEND': return 'Legend Selection';
      default: return 'Deck';
    }
  }

  addCardToDeck(card: Card): void {
    const zone = this.currentZone();

    // Handle legend selection
    if (zone === 'LEGEND') {
      this.selectedLegend.set(card);
      this.closeCardSelector();

      // If creating new deck, create it now
      if (!this.isEditMode && !this.deckId) {
        this.createDeckWithLegend(card);
      }
      return;
    }

    // Add card to deck
    if (this.deckId) {
      const dto: AddCardToDeckDto = {
        cardId: card.id,
        quantity: 1,
        zone: zone as string
      };
      this.decksService.addCard(this.deckId, dto).subscribe({
        next: () => {
          this.snackBar.open(`Added ${card.name} to deck`, 'Close', { duration: 2000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to add card', 'Close', { duration: 3000 });
        }
      });
    }

    this.closeCardSelector();
  }

  createDeckWithLegend(legend: Card): void {
    const dto: CreateDeckDto = {
      name: this.deckForm.get('name')?.value || 'New Deck',
      description: this.deckForm.get('description')?.value || '',
      legendId: legend.id
    };

    this.decksService.createDeck(dto).subscribe({
      next: (deck) => {
        this.deckId = deck.id;
        this.isEditMode = true;
        // Update URL without navigation
        this.router.navigate(['/decks', deck.id], { replaceUrl: true });
        this.snackBar.open('Deck created! Now add cards.', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to create deck', 'Close', { duration: 3000 });
      }
    });
  }

  removeCard(deckCard: DeckCard): void {
    if (this.deckId) {
      this.decksService.removeCard(this.deckId, deckCard.cardId).subscribe({
        error: () => {
          this.snackBar.open('Failed to remove card', 'Close', { duration: 3000 });
        }
      });
    }
  }

  incrementCard(deckCard: DeckCard): void {
    if (this.deckId && deckCard.quantity < 3) {
      const dto: UpdateDeckCardDto = { quantity: deckCard.quantity + 1 };
      this.decksService.updateCard(this.deckId, deckCard.cardId, dto).subscribe({
        error: () => {
          this.snackBar.open('Failed to update card', 'Close', { duration: 3000 });
        }
      });
    }
  }

  decrementCard(deckCard: DeckCard): void {
    if (this.deckId && deckCard.quantity > 1) {
      const dto: UpdateDeckCardDto = { quantity: deckCard.quantity - 1 };
      this.decksService.updateCard(this.deckId, deckCard.cardId, dto).subscribe({
        error: () => {
          this.snackBar.open('Failed to update card', 'Close', { duration: 3000 });
        }
      });
    }
  }

  saveDeck(): void {
    if (!this.deckForm.valid) {
      this.snackBar.open('Please enter a deck name', 'Close', { duration: 3000 });
      return;
    }

    if (this.deckId) {
      this.decksService.updateDeck(this.deckId, {
        name: this.deckForm.get('name')?.value,
        description: this.deckForm.get('description')?.value
      }).subscribe({
        next: () => {
          this.snackBar.open('Deck saved successfully!', 'Close', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Failed to save deck', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
