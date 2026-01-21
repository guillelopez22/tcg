import { Injectable, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  Deck,
  DeckCard,
  DeckZone,
  CreateDeckDto,
  UpdateDeckDto,
  AddCardToDeckDto,
  UpdateDeckCardDto,
  DeckValidationResult,
  DeckStatsResponse,
  DeckResponseDto,
  DeckListResponseDto,
} from '@la-grieta/shared';

@Injectable({
  providedIn: 'root'
})
export class DecksService {
  // Angular Signals for state management
  private decksSignal = signal<DeckListResponseDto[]>([]);
  private currentDeckSignal = signal<DeckResponseDto | null>(null);
  private deckStatsSignal = signal<DeckStatsResponse | null>(null);
  private validationResultSignal = signal<DeckValidationResult | null>(null);
  private loadingSignal = signal<boolean>(false);
  private savingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public readonly signals
  readonly decks = this.decksSignal.asReadonly();
  readonly currentDeck = this.currentDeckSignal.asReadonly();
  readonly deckStats = this.deckStatsSignal.asReadonly();
  readonly validationResult = this.validationResultSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed values
  readonly hasDecks = computed(() => this.decksSignal().length > 0);
  readonly decksCount = computed(() => this.decksSignal().length);

  readonly mainDeckCards = computed(() => {
    const deck = this.currentDeckSignal();
    if (!deck?.cards) return [];
    return deck.cards.filter(c => c.zone === DeckZone.MAIN);
  });

  readonly runeDeckCards = computed(() => {
    const deck = this.currentDeckSignal();
    if (!deck?.cards) return [];
    return deck.cards.filter(c => c.zone === DeckZone.RUNE);
  });

  readonly battlefieldCards = computed(() => {
    const deck = this.currentDeckSignal();
    if (!deck?.cards) return [];
    return deck.cards.filter(c => c.zone === DeckZone.BATTLEFIELD);
  });

  readonly mainDeckCount = computed(() =>
    this.mainDeckCards().reduce((sum, c) => sum + c.quantity, 0)
  );

  readonly runeDeckCount = computed(() =>
    this.runeDeckCards().reduce((sum, c) => sum + c.quantity, 0)
  );

  readonly battlefieldCount = computed(() =>
    this.battlefieldCards().reduce((sum, c) => sum + c.quantity, 0)
  );

  readonly isValidDeck = computed(() => {
    const result = this.validationResultSignal();
    return result?.isValid ?? false;
  });

  constructor(private api: ApiService) {}

