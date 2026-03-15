import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { cards } from '@la-grieta/db';
import { RUNE_DECK_SIZE } from '@la-grieta/shared';

@Injectable()
export class DeckValidationService {
  constructor(private readonly db: DbClient) {}

  async buildCardTypeMap(cardIds: string[]): Promise<Map<string, string | null>> {
    const uniqueIds = [...new Set(cardIds)];
    const rows = await this.db
      .select({ id: cards.id, cardType: cards.cardType })
      .from(cards)
      .where(inArray(cards.id, uniqueIds));
    return new Map(rows.map((r) => [r.id, r.cardType]));
  }

  async validateCardIdsExist(
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

  validateCardEntriesBasic(cardEntries: Array<{ cardId: string; quantity: number; zone?: string }>): void {
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
