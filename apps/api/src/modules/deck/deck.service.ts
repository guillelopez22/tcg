import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, and, gt, ilike, inArray } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { decks, deckCards, cards, users } from '@la-grieta/db';
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
import { buildPaginatedResult, escapeLike, MAX_COPIES_PER_CARD as SHARED_MAX_COPIES } from '@la-grieta/shared';
import type { PaginatedResult } from '@la-grieta/shared';

export type DeckCardWithCard = DeckCard & {
  card: {
    id: string;
    name: string;
    cleanName: string;
    rarity: string;
    cardType: string | null;
    domain: string | null;
    imageSmall: string | null;
    imageLarge: string | null;
  };
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

const MAX_DECK_CARDS = 61; // 40 main + 12 runes + 1 champion + 8 sideboard
const MAX_COPIES_PER_CARD = SHARED_MAX_COPIES; // 3 — Riftbound official limit

@Injectable()
export class DeckService {
  constructor(private readonly db: DbClient) {}

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
      this.validateCardEntries(input.cards);
      await this.validateCardIdsExist(input.cards);
    }

    const [created] = await this.db
      .insert(decks)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        isPublic: input.isPublic ?? false,
        coverCardId: input.coverCardId ?? null,
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

    this.validateCardEntries(input.cards);

    if (input.cards.length > 0) {
      await this.validateCardIdsExist(input.cards);
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
            })),
          );
        }
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

  private validateCardEntries(cardEntries: Array<{ cardId: string; quantity: number }>): void {
    const cardMap = new Map<string, number>();
    for (const entry of cardEntries) {
      const current = cardMap.get(entry.cardId) ?? 0;
      cardMap.set(entry.cardId, current + entry.quantity);
    }

    for (const [cardId, totalQty] of cardMap.entries()) {
      if (totalQty > MAX_COPIES_PER_CARD) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot have more than ${MAX_COPIES_PER_CARD} copies of card ${cardId}`,
        });
      }
    }

    const totalCards = [...cardMap.values()].reduce((sum, q) => sum + q, 0);
    if (totalCards > MAX_DECK_CARDS) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Deck cannot exceed ${MAX_DECK_CARDS} cards`,
      });
    }
  }
}
