import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { CollectionsModule } from './collections/collections.module';
import { DecksModule } from './decks/decks.module';
import { ScannerModule } from './scanner/scanner.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    CardsModule,
    CollectionsModule,
    DecksModule,
    ScannerModule,
    MarketplaceModule,
    StripeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
