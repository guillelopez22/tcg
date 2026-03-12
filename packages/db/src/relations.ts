import { relations } from 'drizzle-orm';
import { users } from './schema/users';
import { sessions } from './schema/sessions';
import { sets } from './schema/sets';
import { cards } from './schema/cards';
import { cardPrices } from './schema/card-prices';
import { collections } from './schema/collections';
import { wishlists } from './schema/wishlists';
import { decks, deckCards } from './schema/decks';
import { listings } from './schema/listings';
import { orders } from './schema/orders';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  collections: many(collections),
  wishlists: many(wishlists),
  decks: many(decks),
  listings: many(listings),
  buyerOrders: many(orders, { relationName: 'buyer' }),
  sellerOrders: many(orders, { relationName: 'seller' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const setsRelations = relations(sets, ({ many }) => ({
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  set: one(sets, { fields: [cards.setId], references: [sets.id] }),
  collections: many(collections),
  wishlists: many(wishlists),
  deckCards: many(deckCards),
  listings: many(listings),
  price: one(cardPrices, { fields: [cards.id], references: [cardPrices.cardId] }),
}));

export const cardPricesRelations = relations(cardPrices, ({ one }) => ({
  card: one(cards, { fields: [cardPrices.cardId], references: [cards.id] }),
}));

export const collectionsRelations = relations(collections, ({ one }) => ({
  user: one(users, { fields: [collections.userId], references: [users.id] }),
  card: one(cards, { fields: [collections.cardId], references: [cards.id] }),
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, { fields: [wishlists.userId], references: [users.id] }),
  card: one(cards, { fields: [wishlists.cardId], references: [cards.id] }),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(users, { fields: [decks.userId], references: [users.id] }),
  coverCard: one(cards, { fields: [decks.coverCardId], references: [cards.id] }),
  cards: many(deckCards),
}));

export const deckCardsRelations = relations(deckCards, ({ one }) => ({
  deck: one(decks, { fields: [deckCards.deckId], references: [decks.id] }),
  card: one(cards, { fields: [deckCards.cardId], references: [cards.id] }),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  card: one(cards, { fields: [listings.cardId], references: [cards.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  buyer: one(users, { fields: [orders.buyerId], references: [users.id], relationName: 'buyer' }),
  seller: one(users, { fields: [orders.sellerId], references: [users.id], relationName: 'seller' }),
  listing: one(listings, { fields: [orders.listingId], references: [listings.id] }),
}));
