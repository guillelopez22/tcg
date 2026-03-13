import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { TrpcService } from '../../trpc/trpc.service';
import { AuthService } from './auth.service';
import {
  registerSchema,
  loginSchema,
} from '@la-grieta/shared';

@Injectable()
export class AuthRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authService: AuthService,
  ) {}

  buildRouter() {
    // Auth-sensitive endpoints: 10/min per IP
    const authLimitedProcedure = this.trpc.authProcedure;
    const protectedLimitedProcedure = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      register: authLimitedProcedure
        .input(registerSchema)
        .mutation(({ input, ctx }) => this.authService.register(input, ctx.res)),

      login: authLimitedProcedure
        .input(loginSchema)
        .mutation(({ input, ctx }) => this.authService.login(input, ctx.res)),

      // Refresh token is read from the httpOnly cookie — no body input required.
      // The cookie is set at path /api/trpc/auth.refresh so it is sent automatically.
      refresh: authLimitedProcedure
        .mutation(({ ctx }) => {
          const rawToken = ctx.req.cookies?.['refresh_token'] as string | undefined;
          if (!rawToken) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No refresh token provided' });
          }
          return this.authService.refresh(rawToken, ctx.res);
        }),

      logout: protectedLimitedProcedure
        .mutation(({ ctx }) => {
          const authHeader = ctx.req.headers['authorization'];
          const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : '';
          return this.authService.logout(ctx.userId, token);
        }),

      logoutAll: protectedLimitedProcedure
        .mutation(({ ctx }) => {
          const authHeader = ctx.req.headers['authorization'];
          const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : '';
          return this.authService.logoutAll(ctx.userId, token);
        }),

      me: protectedLimitedProcedure
        .query(({ ctx }) => this.authService.me(ctx.userId)),
    });
  }
}
