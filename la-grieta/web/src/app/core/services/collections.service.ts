import { Injectable, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  Collection,
  CollectionWithItems,
  CollectionWithCount,
  CreateCollectionDto,
  UpdateCollectionDto,
  AddCardToCollectionDto,
  UpdateCollectionItemDto,
  CollectionStatsResponseDto,
} from '@la-grieta/shared';

@Injectable({
  providedIn: 'root'
})
export class CollectionsService {
  // Angular Signals for state management
  private collectionsSignal = signal<CollectionWithCount[]>([]);
  private currentCollectionSignal = signal<CollectionWithItems | null>(null);
  private collectionStatsSignal = signal<CollectionStatsResponseDto | null>(null);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Public computed signals
  readonly collections = this.collectionsSignal.asReadonly();
  readonly currentCollection = this.currentCollectionSignal.asReadonly();
  readonly collectionStats = this.collectionStatsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed values
  readonly hasCollections = computed(() => this.collectionsSignal().length > 0);
  readonly collectionsCount = computed(() => this.collectionsSignal().length);
  readonly totalCardsInCollection = computed(() => {
    const stats = this.collectionStatsSignal();
    return stats?.totalQuantity || 0;
  });

  constructor(private api: ApiService) {}

  /**
   * 1. Create Collection
   * POST /api/collections
   */
  createCollection(dto: CreateCollectionDto): Observable<Collection> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<Collection>('collections', dto).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
          // Refresh collections list after creation
          this.loadCollections().subscribe();
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to create collection');
        }
      })
    );
  }

  /**
   * 2. List Collections
   * GET /api/collections
   */
  loadCollections(): Observable<CollectionWithCount[]> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<CollectionWithCount[]>('collections').pipe(
      tap({
        next: (collections) => {
          this.collectionsSignal.set(collections);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load collections');
        }
      })
    );
  }

  /**
   * 3. Get Collection with Cards
   * GET /api/collections/:id
   */
  loadCollection(id: string): Observable<CollectionWithItems> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.get<CollectionWithItems>(`collections/${id}`).pipe(
      tap({
        next: (collection) => {
          this.currentCollectionSignal.set(collection);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to load collection');
        }
      })
    );
  }

  /**
   * 4. Update Collection
   * PUT /api/collections/:id
   */
  updateCollection(id: string, dto: UpdateCollectionDto): Observable<Collection> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.put<Collection>(`collections/${id}`, dto).pipe(
      tap({
        next: (updated) => {
          this.loadingSignal.set(false);
          // Update current collection if it's the one being edited
          const current = this.currentCollectionSignal();
          if (current && current.id === id) {
            this.currentCollectionSignal.set({ ...current, ...updated });
          }
          // Refresh collections list
          this.loadCollections().subscribe();
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to update collection');
        }
      })
    );
  }

  /**
   * 5. Delete Collection
   * DELETE /api/collections/:id
   */
  deleteCollection(id: string): Observable<{ message: string; deletedItems: number }> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.delete<{ message: string; deletedItems: number }>(`collections/${id}`).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
          // Clear current collection if it was deleted
          if (this.currentCollectionSignal()?.id === id) {
            this.currentCollectionSignal.set(null);
          }
          // Refresh collections list
          this.loadCollections().subscribe();
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to delete collection');
        }
      })
    );
  }

  /**
   * 6. Add Card to Collection
   * POST /api/collections/:id/cards
   */
  addCardToCollection(collectionId: string, dto: AddCardToCollectionDto): Observable<CollectionWithItems> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<CollectionWithItems>(`collections/${collectionId}/cards`, dto).pipe(
      tap({
        next: (updated) => {
          this.loadingSignal.set(false);
          this.currentCollectionSignal.set(updated);
          // Refresh stats if available
          if (this.collectionStatsSignal()) {
            this.loadCollectionStats(collectionId).subscribe();
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to add card');
        }
      })
    );
  }

  /**
   * 7. Update Collection Item
   * PUT /api/collections/:collectionId/cards/:itemId
   */
  updateCollectionItem(
    collectionId: string,
    itemId: string,
    dto: UpdateCollectionItemDto
  ): Observable<CollectionWithItems> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.put<CollectionWithItems>(`collections/${collectionId}/cards/${itemId}`, dto).pipe(
      tap({
        next: (updated) => {
          this.loadingSignal.set(false);
          this.currentCollectionSignal.set(updated);
          // Refresh stats if available
          if (this.collectionStatsSignal()) {
            this.loadCollectionStats(collectionId).subscribe();
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to update item');
        }
      })
    );
  }

  /**
   * 8. Remove Card from Collection
   * DELETE /api/collections/:collectionId/cards/:itemId
   */
  removeCardFromCollection(collectionId: string, itemId: string): Observable<CollectionWithItems> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.delete<CollectionWithItems>(`collections/${collectionId}/cards/${itemId}`).pipe(
      tap({
        next: (updated) => {
          this.loadingSignal.set(false);
          this.currentCollectionSignal.set(updated);
          // Refresh stats if available
          if (this.collectionStatsSignal()) {
            this.loadCollectionStats(collectionId).subscribe();
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to remove card');
        }
      })
    );
  }

  /**
   * 9. Get Collection Statistics
   * GET /api/collections/:id/stats
   */
  loadCollectionStats(id: string): Observable<CollectionStatsResponseDto> {
    this.errorSignal.set(null);

    return this.api.get<CollectionStatsResponseDto>(`collections/${id}/stats`).pipe(
      tap({
        next: (stats) => {
          this.collectionStatsSignal.set(stats);
        },
        error: (err) => {
          this.errorSignal.set(err.error?.message || 'Failed to load statistics');
        }
      })
    );
  }

  /**
   * 10. Seed Collection (Development Only)
   * POST /api/collections/:id/seed
   */
  seedCollection(id: string): Observable<CollectionWithItems> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<CollectionWithItems>(`collections/${id}/seed`, {}).pipe(
      tap({
        next: (collection) => {
          this.loadingSignal.set(false);
          this.currentCollectionSignal.set(collection);
          // Refresh stats after seeding
          this.loadCollectionStats(id).subscribe();
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to seed collection');
        }
      })
    );
  }

  /**
   * Clear current collection from state
   */
  clearCurrentCollection(): void {
    this.currentCollectionSignal.set(null);
    this.collectionStatsSignal.set(null);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