  /**
   * 1. List User's Decks
   * GET /api/decks
   */
  loadDecks(): Observable<DeckListResponseDto[]> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<DeckListResponseDto[]>('decks').pipe(
      tap({
        next: (decks) => {
          this.decksSignal.set(decks);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load decks');
        }
      })
    );
  }

  /**
   * 2. Get Deck with Cards
   * GET /api/decks/:id
   */
  loadDeck(id: string): Observable<DeckResponseDto> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<DeckResponseDto>(`decks/${id}`).pipe(
      tap({
        next: (deck) => {
          this.currentDeckSignal.set(deck);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load deck');
        }
      })
    );
  }

  /**
   * 3. Create Deck
   * POST /api/decks
   */
  createDeck(dto: CreateDeckDto): Observable<DeckResponseDto> {
    this.savingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<DeckResponseDto>('decks', dto).pipe(
      tap({
        next: (deck) => {
          this.savingSignal.set(false);
          this.currentDeckSignal.set(deck);
          // Refresh decks list
          this.loadDecks().subscribe();
        },
        error: (err) => {
          this.savingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to create deck');
        }
      })
    );
  }

  /**
   * 4. Update Deck
   * PUT /api/decks/:id
   */
  updateDeck(id: string, dto: UpdateDeckDto): Observable<DeckResponseDto> {
    this.savingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.put<DeckResponseDto>(`decks/${id}`, dto).pipe(
      tap({
        next: (updated) => {
          this.savingSignal.set(false);
          // Update current deck if it's the one being edited
          const current = this.currentDeckSignal();
          if (current && current.id === id) {
            this.currentDeckSignal.set({ ...current, ...updated });
          }
          // Refresh decks list
          this.loadDecks().subscribe();
        },
        error: (err) => {
          this.savingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to update deck');
        }
      })
    );
  }

  /**
   * 5. Delete Deck
   * DELETE /api/decks/:id
   */
  deleteDeck(id: string): Observable<{ message: string }> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.delete<{ message: string }>(`decks/${id}`).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
          // Clear current deck if it was deleted
          if (this.currentDeckSignal()?.id === id) {
            this.currentDeckSignal.set(null);
            this.deckStatsSignal.set(null);
            this.validationResultSignal.set(null);
          }
          // Refresh decks list
          this.loadDecks().subscribe();
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to delete deck');
        }
      })
    );
  }

  /**
   * 6. Add Card to Deck
   * POST /api/decks/:id/cards
   */
  addCard(deckId: string, dto: AddCardToDeckDto): Observable<DeckResponseDto> {
    this.savingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<DeckResponseDto>(`decks/${deckId}/cards`, dto).pipe(
      tap({
        next: (updated) => {
          this.savingSignal.set(false);
          this.currentDeckSignal.set(updated);
          // Refresh validation
          this.validateDeck(deckId).subscribe();
        },
        error: (err) => {
          this.savingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to add card');
        }
      })
    );
  }

  /**
   * 7. Update Card in Deck
   * PUT /api/decks/:deckId/cards/:cardId
   */
  updateCard(deckId: string, cardId: string, dto: UpdateDeckCardDto): Observable<DeckResponseDto> {
    this.savingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.put<DeckResponseDto>(`decks/${deckId}/cards/${cardId}`, dto).pipe(
      tap({
        next: (updated) => {
          this.savingSignal.set(false);
          this.currentDeckSignal.set(updated);
          // Refresh validation
          this.validateDeck(deckId).subscribe();
        },
        error: (err) => {
          this.savingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to update card');
        }
      })
    );
  }

  /**
   * 8. Remove Card from Deck
   * DELETE /api/decks/:deckId/cards/:cardId
   */
  removeCard(deckId: string, cardId: string): Observable<DeckResponseDto> {
    this.savingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.delete<DeckResponseDto>(`decks/${deckId}/cards/${cardId}`).pipe(
      tap({
        next: (updated) => {
          this.savingSignal.set(false);
          this.currentDeckSignal.set(updated);
          // Refresh validation
          this.validateDeck(deckId).subscribe();
        },
        error: (err) => {
          this.savingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to remove card');
        }
      })
    );
  }

  /**
   * 9. Validate Deck
   * POST /api/decks/:id/validate
   */
  validateDeck(id: string): Observable<DeckValidationResult> {
    this.errorSignal.set(null);

    return this.api.post<DeckValidationResult>(`decks/${id}/validate`, {}).pipe(
      tap({
        next: (result) => {
          this.validationResultSignal.set(result);
        },
        error: (err) => {
          this.errorSignal.set(err.error?.message || 'Failed to validate deck');
        }
      })
    );
  }

  /**
   * 10. Get Deck Statistics
   * GET /api/decks/:id/stats
   */
  loadDeckStats(id: string): Observable<DeckStatsResponse> {
    this.errorSignal.set(null);

    return this.api.get<DeckStatsResponse>(`decks/${id}/stats`).pipe(
      tap({
        next: (stats) => {
          this.deckStatsSignal.set(stats);
        },
        error: (err) => {
          this.errorSignal.set(err.error?.message || 'Failed to load statistics');
        }
      })
    );
  }

  /**
   * Clear current deck from state
   */
  clearCurrentDeck(): void {
    this.currentDeckSignal.set(null);
    this.deckStatsSignal.set(null);
    this.validationResultSignal.set(null);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
