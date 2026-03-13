import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbClient } from './client';

export async function runMigrations(connectionString: string): Promise<void> {
  const db = createDbClient(connectionString);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed successfully');
}
