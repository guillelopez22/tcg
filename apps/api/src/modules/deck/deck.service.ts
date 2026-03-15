import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, and, gt, ilike, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { decks, deckCards, cards, users, collections, deckShareCodes } from '@la-grieta/db';
import type { Deck, DeckCard } from '@la-grieta/db';
import type {
  DeckListInput,
  DeckGetByIdInput,
  DeckCreateInput,
  DeckUpdateInput,
  DeckDeleteInput,
  DeckSetCardsInput,
  DeckBrowseInput,
} from '@la-grieta/shared';
import {
  buildPaginatedResult,
  escapeLike,
  validateDeckFormat,
  getZoneForCardType,
} from '@la-grieta/shared';
import type { PaginatedResult } from '@la-grieta/shared';
import { DeckValidationService } from './deck-validation.service';

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
    private readonly validation: DeckValidationService,
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

    let rows: DeckWithCover[] = flatRows.map((r) => ({
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

    // Backfill: for decks missing a coverCard, find their Legend card
    const missingCoverIds = rows.filter((r) => !r.coverCard).map((r) => r.id);
    if (missingCoverIds.length > 0) {
      const legendRows = await this.db
        .select({
          deckId: deckCards.deckId,
          cardId: cards.id,
          cardName: cards.name,
          cleanName: cards.cleanName,
          imageSmall: cards.imageSmall,
          domain: cards.domain,
        })
        .from(deckCards)
        .innerJoin(cards, and(eq(deckCards.cardId, cards.id), eq(cards.cardType, 'Legend')))
        .where(and(
          inArray(deckCards.deckId, missingCoverIds),
          sql`${deckCards.zone} IN ('legend', 'champion')`,
        ));

      const legendMap = new Map(legendRows.map((r) => [r.deckId, r]));

      rows = rows.map((row) => {
        if (row.coverCard) return row;
        const legend = legendMap.get(row.id);
        if (!legend) return row;
        // Also persist the fix so it doesn't re-query next time
        void this.db.update(decks).set({
          coverCardId: legend.cardId,
          domain: row.domain ?? (legend.domain?.split(';')[0] ?? null),
        }).where(eq(decks.id, row.id));
        return {
          ...row,
          coverCard: { id: legend.cardId, name: legend.cardName, cleanName: legend.cleanName, imageSmall: legend.imageSmall },
          domain: row.domain ?? (legend.domain?.split(';')[0] ?? null),
        };
      });
    }

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
      this.validation.validateCardEntriesBasic(input.cards);
      await this.validation.validateCardIdsExist(input.cards);
    }

    // Compute status from format validation if cards provided
    // Correct zones for fixed-zone card types before validation
    let status: string = 'draft';
    let autoCoverCardId: string | null = null;
    let autoDomain: string | null = null;
    let correctedCreateCards: Array<{ cardId: string; quantity: number; zone: string }> | undefined;
    if (input.cards && input.cards.length > 0) {
      const cardTypeMap = await this.validation.buildCardTypeMap(input.cards.map((c) => c.cardId));
      correctedCreateCards = input.cards.map((c) => {
        const derivedZone = getZoneForCardType(cardTypeMap.get(c.cardId) ?? null);
        return {
          cardId: c.cardId,
          quantity: c.quantity,
          zone: derivedZone !== 'main' ? derivedZone : (c.zone ?? 'main'),
        };
      });
      const errors = validateDeckFormat(correctedCreateCards, cardTypeMap);
      status = errors.length === 0 ? 'complete' : 'draft';

      // Auto-detect coverCardId and domain from Legend card if not provided
      if (!input.coverCardId) {
        const legendCardId = input.cards.find((c) => cardTypeMap.get(c.cardId) === 'Legend')?.cardId;
        if (legendCardId) {
          autoCoverCardId = legendCardId;
          const [legendRow] = await this.db
            .select({ domain: cards.domain })
            .from(cards)
            .where(eq(cards.id, legendCardId))
            .limit(1);
          if (legendRow?.domain) {
            autoDomain = legendRow.domain.split(';')[0] ?? null;
          }
        }
      }
    }

    const [created] = await this.db
      .insert(decks)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        isPublic: input.isPublic ?? false,
        coverCardId: input.coverCardId ?? autoCoverCardId,
        domain: autoDomain ?? undefined,
        status,
      })
      .returning();

    if (!created) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create deck' });
    }

    if (correctedCreateCards && correctedCreateCards.length > 0) {
      try {
        await this.db.insert(deckCards).values(
          correctedCreateCards.map((c) => ({
            deckId: created.id,
            cardId: c.cardId,
            quantity: c.quantity,
            zone: c.zone,
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

  /**
   * Re-validate all decks, fix bad data, and update status.
   * Fixes: signature cards with qty > 1, missing champion zone assignment.
   */
  async revalidateAllStatuses(): Promise<{ updated: number; fixed: number }> {
    const allDecks = await this.db
      .select({ id: decks.id })
      .from(decks);

    let updated = 0;
    let fixed = 0;
    for (const deck of allDecks) {
      const cardRows = await this.db
        .select({
          cardId: deckCards.cardId,
          quantity: deckCards.quantity,
          zone: deckCards.zone,
        })
        .from(deckCards)
        .where(eq(deckCards.deckId, deck.id));

      if (cardRows.length === 0) continue;

      const cardTypeMap = await this.validation.buildCardTypeMap(cardRows.map((c) => c.cardId));

      // Fix missing champion zone: if no champion zone entry, promote first Champion Unit
      const hasChampionZone = cardRows.some((r) => r.zone === 'champion');
      if (!hasChampionZone) {
        const champRow = cardRows.find((r) => cardTypeMap.get(r.cardId) === 'Champion Unit');
        if (champRow) {
          if (champRow.quantity > 1) {
            // Split: 1 to champion, rest stay in main
            await this.db
              .update(deckCards)
              .set({ quantity: champRow.quantity - 1 })
              .where(and(eq(deckCards.deckId, deck.id), eq(deckCards.cardId, champRow.cardId), eq(deckCards.zone, champRow.zone)));
            await this.db
              .insert(deckCards)
              .values({ deckId: deck.id, cardId: champRow.cardId, quantity: 1, zone: 'champion' });
          } else {
            await this.db
              .update(deckCards)
              .set({ zone: 'champion' })
              .where(and(eq(deckCards.deckId, deck.id), eq(deckCards.cardId, champRow.cardId), eq(deckCards.zone, champRow.zone)));
          }
          fixed++;
        }
      }

      // Re-read after fixes and validate
      const fixedRows = await this.db
        .select({ cardId: deckCards.cardId, quantity: deckCards.quantity, zone: deckCards.zone })
        .from(deckCards)
        .where(eq(deckCards.deckId, deck.id));
      const errors = validateDeckFormat(fixedRows, cardTypeMap);
      const newStatus = errors.length === 0 ? 'complete' : 'draft';

      await this.db
        .update(decks)
        .set({ status: newStatus })
        .where(eq(decks.id, deck.id));

      updated++;
    }

    return { updated, fixed };
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

    this.validation.validateCardEntriesBasic(input.cards);

    if (input.cards.length > 0) {
      await this.validation.validateCardIdsExist(input.cards);
    }

    // Compute status from validateDeckFormat
    // Also correct zones: fixed-zone card types (Legend, Champion Unit, Rune, Battlefield)
    // must always be stored in their canonical zone regardless of what the client sends.
    let status: string = 'draft';
    let correctedCards = input.cards.map((c) => ({
      cardId: c.cardId,
      quantity: c.quantity,
      zone: c.zone ?? 'main',
    }));

    if (correctedCards.length > 0) {
      const cardTypeMap = await this.validation.buildCardTypeMap(correctedCards.map((c) => c.cardId));
      correctedCards = correctedCards.map((c) => {
        const derivedZone = getZoneForCardType(cardTypeMap.get(c.cardId) ?? null);
        return {
          ...c,
          zone: derivedZone !== 'main' ? derivedZone : c.zone,
        };
      });
      const errors = validateDeckFormat(correctedCards, cardTypeMap);
      status = errors.length === 0 ? 'complete' : 'draft';
    }

    try {
      await this.db.transaction(async (tx) => {
        await tx.delete(deckCards).where(eq(deckCards.deckId, input.deckId));

        if (correctedCards.length > 0) {
          await tx.insert(deckCards).values(
            correctedCards.map((c) => ({
              deckId: input.deckId,
              cardId: c.cardId,
              quantity: c.quantity,
              zone: c.zone,
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

    if (input.championName) {
      const escapedName = escapeLike(input.championName);
      conditions.push(
        sql`${decks.id} IN (
          SELECT dc.deck_id FROM deck_cards dc
          INNER JOIN cards c ON dc.card_id = c.id
          WHERE (dc.zone = 'legend' OR dc.zone = 'champion')
          AND c.clean_name ILIKE ${`%${escapedName}%`}
        )`,
      );
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

  async resolveShareCode(code: string): Promise<DeckWithCards> {
    const [row] = await this.db
      .select({ deckId: deckShareCodes.deckId })
      .from(deckShareCodes)
      .where(eq(deckShareCodes.code, code))
      .limit(1);

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck no longer available' });
    }

    return this.getById(null, { id: row.deckId });
  }
}
