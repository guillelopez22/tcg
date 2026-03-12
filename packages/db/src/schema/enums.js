"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderStatusEnum = exports.listingStatusEnum = exports.wishlistTypeEnum = exports.cardVariantEnum = exports.cardConditionEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.cardConditionEnum = (0, pg_core_1.pgEnum)('card_condition', [
    'mint',
    'near_mint',
    'lightly_played',
    'moderately_played',
    'heavily_played',
    'damaged',
]);
exports.cardVariantEnum = (0, pg_core_1.pgEnum)('card_variant', [
    'normal',
    'alt_art',
    'overnumbered',
    'signature',
]);
exports.wishlistTypeEnum = (0, pg_core_1.pgEnum)('wishlist_type', ['want', 'trade']);
exports.listingStatusEnum = (0, pg_core_1.pgEnum)('listing_status', [
    'active',
    'sold',
    'cancelled',
]);
exports.orderStatusEnum = (0, pg_core_1.pgEnum)('order_status', [
    'pending',
    'paid',
    'shipped',
    'delivered',
    'completed',
    'disputed',
    'cancelled',
    'refunded',
]);
