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

@Module({
  imports: [TrpcCoreModule, AuthModule, CardModule, UserModule, CollectionModule, WishlistModule, DeckModule, PriceSyncModule, ScannerModule, DeckRecommendationsModule],
  providers: [TrpcRouter],
  controllers: [TrpcController],
  exports: [TrpcCoreModule],
})
export class TrpcModule {}
