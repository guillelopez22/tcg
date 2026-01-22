import { ListingType, ListingStatus } from '../enums/listing-status.enum';

// ==================== LISTING DTOs ====================

export interface CreateListingDto {
  title: string;
  description?: string;
  type: ListingType;
  shopId?: string;

  // Pricing
  price?: number;
  startingBid?: number;
  buyNowPrice?: number;

  // Auction
  endsAt?: Date;

  // Items
  items: CreateListingItemDto[];
}

export interface CreateListingItemDto {
  cardId: string;
  quantity: number;
  condition: string;
}

export interface UpdateListingDto {
  title?: string;
  description?: string;
  price?: number;
  buyNowPrice?: number;
  status?: ListingStatus;
}

export interface ListingFiltersDto {
  status?: ListingStatus;
  type?: ListingType;
  cardId?: string;
  sellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  shopId?: string;
  page?: number;
  limit?: number;
}

// ==================== SHOP DTOs ====================

export interface CreateShopDto {
  name: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  logoUrl?: string;
}

export interface UpdateShopDto {
  name?: string;
  description?: string;
  bannerUrl?: string;
  logoUrl?: string;
}

// ==================== ORDER DTOs ====================

export interface CreateOrderDto {
  listingId: string;
  shippingAddress: ShippingAddressDto;
}

export interface ShippingAddressDto {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface UpdateOrderStatusDto {
  status: string; // OrderStatus enum values
  trackingNumber?: string;
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAYMENT_HELD = 'PAYMENT_HELD',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface OrderFiltersDto {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}
