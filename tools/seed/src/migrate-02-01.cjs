/**
 * Migration 02-01: Create deck_share_codes table.
 *
 * Usage:
 *   DATABASE_URL=... node tools/seed/src/migrate-02-01.cjs
 *
 * Idempotent: uses IF NOT EXISTS to skip if table already exists.
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
    console.log('Running migration 02-01: Create deck_share_codes table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS deck_share_codes (
        code VARCHAR(12) PRIMARY KEY,
        deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_deck_share_codes_deck_id ON deck_share_codes(deck_id);
    `);

    console.log('Migration complete: deck_share_codes table created (or already existed).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
