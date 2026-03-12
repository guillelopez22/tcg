/**
 * Seed script for tournament/sample decks used by the deck recommendations feature.
 * Usage: pnpm tsx tools/seed/src/seed-tournament-decks.ts
 * Requires DATABASE_URL environment variable.
 *
 * Idempotent: skips any deck with the same name that already exists.
 * Uses a "La Grieta System" user for seeded decks. Creates the user if it doesn't exist.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbClient } from '@la-grieta/db';
import { users, decks, deckCards, cards } from '@la-grieta/db';
import { eq, inArray } from 'drizzle-orm';

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

  // Step 2: Collect all externalIds referenced by tournament decks
  const allExternalIds = [
    ...new Set(tournamentDecks.flatMap((d) => d.cards.map((c) => c.externalId))),
  ];

  // Step 3: Query DB for actual card UUIDs
  const cardRows = await db
    .select({ id: cards.id, externalId: cards.externalId })
    .from(cards)
    .where(inArray(cards.externalId, allExternalIds));

  const cardIdByExternalId = new Map<string, string>(
    cardRows.map((r) => [r.externalId, r.id]),
  );

  const missing = allExternalIds.filter((eid) => !cardIdByExternalId.has(eid));
  if (missing.length > 0) {
    console.warn(`Warning: ${missing.length} card external IDs not found in DB. Run card seed first.`);
    console.warn('Missing:', missing.slice(0, 5).join(', '), missing.length > 5 ? `...and ${missing.length - 5} more` : '');
  }

  // Step 4: Seed each deck (idempotent)
  let seeded = 0;
  let skipped = 0;

  for (const deckData of tournamentDecks) {
    // Check if deck with this name already exists
    const existing = await db
      .select({ id: decks.id })
      .from(decks)
      .where(eq(decks.name, deckData.name))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      console.log(`  Skipping (already exists): ${deckData.name}`);
      skipped++;
      continue;
    }

    // Resolve cover card ID
    const coverCardId = cardIdByExternalId.get(deckData.coverCardExternalId) ?? null;

    // Create deck
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

    // Insert deck cards (skip cards not found in DB)
    const deckCardValues = deckData.cards
      .map((c) => {
        const cardId = cardIdByExternalId.get(c.externalId);
        if (!cardId) return null;
        return { deckId: createdDeck.id, cardId, quantity: c.quantity };
      })
      .filter((v): v is { deckId: string; cardId: string; quantity: number } => v !== null);

    if (deckCardValues.length > 0) {
      await db.insert(deckCards).values(deckCardValues);
    }

    console.log(`  Seeded: ${deckData.name} (${deckCardValues.length} cards)`);
    seeded++;
  }

  console.log(`\nDone! Seeded: ${seeded}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Tournament deck seed failed:', err);
  process.exit(1);
});
