import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';
import * as relations from './relations';

export type DbClient = ReturnType<typeof createDbClient>;

export function createDbClient(connectionString: string) {
  const pool = new Pool({
    connectionString,
    // Production-safe pool limits: enough headroom for Railway's container
    // without overwhelming a shared Postgres instance.
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return drizzle(pool, { schema: { ...schema, ...relations } });
}
