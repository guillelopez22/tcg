// Create Collection
export interface CreateCollectionDto {
  name: string;
  description?: string;
}

// Update Collection
export interface UpdateCollectionDto {
  name?: string;
  description?: string;
}

// Add Card to Collection
export interface AddCardToCollectionDto {
  cardId: string;
  quantity: number;
  condition: string;
}

// Update Collection Item
export interface UpdateCollectionItemDto {
  quantity?: number;
  condition?: string;
}

// Collection Response (flexible type for API responses)
export interface CollectionResponseDto {
  id: string;
  userId: string;
  name: string;
  description?: string;
  items: any[]; // Flexible to accommodate Prisma responses
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Collection Statistics
export interface CollectionStatsResponseDto {
  totalUniqueCards: number;
  totalQuantity: number;
  cardsByRarity: Record<string, number>;
  cardsByType: Record<string, number>;
  estimatedMarketValue: number;
}
