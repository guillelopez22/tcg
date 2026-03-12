/**
 * Migration 01.1-01: Add tier column to decks table.
 *
 * Usage:
 *   DATABASE_URL=... node tools/seed/src/migrate-01.1-01.cjs
 *
 * Idempotent: uses IF NOT EXISTS to skip if column already exists.
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
    console.log('Running migration 01.1-01: Add tier column to decks...');

    await client.query(`
      ALTER TABLE decks
      ADD COLUMN IF NOT EXISTS tier varchar(2);
    `);

    console.log('Migration complete: tier column added to decks table (or already existed).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
