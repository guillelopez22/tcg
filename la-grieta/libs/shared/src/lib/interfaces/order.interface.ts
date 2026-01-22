import { ShippingAddressDto } from '../dto/marketplace.dto';

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;

  subtotal: number;
  shippingCost: number;
  platformFee: number;
  total: number;

  status: string; // OrderStatus

  stripePaymentId?: string;
  escrowHeldAt?: Date;
  escrowReleasedAt?: Date;

  shippingAddress: ShippingAddressDto;
  trackingNumber?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface OrderWithDetails extends Order {
  buyer?: {
    id: string;
    username: string;
    email: string;
  };
  seller?: {
    id: string;
    username: string;
    email: string;
  };
  listing?: {
    title: string;
    description?: string;
  };
}
