import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { UserService } from './user.service';
import { updateUserSchema } from '@la-grieta/shared';

@Injectable()
export class UserRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly userService: UserService,
  ) {}

  buildRouter() {
    const pub = this.trpc.rateLimitedPublicProcedure;
    const protected_ = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      getProfile: pub
        .input(z.object({ username: z.string() }))
        .query(({ input }) => this.userService.getPublicProfile(input.username)),

      me: protected_
        .query(({ ctx }) => this.userService.getProfileById(ctx.userId)),

      updateProfile: protected_
        .input(updateUserSchema)
        .mutation(({ ctx, input }) => this.userService.updateProfile(ctx.userId, input)),
    });
  }
}
