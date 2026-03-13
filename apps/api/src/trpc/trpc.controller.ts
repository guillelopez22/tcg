import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { TrpcRouter } from './trpc.router';
import { createTrpcContext } from './trpc.context';
import type { DbClient } from '@la-grieta/db';
import type { Redis } from 'ioredis';

import { Inject } from '@nestjs/common';
import { DB_TOKEN, REDIS_TOKEN } from '../core/core.module';

@Controller()
export class TrpcController {
  private readonly router;

  constructor(
    private readonly trpcRouter: TrpcRouter,
    @Inject(DB_TOKEN) private readonly db: DbClient,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {
    this.router = this.trpcRouter.buildRouter();
  }

  @All('trpc/:path*')
  async handler(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Convert Express Request to standard Request for fetch-based handler
    const url = `http://localhost${req.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      }
    }

    const fetchReq = new Request(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const response = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req: fetchReq as unknown as globalThis.Request,
      router: this.router,
      createContext: () =>
        createTrpcContext({ req, res, db: this.db, redis: this.redis }),
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const body = await response.text();
    res.send(body);
  }
}
