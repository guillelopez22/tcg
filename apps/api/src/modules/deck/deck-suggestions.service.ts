import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { DbClient } from '@la-grieta/db';
import { cards, decks, deckCards, collections } from '@la-grieta/db';
import type { DeckSuggestInput } from '@la-grieta/shared';

export type SuggestedCard = {
  cardId: string;
  card: {
    id: string;
    name: string;
    cleanName: string;
    rarity: string;
    cardType: string | null;
    domain: string | null;
    energyCost: number | null;
    imageSmall: string | null;
    keywords: string[] | null;
  };
  score: number;
  reasonTag: string;
  reasonDetail: string;
  owned: boolean;
};

@Injectable()
export class DeckSuggestionsService {
  constructor(
    private readonly db: DbClient,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async suggest(userId: string, input: DeckSuggestInput): Promise<SuggestedCard[]> {
    const cacheKey = `deck:suggest:${input.deckId}:${input.mode}:${input.zone}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SuggestedCard[];
    }

    // Load current deck cards to understand what's already in the deck
    const existingDeckCards = await this.db
      .select({
        cardId: deckCards.cardId,
        quantity: deckCards.quantity,
        zone: deckCards.zone,
        card_domain: cards.domain,
        card_energyCost: cards.energyCost,
        card_keywords: cards.keywords,
        card_cardType: cards.cardType,
      })
      .from(deckCards)
      .innerJoin(cards, eq(deckCards.cardId, cards.id))
      .where(eq(deckCards.deckId, input.deckId));

    // Derive allowed domains from the legend's dual-domain (e.g. "Fury;Chaos" → ["Fury","Chaos"])
    const legendEntry = existingDeckCards.find((dc) => dc.zone === 'legend');
    const championEntry = existingDeckCards.find((dc) => dc.zone === 'champion');
    const championDomain = legendEntry?.card_domain ?? championEntry?.card_domain ?? null;
    const allowedDomains = championDomain ? championDomain.split(';') : [];

    // Compute energy curve of existing deck (for gap analysis)
    const energyCurve = new Map<number, number>();
    for (const dc of existingDeckCards) {
      if (dc.zone === 'main' || dc.zone === 'sideboard') {
        const bucket = dc.card_energyCost ?? 0;
        energyCurve.set(bucket, (energyCurve.get(bucket) ?? 0) + dc.quantity);
      }
    }

    // Find the energy cost bucket with fewest cards (gap in curve)
    const curveBuckets = [0, 1, 2, 3, 4, 5, 6, 7];
    let minBucket = 0;
    let minCount = Infinity;
    for (const bucket of curveBuckets) {
      const count = energyCurve.get(bucket) ?? 0;
      if (count < minCount) {
        minCount = count;
        minBucket = bucket;
      }
    }

    // Gather existing deck keywords for synergy matching
    const deckKeywords = new Set<string>();
    for (const dc of existingDeckCards) {
      for (const kw of dc.card_keywords ?? []) {
        deckKeywords.add(kw);
      }
    }

    // Existing card IDs to exclude (already in deck for this zone)
    const existingCardIds = new Set(existingDeckCards.map((dc) => dc.cardId));

    // Determine which card types are valid for the requested zone
    const zoneTypeFilter = this.getCardTypesForZone(input.zone);

    // Load candidate cards from DB (filtered by appropriate card types)
    const candidateCards = await this.db
      .select({
        id: cards.id,
        name: cards.name,
        cleanName: cards.cleanName,
        rarity: cards.rarity,
        cardType: cards.cardType,
        domain: cards.domain,
        energyCost: cards.energyCost,
        imageSmall: cards.imageSmall,
        keywords: cards.keywords,
      })
      .from(cards)
      .where(
        and(
          inArray(cards.cardType, zoneTypeFilter),
          eq(cards.isProduct, false),
        ),
      );

    // Load user's collection for owned-card boost
    const userCollection = await this.db
      .select({ cardId: collections.cardId })
      .from(collections)
      .where(eq(collections.userId, userId));
    const ownedCardIds = new Set(userCollection.map((c) => c.cardId));

    // Load trending decks sharing the same champion for co-occurrence scoring
    const coOccurrenceCardIds = new Set<string>();
    const trendingLookupEntry = legendEntry ?? championEntry;
    if (trendingLookupEntry) {
      const trendingDeckRows = await this.db
        .select({ cardId: deckCards.cardId })
        .from(deckCards)
        .innerJoin(decks, eq(deckCards.deckId, decks.id))
        .where(
          and(
            eq(decks.isPublic, true),
            // Find decks that also contain this legend/champion
            sql`${deckCards.deckId} IN (
              SELECT deck_id FROM deck_cards WHERE card_id = ${trendingLookupEntry.cardId} AND (zone = 'legend' OR zone = 'champion')
            )`,
          ),
        );
      for (const row of trendingDeckRows) {
        coOccurrenceCardIds.add(row.cardId);
      }
    }

    // Score each candidate
    type ScoredCandidate = SuggestedCard & { _score: number };
    const scored: ScoredCandidate[] = [];

    const isSignatureType = (ct: string | null) =>
      ct === 'Signature Unit' || ct === 'Signature Spell' || ct === 'Signature Gear';

    for (const card of candidateCards) {
      // Skip cards already in this deck
      if (existingCardIds.has(card.id)) continue;

      // Hard domain filter — only suggest cards legal for this champion
      if (allowedDomains.length > 0) {
        if (isSignatureType(card.cardType)) {
          // Signature cards must match the champion's exact domain pair
          if (card.domain !== championDomain) continue;
        } else if (card.domain) {
          // Regular domain cards must belong to one of the champion's two domains (or be neutral)
          if (!allowedDomains.includes(card.domain)) continue;
        }
        // Neutral cards (domain is null) are always allowed
      }

      let score = 0;
      const signals: Array<{ signal: string; points: number }> = [];

      // Domain match: +3 if card domain matches one of the champion's domains
      if (allowedDomains.length > 0 && card.domain && allowedDomains.includes(card.domain)) {
        score += 3;
        signals.push({ signal: 'Domain match', points: 3 });
      }

      // Curve balance: +2 if fills a gap in energy curve
      if (card.energyCost === minBucket) {
        score += 2;
        signals.push({ signal: 'Curve filler', points: 2 });
      }

      // Co-occurrence: +2 if appears in trending decks with same champion
      if (coOccurrenceCardIds.has(card.id)) {
        score += 2;
        signals.push({ signal: 'Meta pick', points: 2 });
      }

      // Keyword synergy: +1 per matching keyword
      const cardKeywords = card.keywords ?? [];
      let keywordScore = 0;
      let matchedKeyword = '';
      for (const kw of cardKeywords) {
        if (deckKeywords.has(kw)) {
          keywordScore += 1;
          matchedKeyword = kw;
        }
      }
      if (keywordScore > 0) {
        score += keywordScore;
        signals.push({ signal: `Synergy: ${matchedKeyword}`, points: keywordScore });
      }

      // Owned first boost: +5
      const isOwned = ownedCardIds.has(card.id);
      if (input.mode === 'owned_first' && isOwned) {
        score += 5;
        signals.push({ signal: 'Owned', points: 5 });
      }

      // Pick the best reason tag from the highest-scoring signal
      const bestSignal = signals.sort((a, b) => b.points - a.points)[0];
      const reasonTag = bestSignal?.signal ?? 'Suggestion';
      const reasonDetail = signals.map((s) => `${s.signal} (+${s.points})`).join(', ') || 'General suggestion';

      scored.push({
        cardId: card.id,
        card: {
          id: card.id,
          name: card.name,
          cleanName: card.cleanName,
          rarity: card.rarity,
          cardType: card.cardType,
          domain: card.domain,
          energyCost: card.energyCost,
          imageSmall: card.imageSmall,
          keywords: card.keywords,
        },
        score,
        reasonTag,
        reasonDetail,
        owned: isOwned,
        _score: score,
      });
    }

    // Sort by score descending, take top 15
    scored.sort((a, b) => b._score - a._score);
    const results: SuggestedCard[] = scored.slice(0, 15).map(({ _score: _, ...rest }) => rest);

    // Cache for 10 minutes
    await this.redis.setex(cacheKey, 600, JSON.stringify(results));

    return results;
  }

  private getCardTypesForZone(zone: string): string[] {
    switch (zone) {
      case 'main':
        return ['Unit', 'Spell', 'Gear', 'Signature Unit', 'Signature Spell', 'Signature Gear'];
      case 'rune':
        return ['Rune'];
      case 'legend':
        return ['Legend'];
      case 'champion':
        return ['Champion Unit'];
      case 'battlefield':
        return ['Battlefield'];
      case 'sideboard':
        return ['Unit', 'Spell', 'Gear'];
      default:
        return ['Unit', 'Spell', 'Gear'];
    }
  }
}
