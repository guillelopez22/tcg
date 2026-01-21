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
    path: '**',
    redirectTo: '/cards'
  }
];
