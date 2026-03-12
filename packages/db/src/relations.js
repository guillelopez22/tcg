"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRelations = exports.listingsRelations = exports.deckCardsRelations = exports.deckShareCodesRelations = exports.decksRelations = exports.collectionsRelations = exports.cardsRelations = exports.setsRelations = exports.sessionsRelations = exports.usersRelations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const users_1 = require("./schema/users");
const sessions_1 = require("./schema/sessions");
const sets_1 = require("./schema/sets");
const cards_1 = require("./schema/cards");
const collections_1 = require("./schema/collections");
const decks_1 = require("./schema/decks");
const deck_share_codes_1 = require("./schema/deck-share-codes");
const listings_1 = require("./schema/listings");
const orders_1 = require("./schema/orders");
exports.usersRelations = (0, drizzle_orm_1.relations)(users_1.users, ({ many }) => ({
    sessions: many(sessions_1.sessions),
    collections: many(collections_1.collections),
    decks: many(decks_1.decks),
    listings: many(listings_1.listings),
    buyerOrders: many(orders_1.orders, { relationName: 'buyer' }),
    sellerOrders: many(orders_1.orders, { relationName: 'seller' }),
}));
exports.sessionsRelations = (0, drizzle_orm_1.relations)(sessions_1.sessions, ({ one }) => ({
    user: one(users_1.users, { fields: [sessions_1.sessions.userId], references: [users_1.users.id] }),
}));
exports.setsRelations = (0, drizzle_orm_1.relations)(sets_1.sets, ({ many }) => ({
    cards: many(cards_1.cards),
}));
exports.cardsRelations = (0, drizzle_orm_1.relations)(cards_1.cards, ({ one, many }) => ({
    set: one(sets_1.sets, { fields: [cards_1.cards.setId], references: [sets_1.sets.id] }),
    collections: many(collections_1.collections),
    deckCards: many(decks_1.deckCards),
    listings: many(listings_1.listings),
}));
exports.collectionsRelations = (0, drizzle_orm_1.relations)(collections_1.collections, ({ one }) => ({
    user: one(users_1.users, { fields: [collections_1.collections.userId], references: [users_1.users.id] }),
    card: one(cards_1.cards, { fields: [collections_1.collections.cardId], references: [cards_1.cards.id] }),
}));
exports.decksRelations = (0, drizzle_orm_1.relations)(decks_1.decks, ({ one, many }) => ({
    user: one(users_1.users, { fields: [decks_1.decks.userId], references: [users_1.users.id] }),
    coverCard: one(cards_1.cards, { fields: [decks_1.decks.coverCardId], references: [cards_1.cards.id] }),
    cards: many(decks_1.deckCards),
    shareCodes: many(deck_share_codes_1.deckShareCodes),
}));
exports.deckShareCodesRelations = (0, drizzle_orm_1.relations)(deck_share_codes_1.deckShareCodes, ({ one }) => ({
    deck: one(decks_1.decks, { fields: [deck_share_codes_1.deckShareCodes.deckId], references: [decks_1.decks.id] }),
}));
exports.deckCardsRelations = (0, drizzle_orm_1.relations)(decks_1.deckCards, ({ one }) => ({
    deck: one(decks_1.decks, { fields: [decks_1.deckCards.deckId], references: [decks_1.decks.id] }),
    card: one(cards_1.cards, { fields: [decks_1.deckCards.cardId], references: [cards_1.cards.id] }),
}));
exports.listingsRelations = (0, drizzle_orm_1.relations)(listings_1.listings, ({ one }) => ({
    seller: one(users_1.users, { fields: [listings_1.listings.sellerId], references: [users_1.users.id] }),
    card: one(cards_1.cards, { fields: [listings_1.listings.cardId], references: [cards_1.cards.id] }),
}));
exports.ordersRelations = (0, drizzle_orm_1.relations)(orders_1.orders, ({ one }) => ({
    buyer: one(users_1.users, { fields: [orders_1.orders.buyerId], references: [users_1.users.id], relationName: 'buyer' }),
    seller: one(users_1.users, { fields: [orders_1.orders.sellerId], references: [users_1.users.id], relationName: 'seller' }),
    listing: one(listings_1.listings, { fields: [orders_1.orders.listingId], references: [listings_1.listings.id] }),
}));
