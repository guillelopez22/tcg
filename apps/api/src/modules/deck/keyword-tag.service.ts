import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { cards } from '@la-grieta/db';

/**
 * Pure function — no DB or platform dependencies.
 * Parses synergy keywords from a card's description text.
 *
 * Keyword rules:
 *   Uppercase abilities: ACCELERATE, ASSAULT, MULTIATTACK, BARRIER, VIGILANCE, DRAIN, OVERWHELM
 *   Action words: discard, draw, heal/restore, buff (+X might / give a unit), sacrifice/destroy
 */
export function parseKeywords(description: string | null): string[] {
  if (!description) return [];

  const found = new Set<string>();
  const text = description;

  // Uppercase ability keywords
  const abilityKeywords = ['ACCELERATE', 'ASSAULT', 'MULTIATTACK', 'BARRIER', 'VIGILANCE', 'DRAIN', 'OVERWHELM'];
  for (const kw of abilityKeywords) {
    if (text.includes(kw)) {
      found.add(kw.toLowerCase());
    }
  }

  // Action keywords (case-insensitive)
  const lower = text.toLowerCase();

  if (lower.includes('discard')) found.add('discard');
  if (lower.includes('draw')) found.add('draw');
  if (lower.includes('heal') || lower.includes('restore')) found.add('heal');
  if (lower.includes('+') && lower.includes('might') || lower.includes('give a unit')) found.add('buff');
  if (lower.includes('sacrifice') || lower.includes('destroy')) found.add('sacrifice');

  return [...found];
}

@Injectable()
export class KeywordTagService {
  private readonly logger = new Logger(KeywordTagService.name);

  constructor(
    @Inject('DB_CLIENT') private readonly db: DbClient,
  ) {}

  /** Runs daily at 07:00 UTC (after deck-sync cron at 06:00) */
  @Cron('0 7 * * *')
  async tagKeywords(): Promise<void> {
    this.logger.log('Cron: starting keyword tagging for all cards');

    // Load all cards with descriptions
    const allCards = await this.db
      .select({
        id: cards.id,
        description: cards.description,
      })
      .from(cards);

    let taggedCount = 0;

    for (const card of allCards) {
      const keywords = parseKeywords(card.description);

      if (keywords.length > 0) {
        await this.db
          .update(cards)
          .set({ keywords })
          .where(eq(cards.id, card.id));
        taggedCount++;
      }
    }

    this.logger.log(`Keyword tagging complete: ${taggedCount} cards tagged`);
  }
}
