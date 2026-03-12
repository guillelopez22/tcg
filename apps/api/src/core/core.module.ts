import { Global, Module } from '@nestjs/common';
import { createDbClient } from '@la-grieta/db';
import Redis from 'ioredis';
import { createR2Client, validateR2Config, generateUploadUrl } from '@la-grieta/r2';
import type { R2Service } from '../modules/collection/collection.service';

export const DB_TOKEN = 'DB_CLIENT';
export const REDIS_TOKEN = 'REDIS_CLIENT';
export const R2_TOKEN = 'R2_SERVICE';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createR2Service(): R2Service {
  const config = validateR2Config(process.env);
  const client = createR2Client(config);
  return {
    generateUploadUrl: (input) =>
      generateUploadUrl(client, config, {
        purpose: input.purpose,
        userId: input.userId,
        contentType: input.contentType as 'image/jpeg' | 'image/png' | 'image/webp',
      }),
  };
}

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: () => createDbClient(requireEnv('DATABASE_URL')),
    },
    {
      provide: REDIS_TOKEN,
      useFactory: () => new Redis(requireEnv('REDIS_URL')),
    },
    {
      provide: R2_TOKEN,
      useFactory: () => createR2Service(),
    },
  ],
  exports: [DB_TOKEN, REDIS_TOKEN, R2_TOKEN],
})
export class CoreModule {}
