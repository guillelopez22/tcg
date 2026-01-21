import { Card } from './card.interface';

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  cardId: string;
  card?: Card;
  quantity: number;
  condition: string;
  acquiredAt: Date;
}

export interface CollectionWithItems extends Collection {
  items: CollectionItem[];
}

export interface CollectionWithCount extends Collection {
  itemCount: number;
}
