"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistListSchema = exports.wishlistUpdateSchema = exports.wishlistToggleSchema = void 0;
const zod_1 = require("zod");
const card_constants_1 = require("../constants/card.constants");
exports.wishlistToggleSchema = zod_1.z.object({
    cardId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(card_constants_1.WISHLIST_TYPES),
});
exports.wishlistUpdateSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    preferredVariant: zod_1.z.enum(card_constants_1.CARD_VARIANTS).optional(),
    maxPrice: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    askingPrice: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    isPublic: zod_1.z.boolean().optional(),
});
exports.wishlistListSchema = zod_1.z.object({
    type: zod_1.z.enum(card_constants_1.WISHLIST_TYPES),
    cursor: zod_1.z.string().uuid().optional(),
    limit: zod_1.z.number().min(1).max(100).default(20),
});
