import { z } from 'zod';
import { DECK_ZONES, RUNE_DECK_SIZE } from '../constants/card.constants';

// Runes can have up to RUNE_DECK_SIZE (12) copies; regular cards max at 3.
// Validation uses the higher bound; per-zone limits are enforced server-side.
export const deckCardEntrySchema = z.object({
  cardId: z.string().uuid(),
  quantity: z.number().int().min(1).max(RUNE_DECK_SIZE),
  zone: z.enum(DECK_ZONES).default('main'),
});

export const deckListSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().min(1).max(50).default(10),
});

export const deckGetByIdSchema = z.object({
  id: z.string().uuid(),
});

export const deckCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().default(false),
  coverCardId: z.string().uuid().optional(),
  // 40 main + 12 runes + 1 champion + 8 sideboard = 61 max entries
  cards: z.array(deckCardEntrySchema).max(61).optional(),
});

export const deckUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
  coverCardId: z.string().uuid().optional(),
});

export const deckDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const deckSetCardsSchema = z.object({
  deckId: z.string().uuid(),
  // 40 main + 12 runes + 1 champion + 8 sideboard = 61 max entries
  cards: z.array(deckCardEntrySchema).max(61),
});

export const deckBrowseSchema = z.object({
  domain: z.string().optional(),
  search: z.string().max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().min(1).max(50).default(10),
});

export const deckSuggestSchema = z.object({
  deckId: z.string().uuid(),
  mode: z.enum(['owned_first', 'best_fit']).default('best_fit'),
  zone: z.enum(DECK_ZONES).default('main'),
});

export const deckBuildabilitySchema = z.object({
  deckId: z.string().uuid(),
});

export type DeckCardEntry = z.infer<typeof deckCardEntrySchema>;
export type DeckListInput = z.infer<typeof deckListSchema>;
export type DeckGetByIdInput = z.infer<typeof deckGetByIdSchema>;
export type DeckCreateInput = z.infer<typeof deckCreateSchema>;
export type DeckUpdateInput = z.infer<typeof deckUpdateSchema>;
export type DeckDeleteInput = z.infer<typeof deckDeleteSchema>;
export type DeckSetCardsInput = z.infer<typeof deckSetCardsSchema>;
export type DeckBrowseInput = z.infer<typeof deckBrowseSchema>;
export type DeckSuggestInput = z.infer<typeof deckSuggestSchema>;
export type DeckBuildabilityInput = z.infer<typeof deckBuildabilitySchema>;
