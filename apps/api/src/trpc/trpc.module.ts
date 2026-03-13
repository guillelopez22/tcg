import { Module } from '@nestjs/common';
import { TrpcCoreModule } from './trpc-core.module';
import { TrpcRouter } from './trpc.router';
import { TrpcController } from './trpc.controller';
import { AuthModule } from '../modules/auth/auth.module';
import { CardModule } from '../modules/card/card.module';
import { UserModule } from '../modules/user/user.module';
import { CollectionModule } from '../modules/collection/collection.module';
import { WishlistModule } from '../modules/wishlist/wishlist.module';
import { DeckModule } from '../modules/deck/deck.module';
import { PriceSyncModule } from '../modules/price-sync/price-sync.module';
import { ScannerModule } from '../modules/scanner/scanner.module';
import { DeckRecommendationsModule } from '../modules/deck-recommendations/deck-recommendations.module';
import { DeckSyncModule } from '../modules/deck-sync/deck-sync.module';
import { KeywordTagModule } from '../modules/deck/keyword-tag.module';
import { MatchModule } from '../modules/match/match.module';
import { NewsModule } from '../modules/news/news.module';

@Module({
  imports: [TrpcCoreModule, AuthModule, CardModule, UserModule, CollectionModule, WishlistModule, DeckModule, PriceSyncModule, ScannerModule, DeckRecommendationsModule, DeckSyncModule, KeywordTagModule, MatchModule, NewsModule],
  providers: [TrpcRouter],
  controllers: [TrpcController],
  exports: [TrpcCoreModule],
})
export class TrpcModule {}
