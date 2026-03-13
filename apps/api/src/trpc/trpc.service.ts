import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import * as jwt from 'jsonwebtoken';
import type { TrpcContext, AuthenticatedTrpcContext } from './trpc.context';
import { jwtPayloadSchema } from '@la-grieta/shared';
import { checkRateLimit, getClientIp } from '../modules/throttler/rate-limit.middleware';

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Strip stack traces in production
        stack: process.env['NODE_ENV'] === 'development' ? shape.data?.stack : undefined,
      },
    };
  },
});

// Logging middleware
const loggingMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  console.log(`[tRPC] ${type} ${path} — ${result.ok ? 'ok' : 'error'} (${durationMs}ms)`);
  return result;
});

// JWT verification + Redis blacklist check
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers['authorization'];
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/, '') : undefined;

  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing access token' });
  }

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Server configuration error' });
  }

  let rawPayload: unknown;
  try {
    rawPayload = jwt.verify(token, jwtSecret);
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired access token' });
  }

  const parsed = jwtPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token payload' });
  }

  const payload = parsed.data;

  const isBlacklisted = await ctx.redis.get(`blacklist:${token}`);
  if (isBlacklisted) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token has been revoked' });
  }

  return next({
    ctx: {
      userId: payload.sub,
      userRole: payload.role,
    },
  });
});

// Optional auth — extracts userId if a valid token is present, but doesn't require it
const optionalAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers['authorization'];
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/, '') : undefined;

  if (!token) {
    return next();
  }

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    return next();
  }

  try {
    const rawPayload = jwt.verify(token, jwtSecret);
    const parsed = jwtPayloadSchema.safeParse(rawPayload);
    if (parsed.success) {
      const isBlacklisted = await ctx.redis.get(`blacklist:${token}`);
      if (!isBlacklisted) {
        return next({
          ctx: {
            userId: parsed.data.sub,
            userRole: parsed.data.role,
          },
        });
      }
    }
  } catch {
    // Invalid token — continue as unauthenticated
  }

  return next();
});

/**
 * Public procedure — no auth required, with request logging.
 * Does not include rate limiting so it remains testable with minimal mocks.
 */
export const publicProcedure = t.procedure.use(loggingMiddleware);

/**
 * Protected procedure — validates JWT and checks Redis blacklist.
 * Does not include rate limiting so it remains testable with minimal mocks.
 */
export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(authMiddleware);

/**
 * Rate-limited variants — used in production routers.
 * Separated from base procedures to keep unit tests simple (no pipeline mock needed).
 */
export const rateLimitMiddleware = {
  /** 100/min per IP for public endpoints */
  public: t.middleware(async ({ ctx, next }) => {
    const ip = getClientIp(ctx.req as Parameters<typeof getClientIp>[0]);
    await checkRateLimit(ctx.redis, `public:${ip}`, { windowSeconds: 60, limit: 100 });
    return next();
  }),
  /** 10/min per IP for auth endpoints (register, login, refresh) */
  auth: t.middleware(async ({ ctx, next }) => {
    const ip = getClientIp(ctx.req as Parameters<typeof getClientIp>[0]);
    await checkRateLimit(ctx.redis, `auth:${ip}`, { windowSeconds: 60, limit: 10 });
    return next();
  }),
  /** 1000/min per userId for authenticated endpoints */
  authenticated: t.middleware(async ({ ctx, next }) => {
    const userId = (ctx as AuthenticatedTrpcContext).userId;
    await checkRateLimit(ctx.redis, `authed:${userId}`, { windowSeconds: 60, limit: 1000 });
    return next();
  }),
};

@Injectable()
export class TrpcService {
  get router() {
    return t.router;
  }

  get publicProcedure() {
    return publicProcedure;
  }

  get protectedProcedure() {
    return protectedProcedure;
  }

  /** Public procedure with optional auth — extracts userId if token present */
  get optionalAuthProcedure() {
    return publicProcedure.use(optionalAuthMiddleware).use(rateLimitMiddleware.public);
  }

  /** Public procedure with 100/min rate limit per IP */
  get rateLimitedPublicProcedure() {
    return publicProcedure.use(rateLimitMiddleware.public);
  }

  /** Auth endpoint procedure with 10/min rate limit per IP */
  get authProcedure() {
    return publicProcedure.use(rateLimitMiddleware.auth);
  }

  /** Protected procedure with 1000/min rate limit per userId */
  get rateLimitedProtectedProcedure() {
    return protectedProcedure.use(rateLimitMiddleware.authenticated);
  }

  get mergeRouters() {
    return t.mergeRouters;
  }
}
