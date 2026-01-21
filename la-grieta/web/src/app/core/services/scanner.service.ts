import { Injectable, signal, computed } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import { Card } from '@la-grieta/shared';

// Scanner API Types
export interface ScanImageDto {
  image: string; // base64 encoded image
  mimeType: string;
}

export interface ScanMatch {
  card: Card;
  confidence: number;
  matchType: 'EXACT' | 'FUZZY' | 'PARTIAL';
}

export interface ScanResponse {
  success: boolean;
  match?: ScanMatch;
  alternatives?: ScanMatch[];
  extractedText?: string[];
  error?: string;
}

export interface BulkScanResponse {
  results: ScanResponse[];
  summary: {
    total: number;
    matched: number;
    failed: number;
  };
}

export interface ScannerStatus {
  available: boolean;
  mode: 'MOCK' | 'LIVE';
  quotaRemaining?: number;
}

export type ScanState = 'idle' | 'capturing' | 'processing' | 'success' | 'partial_match' | 'no_match' | 'error';

export interface ScannedCard {
  card: Card;
  quantity: number;
  condition: string;
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class ScannerService {
  // State signals
  private scanStateSignal = signal<ScanState>('idle');
  private currentResultSignal = signal<ScanResponse | null>(null);
  private bulkQueueSignal = signal<ScannedCard[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private statusSignal = signal<ScannerStatus | null>(null);

  // Public readonly signals
  readonly scanState = this.scanStateSignal.asReadonly();
  readonly currentResult = this.currentResultSignal.asReadonly();
  readonly bulkQueue = this.bulkQueueSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();

  // Computed values
  readonly queueCount = computed(() => this.bulkQueueSignal().length);
  readonly hasQueue = computed(() => this.bulkQueueSignal().length > 0);
  readonly totalQueueQuantity = computed(() =>
    this.bulkQueueSignal().reduce((sum, item) => sum + item.quantity, 0)
  );

  constructor(private api: ApiService) {}

  /**
   * Scan a single card image
   * POST /api/scanner/scan
   */
  scanCard(image: string, mimeType: string): Observable<ScanResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.scanStateSignal.set('processing');

    const dto: ScanImageDto = { image, mimeType };

    return this.api.post<ScanResponse>('scanner/scan', dto).pipe(
      tap({
        next: (response) => {
          this.loadingSignal.set(false);
          this.currentResultSignal.set(response);

          if (response.success && response.match) {
            if (response.alternatives && response.alternatives.length > 0) {
              this.scanStateSignal.set('partial_match');
            } else {
              this.scanStateSignal.set('success');
            }
          } else {
            this.scanStateSignal.set('no_match');
          }
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.scanStateSignal.set('error');
          this.errorSignal.set(err.error?.message || 'Failed to scan card');
        }
      }),
      catchError((err) => {
        this.loadingSignal.set(false);
        this.scanStateSignal.set('error');
        this.errorSignal.set(err.error?.message || 'Failed to scan card');
        const errorResponse: ScanResponse = {
          success: false,
          error: err.error?.message || 'Failed to scan card'
        };
        this.currentResultSignal.set(errorResponse);
        return of(errorResponse);
      })
    );
  }

  /**
   * Scan multiple card images
   * POST /api/scanner/scan-bulk
   */
  scanBulk(images: ScanImageDto[]): Observable<BulkScanResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<BulkScanResponse>('scanner/scan-bulk', { images }).pipe(
      tap({
        next: () => {
          this.loadingSignal.set(false);
        },
        error: (err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(err.error?.message || 'Failed to scan cards');
        }
      })
    );
  }

  /**
   * Get scanner service status
   * GET /api/scanner/status
   */
  getStatus(): Observable<ScannerStatus> {
    return this.api.get<ScannerStatus>('scanner/status').pipe(
      tap({
        next: (status) => {
          this.statusSignal.set(status);
        },
        error: () => {
          this.statusSignal.set({ available: false, mode: 'MOCK' });
        }
      }),
      catchError(() => of({ available: false, mode: 'MOCK' as const }))
    );
  }

  /**
   * Add a scanned card to the bulk queue
   */
  addToQueue(card: Card, quantity: number, condition: string, confidence: number): void {
    const queue = this.bulkQueueSignal();
    const existing = queue.find(item => item.card.id === card.id && item.condition === condition);

    if (existing) {
      // Update quantity if same card and condition exists
      this.bulkQueueSignal.set(
        queue.map(item =>
          item.card.id === card.id && item.condition === condition
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      // Add new item
      this.bulkQueueSignal.set([...queue, { card, quantity, condition, confidence }]);
    }
  }

  /**
   * Update a queue item
   */
  updateQueueItem(index: number, updates: Partial<ScannedCard>): void {
    const queue = this.bulkQueueSignal();
    if (index >= 0 && index < queue.length) {
      this.bulkQueueSignal.set(
        queue.map((item, i) => i === index ? { ...item, ...updates } : item)
      );
    }
  }

  /**
   * Remove a card from the bulk queue
   */
  removeFromQueue(index: number): void {
    const queue = this.bulkQueueSignal();
    this.bulkQueueSignal.set(queue.filter((_, i) => i !== index));
  }

  /**
   * Clear the entire bulk queue
   */
  clearQueue(): void {
    this.bulkQueueSignal.set([]);
  }

  /**
   * Reset scan state to idle
   */
  resetScanState(): void {
    this.scanStateSignal.set('idle');
    this.currentResultSignal.set(null);
    this.errorSignal.set(null);
  }

  /**
   * Set scan state for capturing
   */
  setCapturing(): void {
    this.scanStateSignal.set('capturing');
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
