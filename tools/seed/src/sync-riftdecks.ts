/**
 * Standalone sync script — pulls tournament and meta decks from riftdecks.com
 * and upserts them into the database under the "la-grieta-system" user.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx tools/seed/src/sync-riftdecks.ts
 *   # or via package script:
 *   DATABASE_URL=... pnpm --filter @la-grieta/seed sync-decks
 *
 * Idempotent: matches existing decks by name + system user, replaces card list on each run.
 */

import 'dotenv/config';
import { createDbClient } from '@la-grieta/db';
import { users, decks, deckCards, cards } from '@la-grieta/db';
import { eq, inArray, and } from 'drizzle-orm';
import { getZoneForCardType, validateDeckFormat, SIGNATURE_TYPES } from '@la-grieta/shared';
import {
  scrapeTierListChampions,
  scrapeChampionDecks,
  scrapeDeckPage,
  scrapeRecentTournaments,
  scrapeTournamentDecks,
} from './scrape-riftdecks.js';
import type { ScrapedDeck } from './scrape-riftdecks.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SYSTEM_USERNAME = 'la-grieta-system';

/** Only sync decks for champions in these tiers. */
const SYNC_TIERS = new Set(['S', 'A', 'B']);

/** Top N meta decks to pull per champion. */
const DECKS_PER_CHAMPION = 3;

/** Top N recent tournaments to pull decks from. */
const TOURNAMENT_LIMIT = 5;

/** Top N decks to pull per tournament. */
const DECKS_PER_TOURNAMENT = 16;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function detectRegion(tournamentName: string | null, deckName: string): string | null {
  const text = `${tournamentName ?? ''} ${deckName}`.toLowerCase();
  // Chinese indicators
  if (/[\u4e00-\u9fff]/.test(text) || text.includes('china') || text.includes('cn ') || text.includes('shanghai') || text.includes('beijing') || text.includes('shenzhen')) {
    return 'China';
  }
  // City/country names for non-China regions
  if (text.includes('bologna') || text.includes('italy')) return 'Europe';
  if (text.includes('las vegas') || text.includes('usa') || text.includes('na ')) return 'North America';
  if (text.includes('tokyo') || text.includes('japan') || text.includes('seoul') || text.includes('korea')) return 'Asia';
  if (text.includes('brazil') || text.includes('latam') || text.includes('honduras')) return 'Latin America';
  return 'International';
}

