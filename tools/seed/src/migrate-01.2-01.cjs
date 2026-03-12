/**
 * Migration 01.2-01: Zone-aware deck building data layer.
 *
 * Adds:
 *   - zone column to deck_cards table
 *   - Updates unique index from (deck_id, card_id) to (deck_id, card_id, zone)
 *   - status column to decks table
 *   - keywords column to cards table
 *
 * Usage:
 *   DATABASE_URL=... node tools/seed/src/migrate-01.2-01.cjs
 *
 * Idempotent: uses IF NOT EXISTS / IF EXISTS to skip already-applied changes.
 */

'use strict';

const { Client } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log('Running migration 01.2-01: Zone-aware deck building data layer...');

    await client.query(`
      ALTER TABLE deck_cards
      ADD COLUMN IF NOT EXISTS zone VARCHAR(20) NOT NULL DEFAULT 'main';
    `);
    console.log('  [1/5] zone column added to deck_cards (or already existed).');

    await client.query(`
      DROP INDEX IF EXISTS idx_deck_cards_deck_card;
    `);
    console.log('  [2/5] old unique index idx_deck_cards_deck_card dropped (or did not exist).');

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_cards_deck_card_zone
      ON deck_cards (deck_id, card_id, zone);
    `);
    console.log('  [3/5] new unique index idx_deck_cards_deck_card_zone created (or already existed).');

    await client.query(`
      ALTER TABLE decks
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
    `);
    console.log("  [4/5] status column added to decks (or already existed).");

    await client.query(`
      ALTER TABLE cards
      ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';
    `);
    console.log('  [5/5] keywords column added to cards (or already existed).');

    console.log('Migration 01.2-01 complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
