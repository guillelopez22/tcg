import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { ShopsService } from './shops.service';
import { ShopsController } from './shops.controller';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  controllers: [ListingsController, ShopsController, OrdersController],
  providers: [ListingsService, ShopsService, OrdersService],
  exports: [ListingsService, ShopsService, OrdersService],
})
export class MarketplaceModule {}
