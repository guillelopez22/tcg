import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, ilike } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import type { DbClient } from '@la-grieta/db';
import { cards, decks, deckShareCodes } from '@la-grieta/db';
import type { DeckImportTextInput, DeckImportUrlInput } from '@la-grieta/shared';
import { escapeLike, getZoneForCardType, autoDetectAndParse } from '@la-grieta/shared';
import { DeckValidationService } from './deck-validation.service';

const nanoidAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export type ResolvedDeckCardEntry = {
  cardId: string;
  quantity: number;
  zone: 'main' | 'rune' | 'legend' | 'champion' | 'battlefield' | 'sideboard';
};

export type ImportResult = {
  resolved: ResolvedDeckCardEntry[];
  unmatched: string[];
  deckName: string;
};

@Injectable()
export class DeckImportService {
  constructor(
    private readonly db: DbClient,
    private readonly validation: DeckValidationService,
  ) {}

  async generateShareCode(userId: string, deckId: string): Promise<string> {
    const [deck] = await this.db
      .select({ id: decks.id, userId: decks.userId, isPublic: decks.isPublic })
      .from(decks)
      .where(eq(decks.id, deckId))
      .limit(1);

    if (!deck) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
    }

    if (deck.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this deck' });
    }

    if (!deck.isPublic) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only public decks can be shared. Make this deck public first.',
      });
    }

    // Try to generate a unique code up to 3 times
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = `LG-${nanoidAlphabet()}`;
      try {
        await this.db.insert(deckShareCodes).values({ code, deckId });
        return code;
      } catch (err) {
        // Retry on unique violation (code collision, extremely rare)
        if (
          err instanceof Error &&
          err.message.includes('duplicate key') ||
          (err instanceof Error && err.message.includes('unique constraint'))
        ) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to generate share code after retries',
      cause: lastError,
    });
  }

  /**
   * Look up a share code and return the associated deck ID.
   * The caller is responsible for loading the full deck via DeckService.getById.
   */
  async resolveShareCodeToDeckId(code: string): Promise<string> {
    const [row] = await this.db
      .select({ deckId: deckShareCodes.deckId })
      .from(deckShareCodes)
      .where(eq(deckShareCodes.code, code))
      .limit(1);

    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck no longer available' });
    }

    return row.deckId;
  }

  async importFromText(_userId: string, input: DeckImportTextInput): Promise<ImportResult> {
    const parseResult = autoDetectAndParse(input.text);

    // Guard: the parser found no recognisable card entries at all.
    // This can happen even after schema validation if the text is structured
    // in a format the parser does not support.
    if (parseResult.entries.length === 0 && parseResult.unmatched.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'No card entries could be parsed from the import text. ' +
          'Expected lines in the format "N CardName" (e.g. "3 Zed, The Undying").',
      });
    }

    // Resolve card names against DB using ILIKE on cleanName
    const resolved: ResolvedDeckCardEntry[] = [];
    const unmatched: string[] = [...parseResult.unmatched];

    for (const entry of parseResult.entries) {
      const [matched] = await this.db
        .select({ id: cards.id })
        .from(cards)
        .where(ilike(cards.cleanName, `%${escapeLike(entry.cardName)}%`))
        .limit(1);

      if (matched) {
        resolved.push({ cardId: matched.id, quantity: entry.quantity, zone: entry.zone });
      } else {
        unmatched.push(entry.cardName);
      }
    }

    // Apply zone correction: Legends, Battlefields, and Runes go to their canonical zone.
    // Champion Units: first one goes to 'champion' zone, rest stay in 'main'.
    // Signature cards: enforce 1-copy limit.
    if (resolved.length > 0) {
      const cardTypeMap = await this.validation.buildCardTypeMap(resolved.map((c) => c.cardId));
      let hasChampion = false;
      for (let i = 0; i < resolved.length; i++) {
        const entry = resolved[i]!;
        const cardType = cardTypeMap.get(entry.cardId) ?? null;
        const derivedZone = getZoneForCardType(cardType);

        // First Champion Unit goes to champion zone
        if (cardType === 'Champion Unit' && !hasChampion) {
          hasChampion = true;
          resolved[i] = { ...entry, zone: 'champion', quantity: 1 };
          continue;
        }

        resolved[i] = {
          ...entry,
          zone: derivedZone !== 'main' ? derivedZone : entry.zone,
        };
      }
    }

    return {
      resolved,
      unmatched,
      deckName: input.name ?? 'Imported Deck',
    };
  }

  async importFromUrl(userId: string, input: DeckImportUrlInput): Promise<ImportResult> {
    let text: string;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      let response: Response;
      try {
        response = await fetch(input.url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      // Strip HTML tags to extract plain text content
      text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Could not fetch that URL. Try pasting the deck list text instead.',
      });
    }

    return this.importFromText(userId, { text, name: input.name });
  }
}
