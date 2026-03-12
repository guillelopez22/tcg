import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DeckService } from './deck.service';
import {
  deckListSchema,
  deckGetByIdSchema,
  deckCreateSchema,
  deckUpdateSchema,
  deckDeleteSchema,
  deckSetCardsSchema,
  deckBrowseSchema,
  deckSuggestSchema,
  deckBuildabilitySchema,
  shareCodeGenerateSchema,
  shareCodeResolveSchema,
  deckImportTextSchema,
  deckImportUrlSchema,
} from '@la-grieta/shared';

@Injectable()
export class DeckRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly deckService: DeckService,
  ) {}

  buildRouter() {
    const proc = this.trpc.rateLimitedProtectedProcedure;
    const pub = this.trpc.rateLimitedPublicProcedure;

    return this.trpc.router({
      create: proc
        .input(deckCreateSchema)
        .mutation(({ ctx, input }) => this.deckService.create(ctx.userId, input)),

      update: proc
        .input(deckUpdateSchema)
        .mutation(({ ctx, input }) => this.deckService.update(ctx.userId, input)),

      delete: proc
        .input(deckDeleteSchema)
        .mutation(({ ctx, input }) => this.deckService.delete(ctx.userId, input)),

      setCards: proc
        .input(deckSetCardsSchema)
        .mutation(({ ctx, input }) => this.deckService.setCards(ctx.userId, input)),

      list: proc
        .input(deckListSchema)
        .query(({ ctx, input }) => this.deckService.list(ctx.userId, input)),

      // Optional auth — public decks visible to all, private decks only to owner
      getById: this.trpc.optionalAuthProcedure
        .input(deckGetByIdSchema)
        .query(({ ctx, input }) => this.deckService.getById(ctx.userId ?? null, input)),

      browse: pub
        .input(deckBrowseSchema)
        .query(({ input }) => this.deckService.browse(input)),

      suggest: proc
        .input(deckSuggestSchema)
        .query(({ ctx, input }) => this.deckService.suggest(ctx.userId, input)),

      buildability: proc
        .input(deckBuildabilitySchema)
        .query(({ ctx, input }) => this.deckService.getBuildability(ctx.userId, input.deckId)),

      // Share code endpoints
      generateShareCode: proc
        .input(shareCodeGenerateSchema)
        .mutation(({ ctx, input }) => this.deckService.generateShareCode(ctx.userId, input.deckId)),

      // resolveShareCode is a QUERY (read-only, no side effects)
      // Clients should call with .useQuery() or .fetch(), NOT .mutate()
      resolveShareCode: pub
        .input(shareCodeResolveSchema)
        .query(({ input }) => this.deckService.resolveShareCode(input.code)),

      // Import endpoints
      importFromText: proc
        .input(deckImportTextSchema)
        .mutation(({ ctx, input }) => this.deckService.importFromText(ctx.userId, input)),

      importFromUrl: proc
        .input(deckImportUrlSchema)
        .mutation(({ ctx, input }) => this.deckService.importFromUrl(ctx.userId, input)),
    });
  }
}
