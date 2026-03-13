export declare const LISTING_STATUSES: readonly ["draft", "active", "sold", "cancelled", "expired"];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export declare const SHIPPING_OPTIONS: readonly ["local", "national", "both"];
export type ShippingOption = (typeof SHIPPING_OPTIONS)[number];
