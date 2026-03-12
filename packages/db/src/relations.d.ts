export declare const usersRelations: import("drizzle-orm").Relations<"users", {
    sessions: import("drizzle-orm").Many<"sessions">;
    collections: import("drizzle-orm").Many<"collections">;
    decks: import("drizzle-orm").Many<"decks">;
    listings: import("drizzle-orm").Many<"listings">;
    buyerOrders: import("drizzle-orm").Many<"orders">;
    sellerOrders: import("drizzle-orm").Many<"orders">;
}>;
export declare const sessionsRelations: import("drizzle-orm").Relations<"sessions", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const setsRelations: import("drizzle-orm").Relations<"sets", {
    cards: import("drizzle-orm").Many<"cards">;
}>;
export declare const cardsRelations: import("drizzle-orm").Relations<"cards", {
    set: import("drizzle-orm").One<"sets", true>;
    collections: import("drizzle-orm").Many<"collections">;
    deckCards: import("drizzle-orm").Many<"deck_cards">;
    listings: import("drizzle-orm").Many<"listings">;
}>;
export declare const collectionsRelations: import("drizzle-orm").Relations<"collections", {
    user: import("drizzle-orm").One<"users", true>;
    card: import("drizzle-orm").One<"cards", true>;
}>;
export declare const decksRelations: import("drizzle-orm").Relations<"decks", {
    user: import("drizzle-orm").One<"users", true>;
    coverCard: import("drizzle-orm").One<"cards", false>;
    cards: import("drizzle-orm").Many<"deck_cards">;
    shareCodes: import("drizzle-orm").Many<"deck_share_codes">;
}>;
export declare const deckCardsRelations: import("drizzle-orm").Relations<"deck_cards", {
    deck: import("drizzle-orm").One<"decks", true>;
    card: import("drizzle-orm").One<"cards", true>;
}>;
export declare const deckShareCodesRelations: import("drizzle-orm").Relations<"deck_share_codes", {
    deck: import("drizzle-orm").One<"decks", true>;
}>;
export declare const listingsRelations: import("drizzle-orm").Relations<"listings", {
    seller: import("drizzle-orm").One<"users", true>;
    card: import("drizzle-orm").One<"cards", true>;
}>;
export declare const ordersRelations: import("drizzle-orm").Relations<"orders", {
    buyer: import("drizzle-orm").One<"users", true>;
    seller: import("drizzle-orm").One<"users", true>;
    listing: import("drizzle-orm").One<"listings", true>;
}>;
