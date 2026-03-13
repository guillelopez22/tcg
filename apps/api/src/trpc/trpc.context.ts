import type { Request, Response } from 'express';
import type { DbClient } from '@la-grieta/db';
import type { Redis } from 'ioredis';

export interface TrpcContext {
  req: Request;
  res: Response;
  db: DbClient;
  redis: Redis;
  userId?: string;
  userRole?: string;
}

/** Narrowed context guaranteed by the auth middleware — userId is always present. */
export interface AuthenticatedTrpcContext extends TrpcContext {
  userId: string;
  userRole: string;
}

export interface CreateContextOptions {
  req: Request;
  res: Response;
  db: DbClient;
  redis: Redis;
}

export function createTrpcContext(opts: CreateContextOptions): TrpcContext {
  return {
    req: opts.req,
    res: opts.res,
    db: opts.db,
    redis: opts.redis,
  };
}
