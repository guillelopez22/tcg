import { Injectable, Inject } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, and, gt, ilike, inArray, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { DbClient } from '@la-grieta/db';
import { decks, deckCards, cards, users, collections } from '@la-grieta/db';
import type { Deck, DeckCard } from '@la-grieta/db';
import type {
  DeckListInput,
  DeckGetByIdInput,
  DeckCreateInput,
  DeckUpdateInput,
  DeckDeleteInput,
  DeckSetCardsInput,
  DeckBrowseInput,
  DeckSuggestInput,
} from '@la-grieta/shared';
import {
  buildPaginatedResult,
  escapeLike,
  validateDeckFormat,
  MAX_COPIES_PER_CARD,
  RUNE_DECK_SIZE,
  SIGNATURE_TYPES,
  getZoneForCardType,
} from '@la-grieta/shared';
import type { PaginatedResult } from '@la-grieta/shared';

export type DeckCardWithCard = DeckCard & {
  card: {
    id: string;
    name: string;
    cleanName: string;
    rarity: string;
    cardType: string | null;
    domain: string | null;
    energyCost: number | null;
    imageSmall: string | null;
    imageLarge: string | null;
  };
  zone: string;
};

export type DeckWithCards = Deck & { cards: DeckCardWithCard[] };

export type CoverCard = {
  id: string;
  name: string | null;
  cleanName: string | null;
  imageSmall: string | null;
};

export type DeckWithCover = Deck & {
  coverCard: CoverCard | null;
};

export type DeckWithCreator = Deck & {
  user: {
    username: string;
    displayName: string | null;
  };
  coverCard: CoverCard | null;
};

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

export type BuildabilityResult = {
  owned: number;
  total: number;
  pct: number;
  missingCardIds: string[];
};

