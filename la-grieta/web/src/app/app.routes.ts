import { Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { CardBrowserComponent } from './features/cards/card-browser/card-browser.component';
import { CardDetailComponent } from './features/cards/card-detail/card-detail.component';
import { CollectionsListComponent } from './features/collections/pages/collections-list/collections-list.component';
import { CollectionDetailComponent } from './features/collections/pages/collection-detail/collection-detail.component';
import { DecksListComponent } from './features/decks/pages/decks-list/decks-list.component';
import { DeckBuilderComponent } from './features/decks/pages/deck-builder/deck-builder.component';
import { ScannerPageComponent } from './features/scanner/pages/scanner-page/scanner-page.component';
import { MarketplaceBrowseComponent } from './features/marketplace/pages/marketplace-browse/marketplace-browse.component';
import { ListingDetailComponent } from './features/marketplace/pages/listing-detail/listing-detail.component';
import { CreateListingComponent } from './features/marketplace/pages/create-listing/create-listing.component';
import { ShopProfileComponent } from './features/marketplace/pages/shop-profile/shop-profile.component';
import { MyShopComponent } from './features/marketplace/pages/my-shop/my-shop.component';
import { OrderHistoryComponent } from './features/marketplace/pages/order-history/order-history.component';
import { SalesDashboardComponent } from './features/marketplace/pages/sales-dashboard/sales-dashboard.component';
import { SellerOnboardingComponent } from './features/marketplace/pages/seller-onboarding/seller-onboarding.component';
import { CheckoutComponent } from './features/marketplace/pages/checkout/checkout.component';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/cards',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'cards',
    component: CardBrowserComponent,
    canActivate: [authGuard]
  },
  {
    path: 'cards/:id',
    component: CardDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'collections',
    component: CollectionsListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'collections/:id',
    component: CollectionDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'decks',
    component: DecksListComponent,
    canActivate: [authGuard]
  },
  {
    path: 'decks/:id',
    component: DeckBuilderComponent,
    canActivate: [authGuard]
  },
  {
    path: 'scanner',
    component: ScannerPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace',
    component: MarketplaceBrowseComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/listings/create',
    component: CreateListingComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/listings/:id',
    component: ListingDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/shops/my',
    component: MyShopComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/shops/:id',
    component: ShopProfileComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/orders',
    component: OrderHistoryComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/sales',
    component: SalesDashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/seller-onboarding',
    component: SellerOnboardingComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/checkout',
    component: CheckoutComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/checkout/success',
    component: CheckoutComponent,
    canActivate: [authGuard]
  },
  {
    path: 'marketplace/checkout/cancel',
    component: CheckoutComponent,
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/cards'
  }
];
