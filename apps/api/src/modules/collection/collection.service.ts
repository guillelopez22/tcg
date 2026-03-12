import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, and, gt, sql, asc, desc } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { DbClient } from '@la-grieta/db';
import { collections, cards, sets, cardPrices } from '@la-grieta/db';
import type {
  CollectionListInput,
  CollectionAddInput,
  CollectionUpdateInput,
  CollectionRemoveInput,
  CollectionAddBulkInput,
  CollectionGetByCardInput,
} from '@la-grieta/shared';
import { buildPaginatedResult, isFoilVariant } from '@la-grieta/shared';
import type { PaginatedResult } from '@la-grieta/shared';
import type { Collection, Card, Set } from '@la-grieta/db';

export type CollectionEntryWithCard = Collection & {
  card: Card & { set: Set; marketPrice: string | null; foilMarketPrice: string | null };
};

export interface CollectionStats {
  totalCards: number;
  uniqueCards: number;
  totalMarketValue: number;
  setStats: Array<{
    setId: string;
    setName: string;
    setSlug: string;
    totalCards: number;
    ownedCards: number;
    completionPercent: number;
  }>;
  valueBySet: Array<{
    setId: string;
    setName: string;
    totalValue: number;
  }>;
  rarityDistribution: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
  };
}

export interface UploadUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresAt: number;
}

export interface R2Service {
  generateUploadUrl(input: {
    purpose: 'collection';
    userId: string;
    contentType: string;
  }): Promise<UploadUrlResult>;
}

@Injectable()
export class CollectionService {
  constructor(
    private readonly db: DbClient,
    private readonly redis: Redis,
    private readonly r2: R2Service,
  ) {}

