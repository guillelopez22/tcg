import { Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { DbClient } from '@la-grieta/db';
import { collections, cards, decks, deckCards, cardPrices } from '@la-grieta/db';

export interface MissingCard {
  cardId: string;
  cardName: string;
  quantity: number;
  marketPrice: string | null;
  imageSmall: string | null;
}

export interface OwnedCard {
  cardId: string;
  cardName: string;
  quantity: number;
}

export interface DeckRecommendation {
  deckId: string;
  deckName: string;
  champion: string | null;
  championImageSmall: string | null;
  ownershipPct: number;
  ownedCards: OwnedCard[];
  missingCards: MissingCard[];
  synergyReasoning: string;
  domain: string | null;
}

@Injectable()
export class DeckRecommendationsService {
  constructor(
    private readonly db: DbClient,
    private readonly redis: Redis,
  ) {}

  async getRecommendations(userId: string): Promise<DeckRecommendation[]> {
    // Step 1: Get user's collection — distinct card IDs + domain info
    const userCollection = await this.db
      .select({
        cardId: collections.cardId,
        card_domain: cards.domain,
        card_description: cards.description,
      })
      .from(collections)
      .innerJoin(cards, eq(collections.cardId, cards.id))
      .where(eq(collections.userId, userId));

    const userCardIds = new Set(userCollection.map((c) => c.cardId));

    // Step 2: Get all public decks
    const publicDecks = await this.db
      .select({
        id: decks.id,
        name: decks.name,
        description: decks.description,
        coverCardId: decks.coverCardId,
        domain: decks.domain,
      })
      .from(decks)
      .where(eq(decks.isPublic, true));

    if (publicDecks.length === 0) {
      return [];
    }

    // Step 3: For each deck, fetch deck cards and compute scores
    const recommendations: DeckRecommendation[] = [];

    for (const deck of publicDecks) {
      // Get deck cards with card details
      const deckCardRows = await this.db
        .select({
          deckId: deckCards.deckId,
          cardId: deckCards.cardId,
          quantity: deckCards.quantity,
          card_id: cards.id,
          card_name: cards.name,
          card_domain: cards.domain,
          card_imageSmall: cards.imageSmall,
        })
        .from(deckCards)
        .innerJoin(cards, eq(deckCards.cardId, cards.id))
        .where(eq(deckCards.deckId, deck.id));

      if (deckCardRows.length === 0) continue;

      // Compute ownership
      const totalCards = deckCardRows.length;
      const ownedCardRows = deckCardRows.filter((dc) => userCardIds.has(dc.cardId));
      const missingCardRows = deckCardRows.filter((dc) => !userCardIds.has(dc.cardId));
      const ownershipPct = totalCards > 0 ? Math.round((ownedCardRows.length / totalCards) * 100) : 0;

      // Get market prices for missing cards
      let missingCardPrices: Array<{
        cardId: string;
        card_name: string;
        card_imageSmall: string | null;
        marketPrice: string | null;
        foilMarketPrice: string | null;
      }> = [];

      if (missingCardRows.length > 0) {
        const missingCardIds = missingCardRows.map((dc) => dc.cardId);
        missingCardPrices = await this.db
          .select({
            cardId: cardPrices.cardId,
            card_name: cards.name,
            card_imageSmall: cards.imageSmall,
            marketPrice: cardPrices.marketPrice,
            foilMarketPrice: cardPrices.foilMarketPrice,
          })
          .from(cardPrices)
          .innerJoin(cards, eq(cardPrices.cardId, cards.id))
          .where(inArray(cardPrices.cardId, missingCardIds));
      }

      const priceByCardId = new Map(missingCardPrices.map((p) => [p.cardId, p]));

      const missingCards: MissingCard[] = missingCardRows.map((dc) => {
        const priceRow = priceByCardId.get(dc.cardId);
        return {
          cardId: dc.cardId,
          cardName: dc.card_name,
          quantity: dc.quantity,
          marketPrice: priceRow?.marketPrice ?? null,
          imageSmall: dc.card_imageSmall,
        };
      });

      const ownedCards: OwnedCard[] = ownedCardRows.map((dc) => ({
        cardId: dc.cardId,
        cardName: dc.card_name,
        quantity: dc.quantity,
      }));

      // Synergy scoring
      const synergyScore = this.computeSynergyScore(deck, userCollection, deckCardRows);
      const compositeScore = ownershipPct * 0.7 + synergyScore * 0.3;

      // Get champion image from cover card
      const championRow = deckCardRows.find((dc) => dc.cardId === deck.coverCardId);
      const championImageSmall = championRow?.card_imageSmall ?? null;

      const synergyReasoning = this.generateSynergyReasoning(deck, userCollection, deckCardRows, ownershipPct);

      recommendations.push({
        deckId: deck.id,
        deckName: deck.name,
        champion: deck.name,
        championImageSmall,
        ownershipPct,
        ownedCards,
        missingCards,
        synergyReasoning,
        domain: deck.domain,
        _compositeScore: compositeScore,
      } as DeckRecommendation & { _compositeScore: number });
    }

    // Sort by composite score (ownership + synergy) descending
    (recommendations as Array<DeckRecommendation & { _compositeScore?: number }>).sort(
      (a, b) => ((b as { _compositeScore?: number })._compositeScore ?? b.ownershipPct) - ((a as { _compositeScore?: number })._compositeScore ?? a.ownershipPct),
    );

    // Remove internal score field and return top 5
    return recommendations.slice(0, 5).map(({ _compositeScore: _, ...rec }) => rec as DeckRecommendation);
  }

  private computeSynergyScore(
    deck: { domain: string | null; description: string | null },
    userCollection: Array<{ cardId: string; card_domain: string | null; card_description: string | null }>,
    deckCardRows: Array<{ cardId: string; card_domain: string | null }>,
  ): number {
    if (userCollection.length === 0) return 0;

    // Count user cards matching deck's domain
    const deckDomain = deck.domain;
    const userDomainCards = userCollection.filter((c) => c.card_domain === deckDomain).length;
    const domainSynergyPct = Math.min(userDomainCards / Math.max(userCollection.length, 1), 1);

    // Keyword synergy: look for shared keywords in descriptions
    const deckKeywords = new Set<string>();
    const KEYWORDS = ['ACCELERATE', 'ASSAULT', 'VIGILANCE', 'DRAIN', 'HEAL', 'OVERWHELM', 'MULTIATTACK', 'BARRIER'];
    for (const card of deckCardRows) {
      // We don't have descriptions here, just use domain synergy
    }

    return Math.round(domainSynergyPct * 100);
  }

  private generateSynergyReasoning(
    deck: { name: string; domain: string | null; description: string | null },
    userCollection: Array<{ cardId: string; card_domain: string | null; card_description: string | null }>,
    deckCardRows: Array<{ cardId: string; card_domain: string | null }>,
    ownershipPct: number,
  ): string {
    const deckDomain = deck.domain ?? 'multi-domain';
    const domainCount = userCollection.filter((c) => c.card_domain === deck.domain).length;
    const totalUserCards = userCollection.length;

    if (ownershipPct === 100) {
      return `You already own all the cards for this deck! ${deck.name} is ready to play.`;
    }

    if (domainCount > 0 && totalUserCards > 0) {
      const domainPct = Math.round((domainCount / totalUserCards) * 100);
      return `${domainPct}% of your collection (${domainCount} cards) share the ${deckDomain} domain with this deck. You own ${ownershipPct}% of the cards needed — a great match for your collection.`;
    }

    if (ownershipPct > 0) {
      return `You already own ${ownershipPct}% of the cards needed for ${deck.name}. Building this deck would require a small investment.`;
    }

    return `${deck.name} is a competitive ${deckDomain} deck. While you don't own any of its cards yet, it represents an exciting deck-building goal.`;
  }
}
