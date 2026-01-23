import {  Component, Inject, OnInit, signal , inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { CollectionsService } from '../../../../core/services/collections.service';
import { CardsService } from '../../../../core/services/cards.service';
import { Card, CardCondition, CARD_CONDITIONS, AddCardToCollectionDto } from '@la-grieta/shared';
import { debounceTime, distinctUntilChanged } from 'rxjs';

export interface AddCardsModalData {
  collectionId: string;
}

@Component({
  selector: 'app-add-cards-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule
  ],
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-heading font-bold text-gray-900">
          Add Cards to Collection
        </h2>
        <button
          mat-icon-button
          (click)="onCancel()"
          aria-label="Close dialog"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Search Section -->
      <div class="mb-6">
        <mat-form-field class="w-full" appearance="outline">
          <mat-label>Search for a card</mat-label>
          <input
            matInput
            [formControl]="searchControl"
            placeholder="Type card name..."
          />
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>

        <!-- Search Results -->
        @if (searchControl.value && searchControl.value.length >= 2) {
          <div class="max-h-[300px] overflow-y-auto border rounded-lg">
            @if (loadingCards()) {
              <div class="p-4 text-center text-gray-500">
                <mat-icon class="animate-spin">refresh</mat-icon>
                <p>Searching...</p>
              </div>
            } @else if (searchResults().length > 0) {
              @for (card of searchResults(); track card.id) {
                <div
                  class="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 flex items-center gap-3"
                  (click)="selectCard(card)"
                  (keydown.enter)="selectCard(card)"
                  (keydown.space)="selectCard(card)"
                  tabindex="0"
                  role="button"
                  [attr.aria-label]="'Select card ' + card.name"
                  [class.bg-blue-50]="selectedCard()?.id === card.id"
                >
                  @if (card.imageUrl) {
                    <img
                      [src]="card.imageUrl"
                      [alt]="card.name"
                      class="w-12 h-auto rounded"
                    />
                  } @else {
                    <div class="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">
                      <mat-icon class="text-gray-400">image</mat-icon>
                    </div>
                  }
                  <div class="flex-1">
                    <p class="font-semibold text-gray-900">{{ card.name }}</p>
                    <p class="text-xs text-gray-600">
                      {{ card.cardType }} • {{ card.rarity }}
                      @if (card.marketPrice) {
                        • {{ formatPrice(card.marketPrice) }}
                      }
                    </p>
                  </div>
                  @if (selectedCard()?.id === card.id) {
                    <mat-icon class="text-primary">check_circle</mat-icon>
                  }
                </div>
              }
            } @else {
              <div class="p-4 text-center text-gray-500">
                No cards found
              </div>
            }
          </div>
        } @else if (searchControl.value) {
          <p class="text-sm text-gray-500 mt-2">Type at least 2 characters to search</p>
        }
      </div>

      <!-- Add Form (shown when card is selected) -->
      @if (selectedCard()) {
        <form [formGroup]="addForm" (ngSubmit)="onSubmit()" class="border-t pt-6">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div class="flex items-center gap-3">
              @if (selectedCard()?.imageUrl) {
                <img
                  [src]="selectedCard()!.imageUrl"
                  [alt]="selectedCard()!.name"
                  class="w-16 h-auto rounded"
                />
              }
              <div>
                <p class="font-semibold text-gray-900">{{ selectedCard()?.name }}</p>
                <p class="text-sm text-gray-600">
                  {{ selectedCard()?.cardType }} • {{ selectedCard()?.rarity }}
                </p>
              </div>
            </div>
          </div>

          <!-- Quantity Field -->
          <mat-form-field class="w-full mb-4" appearance="outline">
            <mat-label>Quantity</mat-label>
            <input
              matInput
              type="number"
              formControlName="quantity"
              min="1"
              max="999"
              required
            />
            <mat-icon matPrefix>numbers</mat-icon>
            @if (addForm.get('quantity')?.hasError('required')) {
              <mat-error>Quantity is required</mat-error>
            }
            @if (addForm.get('quantity')?.hasError('min')) {
              <mat-error>Minimum quantity is 1</mat-error>
            }
            @if (addForm.get('quantity')?.hasError('max')) {
              <mat-error>Maximum quantity is 999</mat-error>
            }
          </mat-form-field>

          <!-- Condition Field -->
          <mat-form-field class="w-full mb-6" appearance="outline">
            <mat-label>Condition</mat-label>
            <mat-select formControlName="condition" required>
              @for (condition of conditions; track condition) {
                <mat-option [value]="condition">
                  {{ getConditionLabel(condition) }}
                </mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>grade</mat-icon>
            @if (addForm.get('condition')?.hasError('required')) {
              <mat-error>Condition is required</mat-error>
            }
          </mat-form-field>

          <!-- Error Message -->
          @if (collectionsService.error()) {
            <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div class="flex items-center gap-2">
                <mat-icon class="text-red-600 !text-base">error</mat-icon>
                <p class="text-sm text-red-800">{{ collectionsService.error() }}</p>
              </div>
            </div>
          }

          <!-- Actions -->
          <div class="flex gap-3 justify-end">
            <button
              mat-button
              type="button"
              (click)="clearSelection()"
              [disabled]="collectionsService.loading()"
            >
              Choose Different Card
            </button>
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="addForm.invalid || collectionsService.loading()"
            >
              @if (collectionsService.loading()) {
                <mat-icon class="animate-spin">refresh</mat-icon>
              }
              Add to Collection
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }
  `]
})
export class AddCardsModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private cardsService = inject(CardsService);
  public collectionsService = inject(CollectionsService);
  private dialogRef = inject(MatDialogRef<AddCardsModalComponent>);
  public data = inject<AddCardsModalData>(MAT_DIALOG_DATA);
  searchControl!: FormControl<string | null>;
  addForm!: FormGroup;

  searchResults = signal<Card[]>([]);
  selectedCard = signal<Card | null>(null);
  loadingCards = signal(false);

  conditions = CARD_CONDITIONS;

  constructor() {
    this.searchControl = this.fb.control('');
    this.addForm = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(999)]],
      condition: [CardCondition.NEAR_MINT, Validators.required]
    });
  }

  ngOnInit(): void {
    // Setup search with debounce
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((searchTerm: string | null) => {
        if (searchTerm && searchTerm.length >= 2) {
          this.searchCards(searchTerm);
        } else {
          this.searchResults.set([]);
        }
      });
  }

  searchCards(name: string): void {
    this.loadingCards.set(true);
    this.cardsService.getCards({ name }, 0, 10).subscribe({
      next: (response) => {
        this.searchResults.set(response.cards);
        this.loadingCards.set(false);
      },
      error: () => {
        this.searchResults.set([]);
        this.loadingCards.set(false);
      }
    });
  }

  selectCard(card: Card): void {
    this.selectedCard.set(card);
    this.addForm.patchValue({
      quantity: 1,
      condition: CardCondition.NEAR_MINT
    });
  }

  clearSelection(): void {
    this.selectedCard.set(null);
    this.addForm.reset({
      quantity: 1,
      condition: CardCondition.NEAR_MINT
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  getConditionLabel(condition: string): string {
    switch (condition) {
      case CardCondition.MINT:
        return 'Mint';
      case CardCondition.NEAR_MINT:
        return 'Near Mint';
      case CardCondition.EXCELLENT:
        return 'Excellent';
      case CardCondition.GOOD:
        return 'Good';
      case CardCondition.PLAYED:
        return 'Played';
      case CardCondition.POOR:
        return 'Poor';
      default:
        return condition;
    }
  }

  onSubmit(): void {
    if (this.addForm.invalid || !this.selectedCard()) return;

    this.collectionsService.clearError();

    const dto: AddCardToCollectionDto = {
      cardId: this.selectedCard()!.id,
      quantity: this.addForm.value.quantity,
      condition: this.addForm.value.condition
    };

    this.collectionsService.addCardToCollection(this.data.collectionId, dto).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: () => {
        // Error handled by service
      }
    });
  }

  onCancel(): void {
    this.collectionsService.clearError();
    this.dialogRef.close(false);
  }
}
