import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, and, gt, desc } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { DbClient } from '@la-grieta/db';
import { wishlists, cards, sets, cardPrices } from '@la-grieta/db';
import type { Wishlist } from '@la-grieta/db';
import type { WishlistToggleInput, WishlistUpdateInput, WishlistListInput } from '@la-grieta/shared';
import { buildPaginatedResult } from '@la-grieta/shared';
import type { PaginatedResult } from '@la-grieta/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WishlistCard {
  id: string;
  name: string;
  imageSmall: string | null;
  imageLarge: string | null;
  rarity: string | null;
  setId: string;
  setSlug: string;
  setName: string;
  marketPrice: string | null;
}

export type WishlistEntryWithCard = Wishlist & {
  card: WishlistCard;
};

export interface WishlistForCardResult {
  onWantlist: boolean;
  onTradelist: boolean;
  wantEntry?: Wishlist;
  tradeEntry?: Wishlist;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class WishlistService {
  constructor(
    private readonly db: DbClient,
    private readonly redis: Redis,
  ) {}

  async toggle(
    userId: string,
    input: WishlistToggleInput,
  ): Promise<{ added: boolean }> {
    // Check if entry already exists for this userId + cardId + type
    const [existing] = await this.db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(
        and(
          eq(wishlists.userId, userId),
          eq(wishlists.cardId, input.cardId),
          eq(wishlists.type, input.type),
        ),
      )
      .limit(1);

    if (existing) {
      // Toggle off: remove the entry
      await this.db.delete(wishlists).where(eq(wishlists.id, existing.id));
      return { added: false };
    }

    // Toggle on: create the entry
    await this.db
      .insert(wishlists)
      .values({
        userId,
        cardId: input.cardId,
        type: input.type,
      })
      .returning();

    return { added: true };
  }

  async update(
    userId: string,
    input: WishlistUpdateInput,
  ): Promise<Wishlist | null> {
    const [entry] = await this.db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.id, input.id), eq(wishlists.userId, userId)))
      .limit(1);

    if (!entry) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Wishlist entry not found' });
    }

    const updateData: Partial<typeof wishlists.$inferInsert> = {};
    if (input.preferredVariant !== undefined) updateData.preferredVariant = input.preferredVariant;
    if (input.maxPrice !== undefined) updateData.maxPrice = input.maxPrice;
    if (input.askingPrice !== undefined) updateData.askingPrice = input.askingPrice;
    if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

    const [updated] = await this.db
      .update(wishlists)
      .set(updateData)
      .where(eq(wishlists.id, input.id))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update wishlist entry' });
    }

    return updated;
  }

  async list(
    userId: string,
    input: WishlistListInput,
  ): Promise<PaginatedResult<WishlistEntryWithCard>> {
    const conditions = [
      eq(wishlists.userId, userId),
      eq(wishlists.type, input.type),
    ];

    if (input.cursor) {
      conditions.push(gt(wishlists.id, input.cursor));
    }

    const flatRows = await this.db
      .select({
        id: wishlists.id,
        userId: wishlists.userId,
        cardId: wishlists.cardId,
        type: wishlists.type,
        preferredVariant: wishlists.preferredVariant,
        maxPrice: wishlists.maxPrice,
        askingPrice: wishlists.askingPrice,
        isPublic: wishlists.isPublic,
        createdAt: wishlists.createdAt,
        updatedAt: wishlists.updatedAt,
        // Card fields
        card_id: cards.id,
        card_name: cards.name,
        card_imageSmall: cards.imageSmall,
        card_imageLarge: cards.imageLarge,
        card_rarity: cards.rarity,
        card_setId: cards.setId,
        // Set fields
        card_setSlug: sets.slug,
        card_setName: sets.name,
        // Price fields
        card_marketPrice: cardPrices.marketPrice,
      })
      .from(wishlists)
      .innerJoin(cards, eq(wishlists.cardId, cards.id))
      .innerJoin(sets, eq(cards.setId, sets.id))
      .leftJoin(cardPrices, eq(cards.id, cardPrices.cardId))
      .where(and(...conditions))
      .orderBy(desc(wishlists.createdAt))
      .limit(input.limit + 1);

    const rows = flatRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      cardId: r.cardId,
      type: r.type,
      preferredVariant: r.preferredVariant,
      maxPrice: r.maxPrice,
      askingPrice: r.askingPrice,
      isPublic: r.isPublic,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      card: {
        id: r.card_id,
        name: r.card_name,
        imageSmall: r.card_imageSmall,
        imageLarge: r.card_imageLarge,
        rarity: r.card_rarity,
        setId: r.card_setId,
        setSlug: r.card_setSlug,
        setName: r.card_setName,
        marketPrice: r.card_marketPrice ?? null,
      },
    }));

    return buildPaginatedResult(rows as WishlistEntryWithCard[], input.limit);
  }

  async getForCard(
    userId: string,
    cardId: string,
  ): Promise<WishlistForCardResult> {
    const entries = await this.db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, userId), eq(wishlists.cardId, cardId)))
      .limit(2);

    const wantEntry = entries.find((e) => e.type === 'want');
    const tradeEntry = entries.find((e) => e.type === 'trade');

    return {
      onWantlist: !!wantEntry,
      onTradelist: !!tradeEntry,
      wantEntry,
      tradeEntry,
    };
  }
}
