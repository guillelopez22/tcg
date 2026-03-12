import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { CardService } from './card.service';
import {
  cardListSchema,
  cardGetByIdSchema,
  cardGetByExternalIdSchema,
  cardSyncSchema,
  cardGetPriceSchema,
} from '@la-grieta/shared';

@Injectable()
export class CardRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly cardService: CardService,
  ) {}

  buildRouter() {
    const pub = this.trpc.rateLimitedPublicProcedure;
    const protected_ = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      list: pub
        .input(cardListSchema)
        .query(({ input }) => this.cardService.list(input)),

      getById: pub
        .input(cardGetByIdSchema)
        .query(({ input }) => this.cardService.getById(input)),

      getByExternalId: pub
        .input(cardGetByExternalIdSchema)
        .query(({ input }) => this.cardService.getByExternalId(input)),

      sets: pub
        .query(() => this.cardService.getSets()),

      sync: protected_
        .input(cardSyncSchema)
        .query(({ input }) => this.cardService.sync(input)),

      getPrice: pub
        .input(cardGetPriceSchema)
        .query(({ input }) => this.cardService.getPrice(input)),

      legends: pub
        .query(() => this.cardService.getLegends()),
    });
  }
}
