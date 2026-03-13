import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { PriceSyncService } from './price-sync.service';

@Injectable()
export class PriceSyncRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly priceSyncService: PriceSyncService,
  ) {}

  buildRouter() {
    const protected_ = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      syncNow: protected_
        .mutation(() => this.priceSyncService.syncNow()),
    });
  }
}