  async list(
    userId: string,
    input: CollectionListInput,
  ): Promise<PaginatedResult<CollectionEntryWithCard>> {
    const conditions = [eq(collections.userId, userId)];

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

    if (input.variant) {
      conditions.push(eq(collections.variant, input.variant));
    }

    if (input.condition) {
      conditions.push(eq(collections.condition, input.condition));
    }

    if (input.domain) {
      conditions.push(eq(cards.domain, input.domain));
    }

    if (input.cursor) {
      conditions.push(gt(collections.id, input.cursor));
    }

    // Determine ORDER BY clause
    const sortDir = input.sortDir ?? 'desc';
    const sortFn = sortDir === 'asc' ? asc : desc;
    let orderByCol;
    switch (input.sortBy) {
      case 'name':
        orderByCol = sortFn(cards.name);
        break;
      case 'price':
        orderByCol = sortFn(collections.purchasePrice);
        break;
      case 'set_number':
        orderByCol = sortFn(cards.number);
        break;
      case 'date_added':
      default:
        orderByCol = sortFn(collections.createdAt);
        break;
    }

    const flatRows = await this.db
      .select({
        id: collections.id,
        userId: collections.userId,
        cardId: collections.cardId,
        variant: collections.variant,
        condition: collections.condition,
        purchasePrice: collections.purchasePrice,
        photoUrl: collections.photoUrl,
        photoKey: collections.photoKey,
        notes: collections.notes,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        // Card fields (prefixed to avoid name collisions)
        card_id: cards.id,
        card_externalId: cards.externalId,
        card_number: cards.number,
        card_code: cards.code,
        card_name: cards.name,
        card_cleanName: cards.cleanName,
        card_setId: cards.setId,
        card_rarity: cards.rarity,
        card_cardType: cards.cardType,
        card_domain: cards.domain,
        card_energyCost: cards.energyCost,
        card_powerCost: cards.powerCost,
        card_might: cards.might,
        card_description: cards.description,
        card_flavorText: cards.flavorText,
        card_imageSmall: cards.imageSmall,
        card_imageLarge: cards.imageLarge,
        card_tcgplayerId: cards.tcgplayerId,
        card_tcgplayerUrl: cards.tcgplayerUrl,
        card_isProduct: cards.isProduct,
        card_createdAt: cards.createdAt,
        card_updatedAt: cards.updatedAt,
        // Set fields
        set_id: sets.id,
        set_slug: sets.slug,
        set_name: sets.name,
        set_total: sets.total,
        set_releaseDate: sets.releaseDate,
        set_description: sets.description,
        set_tcgplayerGroupId: sets.tcgplayerGroupId,
        set_createdAt: sets.createdAt,
        set_updatedAt: sets.updatedAt,
        // Price fields
        card_marketPrice: cardPrices.marketPrice,
        card_foilMarketPrice: cardPrices.foilMarketPrice,
      })
      .from(collections)
      .innerJoin(cards, eq(collections.cardId, cards.id))
      .innerJoin(sets, eq(cards.setId, sets.id))
      .leftJoin(cardPrices, eq(cards.id, cardPrices.cardId))
      .where(and(...conditions))
      .orderBy(orderByCol)
      .limit(input.limit + 1);

    // Reshape flat rows into nested structure expected by CollectionEntryWithCard
    const rows = flatRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      cardId: r.cardId,
      variant: r.variant,
      condition: r.condition,
      purchasePrice: r.purchasePrice,
      photoUrl: r.photoUrl,
      photoKey: r.photoKey,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      card: {
        id: r.card_id,
        externalId: r.card_externalId,
        number: r.card_number,
        code: r.card_code,
        name: r.card_name,
        cleanName: r.card_cleanName,
        setId: r.card_setId,
        rarity: r.card_rarity,
        cardType: r.card_cardType,
        domain: r.card_domain,
        energyCost: r.card_energyCost,
        powerCost: r.card_powerCost,
        might: r.card_might,
        description: r.card_description,
        flavorText: r.card_flavorText,
        imageSmall: r.card_imageSmall,
        imageLarge: r.card_imageLarge,
        tcgplayerId: r.card_tcgplayerId,
        tcgplayerUrl: r.card_tcgplayerUrl,
        isProduct: r.card_isProduct,
        createdAt: r.card_createdAt,
        updatedAt: r.card_updatedAt,
        set: {
          id: r.set_id,
          slug: r.set_slug,
          name: r.set_name,
          total: r.set_total,
          releaseDate: r.set_releaseDate,
          description: r.set_description,
          tcgplayerGroupId: r.set_tcgplayerGroupId,
          createdAt: r.set_createdAt,
          updatedAt: r.set_updatedAt,
        },
        marketPrice: r.card_marketPrice ?? null,
        foilMarketPrice: r.card_foilMarketPrice ?? null,
      },
    }));

    return buildPaginatedResult(rows as CollectionEntryWithCard[], input.limit);
  }

  async add(userId: string, input: CollectionAddInput): Promise<Collection> {
    // Verify card exists
    const [card] = await this.db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.id, input.cardId))
      .limit(1);

    if (!card) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Card not found' });
    }

    // Per-copy model: always insert a new row (no upsert)
    const [created] = await this.db
      .insert(collections)
      .values({
        userId,
        cardId: input.cardId,
        variant: input.variant ?? 'normal',
        condition: input.condition ?? 'near_mint',
        notes: input.notes ?? null,
      })
      .returning();

    if (!created) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create collection entry' });
    }

    return created;
  }

  async addBulk(userId: string, input: CollectionAddBulkInput): Promise<Collection[]> {
    if (input.entries.length > 50) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot add more than 50 cards at once' });
    }

    return this.db.transaction(async (tx) => {
      const results: Collection[] = [];
      // Process sequentially so card validation errors stop the transaction
      for (const entry of input.entries) {
        const result = await this.addWithTx(tx, userId, entry);
        results.push(result);
      }
      return results;
    });
  }

  private async addWithTx(
    tx: Pick<DbClient, 'select' | 'insert' | 'update' | 'delete'>,
    userId: string,
    input: CollectionAddInput,
  ): Promise<Collection> {
    const [card] = await tx
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.id, input.cardId))
      .limit(1);

    if (!card) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Card not found' });
    }

    // Per-copy model: always insert a new row
    const [created] = await tx
      .insert(collections)
      .values({
        userId,
        cardId: input.cardId,
        variant: input.variant ?? 'normal',
        condition: input.condition ?? 'near_mint',
        notes: input.notes ?? null,
      })
      .returning();

    if (!created) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create collection entry' });
    }

    return created;
  }

  async update(userId: string, input: CollectionUpdateInput): Promise<Collection | null> {
    const [entry] = await this.db
      .select()
      .from(collections)
      .where(and(eq(collections.id, input.id), eq(collections.userId, userId)))
      .limit(1);

    if (!entry) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Collection entry not found' });
    }

    const updateData: Partial<typeof collections.$inferInsert> = {};
    if (input.variant !== undefined) updateData.variant = input.variant;
    if (input.condition !== undefined) updateData.condition = input.condition;
    if (input.purchasePrice !== undefined) updateData.purchasePrice = input.purchasePrice;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.photoUrl !== undefined) updateData.photoUrl = input.photoUrl;
    if (input.photoKey !== undefined) updateData.photoKey = input.photoKey;

    const [updated] = await this.db
      .update(collections)
      .set(updateData)
      .where(eq(collections.id, input.id))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update collection entry' });
    }

    return updated;
  }

  async remove(userId: string, input: CollectionRemoveInput): Promise<void> {
    const [entry] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, input.id), eq(collections.userId, userId)))
      .limit(1);

    if (!entry) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Collection entry not found' });
    }

    await this.db.delete(collections).where(eq(collections.id, input.id));
  }

  async getByCard(userId: string, input: CollectionGetByCardInput): Promise<CollectionEntryWithCard[]> {
    const flatRows = await this.db
      .select({
        id: collections.id,
        userId: collections.userId,
        cardId: collections.cardId,
        variant: collections.variant,
        condition: collections.condition,
        purchasePrice: collections.purchasePrice,
        photoUrl: collections.photoUrl,
        photoKey: collections.photoKey,
        notes: collections.notes,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        // Card fields
        card_id: cards.id,
        card_externalId: cards.externalId,
        card_number: cards.number,
        card_code: cards.code,
        card_name: cards.name,
        card_cleanName: cards.cleanName,
        card_setId: cards.setId,
        card_rarity: cards.rarity,
        card_cardType: cards.cardType,
        card_domain: cards.domain,
        card_energyCost: cards.energyCost,
        card_powerCost: cards.powerCost,
        card_might: cards.might,
        card_description: cards.description,
        card_flavorText: cards.flavorText,
        card_imageSmall: cards.imageSmall,
        card_imageLarge: cards.imageLarge,
        card_tcgplayerId: cards.tcgplayerId,
        card_tcgplayerUrl: cards.tcgplayerUrl,
        card_isProduct: cards.isProduct,
        card_createdAt: cards.createdAt,
        card_updatedAt: cards.updatedAt,
        // Set fields
        set_id: sets.id,
        set_slug: sets.slug,
        set_name: sets.name,
        set_total: sets.total,
        set_releaseDate: sets.releaseDate,
        set_description: sets.description,
        set_tcgplayerGroupId: sets.tcgplayerGroupId,
        set_createdAt: sets.createdAt,
        set_updatedAt: sets.updatedAt,
      })
      .from(collections)
      .innerJoin(cards, eq(collections.cardId, cards.id))
      .innerJoin(sets, eq(cards.setId, sets.id))
      .where(and(eq(collections.userId, userId), eq(collections.cardId, input.cardId)))
      .orderBy(desc(collections.createdAt))
      .limit(100);

    return flatRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      cardId: r.cardId,
      variant: r.variant,
      condition: r.condition,
      purchasePrice: r.purchasePrice,
      photoUrl: r.photoUrl,
      photoKey: r.photoKey,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      card: {
        id: r.card_id,
        externalId: r.card_externalId,
        number: r.card_number,
        code: r.card_code,
        name: r.card_name,
        cleanName: r.card_cleanName,
        setId: r.card_setId,
        rarity: r.card_rarity,
        cardType: r.card_cardType,
        domain: r.card_domain,
        energyCost: r.card_energyCost,
        powerCost: r.card_powerCost,
        might: r.card_might,
        description: r.card_description,
        flavorText: r.card_flavorText,
        imageSmall: r.card_imageSmall,
        imageLarge: r.card_imageLarge,
        tcgplayerId: r.card_tcgplayerId,
        tcgplayerUrl: r.card_tcgplayerUrl,
        isProduct: r.card_isProduct,
        createdAt: r.card_createdAt,
        updatedAt: r.card_updatedAt,
        set: {
          id: r.set_id,
          slug: r.set_slug,
          name: r.set_name,
          total: r.set_total,
          releaseDate: r.set_releaseDate,
          description: r.set_description,
          tcgplayerGroupId: r.set_tcgplayerGroupId,
          createdAt: r.set_createdAt,
          updatedAt: r.set_updatedAt,
        },
      },
    })) as CollectionEntryWithCard[];
  }

  async getUploadUrl(
    userId: string,
    input: { contentType: string },
  ): Promise<UploadUrlResult> {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(input.contentType)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Content type "${input.contentType}" is not allowed. Use image/jpeg, image/png, or image/webp.`,
      });
    }

    try {
      return await this.r2.generateUploadUrl({
        purpose: 'collection',
        userId,
        contentType: input.contentType,
      });
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: err instanceof Error ? err.message : 'Failed to generate upload URL',
      });
    }
  }

  async stats(userId: string): Promise<CollectionStats> {
    // Query 1: overall totals for the user — count rows (per-copy model, no quantity column)
    const [totals] = await this.db
      .select({
        totalCards: sql<number>`COUNT(*)::int`,
        uniqueCards: sql<number>`COUNT(DISTINCT ${collections.cardId})::int`,
      })
      .from(collections)
      .where(eq(collections.userId, userId))
      .limit(1);

    // Query 2: all sets ordered by release date (cached — user-independent)
    let allSets: typeof sets.$inferSelect[];
    const cachedSets = await this.redis.get('cache:all_sets');
    if (cachedSets) {
      allSets = JSON.parse(cachedSets) as typeof sets.$inferSelect[];
    } else {
      allSets = await this.db.select().from(sets).orderBy(sets.releaseDate);
      await this.redis.setex('cache:all_sets', 3600, JSON.stringify(allSets));
    }

    if (allSets.length === 0) {
      return {
        totalCards: totals?.totalCards ?? 0,
        uniqueCards: totals?.uniqueCards ?? 0,
        totalMarketValue: 0,
        setStats: [],
        valueBySet: [],
        rarityDistribution: { common: 0, uncommon: 0, rare: 0, epic: 0 },
      };
    }

    // Query 3: total non-product cards per set (cached — user-independent)
    let totalCardsPerSet: Array<{ setId: string; count: number }>;
    const cachedCardsPerSet = await this.redis.get('cache:cards_per_set');
    if (cachedCardsPerSet) {
      totalCardsPerSet = JSON.parse(cachedCardsPerSet) as Array<{ setId: string; count: number }>;
    } else {
      totalCardsPerSet = await this.db
        .select({
          setId: cards.setId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(cards)
        .where(eq(cards.isProduct, false))
        .groupBy(cards.setId);
      await this.redis.setex('cache:cards_per_set', 3600, JSON.stringify(totalCardsPerSet));
    }

    // Query 4: owned unique cards per set for this user (single aggregate query)
    const ownedCardsPerSet = await this.db
      .select({
        setId: cards.setId,
        count: sql<number>`COUNT(DISTINCT ${collections.cardId})::int`,
      })
      .from(collections)
      .innerJoin(cards, eq(collections.cardId, cards.id))
      .where(eq(collections.userId, userId))
      .groupBy(cards.setId);

    const totalBySetId = new Map<string, number>(
      totalCardsPerSet.map((r) => [r.setId, r.count]),
    );
    const ownedBySetId = new Map<string, number>(
      ownedCardsPerSet.map((r) => [r.setId, r.count]),
    );

    const setStats = allSets.map((set) => {
      const total = totalBySetId.get(set.id) ?? 0;
      const owned = ownedBySetId.get(set.id) ?? 0;
      const completionPercent = total > 0 ? Math.round((owned / total) * 100) : 0;
      return {
        setId: set.id,
        setName: set.name,
        setSlug: set.slug,
        totalCards: total,
        ownedCards: owned,
        completionPercent,
      };
    });

    // Query 5: market value — join collections -> cards -> card_prices
    // Use new cache key (cache:user_stats_v2) to avoid stale cache from old shape
    const cacheKey = `cache:user_stats_v2:${userId}`;
    const cachedStatsExtra = await this.redis.get(cacheKey);

    let totalMarketValue: number;
    let valueBySet: Array<{ setId: string; setName: string; totalValue: number }>;
    let rarityDistribution: { common: number; uncommon: number; rare: number; epic: number };

    if (cachedStatsExtra) {
      const parsed = JSON.parse(cachedStatsExtra) as {
        totalMarketValue: number;
        valueBySet: typeof valueBySet;
        rarityDistribution: typeof rarityDistribution;
      };
      totalMarketValue = parsed.totalMarketValue;
      valueBySet = parsed.valueBySet;
      rarityDistribution = parsed.rarityDistribution;
    } else {
      // Fetch all collection entries for this user with their variant, card rarity, set, and prices
      const collectionWithPrices = await this.db
        .select({
          variant: collections.variant,
          setId: cards.setId,
          rarity: cards.rarity,
          marketPrice: cardPrices.marketPrice,
          foilMarketPrice: cardPrices.foilMarketPrice,
        })
        .from(collections)
        .innerJoin(cards, eq(collections.cardId, cards.id))
        .innerJoin(cardPrices, eq(cards.id, cardPrices.cardId))
        .where(eq(collections.userId, userId));

      // Calculate total market value using variant mapping
      let total = 0;
      const valueMap = new Map<string, number>();
      const rarityCount = { common: 0, uncommon: 0, rare: 0, epic: 0 };

      for (const row of collectionWithPrices) {
        // Use foil price for foil variants, normal price otherwise
        const priceStr = isFoilVariant(row.variant)
          ? row.foilMarketPrice
          : row.marketPrice;
        const price = priceStr ? parseFloat(priceStr) : 0;
        total += price;
        valueMap.set(row.setId, (valueMap.get(row.setId) ?? 0) + price);
      }

      totalMarketValue = Math.round(total * 100) / 100;

      valueBySet = allSets
        .filter((s) => valueMap.has(s.id))
        .map((s) => ({
          setId: s.id,
          setName: s.name,
          totalValue: Math.round((valueMap.get(s.id) ?? 0) * 100) / 100,
        }));

      // Query 6: rarity distribution (entries without price join for accuracy)
      const rarityRows = await this.db
        .select({
          rarity: cards.rarity,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(collections)
        .innerJoin(cards, eq(collections.cardId, cards.id))
        .where(eq(collections.userId, userId))
        .groupBy(cards.rarity);

      for (const row of rarityRows) {
        const rarity = (row.rarity ?? '').toLowerCase();
        if (rarity === 'common') rarityCount.common += row.count;
        else if (rarity === 'uncommon') rarityCount.uncommon += row.count;
        else if (rarity === 'rare') rarityCount.rare += row.count;
        else if (rarity === 'epic') rarityCount.epic += row.count;
      }
      rarityDistribution = rarityCount;

      // Cache for 5 minutes
      await this.redis.setex(
        cacheKey,
        300,
        JSON.stringify({ totalMarketValue, valueBySet, rarityDistribution }),
      );
    }

    return {
      totalCards: totals?.totalCards ?? 0,
      uniqueCards: totals?.uniqueCards ?? 0,
      totalMarketValue,
      setStats,
      valueBySet,
      rarityDistribution,
    };
  }
}
