import { Injectable } from '@nestjs/common';
import { DeckStatsResponse } from '@la-grieta/shared';

interface CardForStats {
  id: string;
  cardId: string;
  quantity: number;
  zone: string;
  card: {
    id: string;
    name: string;
    cardType: string;
    domains: string[];
    energyCost?: number;
    marketPrice?: number;
  };
}

@Injectable()
export class DeckStatsService {
  /**
   * Calculate comprehensive statistics for a deck
   */
  calculateStats(cards: CardForStats[]): DeckStatsResponse {
    const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);

    const cardsByZone = this.calculateCardsByZone(cards);
    const cardsByType = this.calculateCardsByType(cards);
    const domainDistribution = this.calculateDomainDistribution(cards);
    const manaCurve = this.calculateManaCurve(cards);
    const estimatedValue = this.calculateEstimatedValue(cards);

    return {
      totalCards,
      cardsByZone,
      cardsByType,
      domainDistribution,
      manaCurve,
      estimatedValue,
    };
  }

  /**
   * Count cards by zone
   */
  private calculateCardsByZone(cards: CardForStats[]): {
    MAIN: number;
    RUNE: number;
    BATTLEFIELD: number;
  } {
    const zones = {
      MAIN: 0,
      RUNE: 0,
      BATTLEFIELD: 0,
    };

    cards.forEach((card) => {
      if (zones[card.zone] !== undefined) {
        zones[card.zone] += card.quantity;
      }
    });

    return zones;
  }

  /**
   * Count cards by card type
   */
  private calculateCardsByType(cards: CardForStats[]): Record<string, number> {
    const types: Record<string, number> = {};

    cards.forEach((card) => {
      const type = card.card.cardType;
      types[type] = (types[type] || 0) + card.quantity;
    });

    return types;
  }

  /**
   * Calculate domain distribution
   * Note: Cards can have multiple domains, so we count each occurrence
   */
  private calculateDomainDistribution(cards: CardForStats[]): Record<string, number> {
    const domains: Record<string, number> = {};

    cards.forEach((card) => {
      card.card.domains.forEach((domain) => {
        domains[domain] = (domains[domain] || 0) + card.quantity;
      });
    });

    return domains;
  }

  /**
   * Calculate mana curve (energy cost distribution)
   */
  private calculateManaCurve(cards: CardForStats[]): Record<number, number> {
    const curve: Record<number, number> = {};

    cards.forEach((card) => {
      // Use energyCost if available, otherwise categorize as 0
      const cost = card.card.energyCost ?? 0;

      curve[cost] = (curve[cost] || 0) + card.quantity;
    });

    return curve;
  }

  /**
   * Calculate total estimated market value
   */
  private calculateEstimatedValue(cards: CardForStats[]): number {
    const total = cards.reduce((sum, card) => {
      const price = card.card.marketPrice || 0;
      return sum + price * card.quantity;
    }, 0);

    // Round to 2 decimal places
    return Math.round(total * 100) / 100;
  }
}
