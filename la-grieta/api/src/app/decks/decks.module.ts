import { Module } from '@nestjs/common';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';
import { DeckValidationService } from './deck-validation.service';
import { DeckStatsService } from './deck-stats.service';

@Module({
  controllers: [DecksController],
  providers: [DecksService, DeckValidationService, DeckStatsService],
  exports: [DecksService],
})
export class DecksModule {}
