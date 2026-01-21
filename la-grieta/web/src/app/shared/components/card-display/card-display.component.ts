import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { Card, Domain } from '@la-grieta/shared';

@Component({
  selector: 'lg-card-display',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule],
  templateUrl: './card-display.component.html',
  styleUrl: './card-display.component.scss'
})
export class CardDisplayComponent {
  @Input({ required: true }) card!: Card;
  @Output() cardClick = new EventEmitter<Card>();

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

  onClick(): void {
    this.cardClick.emit(this.card);
  }
}
