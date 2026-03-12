"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getZoneForCardType = exports.SIGNATURE_TYPES = exports.SIDEBOARD_SIZE = exports.CHAMPION_COUNT = exports.RUNE_DECK_SIZE = exports.MAIN_DECK_SIZE = exports.MAX_SIGNATURE_COPIES = exports.MAX_COPIES_PER_CARD = exports.DECK_ZONES = exports.FOIL_VARIANTS = exports.isFoilVariant = exports.WISHLIST_TYPES = exports.CARD_VARIANTS = exports.CARD_CONDITIONS = exports.CARD_DOMAINS = exports.CARD_TYPES = exports.CARD_RARITIES = void 0;
exports.CARD_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Alternate Art', 'Overnumbered'];
exports.CARD_TYPES = [
    'Unit',
    'Champion Unit',
    'Spell',
    'Legend',
    'Signature Unit',
    'Signature Spell',
    'Gear',
    'Signature Gear',
];
exports.CARD_DOMAINS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];
exports.CARD_CONDITIONS = [
    'near_mint',
    'lightly_played',
    'moderately_played',
    'heavily_played',
    'damaged',
];
exports.CARD_VARIANTS = ['normal', 'alt_art', 'overnumbered', 'signature'];
exports.WISHLIST_TYPES = ['want', 'trade'];
exports.FOIL_VARIANTS = new Set(['alt_art', 'overnumbered', 'signature']);
function isFoilVariant(variant) {
    return exports.FOIL_VARIANTS.has(variant);
}
exports.isFoilVariant = isFoilVariant;
exports.DECK_ZONES = ['main', 'rune', 'champion', 'sideboard'];
exports.MAX_COPIES_PER_CARD = 3;
exports.MAX_SIGNATURE_COPIES = 1;
exports.MAIN_DECK_SIZE = 40;
exports.RUNE_DECK_SIZE = 12;
exports.CHAMPION_COUNT = 1;
exports.SIDEBOARD_SIZE = 8;
exports.SIGNATURE_TYPES = ['Signature Unit', 'Signature Spell', 'Signature Gear'];
function getZoneForCardType(cardType) {
    if (cardType === 'Legend') return 'champion';
    if (cardType === 'Rune') return 'rune';
    return 'main';
}
exports.getZoneForCardType = getZoneForCardType;
