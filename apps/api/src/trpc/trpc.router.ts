import { Injectable } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { AuthRouter } from '../modules/auth/auth.router';
import { CardRouter } from '../modules/card/card.router';
import { UserRouter } from '../modules/user/user.router';
import { CollectionRouter } from '../modules/collection/collection.router';
import { WishlistRouter } from '../modules/wishlist/wishlist.router';
import { DeckRouter } from '../modules/deck/deck.router';
import { PriceSyncRouter } from '../modules/price-sync/price-sync.router';
import { ScannerRouter } from '../modules/scanner/scanner.router';
import { DeckRecommendationsRouter } from '../modules/deck-recommendations/deck-recommendations.router';
import { DeckSyncRouter } from '../modules/deck-sync/deck-sync.router';

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authRouter: AuthRouter,
    private readonly cardRouter: CardRouter,
    private readonly userRouter: UserRouter,
    private readonly collectionRouter: CollectionRouter,
    private readonly wishlistRouter: WishlistRouter,
    private readonly deckRouter: DeckRouter,
    private readonly priceSyncRouter: PriceSyncRouter,
    private readonly scannerRouter: ScannerRouter,
    private readonly deckRecommendationsRouter: DeckRecommendationsRouter,
    private readonly deckSyncRouter: DeckSyncRouter,
  ) {}

  buildRouter() {
    return this.trpc.router({
      health: this.trpc.publicProcedure.query(() => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
      })),
      auth: this.authRouter.buildRouter(),
      card: this.cardRouter.buildRouter(),
      user: this.userRouter.buildRouter(),
      collection: this.collectionRouter.buildRouter(),
      wishlist: this.wishlistRouter.buildRouter(),
      deck: this.deckRouter.buildRouter(),
      priceSync: this.priceSyncRouter.buildRouter(),
      scanner: this.scannerRouter.buildRouter(),
      deckRecommendations: this.deckRecommendationsRouter.buildRouter(),
      deckSync: this.deckSyncRouter.buildRouter(),
    });
  }
}

export type AppRouter = ReturnType<TrpcRouter['buildRouter']>;
