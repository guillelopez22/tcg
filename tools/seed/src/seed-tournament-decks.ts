/**
 * Seed script for tournament/sample decks used by the deck recommendations feature.
 * Usage: pnpm tsx tools/seed/src/seed-tournament-decks.ts
 * Requires DATABASE_URL environment variable.
 *
 * Idempotent & update-capable: upserts decks by name, replaces deck cards on every run.
 * Uses a "La Grieta System" user for seeded decks. Creates the user if it doesn't exist.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbClient } from '@la-grieta/db';
import { users, decks, deckCards, cards } from '@la-grieta/db';
import { eq, inArray } from 'drizzle-orm';
import { getZoneForCardType, validateDeckFormat, SIGNATURE_TYPES } from '@la-grieta/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TournamentDeckCard {
  externalId: string;
  quantity: number;
}

interface TournamentDeck {
  name: string;
  champion: string;
  coverCardExternalId: string;
  description: string;
  domain: string;
  isTournament: boolean;
  source: string;
  isPublic: boolean;
  cards: TournamentDeckCard[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const db = createDbClient(databaseUrl);

  const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../tournament-decks.json');
  const tournamentDecks = JSON.parse(readFileSync(dataPath, 'utf-8')) as TournamentDeck[];

  console.log(`Loading ${tournamentDecks.length} tournament decks...`);

  // Step 1: Ensure system user exists
  const SYSTEM_USERNAME = 'la-grieta-system';
  let systemUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, SYSTEM_USERNAME))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!systemUser) {
    console.log('Creating system user...');
    const [created] = await db
      .insert(users)
      .values({
        username: SYSTEM_USERNAME,
        email: 'system@la-grieta.app',
        passwordHash: '$invalid$', // never used for login
        displayName: 'La Grieta',
      })
      .returning({ id: users.id });
    if (!created) throw new Error('Failed to create system user');
    systemUser = created;
    console.log(`System user created: ${systemUser.id}`);
  } else {
    console.log(`System user found: ${systemUser.id}`);
  }

  const systemUserId = systemUser.id;

  // Step 1b: If --clean flag, delete all system user decks first
  if (process.argv.includes('--clean')) {
    const systemDecks = await db
      .select({ id: decks.id })
      .from(decks)
      .where(eq(decks.userId, systemUserId));

    if (systemDecks.length > 0) {
      const deckIds = systemDecks.map((d) => d.id);
      await db.delete(deckCards).where(inArray(deckCards.deckId, deckIds));
      await db.delete(decks).where(inArray(decks.id, deckIds));
      console.log(`Cleaned ${systemDecks.length} existing system decks`);
    }
  }

  // Step 2: Collect all externalIds referenced by tournament decks
  const allExternalIds = [
    ...new Set(tournamentDecks.flatMap((d) => d.cards.map((c) => c.externalId))),
  ];

  // Step 3: Query DB for actual card UUIDs, card types, and clean names (for zone assignment)
  const cardRows = await db
    .select({ id: cards.id, externalId: cards.externalId, cardType: cards.cardType, cleanName: cards.cleanName })
    .from(cards)
    .where(inArray(cards.externalId, allExternalIds));

  const cardIdByExternalId = new Map<string, string>(
    cardRows.map((r) => [r.externalId, r.id]),
  );

  const cardTypeByExternalId = new Map<string, string>(
    cardRows.map((r) => [r.externalId, r.cardType]),
  );

  const cardCleanNameByExternalId = new Map<string, string>(
    cardRows.map((r) => [r.externalId, r.cleanName]),
  );

  const missing = allExternalIds.filter((eid) => !cardIdByExternalId.has(eid));
  if (missing.length > 0) {
    console.warn(`Warning: ${missing.length} card external IDs not found in DB. Run card seed first.`);
    console.warn('Missing:', missing.slice(0, 5).join(', '), missing.length > 5 ? `...and ${missing.length - 5} more` : '');
  }

  // Step 4: Upsert each deck
  let created = 0;
  let updated = 0;

  for (const deckData of tournamentDecks) {
    const coverCardId = cardIdByExternalId.get(deckData.coverCardExternalId) ?? null;

    // Check if deck with this name already exists for the system user
    const existing = await db
      .select({ id: decks.id })
      .from(decks)
      .where(eq(decks.name, deckData.name))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    let deckId: string;

    if (existing) {
      // Update existing deck metadata
      await db
        .update(decks)
        .set({
          description: deckData.description,
          isPublic: deckData.isPublic,
          domain: deckData.domain,
          coverCardId,
        })
        .where(eq(decks.id, existing.id));

      // Delete old deck cards and re-insert
      await db.delete(deckCards).where(eq(deckCards.deckId, existing.id));

      deckId = existing.id;
      updated++;
      console.log(`  Updated: ${deckData.name}`);
    } else {
      // Create new deck
      const [createdDeck] = await db
        .insert(decks)
        .values({
          userId: systemUserId,
          name: deckData.name,
          description: deckData.description,
          isPublic: deckData.isPublic,
          domain: deckData.domain,
          coverCardId,
        })
        .returning({ id: decks.id });

      if (!createdDeck) {
        console.error(`  Failed to create deck: ${deckData.name}`);
        continue;
      }

      deckId = createdDeck.id;
      created++;
      console.log(`  Created: ${deckData.name}`);
    }

    // Insert deck cards (skip cards not found in DB)
    // Champion Units default to 'main'. Only one copy of the designated champion
    // (matching deckData.champion) goes to the 'champion' zone.
    let championAssigned = false;
    const deckCardValues: Array<{ deckId: string; cardId: string; quantity: number; zone: string }> = [];

    for (const c of deckData.cards) {
      const cardId = cardIdByExternalId.get(c.externalId);
      if (!cardId) continue;
      const cardType = cardTypeByExternalId.get(c.externalId) ?? null;
      const cleanName = cardCleanNameByExternalId.get(c.externalId) ?? '';
      let zone = getZoneForCardType(cardType);

      // Designate the chosen champion: match by cleanName containing deckData.champion
      if (!championAssigned && cardType === 'Champion Unit' && cleanName.toLowerCase().includes(deckData.champion.toLowerCase())) {
        championAssigned = true;
        // Put 1 copy in champion zone
        deckCardValues.push({ deckId, cardId, quantity: 1, zone: 'champion' });
        // Remaining copies (if any) go to main
        if (c.quantity > 1) {
          deckCardValues.push({ deckId, cardId, quantity: c.quantity - 1, zone: 'main' });
        }
        continue;
      }

      deckCardValues.push({ deckId, cardId, quantity: c.quantity, zone });
    }

    if (deckCardValues.length > 0) {
      await db.insert(deckCards).values(deckCardValues);
    }

    // Compute and set status
    const cardTypeMap = new Map<string, string | null>();
    for (const dcv of deckCardValues) {
      const ct = cardTypeByExternalId.get(
        [...cardIdByExternalId.entries()].find(([, v]) => v === dcv.cardId)?.[0] ?? '',
      ) ?? null;
      cardTypeMap.set(dcv.cardId, ct);
    }
    const errors = validateDeckFormat(deckCardValues, cardTypeMap);
    const status = errors.length === 0 ? 'complete' : 'draft';
    await db.update(decks).set({ status }).where(eq(decks.id, deckId));

    console.log(`    → ${deckCardValues.length} cards [${status}]${errors.length > 0 ? ` (${errors.join(', ')})` : ''}`);
  }

  console.log(`\nDone! Created: ${created}, Updated: ${updated}`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Tournament deck seed failed:', err);
  process.exit(1);
});
