import { Module } from '@nestjs/common';
import { DeckService } from './deck.service';
import { DeckImportService } from './deck-import.service';
import { DeckSuggestionsService } from './deck-suggestions.service';
import { DeckValidationService } from './deck-validation.service';
import { DeckRouter } from './deck.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN, REDIS_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import type Redis from 'ioredis';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: DeckValidationService,
      useFactory: (db: DbClient) => new DeckValidationService(db),
      inject: [DB_TOKEN],
    },
    {
      provide: DeckService,
      useFactory: (db: DbClient, redis: Redis) =>
        new DeckService(db, redis),
      inject: [DB_TOKEN, REDIS_TOKEN],
    },
    {
      provide: DeckImportService,
      useFactory: (db: DbClient, validation: DeckValidationService) =>
        new DeckImportService(db, validation),
      inject: [DB_TOKEN, DeckValidationService],
    },
    {
      provide: DeckSuggestionsService,
      useFactory: (db: DbClient, redis: Redis) => new DeckSuggestionsService(db, redis),
      inject: [DB_TOKEN, REDIS_TOKEN],
    },
    DeckRouter,
  ],
  exports: [DeckRouter, DeckService, DeckImportService, DeckSuggestionsService, DeckValidationService],
})
export class DeckModule {}
