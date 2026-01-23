import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Card, Domain } from '@la-grieta/shared';
import { CardsService } from '../../../core/services/cards.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-card-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './card-detail.component.html',
  styleUrl: './card-detail.component.scss'
})
export class CardDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cardsService = inject(CardsService);

  card = signal<Card | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const cardId = this.route.snapshot.paramMap.get('id');

    if (cardId) {
      this.loadCard(cardId);
    }
  }

  loadCard(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.cardsService.getCardById(id).subscribe({
      next: (card) => {
        this.card.set(card);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load card details');
        this.loading.set(false);
        console.error('Error loading card:', err);
      }
    });
  }

  getDomainColor(domain: Domain): string {
    const domainColors: Record<Domain, string> = {
      [Domain.FURY]: 'bg-fury text-white',
      [Domain.CALM]: 'bg-calm text-white',
      [Domain.MIND]: 'bg-mind text-white',
      [Domain.BODY]: 'bg-body text-white',
      [Domain.CHAOS]: 'bg-chaos text-white',
      [Domain.ORDER]: 'bg-order text-white'
    };
    return domainColors[domain] || 'bg-gray-500 text-white';
  }

  getRarityColor(rarity: string): string {
    const rarityColors: Record<string, string> = {
      'COMMON': 'text-gray-600',
      'RARE': 'text-blue-600',
      'EPIC': 'text-purple-600',
      'LEGENDARY': 'text-amber-600'
    };
    return rarityColors[rarity] || 'text-gray-600';
  }

  goBack(): void {
    this.router.navigate(['/cards']);
  }
}
