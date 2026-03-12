import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { ScannerService } from './scanner.service';

@Injectable()
export class ScannerRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly scannerService: ScannerService,
  ) {}

  buildRouter() {
    const pub = this.trpc.rateLimitedPublicProcedure;

    return this.trpc.router({
      /**
       * Accepts a base64-encoded JPEG/PNG of the card viewfinder crop and
       * returns the top matching cards ranked by NCC score.
       */
      identify: pub
        .input(
          z.object({
            frame: z.string().min(1, 'Frame must not be empty'),
          }),
        )
        .output(
          z.object({
            matches: z.array(
              z.object({
                cardId: z.string(),
                name: z.string(),
                number: z.string().nullable(),
                setName: z.string(),
                imageSmall: z.string().nullable(),
                score: z.number(),
                displayPct: z.number().int().min(0).max(100),
              }),
            ),
          }),
        )
        .mutation(async ({ input }) => {
          const matches = await this.scannerService.identify(input.frame);
          return { matches };
        }),

      /**
       * Returns the current fingerprint load status.
       * The frontend can poll this before showing the scanner UI.
       */
      status: pub
        .output(
          z.object({
            ready: z.boolean(),
            loaded: z.number().int(),
            total: z.number().int(),
          }),
        )
        .query(() => this.scannerService.getStatus()),
    });
  }
}
