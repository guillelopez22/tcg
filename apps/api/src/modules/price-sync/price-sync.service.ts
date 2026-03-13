import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, inArray } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { cards, cardPrices, sets } from '@la-grieta/db';

interface TcgcsvPriceRow {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  directLowPrice: number | null;
  subTypeName: 'Normal' | 'Foil' | string;
}

interface TcgcsvResponse {
  success: boolean;
  results: TcgcsvPriceRow[];
}

interface PriceAccumulator {
  tcgplayerProductId: number;
  cardId: string;
  lowPrice?: string | null;
  midPrice?: string | null;
  highPrice?: string | null;
  marketPrice?: string | null;
  directLowPrice?: string | null;
  foilLowPrice?: string | null;
  foilMidPrice?: string | null;
  foilHighPrice?: string | null;
  foilMarketPrice?: string | null;
  foilDirectLowPrice?: string | null;
}

@Injectable()
export class PriceSyncService {
  private readonly logger = new Logger(PriceSyncService.name);
  private isSyncing = false;

  constructor(private readonly db: DbClient) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async syncPricesCron(): Promise<void> {
    this.logger.log('Cron: starting scheduled price sync');
    await this.syncNow();
  }

  async syncNow(): Promise<{ synced: number; errors: string[] }> {
    if (this.isSyncing) {
      this.logger.warn('Price sync already in progress, skipping');
      return { synced: 0, errors: ['Sync already in progress'] };
    }

    this.isSyncing = true;
    const errors: string[] = [];
    let totalSynced = 0;

    try {
      // Get all sets that have a tcgplayerGroupId
      const allSets = await this.db
        .select({ id: sets.id, name: sets.name, tcgplayerGroupId: sets.tcgplayerGroupId })
        .from(sets)
        .where(eq(sets.tcgplayerGroupId, sets.tcgplayerGroupId)); // non-null filter via self-join workaround

      const setsWithGroup = allSets.filter((s) => s.tcgplayerGroupId !== null);

      if (setsWithGroup.length === 0) {
        this.logger.warn('No sets have tcgplayerGroupId set — nothing to sync');
        return { synced: 0, errors: [] };
      }

      for (const set of setsWithGroup) {
        try {
          const count = await this.syncSet(set.tcgplayerGroupId as number, set.id);
          totalSynced += count;
          this.logger.log(`Synced ${count} prices for set "${set.name}"`);
        } catch (err) {
          const msg = `Failed to sync set "${set.name}": ${err instanceof Error ? err.message : String(err)}`;
          this.logger.error(msg);
          errors.push(msg);
        }
      }
    } finally {
      this.isSyncing = false;
    }

    this.logger.log(`Price sync complete. Total synced: ${totalSynced}, errors: ${errors.length}`);
    return { synced: totalSynced, errors };
  }

  private async syncSet(groupId: number, setId: string): Promise<number> {
    const url = `https://tcgcsv.com/tcgplayer/89/${groupId}/prices`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`TCGCSV responded with HTTP ${response.status} for groupId ${groupId}`);
    }

    const data = (await response.json()) as TcgcsvResponse;

    if (!data.success || !Array.isArray(data.results)) {
      throw new Error(`Unexpected TCGCSV response shape for groupId ${groupId}`);
    }

    // Find all cards in this set that have a tcgplayerId
    const setCards = await this.db
      .select({ id: cards.id, tcgplayerId: cards.tcgplayerId })
      .from(cards)
      .where(eq(cards.setId, setId));

    const cardByTcgplayerId = new Map<number, string>();
    for (const card of setCards) {
      if (card.tcgplayerId !== null) {
        cardByTcgplayerId.set(card.tcgplayerId, card.id);
      }
    }

    if (cardByTcgplayerId.size === 0) {
      return 0;
    }

    // Accumulate normal + foil rows by productId
    const priceMap = new Map<number, PriceAccumulator>();

    for (const row of data.results) {
      const cardId = cardByTcgplayerId.get(row.productId);
      if (!cardId) continue;

      if (!priceMap.has(row.productId)) {
        priceMap.set(row.productId, { tcgplayerProductId: row.productId, cardId });
      }

      const acc = priceMap.get(row.productId)!;
      const toStr = (v: number | null): string | null =>
        v !== null && v !== undefined ? String(v) : null;

      if (row.subTypeName === 'Foil') {
        acc.foilLowPrice = toStr(row.lowPrice);
        acc.foilMidPrice = toStr(row.midPrice);
        acc.foilHighPrice = toStr(row.highPrice);
        acc.foilMarketPrice = toStr(row.marketPrice);
        acc.foilDirectLowPrice = toStr(row.directLowPrice);
      } else {
        // Normal or any other subtype goes to non-foil fields
        acc.lowPrice = toStr(row.lowPrice);
        acc.midPrice = toStr(row.midPrice);
        acc.highPrice = toStr(row.highPrice);
        acc.marketPrice = toStr(row.marketPrice);
        acc.directLowPrice = toStr(row.directLowPrice);
      }
    }

    if (priceMap.size === 0) {
      return 0;
    }

    const upsertRows = Array.from(priceMap.values());

    // Upsert in batches of 100 to avoid giant queries
    const batchSize = 100;
    for (let i = 0; i < upsertRows.length; i += batchSize) {
      const batch = upsertRows.slice(i, i + batchSize);
      await this.db
        .insert(cardPrices)
        .values(batch)
        .onConflictDoUpdate({
          target: cardPrices.cardId,
          set: {
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
            updatedAt: new Date(),
          },
        });
    }

    return upsertRows.length;
  }

  async getPricingStatus(): Promise<{ totalCards: number; cardsWithPrices: number; lastSyncing: boolean }> {
    const [cardCount] = await this.db
      .select({ count: cards.id })
      .from(cards)
      .where(eq(cards.isProduct, false));

    const [priceCount] = await this.db
      .select({ count: cardPrices.id })
      .from(cardPrices);

    return {
      totalCards: cardCount ? 1 : 0,
      cardsWithPrices: priceCount ? 1 : 0,
      lastSyncing: this.isSyncing,
    };
  }
}
