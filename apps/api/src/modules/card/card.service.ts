import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, and, ilike, gt } from 'drizzle-orm';
import * as crypto from 'crypto';
import type Redis from 'ioredis';
import type { DbClient } from '@la-grieta/db';
import { cards, sets, cardPrices } from '@la-grieta/db';
import type {
  CardListInput,
  CardGetByIdInput,
  CardGetByExternalIdInput,
  CardSyncInput,
  CardGetPriceInput,
} from '@la-grieta/shared';
import { buildPaginatedResult, escapeLike } from '@la-grieta/shared';
import type { PaginatedResult } from '@la-grieta/shared';
import type { Card, Set, CardPrice } from '@la-grieta/db';

export type CardWithSet = Card & { set: Set; price: CardPrice | null };

@Injectable()
export class CardService {
  constructor(
    private readonly db: DbClient,
    private readonly redis: Redis,
  ) {}

  async list(input: CardListInput): Promise<PaginatedResult<Card & { price: CardPrice | null }>> {
    const conditions = [];

    if (!input.includeProducts) {
      conditions.push(eq(cards.isProduct, false));
    }

    if (input.setSlug) {
      const [matchedSet] = await this.db
        .select({ id: sets.id })
        .from(sets)
        .where(eq(sets.slug, input.setSlug))
        .limit(1);
      if (!matchedSet) {
        return { items: [], nextCursor: undefined };
      }
      conditions.push(eq(cards.setId, matchedSet.id));
    }

    if (input.rarity) {
      conditions.push(eq(cards.rarity, input.rarity));
    }

    if (input.cardType) {
      conditions.push(eq(cards.cardType, input.cardType));
    }

    if (input.domain) {
      conditions.push(ilike(cards.domain, `%${escapeLike(input.domain)}%`));
    }

    if (input.search) {
      conditions.push(ilike(cards.cleanName, `%${escapeLike(input.search)}%`));
    }

    if (input.cursor) {
      conditions.push(gt(cards.id, input.cursor));
    }

    const rows = await this.db
      .select({
        id: cards.id,
        externalId: cards.externalId,
        number: cards.number,
        code: cards.code,
        name: cards.name,
        cleanName: cards.cleanName,
        setId: cards.setId,
        rarity: cards.rarity,
        cardType: cards.cardType,
        domain: cards.domain,
        energyCost: cards.energyCost,
        powerCost: cards.powerCost,
        might: cards.might,
        description: cards.description,
        flavorText: cards.flavorText,
        imageSmall: cards.imageSmall,
        imageLarge: cards.imageLarge,
        tcgplayerId: cards.tcgplayerId,
        tcgplayerUrl: cards.tcgplayerUrl,
        isProduct: cards.isProduct,
        keywords: cards.keywords,
        createdAt: cards.createdAt,
        updatedAt: cards.updatedAt,
        price: {
          id: cardPrices.id,
          cardId: cardPrices.cardId,
          tcgplayerProductId: cardPrices.tcgplayerProductId,
          lowPrice: cardPrices.lowPrice,
          midPrice: cardPrices.midPrice,
          highPrice: cardPrices.highPrice,
          marketPrice: cardPrices.marketPrice,
          directLowPrice: cardPrices.directLowPrice,
          foilLowPrice: cardPrices.foilLowPrice,
          foilMidPrice: cardPrices.foilMidPrice,
          foilHighPrice: cardPrices.foilHighPrice,
          foilMarketPrice: cardPrices.foilMarketPrice,
          foilDirectLowPrice: cardPrices.foilDirectLowPrice,
          updatedAt: cardPrices.updatedAt,
          createdAt: cardPrices.createdAt,
        },
      })
      .from(cards)
      .leftJoin(cardPrices, eq(cards.id, cardPrices.cardId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(cards.id)
      .limit(input.limit + 1);

    // Normalise null left-join price objects to null
    const normalised = rows.map((row) => ({
      ...row,
      price: (row.price && row.price.tcgplayerProductId !== null) ? (row.price as CardPrice) : null,
    }));

    return buildPaginatedResult(normalised, input.limit);
  }

  async getById(input: CardGetByIdInput): Promise<CardWithSet> {
    const [row] = await this.db
      .select({
        id: cards.id,
        externalId: cards.externalId,
        number: cards.number,
        code: cards.code,
        name: cards.name,
        cleanName: cards.cleanName,
        setId: cards.setId,
        rarity: cards.rarity,
        cardType: cards.cardType,
        domain: cards.domain,
        energyCost: cards.energyCost,
        powerCost: cards.powerCost,
        might: cards.might,
        description: cards.description,
        flavorText: cards.flavorText,
        imageSmall: cards.imageSmall,
        imageLarge: cards.imageLarge,
        tcgplayerId: cards.tcgplayerId,
        tcgplayerUrl: cards.tcgplayerUrl,
        isProduct: cards.isProduct,
        keywords: cards.keywords,
        createdAt: cards.createdAt,
        updatedAt: cards.updatedAt,
        set: {
          id: sets.id,
          externalId: sets.externalId,
          slug: sets.slug,
          name: sets.name,
          total: sets.total,
          releaseDate: sets.releaseDate,
          description: sets.description,
          tcgplayerGroupId: sets.tcgplayerGroupId,
          createdAt: sets.createdAt,
          updatedAt: sets.updatedAt,
        },
        price: {
          id: cardPrices.id,
          cardId: cardPrices.cardId,
          tcgplayerProductId: cardPrices.tcgplayerProductId,
          lowPrice: cardPrices.lowPrice,
          midPrice: cardPrices.midPrice,
          highPrice: cardPrices.highPrice,
          marketPrice: cardPrices.marketPrice,
          directLowPrice: cardPrices.directLowPrice,
          foilLowPrice: cardPrices.foilLowPrice,
          foilMidPrice: cardPrices.foilMidPrice,
          foilHighPrice: cardPrices.foilHighPrice,
          foilMarketPrice: cardPrices.foilMarketPrice,
          foilDirectLowPrice: cardPrices.foilDirectLowPrice,
          updatedAt: cardPrices.updatedAt,
          createdAt: cardPrices.createdAt,
        },
      })
      .from(cards)
      .innerJoin(sets, eq(cards.setId, sets.id))
      .leftJoin(cardPrices, eq(cards.id, cardPrices.cardId))
      .where(eq(cards.id, input.id))
      .limit(1);

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Card not found' });
    }

    // Drizzle returns null for all price fields when left join finds no match;
    // normalise to null price object when tcgplayerProductId is null.
    const price = (row.price && row.price.tcgplayerProductId !== null) ? (row.price as CardPrice) : null;
    return { ...row, price } as CardWithSet;
  }

  async getPrice(input: CardGetPriceInput): Promise<CardPrice | null> {
    const cacheKey = `cache:card_price:${input.cardId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CardPrice;
    }

    const [row] = await this.db
      .select()
      .from(cardPrices)
      .where(eq(cardPrices.cardId, input.cardId))
      .limit(1);

    const result = row ?? null;
    // Cache for 30 minutes
    await this.redis.setex(cacheKey, 1800, JSON.stringify(result));
    return result;
  }

  async getByExternalId(input: CardGetByExternalIdInput): Promise<CardWithSet> {
    const [row] = await this.db
      .select({
        id: cards.id,
        externalId: cards.externalId,
        number: cards.number,
        code: cards.code,
        name: cards.name,
        cleanName: cards.cleanName,
        setId: cards.setId,
        rarity: cards.rarity,
        cardType: cards.cardType,
        domain: cards.domain,
        energyCost: cards.energyCost,
        powerCost: cards.powerCost,
        might: cards.might,
        description: cards.description,
        flavorText: cards.flavorText,
        imageSmall: cards.imageSmall,
        imageLarge: cards.imageLarge,
        tcgplayerId: cards.tcgplayerId,
        tcgplayerUrl: cards.tcgplayerUrl,
        isProduct: cards.isProduct,
        keywords: cards.keywords,
        createdAt: cards.createdAt,
        updatedAt: cards.updatedAt,
        set: {
          id: sets.id,
          externalId: sets.externalId,
          slug: sets.slug,
          name: sets.name,
          total: sets.total,
          releaseDate: sets.releaseDate,
          description: sets.description,
          tcgplayerGroupId: sets.tcgplayerGroupId,
          createdAt: sets.createdAt,
          updatedAt: sets.updatedAt,
        },
        price: {
          id: cardPrices.id,
          cardId: cardPrices.cardId,
          tcgplayerProductId: cardPrices.tcgplayerProductId,
          lowPrice: cardPrices.lowPrice,
          midPrice: cardPrices.midPrice,
          highPrice: cardPrices.highPrice,
          marketPrice: cardPrices.marketPrice,
          directLowPrice: cardPrices.directLowPrice,
          foilLowPrice: cardPrices.foilLowPrice,
          foilMidPrice: cardPrices.foilMidPrice,
          foilHighPrice: cardPrices.foilHighPrice,
          foilMarketPrice: cardPrices.foilMarketPrice,
          foilDirectLowPrice: cardPrices.foilDirectLowPrice,
          updatedAt: cardPrices.updatedAt,
          createdAt: cardPrices.createdAt,
        },
      })
      .from(cards)
      .innerJoin(sets, eq(cards.setId, sets.id))
      .leftJoin(cardPrices, eq(cards.id, cardPrices.cardId))
      .where(eq(cards.externalId, input.externalId))
      .limit(1);

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Card not found' });
    }

    const price = (row.price && row.price.tcgplayerProductId !== null) ? (row.price as CardPrice) : null;
    return { ...row, price } as CardWithSet;
  }

  async getSets(): Promise<Set[]> {
    const cached = await this.redis.get('cache:card_sets');
    if (cached) {
      return JSON.parse(cached) as Set[];
    }

    const result = await this.db.select().from(sets).orderBy(sets.releaseDate);
    await this.redis.setex('cache:card_sets', 3600, JSON.stringify(result));
    return result;
  }

  async getLegends(): Promise<Array<{ id: string; name: string; cleanName: string; domain: string | null; imageSmall: string | null; description: string | null }>> {
    const cached = await this.redis.get('cache:card_legends');
    if (cached) return JSON.parse(cached) as Array<{ id: string; name: string; cleanName: string; domain: string | null; imageSmall: string | null; description: string | null }>;

    const rows = await this.db
      .select({
        id: cards.id,
        name: cards.name,
        cleanName: cards.cleanName,
        domain: cards.domain,
        imageSmall: cards.imageSmall,
        description: cards.description,
      })
      .from(cards)
      .where(and(eq(cards.cardType, 'Legend'), eq(cards.isProduct, false)))
      .orderBy(cards.name);

    await this.redis.setex('cache:card_legends', 3600, JSON.stringify(rows));
    return rows;
  }

  async sync(input: CardSyncInput): Promise<{ hash: string; cards: Card[]; upToDate: boolean }> {
    // Invalidate sets cache on sync
    await this.redis.del('cache:card_sets');

    const allCards = await this.db
      .select()
      .from(cards)
      .where(eq(cards.isProduct, false))
      .orderBy(cards.id);

    // Deterministic hash over sorted card IDs + updatedAt timestamps
    const hashSource = allCards
      .map((c) => `${c.id}:${c.updatedAt.getTime()}`)
      .join('|');
    const hash = crypto.createHash('sha256').update(hashSource).digest('hex');

    if (input.lastSyncHash && input.lastSyncHash === hash) {
      return { hash, cards: [], upToDate: true };
    }

    return { hash, cards: allCards, upToDate: false };
  }
}
