const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env manually since dotenv may not be installed
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        process.env[key] = value;
      }
    }
  });
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await client.connect();
  console.log('Connected to database');

  try {
    // Add new enums (ignore if already exist)
    try {
      await client.query("CREATE TYPE card_variant AS ENUM('normal', 'alt_art', 'overnumbered', 'signature')");
      console.log('Created card_variant enum');
    } catch (e) {
      if (e.code === '42710') {
        console.log('card_variant enum already exists, skipping');
      } else throw e;
    }

    try {
      await client.query("CREATE TYPE wishlist_type AS ENUM('want', 'trade')");
      console.log('Created wishlist_type enum');
    } catch (e) {
      if (e.code === '42710') {
        console.log('wishlist_type enum already exists, skipping');
      } else throw e;
    }

    // Drop unique constraint on collections
    await client.query('DROP INDEX IF EXISTS idx_collections_user_card_condition');
    console.log('Dropped idx_collections_user_card_condition index');

    // Drop quantity column from collections
    try {
      await client.query('ALTER TABLE collections DROP COLUMN IF EXISTS quantity');
      console.log('Dropped quantity column');
    } catch (e) {
      console.log('Drop quantity:', e.message);
    }

    // Add new columns to collections
    try {
      await client.query("ALTER TABLE collections ADD COLUMN IF NOT EXISTS variant card_variant NOT NULL DEFAULT 'normal'");
      console.log('Added variant column');
    } catch (e) {
      console.log('Add variant:', e.message);
    }

    try {
      await client.query('ALTER TABLE collections ADD COLUMN IF NOT EXISTS purchase_price numeric(10,2)');
      console.log('Added purchase_price column');
    } catch (e) {
      console.log('Add purchase_price:', e.message);
    }

    try {
      await client.query('ALTER TABLE collections ADD COLUMN IF NOT EXISTS photo_url varchar(500)');
      console.log('Added photo_url column');
    } catch (e) {
      console.log('Add photo_url:', e.message);
    }

    try {
      await client.query('ALTER TABLE collections ADD COLUMN IF NOT EXISTS photo_key varchar(500)');
      console.log('Added photo_key column');
    } catch (e) {
      console.log('Add photo_key:', e.message);
    }

    // Add composite index on collections
    await client.query('CREATE INDEX IF NOT EXISTS idx_collections_user_card ON collections(user_id, card_id)');
    console.log('Created idx_collections_user_card index');

    // Create wishlists table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id uuid NOT NULL REFERENCES cards(id),
        type wishlist_type NOT NULL,
        preferred_variant card_variant,
        max_price numeric(10,2),
        asking_price numeric(10,2),
        is_public boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log('Created wishlists table');

    // Add unique index on wishlists
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_user_card_type ON wishlists(user_id, card_id, type)');
    console.log('Created idx_wishlists_user_card_type index');

    console.log('\nMigration complete successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
