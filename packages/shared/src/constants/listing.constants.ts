export const LISTING_STATUSES = ['draft', 'active', 'sold', 'cancelled', 'expired'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const SHIPPING_OPTIONS = ['local', 'national', 'both'] as const;
export type ShippingOption = (typeof SHIPPING_OPTIONS)[number];
