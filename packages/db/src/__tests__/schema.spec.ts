import { describe, it, expect } from 'vitest';
import { sets } from '../schema/sets';
import { cards } from '../schema/cards';
import { users } from '../schema/users';
import { sessions } from '../schema/sessions';
import { collections } from '../schema/collections';
import { decks, deckCards } from '../schema/decks';
import { listings } from '../schema/listings';
import { orders } from '../schema/orders';
import {
  usersRelations,
  sessionsRelations,
  setsRelations,
  cardsRelations,
  collectionsRelations,
  decksRelations,
  deckCardsRelations,
  listingsRelations,
  ordersRelations,
} from '../relations';

// ---------------------------------------------------------------------------
// Drizzle introspection helpers
// ---------------------------------------------------------------------------

/**
 * Returns the SQL table name stored by Drizzle in the Symbol(drizzle:Name) property.
 */
function getTableName(table: object): string | undefined {
  const sym = Object.getOwnPropertySymbols(table).find(
    (s) => s.toString() === 'Symbol(drizzle:Name)',
  );
  return sym ? (table as Record<symbol, string>)[sym] : undefined;
}

/**
 * Returns column metadata stored on the table object by key.
 */
function col<T = Record<string, unknown>>(table: object, colName: string): T {
  return (table as Record<string, unknown>)[colName] as T;
}

/**
 * Returns all inline FK definitions on a Drizzle table.
 * Each FK has a reference() method returning { columns, foreignTable, foreignColumns }.
 */
function getInlineForeignKeys(table: object): Array<{
  reference: () => { columns: Array<{ name: string }>; foreignTable: object };
}> {
  const sym = Object.getOwnPropertySymbols(table).find((s) =>
    s.toString().includes('PgInlineForeignKeys'),
  );
  return sym ? (table as Record<symbol, unknown[]>)[sym] as never : [];
}

/**
 * Returns the referenced SQL table name for a FK column.
 */