function dedupeByUrl(links: Array<{ url: string; name: string; tier: string | null; tournament: string | null }>): Array<{ url: string; name: string; tier: string | null; tournament: string | null }> {
  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function syncRiftdecks(databaseUrl: string): Promise<{
  created: number;
  updated: number;
  skippedDecks: number;
  skippedCards: number;
}> {
  const db = createDbClient(databaseUrl);

  let created = 0;
  let updated = 0;
  let skippedDecks = 0;
  let skippedCards = 0;

  // ------------------------------------------------------------------
  // Step 1: Ensure system user exists
  // ------------------------------------------------------------------
  let systemUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, SYSTEM_USERNAME))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!systemUser) {
    console.log('Creating system user...');
    const [createdUser] = await db
      .insert(users)
      .values({
        username: SYSTEM_USERNAME,
        email: 'system@la-grieta.app',
        passwordHash: '$invalid$',
        displayName: 'La Grieta',
      })
      .returning({ id: users.id });
    if (!createdUser) throw new Error('Failed to create system user');
    systemUser = createdUser;
    console.log(`System user created: ${systemUser.id}`);
  } else {
    console.log(`System user found: ${systemUser.id}`);
  }

  const systemUserId = systemUser.id;

  // ------------------------------------------------------------------
  // Step 2: Collect deck URLs from tier list (S/A/B tier champions)
  // ------------------------------------------------------------------
  console.log('\nFetching tier list...');
  let deckLinks: Array<{ url: string; name: string; tier: string | null; tournament: string | null; placement: number | null }> = [];

  try {
    const champions = await scrapeTierListChampions();
    const filteredChampions = champions.filter((c) => SYNC_TIERS.has(c.tier));
    console.log(
      `Found ${champions.length} champions total, ${filteredChampions.length} in tiers ${[...SYNC_TIERS].join('/')}.`,
    );

    for (const champion of filteredChampions) {
      try {
        const championDecks = await scrapeChampionDecks(champion.slug, DECKS_PER_CHAMPION);
        console.log(`  ${champion.name} (${champion.tier}): ${championDecks.length} deck(s)`);
        deckLinks.push(...championDecks.map((d) => ({ ...d, tier: champion.tier, tournament: null, placement: null })));
      } catch (err) {
        console.warn(`  Failed to scrape champion ${champion.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    console.warn(`Failed to scrape tier list: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ------------------------------------------------------------------
  // Step 3: Collect deck URLs from recent tournaments
  // ------------------------------------------------------------------
  console.log('\nFetching recent tournaments...');

  try {
    const tournaments = await scrapeRecentTournaments(TOURNAMENT_LIMIT);
    console.log(`Found ${tournaments.length} recent tournament(s).`);

    for (const tournament of tournaments) {
      try {
        const tournamentDecks = await scrapeTournamentDecks(tournament.url, DECKS_PER_TOURNAMENT);
        console.log(`  "${tournament.name}": ${tournamentDecks.length} deck(s)`);
        deckLinks.push(...tournamentDecks.map((d) => ({ ...d, tier: null, tournament: tournament.name, placement: d.placement })));
      } catch (err) {
        console.warn(`  Failed to scrape tournament "${tournament.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    console.warn(`Failed to scrape tournaments: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ------------------------------------------------------------------
  // Step 4: Deduplicate deck URLs
  // ------------------------------------------------------------------
  deckLinks = dedupeByUrl(deckLinks);
  console.log(`\nTotal unique deck URLs to process: ${deckLinks.length}`);

  if (deckLinks.length === 0) {
    console.log('No decks to process. Exiting.');
    return { created, updated, skippedDecks, skippedCards };
  }

  // ------------------------------------------------------------------
  // Step 5: Scrape each deck page
  // ------------------------------------------------------------------
  const scrapedDecks: Array<ScrapedDeck & { tier: string | null; tournament: string | null; region: string | null; placement: number | null }> = [];

  for (const link of deckLinks) {
    try {
      const deck = await scrapeDeckPage(link.url);
      if (deck) {
        const region = detectRegion(link.tournament, deck.name);
        scrapedDecks.push({ ...deck, tier: link.tier, tournament: link.tournament, region, placement: link.placement });
        console.log(`  Parsed: "${deck.name}" (${deck.cards.length} cards)`);
      } else {
        console.warn(`  Skipped (no data): ${link.url}`);
        skippedDecks++;
      }
    } catch (err) {
      console.warn(`  Failed to parse ${link.url}: ${err instanceof Error ? err.message : String(err)}`);
      skippedDecks++;
    }
  }

  if (scrapedDecks.length === 0) {
    console.log('No decks successfully parsed. Exiting.');
    return { created, updated, skippedDecks, skippedCards };
  }

  // ------------------------------------------------------------------
  // Step 6: Map externalIds → DB card UUIDs
  // ------------------------------------------------------------------
  const allExternalIds = [
    ...new Set(scrapedDecks.flatMap((d) => d.cards.map((c) => c.externalId))),
  ];

  const cardRows = await db
    .select({ id: cards.id, externalId: cards.externalId })
    .from(cards)
    .where(inArray(cards.externalId, allExternalIds));

  const cardIdByExternalId = new Map<string, string>(
    cardRows.map((r) => [r.externalId, r.id]),
  );

  // Also fetch card types for zone assignment
  const cardTypeRows = await db
    .select({ id: cards.id, cardType: cards.cardType })
    .from(cards)
    .where(inArray(cards.id, cardRows.map((r) => r.id)));

  const cardTypeById = new Map<string, string>(
    cardTypeRows.map((r) => [r.id, r.cardType]),
  );

  const missingCards = allExternalIds.filter((eid) => !cardIdByExternalId.has(eid));
  if (missingCards.length > 0) {
    console.warn(
      `Warning: ${missingCards.length} card externalId(s) not found in DB. Run card seed first.`,
    );
    console.warn(
      'Missing (first 5):',
      missingCards.slice(0, 5).join(', '),
      missingCards.length > 5 ? `...and ${missingCards.length - 5} more` : '',
    );
  }

  // ------------------------------------------------------------------
  // Step 7: Upsert decks
  // ------------------------------------------------------------------
  console.log(`\nUpserting ${scrapedDecks.length} deck(s)...`);

  for (const deckData of scrapedDecks) {
    // Use the champion name + deck name as a stable identifier.
    // Prefix with [RD] to distinguish scraped decks from manually created ones.
    const stableName = `[RD] ${deckData.name}`.slice(0, 100);

    // Find the first card of type "legend" as cover, otherwise use the first card
    const coverExternalId =
      deckData.cards.find((c) => c.cardType === 'legend')?.externalId ??
      deckData.cards[0]?.externalId;
    const coverCardId = coverExternalId ? (cardIdByExternalId.get(coverExternalId) ?? null) : null;

    // Build card rows with proper zone assignment, skipping cards not found in DB
    const deckCardValues: Array<{ deckId: string; cardId: string; quantity: number; zone: string }> = [];
    let thisSkipped = 0;
    let championAssigned = false;

    for (const c of deckData.cards) {
      const cardId = cardIdByExternalId.get(c.externalId);
      if (!cardId) {
        thisSkipped++;
        continue;
      }

      const cardType = cardTypeById.get(cardId) ?? null;
      let zone = getZoneForCardType(cardType);
      let quantity = c.quantity;

      // First Champion Unit → champion zone (qty 1), rest to main
      if (cardType === 'Champion Unit' && !championAssigned) {
        championAssigned = true;
        deckCardValues.push({ deckId: '', cardId, quantity: 1, zone: 'champion' });
        if (quantity > 1) {
          deckCardValues.push({ deckId: '', cardId, quantity: quantity - 1, zone: 'main' });
        }
        continue;
      }

      deckCardValues.push({ deckId: '', cardId, quantity, zone });
    }

    skippedCards += thisSkipped;

    // Move overflow main cards to sideboard (main zone capped at 40)
    let mainTotal = deckCardValues
      .filter((v) => v.zone === 'main')
      .reduce((s, v) => s + v.quantity, 0);

    if (mainTotal > 40) {
      // Walk backwards through main entries, shifting overflow to sideboard
      for (let i = deckCardValues.length - 1; i >= 0 && mainTotal > 40; i--) {
        const entry = deckCardValues[i]!;
        if (entry.zone !== 'main') continue;

        const overflow = Math.min(entry.quantity, mainTotal - 40);
        entry.quantity -= overflow;
        mainTotal -= overflow;

        if (overflow > 0) {
          deckCardValues.push({ deckId: '', cardId: entry.cardId, quantity: overflow, zone: 'sideboard' });
        }

        // Remove entry if quantity hit 0
        if (entry.quantity === 0) {
          deckCardValues.splice(i, 1);
        }
      }
    }

    // Check if this deck already exists (name match under system user)
    const existing = await db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.name, stableName), eq(decks.userId, systemUserId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    let deckId: string;

    if (existing) {
      await db
        .update(decks)
        .set({
          description: `Meta deck from riftdecks.com — ${deckData.sourceUrl}`,
          isPublic: true,
          domain: deckData.domain || null,
          tier: deckData.tier,
          tournament: deckData.tournament,
          region: deckData.region,
          placement: deckData.placement,
          coverCardId,
          updatedAt: new Date(),
        })
        .where(eq(decks.id, existing.id));

      await db.delete(deckCards).where(eq(deckCards.deckId, existing.id));

      deckId = existing.id;
      updated++;
      console.log(`  Updated: ${stableName} (${deckCardValues.length} cards, ${thisSkipped} skipped)`);
    } else {
      const [createdDeck] = await db
        .insert(decks)
        .values({
          userId: systemUserId,
          name: stableName,
          description: `Meta deck from riftdecks.com — ${deckData.sourceUrl}`,
          isPublic: true,
          domain: deckData.domain || null,
          tier: deckData.tier,
          tournament: deckData.tournament,
          region: deckData.region,
          placement: deckData.placement,
          coverCardId,
        })
        .returning({ id: decks.id });

      if (!createdDeck) {
        console.error(`  Failed to create deck: ${stableName}`);
        skippedDecks++;
        continue;
      }

      deckId = createdDeck.id;
      created++;
      console.log(`  Created: ${stableName} (${deckCardValues.length} cards, ${thisSkipped} skipped)`);
    }

    // Assign the resolved deckId to all card rows and insert
    const finalCardValues = deckCardValues.map((v) => ({ ...v, deckId }));
    if (finalCardValues.length > 0) {
      await db.insert(deckCards).values(finalCardValues);
    }

    // Compute and set status based on validation
    const cardTypeMap = new Map<string, string | null>(
      finalCardValues.map((v) => [v.cardId, cardTypeById.get(v.cardId) ?? null]),
    );
    const errors = validateDeckFormat(finalCardValues, cardTypeMap);
    const status = errors.length === 0 ? 'complete' : 'draft';
    await db.update(decks).set({ status }).where(eq(decks.id, deckId));
    if (errors.length > 0) {
      console.log(`    Status: ${status} (${errors.join(', ')})`);
    }
  }

  console.log(
    `\nSync complete. Created: ${created}, Updated: ${updated}, Skipped decks: ${skippedDecks}, Skipped cards: ${skippedCards}`,
  );

  return { created, updated, skippedDecks, skippedCards };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  await syncRiftdecks(databaseUrl);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Riftdecks sync failed:', err);
  process.exit(1);
});
