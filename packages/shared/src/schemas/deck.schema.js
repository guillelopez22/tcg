"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckImportUrlInput = exports.DeckImportTextInput = exports.ShareCodeResolveInput = exports.ShareCodeGenerateInput = exports.DeckBuildabilityInput = exports.DeckSuggestInput = exports.DeckBrowseInput = exports.DeckSetCardsInput = exports.DeckDeleteInput = exports.DeckUpdateInput = exports.DeckCreateInput = exports.DeckGetByIdInput = exports.DeckListInput = exports.DeckCardEntry = exports.deckImportUrlSchema = exports.deckImportTextSchema = exports.shareCodeResolveSchema = exports.shareCodeGenerateSchema = exports.deckBuildabilitySchema = exports.deckSuggestSchema = exports.deckBrowseSchema = exports.deckSetCardsSchema = exports.deckDeleteSchema = exports.deckUpdateSchema = exports.deckCreateSchema = exports.deckGetByIdSchema = exports.deckListSchema = exports.deckCardEntrySchema = void 0;
const zod_1 = require("zod");
const card_constants_1 = require("../constants/card.constants");
const deckCardEntrySchema = zod_1.z.object({
    cardId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().int().min(1).max(card_constants_1.MAX_COPIES_PER_CARD),
    zone: zod_1.z.enum(card_constants_1.DECK_ZONES).default('main'),
});
exports.deckCardEntrySchema = deckCardEntrySchema;
exports.deckListSchema = zod_1.z.object({
    cursor: zod_1.z.string().uuid().optional(),
    limit: zod_1.z.number().min(1).max(50).default(10),
});
exports.deckGetByIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.deckCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(1000).optional(),
    isPublic: zod_1.z.boolean().default(false),
    coverCardId: zod_1.z.string().uuid().optional(),
    cards: zod_1.z.array(deckCardEntrySchema).max(61).optional(),
});
exports.deckUpdateSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().max(1000).optional(),
    isPublic: zod_1.z.boolean().optional(),
    coverCardId: zod_1.z.string().uuid().optional(),
});
exports.deckDeleteSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.deckSetCardsSchema = zod_1.z.object({
    deckId: zod_1.z.string().uuid(),
    cards: zod_1.z.array(deckCardEntrySchema).max(61),
});
exports.deckBrowseSchema = zod_1.z.object({
    domain: zod_1.z.string().optional(),
    search: zod_1.z.string().max(100).optional(),
    championName: zod_1.z.string().max(100).optional(),
    cursor: zod_1.z.string().uuid().optional(),
    limit: zod_1.z.number().min(1).max(50).default(10),
});
exports.deckSuggestSchema = zod_1.z.object({
    deckId: zod_1.z.string().uuid(),
    mode: zod_1.z.enum(['owned_first', 'best_fit']).default('best_fit'),
    zone: zod_1.z.enum(card_constants_1.DECK_ZONES).default('main'),
});
exports.deckBuildabilitySchema = zod_1.z.object({
    deckId: zod_1.z.string().uuid(),
});
exports.shareCodeGenerateSchema = zod_1.z.object({
    deckId: zod_1.z.string().uuid(),
});
exports.shareCodeResolveSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(12),
});
exports.deckImportTextSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(10000),
    name: zod_1.z.string().min(1).max(100).optional(),
});
exports.deckImportUrlSchema = zod_1.z.object({
    url: zod_1.z.string().url().max(500),
    name: zod_1.z.string().min(1).max(100).optional(),
});