function fkReferencesTable(table: object, columnSqlName: string): string | undefined {
  const fks = getInlineForeignKeys(table);
  for (const fk of fks) {
    const ref = fk.reference();
    if (ref.columns.some((c) => c.name === columnSqlName)) {
      return getTableName(ref.foreignTable);
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// sets table
// ---------------------------------------------------------------------------
describe('schema: sets table', () => {
  it('should export the sets table', () => {
    expect(sets).toBeDefined();
  });

  it('should have the correct SQL table name "sets"', () => {
    expect(getTableName(sets)).toBe('sets');
  });

  it('should include all required columns', () => {
    const cols = Object.keys(sets);
    expect(cols).toContain('id');
    expect(cols).toContain('slug');
    expect(cols).toContain('name');
    expect(cols).toContain('total');
    expect(cols).toContain('releaseDate');
    expect(cols).toContain('createdAt');
    expect(cols).toContain('updatedAt');
  });

  it('should mark slug as unique', () => {
    expect(col<{ isUnique?: boolean }>(sets, 'slug').isUnique).toBe(true);
  });

  it('should mark slug as notNull', () => {
    expect(col<{ notNull?: boolean }>(sets, 'slug').notNull).toBe(true);
  });

  it('should mark name as notNull', () => {
    expect(col<{ notNull?: boolean }>(sets, 'name').notNull).toBe(true);
  });

  it('should mark total as notNull', () => {
    expect(col<{ notNull?: boolean }>(sets, 'total').notNull).toBe(true);
  });

  it('should allow null description (optional field)', () => {
    expect(col<{ notNull?: boolean }>(sets, 'description').notNull).toBeFalsy();
  });

  it('should allow null tcgplayerGroupId (optional field)', () => {
    expect(col<{ notNull?: boolean }>(sets, 'tcgplayerGroupId').notNull).toBeFalsy();
  });

  it('should infer correct select type shape (compile-time check)', () => {
    type SetRow = typeof sets.$inferSelect;
    const _check: keyof SetRow = 'slug';
    expect(_check).toBe('slug');
  });
});

// ---------------------------------------------------------------------------
// cards table
// ---------------------------------------------------------------------------
describe('schema: cards table', () => {
  it('should export the cards table', () => {
    expect(cards).toBeDefined();
  });

  it('should have the correct SQL table name "cards"', () => {
    expect(getTableName(cards)).toBe('cards');
  });

  it('should include all required columns', () => {
    const cols = Object.keys(cards);
    expect(cols).toContain('id');
    expect(cols).toContain('externalId');
    expect(cols).toContain('number');
    expect(cols).toContain('code');
    expect(cols).toContain('name');
    expect(cols).toContain('cleanName');
    expect(cols).toContain('setId');
    expect(cols).toContain('rarity');
    expect(cols).toContain('cardType');
    expect(cols).toContain('domain');
    expect(cols).toContain('energyCost');
    expect(cols).toContain('powerCost');
    expect(cols).toContain('might');
    expect(cols).toContain('description');
    expect(cols).toContain('flavorText');
    expect(cols).toContain('imageSmall');
    expect(cols).toContain('imageLarge');
    expect(cols).toContain('isProduct');
    expect(cols).toContain('createdAt');
    expect(cols).toContain('updatedAt');
  });

  it('should mark externalId as unique', () => {
    expect(col<{ isUnique?: boolean }>(cards, 'externalId').isUnique).toBe(true);
  });

  it('should mark externalId as notNull', () => {
    expect(col<{ notNull?: boolean }>(cards, 'externalId').notNull).toBe(true);
  });

  it('should default isProduct to false', () => {
    expect(col<{ default?: unknown }>(cards, 'isProduct').default).toBe(false);
  });

  it('should allow null for energyCost (optional numeric)', () => {
    expect(col<{ notNull?: boolean }>(cards, 'energyCost').notNull).toBeFalsy();
  });

  it('should allow null for powerCost (optional numeric)', () => {
    expect(col<{ notNull?: boolean }>(cards, 'powerCost').notNull).toBeFalsy();
  });

  it('should allow null for might (optional numeric)', () => {
    expect(col<{ notNull?: boolean }>(cards, 'might').notNull).toBeFalsy();
  });

  it('should have setId referencing the "sets" table via FK', () => {
    expect(fkReferencesTable(cards, 'set_id')).toBe('sets');
  });

  it('should have setId as notNull (required FK)', () => {
    expect(col<{ notNull?: boolean }>(cards, 'setId').notNull).toBe(true);
  });

  it('should have exactly one inline FK (setId -> sets)', () => {
    expect(getInlineForeignKeys(cards)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// users table
// ---------------------------------------------------------------------------
describe('schema: users table', () => {
  it('should export the users table', () => {
    expect(users).toBeDefined();
  });

  it('should have the correct SQL table name "users"', () => {
    expect(getTableName(users)).toBe('users');
  });

  it('should mark email as unique', () => {
    expect(col<{ isUnique?: boolean }>(users, 'email').isUnique).toBe(true);
  });

  it('should mark email as notNull', () => {
    expect(col<{ notNull?: boolean }>(users, 'email').notNull).toBe(true);
  });

  it('should mark username as unique', () => {
    expect(col<{ isUnique?: boolean }>(users, 'username').isUnique).toBe(true);
  });

  it('should mark username as notNull', () => {
    expect(col<{ notNull?: boolean }>(users, 'username').notNull).toBe(true);
  });

  it('should mark passwordHash as notNull', () => {
    expect(col<{ notNull?: boolean }>(users, 'passwordHash').notNull).toBe(true);
  });

  it('should default role to "user"', () => {
    expect(col<{ default?: unknown }>(users, 'role').default).toBe('user');
  });

  it('should default isVerified to false', () => {
    expect(col<{ default?: unknown }>(users, 'isVerified').default).toBe(false);
  });

  it('should default isActive to true', () => {
    expect(col<{ default?: unknown }>(users, 'isActive').default).toBe(true);
  });

  it('should include whatsappPhone column for bot integration', () => {
    expect(Object.keys(users)).toContain('whatsappPhone');
  });

  it('should allow null whatsappPhone (optional)', () => {
    expect(col<{ notNull?: boolean }>(users, 'whatsappPhone').notNull).toBeFalsy();
  });

  it('should allow null city (optional)', () => {
    expect(col<{ notNull?: boolean }>(users, 'city').notNull).toBeFalsy();
  });

  it('should allow null displayName (optional)', () => {
    expect(col<{ notNull?: boolean }>(users, 'displayName').notNull).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// sessions table
// ---------------------------------------------------------------------------
describe('schema: sessions table', () => {
  it('should export the sessions table', () => {
    expect(sessions).toBeDefined();
  });

  it('should have the correct SQL table name "sessions"', () => {
    expect(getTableName(sessions)).toBe('sessions');
  });

  it('should mark refreshToken as unique', () => {
    expect(col<{ isUnique?: boolean }>(sessions, 'refreshToken').isUnique).toBe(true);
  });

  it('should mark refreshToken as notNull', () => {
    expect(col<{ notNull?: boolean }>(sessions, 'refreshToken').notNull).toBe(true);
  });

  it('should default isRevoked to false', () => {
    expect(col<{ default?: unknown }>(sessions, 'isRevoked').default).toBe(false);
  });

  it('should mark userId as notNull', () => {
    expect(col<{ notNull?: boolean }>(sessions, 'userId').notNull).toBe(true);
  });

  it('should have userId FK referencing the "users" table', () => {
    expect(fkReferencesTable(sessions, 'user_id')).toBe('users');
  });

  it('should mark expiresAt as notNull (required TTL)', () => {
    expect(col<{ notNull?: boolean }>(sessions, 'expiresAt').notNull).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// collections table
// ---------------------------------------------------------------------------
describe('schema: collections table', () => {
  it('should export the collections table', () => {
    expect(collections).toBeDefined();
  });

  it('should have the correct SQL table name "collections"', () => {
    expect(getTableName(collections)).toBe('collections');
  });

  it('should default condition to "near_mint"', () => {
    expect(col<{ default?: unknown }>(collections, 'condition').default).toBe('near_mint');
  });

  it('should default quantity to 1', () => {
    expect(col<{ default?: unknown }>(collections, 'quantity').default).toBe(1);
  });

  it('should mark quantity as notNull', () => {
    expect(col<{ notNull?: boolean }>(collections, 'quantity').notNull).toBe(true);
  });

  it('should have userId FK referencing "users"', () => {
    expect(fkReferencesTable(collections, 'user_id')).toBe('users');
  });

  it('should have cardId FK referencing "cards"', () => {
    expect(fkReferencesTable(collections, 'card_id')).toBe('cards');
  });

  it('should have exactly 2 inline FKs (userId + cardId)', () => {
    expect(getInlineForeignKeys(collections)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// decks and deckCards tables
// ---------------------------------------------------------------------------
describe('schema: decks table', () => {
  it('should export decks and deckCards tables', () => {
    expect(decks).toBeDefined();
    expect(deckCards).toBeDefined();
  });

  it('decks should have the correct SQL table name "decks"', () => {
    expect(getTableName(decks)).toBe('decks');
  });

  it('deckCards should have the correct SQL table name "deck_cards"', () => {
    expect(getTableName(deckCards)).toBe('deck_cards');
  });

  it('should default isPublic to false on decks', () => {
    expect(col<{ default?: unknown }>(decks, 'isPublic').default).toBe(false);
  });

  it('should default quantity to 1 on deckCards', () => {
    expect(col<{ default?: unknown }>(deckCards, 'quantity').default).toBe(1);
  });

  it('should mark quantity as notNull on deckCards', () => {
    expect(col<{ notNull?: boolean }>(deckCards, 'quantity').notNull).toBe(true);
  });

  it('should have deckId FK on deckCards referencing "decks"', () => {
    expect(fkReferencesTable(deckCards, 'deck_id')).toBe('decks');
  });

  it('should have cardId FK on deckCards referencing "cards"', () => {
    expect(fkReferencesTable(deckCards, 'card_id')).toBe('cards');
  });

  it('deckCards should have exactly 2 inline FKs', () => {
    expect(getInlineForeignKeys(deckCards)).toHaveLength(2);
  });

  it('decks userId should reference "users"', () => {
    expect(fkReferencesTable(decks, 'user_id')).toBe('users');
  });
});

// ---------------------------------------------------------------------------
// listings table
// ---------------------------------------------------------------------------
describe('schema: listings table', () => {
  it('should export the listings table', () => {
    expect(listings).toBeDefined();
  });

  it('should have the correct SQL table name "listings"', () => {
    expect(getTableName(listings)).toBe('listings');
  });

  it('should default status to "active"', () => {
    expect(col<{ default?: unknown }>(listings, 'status').default).toBe('active');
  });

  it('should default currency to "USD"', () => {
    expect(col<{ default?: unknown }>(listings, 'currency').default).toBe('USD');
  });

  it('should default shippingAvailable to "local"', () => {
    expect(col<{ default?: unknown }>(listings, 'shippingAvailable').default).toBe('local');
  });

  it('should require priceInCents (notNull)', () => {
    expect(col<{ notNull?: boolean }>(listings, 'priceInCents').notNull).toBe(true);
  });

  it('should require condition (notNull)', () => {
    expect(col<{ notNull?: boolean }>(listings, 'condition').notNull).toBe(true);
  });

  it('should have sellerId FK referencing "users"', () => {
    expect(fkReferencesTable(listings, 'seller_id')).toBe('users');
  });

  it('should have cardId FK referencing "cards"', () => {
    expect(fkReferencesTable(listings, 'card_id')).toBe('cards');
  });

  it('should allow null expiresAt (listings do not always expire)', () => {
    expect(col<{ notNull?: boolean }>(listings, 'expiresAt').notNull).toBeFalsy();
  });

  it('should allow null imageUrls (no photos required)', () => {
    expect(col<{ notNull?: boolean }>(listings, 'imageUrls').notNull).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// orders table
// ---------------------------------------------------------------------------
describe('schema: orders table', () => {
  it('should export the orders table', () => {
    expect(orders).toBeDefined();
  });

  it('should have the correct SQL table name "orders"', () => {
    expect(getTableName(orders)).toBe('orders');
  });

  it('should default status to "pending"', () => {
    expect(col<{ default?: unknown }>(orders, 'status').default).toBe('pending');
  });

  it('should default currency to "USD"', () => {
    expect(col<{ default?: unknown }>(orders, 'currency').default).toBe('USD');
  });

  it('should include all monetary fields as notNull', () => {
    expect(col<{ notNull?: boolean }>(orders, 'subtotalInCents').notNull).toBe(true);
    expect(col<{ notNull?: boolean }>(orders, 'platformFeeInCents').notNull).toBe(true);
    expect(col<{ notNull?: boolean }>(orders, 'totalInCents').notNull).toBe(true);
  });

  it('should include all order lifecycle timestamp fields', () => {
    const cols = Object.keys(orders);
    expect(cols).toContain('paidAt');
    expect(cols).toContain('shippedAt');
    expect(cols).toContain('deliveredAt');
    expect(cols).toContain('completedAt');
    expect(cols).toContain('cancelledAt');
  });

  it('should allow null for all milestone timestamps (not yet reached)', () => {
    expect(col<{ notNull?: boolean }>(orders, 'paidAt').notNull).toBeFalsy();
    expect(col<{ notNull?: boolean }>(orders, 'shippedAt').notNull).toBeFalsy();
    expect(col<{ notNull?: boolean }>(orders, 'deliveredAt').notNull).toBeFalsy();
    expect(col<{ notNull?: boolean }>(orders, 'completedAt').notNull).toBeFalsy();
    expect(col<{ notNull?: boolean }>(orders, 'cancelledAt').notNull).toBeFalsy();
  });

  it('should have buyerId FK referencing "users"', () => {
    expect(fkReferencesTable(orders, 'buyer_id')).toBe('users');
  });

  it('should have sellerId FK referencing "users"', () => {
    expect(fkReferencesTable(orders, 'seller_id')).toBe('users');
  });

  it('should have listingId FK referencing "listings"', () => {
    expect(fkReferencesTable(orders, 'listing_id')).toBe('listings');
  });

  it('should allow null stripePaymentIntentId (not yet paid)', () => {
    expect(col<{ notNull?: boolean }>(orders, 'stripePaymentIntentId').notNull).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// relations
// ---------------------------------------------------------------------------
describe('schema: relations', () => {
  it('should export all relation definitions', () => {
    expect(usersRelations).toBeDefined();
    expect(sessionsRelations).toBeDefined();
    expect(setsRelations).toBeDefined();
    expect(cardsRelations).toBeDefined();
    expect(collectionsRelations).toBeDefined();
    expect(decksRelations).toBeDefined();
    expect(deckCardsRelations).toBeDefined();
    expect(listingsRelations).toBeDefined();
    expect(ordersRelations).toBeDefined();
  });

  it('usersRelations should point to the users table', () => {
    expect(usersRelations.table).toBe(users);
  });

  it('sessionsRelations should point to the sessions table', () => {
    expect(sessionsRelations.table).toBe(sessions);
  });

  it('setsRelations should point to the sets table', () => {
    expect(setsRelations.table).toBe(sets);
  });

  it('cardsRelations should point to the cards table', () => {
    expect(cardsRelations.table).toBe(cards);
  });

  it('collectionsRelations should point to the collections table', () => {
    expect(collectionsRelations.table).toBe(collections);
  });

  it('decksRelations should point to the decks table', () => {
    expect(decksRelations.table).toBe(decks);
  });

  it('deckCardsRelations should point to the deckCards table', () => {
    expect(deckCardsRelations.table).toBe(deckCards);
  });

  it('listingsRelations should point to the listings table', () => {
    expect(listingsRelations.table).toBe(listings);
  });

  it('ordersRelations should point to the orders table', () => {
    expect(ordersRelations.table).toBe(orders);
  });

  it('relation config should be a function (Drizzle lazy evaluation pattern)', () => {
    // Drizzle stores relation configs as lazy functions called internally with { many, one } helpers.
    // We cannot call them directly without Drizzle internals, but verifying the type is correct.
    expect(typeof usersRelations.config).toBe('function');
    expect(typeof cardsRelations.config).toBe('function');
    expect(typeof ordersRelations.config).toBe('function');
  });
});