@Injectable()
export class DeckService {
  constructor(
    private readonly db: DbClient,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async list(userId: string, input: DeckListInput): Promise<PaginatedResult<DeckWithCover>> {
    const conditions = [eq(decks.userId, userId)];

    if (input.cursor) {
      conditions.push(gt(decks.id, input.cursor));
    }

    const flatRows = await this.db
      .select({
        id: decks.id,
        userId: decks.userId,
        name: decks.name,
        description: decks.description,
        coverCardId: decks.coverCardId,
        isPublic: decks.isPublic,
        domain: decks.domain,
        tier: decks.tier,
        status: decks.status,
        createdAt: decks.createdAt,
        updatedAt: decks.updatedAt,
        cover_id: cards.id,
        cover_name: cards.name,
        cover_cleanName: cards.cleanName,
        cover_imageSmall: cards.imageSmall,
      })
      .from(decks)
      .leftJoin(cards, eq(decks.coverCardId, cards.id))
      .where(and(...conditions))
      .orderBy(decks.id)
      .limit(input.limit + 1);

    const rows: DeckWithCover[] = flatRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      description: r.description,
      coverCardId: r.coverCardId,
      isPublic: r.isPublic,
      domain: r.domain,
      tier: r.tier,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      coverCard: r.cover_id
        ? { id: r.cover_id, name: r.cover_name, cleanName: r.cover_cleanName, imageSmall: r.cover_imageSmall }
        : null,
    }));

    return buildPaginatedResult(rows, input.limit);
  }

  async getById(userId: string | null, input: DeckGetByIdInput): Promise<DeckWithCards> {
    const [deck] = await this.db
      .select()
      .from(decks)
      .where(eq(decks.id, input.id))
      .limit(1);

    if (!deck) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
    }

    if (!deck.isPublic && deck.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'This deck is private' });
    }

    const cardRows = await this.db
      .select({
        id: deckCards.id,
        deckId: deckCards.deckId,
        cardId: deckCards.cardId,
        quantity: deckCards.quantity,
        zone: deckCards.zone,
        createdAt: deckCards.createdAt,
        updatedAt: deckCards.updatedAt,
        card: {
          id: cards.id,
          name: cards.name,
          cleanName: cards.cleanName,
          rarity: cards.rarity,
          cardType: cards.cardType,
          domain: cards.domain,
          energyCost: cards.energyCost,
          imageSmall: cards.imageSmall,
          imageLarge: cards.imageLarge,
        },
      })
      .from(deckCards)
      .innerJoin(cards, eq(deckCards.cardId, cards.id))
      .where(eq(deckCards.deckId, deck.id))
      .orderBy(deckCards.id);

    return { ...deck, cards: cardRows } as DeckWithCards;
  }

  async create(userId: string, input: DeckCreateInput): Promise<DeckWithCards> {
    if (input.cards && input.cards.length > 0) {
      this.validateCardEntriesBasic(input.cards);
      await this.validateCardIdsExist(input.cards);
    }

    // Compute status from format validation if cards provided
    let status: string = 'draft';
    if (input.cards && input.cards.length > 0) {
      const cardTypeMap = await this.buildCardTypeMap(input.cards.map((c) => c.cardId));
      const entries = input.cards.map((c) => ({
        cardId: c.cardId,
        quantity: c.quantity,
        zone: c.zone ?? 'main',
      }));
      const errors = validateDeckFormat(entries, cardTypeMap);
      status = errors.length === 0 ? 'complete' : 'draft';
    }

    const [created] = await this.db
      .insert(decks)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        isPublic: input.isPublic ?? false,
        coverCardId: input.coverCardId ?? null,
        status,
      })
      .returning();

    if (!created) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create deck' });
    }

    if (input.cards && input.cards.length > 0) {
      try {
        await this.db.insert(deckCards).values(
          input.cards.map((c) => ({
            deckId: created.id,
            cardId: c.cardId,
            quantity: c.quantity,
            zone: c.zone ?? 'main',
          })),
        );
      } catch (err) {
        // Clean up the created deck if card insert fails due to FK violation
        await this.db.delete(decks).where(eq(decks.id, created.id));
        if (
          err instanceof Error &&
          err.message.includes('violates foreign key constraint') &&
          err.message.includes('deck_cards_card_id_cards_id_fk')
        ) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One or more card IDs do not exist',
          });
        }
        throw err;
      }
    }

    return this.getById(userId, { id: created.id });
  }

  async update(userId: string, input: DeckUpdateInput): Promise<Deck> {
    const [existing] = await this.db
      .select({ id: decks.id, userId: decks.userId })
      .from(decks)
      .where(eq(decks.id, input.id))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this deck' });
    }

    const updateData: Partial<typeof decks.$inferInsert> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;
    if (input.coverCardId !== undefined) updateData.coverCardId = input.coverCardId;

    if (Object.keys(updateData).length === 0) {
      const [deck] = await this.db.select().from(decks).where(eq(decks.id, input.id)).limit(1);
      return deck!;
    }

    const [updated] = await this.db
      .update(decks)
      .set(updateData)
      .where(eq(decks.id, input.id))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update deck' });
    }

    return updated;
  }

  async delete(userId: string, input: DeckDeleteInput): Promise<void> {
    const [existing] = await this.db
      .select({ id: decks.id, userId: decks.userId })
      .from(decks)
      .where(eq(decks.id, input.id))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this deck' });
    }

    await this.db.delete(decks).where(eq(decks.id, input.id));
  }

  async setCards(userId: string, input: DeckSetCardsInput): Promise<DeckWithCards> {
    const [existing] = await this.db
      .select({ id: decks.id, userId: decks.userId })
      .from(decks)
      .where(eq(decks.id, input.deckId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this deck' });
    }

    this.validateCardEntriesBasic(input.cards);

    if (input.cards.length > 0) {
      await this.validateCardIdsExist(input.cards);
    }

    // Compute status from validateDeckFormat
    let status: string = 'draft';
    if (input.cards.length > 0) {
      const cardTypeMap = await this.buildCardTypeMap(input.cards.map((c) => c.cardId));
      const entries = input.cards.map((c) => ({
        cardId: c.cardId,
        quantity: c.quantity,
        zone: c.zone ?? 'main',
      }));
      const errors = validateDeckFormat(entries, cardTypeMap);
      status = errors.length === 0 ? 'complete' : 'draft';
    }

    try {
      await this.db.transaction(async (tx) => {
        await tx.delete(deckCards).where(eq(deckCards.deckId, input.deckId));

        if (input.cards.length > 0) {
          await tx.insert(deckCards).values(
            input.cards.map((c) => ({
              deckId: input.deckId,
              cardId: c.cardId,
              quantity: c.quantity,
              zone: c.zone ?? 'main',
            })),
          );
        }

        await tx.update(decks).set({ status }).where(eq(decks.id, input.deckId));
      });
    } catch (err) {
      // Catch FK violation in case a card ID was deleted between validation and insert
      if (
        err instanceof Error &&
        err.message.includes('violates foreign key constraint') &&
        err.message.includes('deck_cards_card_id_cards_id_fk')
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or more card IDs do not exist',
        });
      }
      throw err;
    }

    return this.getById(userId, { id: input.deckId });
  }

  async browse(input: DeckBrowseInput): Promise<PaginatedResult<DeckWithCreator>> {
    const conditions = [eq(decks.isPublic, true)];

    if (input.domain) {
      conditions.push(ilike(decks.domain, `%${escapeLike(input.domain)}%`));
    }

    if (input.search) {
      conditions.push(ilike(decks.name, `%${escapeLike(input.search)}%`));
    }

    if (input.cursor) {
      conditions.push(gt(decks.id, input.cursor));
    }

    const flatRows = await this.db
      .select({
        // Deck fields
        id: decks.id,
        userId: decks.userId,
        name: decks.name,
        description: decks.description,
        coverCardId: decks.coverCardId,
        isPublic: decks.isPublic,
        domain: decks.domain,
        tier: decks.tier,
        status: decks.status,
        createdAt: decks.createdAt,
        updatedAt: decks.updatedAt,
        // Creator fields (safe subset only — no email, passwordHash, whatsappPhone, etc.)
        user_username: users.username,
        user_displayName: users.displayName,
        // Cover card fields
        cover_id: cards.id,
        cover_name: cards.name,
        cover_cleanName: cards.cleanName,
        cover_imageSmall: cards.imageSmall,
      })
      .from(decks)
      .innerJoin(users, eq(decks.userId, users.id))
      .leftJoin(cards, eq(decks.coverCardId, cards.id))
      .where(and(...conditions))
      .orderBy(decks.id)
      .limit(input.limit + 1);

    const rows: DeckWithCreator[] = flatRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      description: r.description,
      coverCardId: r.coverCardId,
      isPublic: r.isPublic,
      domain: r.domain,
      tier: r.tier,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: {
        username: r.user_username,
        displayName: r.user_displayName,
      },
      coverCard: r.cover_id
        ? { id: r.cover_id, name: r.cover_name, cleanName: r.cover_cleanName, imageSmall: r.cover_imageSmall }
        : null,
    }));

    return buildPaginatedResult(rows, input.limit);
  }

  async getBuildability(userId: string, deckId: string): Promise<BuildabilityResult> {
    // Load deck cards with quantities
    const deckCardRows = await this.db
      .select({
        cardId: deckCards.cardId,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .where(eq(deckCards.deckId, deckId));

    if (deckCardRows.length === 0) {
      return { owned: 0, total: 0, pct: 100, missingCardIds: [] };
    }

    // Load user's collection grouped by cardId (count of copies owned)
    const collectionRows = await this.db
      .select({
        cardId: collections.cardId,
        owned: sql<number>`count(*)::int`,
      })
      .from(collections)
      .where(eq(collections.userId, userId))
      .groupBy(collections.cardId);

    const ownedMap = new Map<string, number>(
      collectionRows.map((r) => [r.cardId, r.owned]),
    );

    const missingCardIds: string[] = [];
    let owned = 0;
    const total = deckCardRows.length;

    for (const entry of deckCardRows) {
      const ownedCount = ownedMap.get(entry.cardId) ?? 0;
      if (ownedCount >= entry.quantity) {
        owned++;
      } else {
        missingCardIds.push(entry.cardId);
      }
    }

    const pct = total > 0 ? Math.round((owned / total) * 100) : 100;

    return { owned, total, pct, missingCardIds };
  }

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

    // Derive allowed domains from the champion's dual-domain (e.g. "Fury;Chaos" → ["Fury","Chaos"])
    const championEntry = existingDeckCards.find((dc) => dc.zone === 'champion');
    const championDomain = championEntry?.card_domain ?? null; // e.g. "Fury;Chaos"
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
    if (championEntry) {
      const trendingDeckRows = await this.db
        .select({ cardId: deckCards.cardId })
        .from(deckCards)
        .innerJoin(decks, eq(deckCards.deckId, decks.id))
        .where(
          and(
            eq(decks.isPublic, true),
            // Find decks that also contain this champion
            sql`${deckCards.deckId} IN (
              SELECT deck_id FROM deck_cards WHERE card_id = ${championEntry.cardId} AND zone = 'champion'
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
        return ['Unit', 'Champion Unit', 'Spell', 'Gear', 'Signature Unit', 'Signature Spell', 'Signature Gear'];
      case 'rune':
        return ['Rune'];
      case 'champion':
        return ['Legend'];
      case 'sideboard':
        return ['Unit', 'Champion Unit', 'Spell', 'Gear'];
      default:
        return ['Unit', 'Champion Unit', 'Spell', 'Gear'];
    }
  }

  private async buildCardTypeMap(cardIds: string[]): Promise<Map<string, string | null>> {
    const uniqueIds = [...new Set(cardIds)];
    const rows = await this.db
      .select({ id: cards.id, cardType: cards.cardType })
      .from(cards)
      .where(inArray(cards.id, uniqueIds));
    return new Map(rows.map((r) => [r.id, r.cardType]));
  }

  private async validateCardIdsExist(
    cardEntries: Array<{ cardId: string; quantity: number }>,
  ): Promise<void> {
    const cardIds = [...new Set(cardEntries.map((c) => c.cardId))];
    const existingCards = await this.db
      .select({ id: cards.id })
      .from(cards)
      .where(inArray(cards.id, cardIds));

    const foundIds = new Set(existingCards.map((c) => c.id));
    const missing = cardIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Cards not found: ${missing.join(', ')}`,
      });
    }
  }

  private validateCardEntriesBasic(cardEntries: Array<{ cardId: string; quantity: number; zone?: string }>): void {
    // Basic sanity check — per-card quantity cap.
    // Rune cards can legitimately have up to RUNE_DECK_SIZE (12) copies,
    // and old data may not have correct zone values, so we use the higher
    // bound here. Full zone-specific limits are enforced by validateDeckFormat.
    for (const entry of cardEntries) {
      if (entry.quantity > RUNE_DECK_SIZE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot have more than ${RUNE_DECK_SIZE} copies of a single card`,
        });
      }
    }
  }
}
