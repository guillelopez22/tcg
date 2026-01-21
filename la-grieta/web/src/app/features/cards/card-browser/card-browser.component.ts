import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Card, CardType, Domain, CardRarity } from '@la-grieta/shared';
import { CardsService, CardFilters } from '../../../core/services/cards.service';
import { CardDisplayComponent } from '../../../shared/components/card-display/card-display.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { Router } from '@angular/router';

@Component({
  selector: 'lg-card-browser',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    CardDisplayComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './card-browser.component.html',
  styleUrl: './card-browser.component.scss'
})
export class CardBrowserComponent implements OnInit {
  cards = signal<Card[]>([]);
  loading = signal(false);
  totalCards = signal(0);
  currentPage = signal(0);
  pageSize = 24;

  searchControl = new FormControl('');
  typeControl = new FormControl<CardType | ''>('');
  rarityControl = new FormControl<CardRarity | ''>('');
  domainControl = new FormControl<Domain[]>([]);

  cardTypes = Object.values(CardType);
  cardRarities = Object.values(CardRarity);
  domains = Object.values(Domain);

  constructor(
    private cardsService: CardsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCards();
    this.setupSearchDebounce();
  }

  setupSearchDebounce(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.currentPage.set(0);
        this.loadCards();
      });
  }

  loadCards(): void {
    this.loading.set(true);

    const filters: CardFilters = {};

    if (this.searchControl.value) {
      filters.name = this.searchControl.value;
    }

    if (this.typeControl.value) {
      filters.cardType = this.typeControl.value as CardType;
    }

    if (this.rarityControl.value) {
      filters.rarity = this.rarityControl.value as CardRarity;
    }

    if (this.domainControl.value && this.domainControl.value.length > 0) {
      filters.domains = this.domainControl.value;
    }

    this.cardsService.getCards(filters, this.currentPage(), this.pageSize).subscribe({
      next: (response) => {
        this.cards.set(response.cards);
        this.totalCards.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading cards:', err);
        this.loading.set(false);
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.loadCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.loadCards();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.typeControl.setValue('');
    this.rarityControl.setValue('');
    this.domainControl.setValue([]);
    this.currentPage.set(0);
    this.loadCards();
  }

  onCardClick(card: Card): void {
    this.router.navigate(['/cards', card.id]);
  }
}
