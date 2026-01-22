import { Listing } from './listing.interface';

export interface Shop {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  logoUrl?: string;
  isVerified: boolean;
  rating: number;
  totalSales: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopWithListings extends Shop {
  listings: Listing[];
}
