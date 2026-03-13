import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { MatchService } from './match.service';
import {
  matchCreateSchema,
  matchJoinSchema,
  matchHistorySchema,
} from '@la-grieta/shared';

@Injectable()
export class MatchRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly matchService: MatchService,
  ) {}

  buildRouter() {
    return this.trpc.router({
      create: this.trpc.optionalAuthProcedure
        .input(matchCreateSchema)
        .mutation(({ ctx, input }) =>
          this.matchService.create(
            (ctx as { userId?: string }).userId ?? null,
            input,
          ),
        ),

      join: this.trpc.optionalAuthProcedure
        .input(matchJoinSchema)
        .mutation(({ ctx, input }) =>
          this.matchService.join(
            (ctx as { userId?: string }).userId ?? null,
            input,
          ),
        ),

      getState: this.trpc.publicProcedure
        .input(z.object({ code: z.string() }))
        .query(({ input }) => this.matchService.getFullState(input.code)),

      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(({ input }) => this.matchService.getById(input.id)),

      history: this.trpc.rateLimitedProtectedProcedure
        .input(matchHistorySchema)
        .query(({ ctx, input }) =>
          this.matchService.history(
            (ctx as { userId: string }).userId,
            input,
          ),
        ),
    });
  }
}
