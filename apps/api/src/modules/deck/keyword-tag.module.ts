import { Module } from '@nestjs/common';
import { KeywordTagService } from './keyword-tag.service';
import { DB_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';

// Note: ScheduleModule.forRoot() is already imported in AppModule — do NOT import it again here.

@Module({
  providers: [
    {
      provide: KeywordTagService,
      useFactory: (db: DbClient) => new KeywordTagService(db),
      inject: [DB_TOKEN],
    },
  ],
  exports: [KeywordTagService],
})
export class KeywordTagModule {}
