import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Card, CardType, Domain, CardRarity } from '@la-grieta/shared';

export interface CardFilters {
  name?: string;
  cardType?: CardType;
  domains?: Domain[];
  rarity?: CardRarity;
  setCode?: string;
}

export interface CardResponse {
  cards: Card[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CardSet {
  code: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class CardsService {
  private api = inject(ApiService);

  getCards(filters?: CardFilters, page = 0, limit = 24): Observable<CardResponse> {
    const params: any = {
      page,
      limit
    };

    if (filters) {
      if (filters.name) {
        params.name = filters.name;
      }
      if (filters.cardType) {
        params.cardType = filters.cardType;
      }
      if (filters.domains && filters.domains.length > 0) {
        params.domains = filters.domains.join(',');
      }
      if (filters.rarity) {
        params.rarity = filters.rarity;
      }
      if (filters.setCode) {
        params.setCode = filters.setCode;
      }
    }

    return this.api.get<CardResponse>('cards', params);
  }

  getCardById(id: string): Observable<Card> {
    return this.api.get<Card>(`cards/${id}`);
  }

  getCardSets(): Observable<CardSet[]> {
    return this.api.get<CardSet[]>('cards/sets');
  }

  syncCards(): Observable<{ message: string; count: number }> {
    return this.api.post<{ message: string; count: number }>('cards/sync', {});
  }
}
