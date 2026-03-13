/**
 * CLI entrypoint for the card seed script.
 * Usage: pnpm --filter @la-grieta/seed seed
 * Requires DATABASE_URL environment variable.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbClient } from '@la-grieta/db';
import { sets, cards } from '@la-grieta/db';
import { eq } from 'drizzle-orm';
import { seedCards, mapSetToInsert, mapCardToInsert, type SeedDb } from './seed-cards';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const db = createDbClient(databaseUrl);

  // Resolve data repo path relative to the monorepo root (2 levels up from tools/seed)
  const dataRepoPath = join(dirname(fileURLToPath(import.meta.url)), '../../../riftbound-tcg-data');

  const seedDb: SeedDb = {
    async insertOrUpdateSet(data: ReturnType<typeof mapSetToInsert>) {
      const [row] = await db
        .insert(sets)
        .values({
          externalId: data.externalId,
          slug: data.slug,
          name: data.name,
          total: data.total,
          releaseDate: data.releaseDate,
          description: data.description ?? undefined,
          tcgplayerGroupId: data.tcgplayerGroupId ?? undefined,
        })
        .onConflictDoUpdate({
          target: sets.slug,
          set: {
            name: data.name,
            total: data.total,
            releaseDate: data.releaseDate,
            description: data.description ?? undefined,
            tcgplayerGroupId: data.tcgplayerGroupId ?? undefined,
          },
        })
        .returning({ id: sets.id, slug: sets.slug });
      if (!row) throw new Error(`Failed to upsert set: ${data.slug}`);
      return row;
    },

    async insertOrUpdateCard(data: ReturnType<typeof mapCardToInsert>) {
      await db
        .insert(cards)
        .values({
          externalId: data.externalId,
          number: data.number,
          code: data.code,
          name: data.name,
          cleanName: data.cleanName,
          setId: data.setId,
          rarity: data.rarity,
          cardType: data.cardType,
          domain: data.domain,
          energyCost: data.energyCost ?? undefined,
          powerCost: data.powerCost ?? undefined,
          might: data.might ?? undefined,
          description: data.description ?? undefined,
          flavorText: data.flavorText ?? undefined,
          imageSmall: data.imageSmall ?? undefined,
          imageLarge: data.imageLarge ?? undefined,
          tcgplayerId: data.tcgplayerId ?? undefined,
          tcgplayerUrl: data.tcgplayerUrl ?? undefined,
          isProduct: data.isProduct,
        })
        .onConflictDoUpdate({
          target: cards.externalId,
          set: {
            name: data.name,
            cleanName: data.cleanName,
            rarity: data.rarity,
            cardType: data.cardType,
            domain: data.domain,
            energyCost: data.energyCost ?? undefined,
            powerCost: data.powerCost ?? undefined,
            might: data.might ?? undefined,
            description: data.description ?? undefined,
            flavorText: data.flavorText ?? undefined,
            imageSmall: data.imageSmall ?? undefined,
            imageLarge: data.imageLarge ?? undefined,
            tcgplayerId: data.tcgplayerId ?? undefined,
            tcgplayerUrl: data.tcgplayerUrl ?? undefined,
            isProduct: data.isProduct,
          },
        });
    },
  };

  console.log('Starting card seed...');
  console.log(`Data repo: ${dataRepoPath}`);

  const result = await seedCards(seedDb, dataRepoPath);

  console.log('\nSeed complete!');
  console.log(`  Sets seeded:     ${result.sets}`);
  console.log(`  Cards seeded:    ${result.cards}`);
  console.log(`  Products seeded: ${result.products}`);
  console.log(`  Total rows:      ${result.cards + result.products}`);

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
