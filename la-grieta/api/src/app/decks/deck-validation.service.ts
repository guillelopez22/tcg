import { Injectable } from '@nestjs/common';
import { ValidationError, DeckValidationResult } from '@la-grieta/shared';

interface DeckCardWithCard {
  id: string;
  cardId: string;
  quantity: number;
  zone: string;
  card: {
    id: string;
    name: string;
    cardType: string;
    domains: string[];
  };
}

interface DeckForValidation {
  legendId: string;
  cards: DeckCardWithCard[];
  legend?: {
    id: string;
    cardType: string;
    domains: string[];
  };
}

@Injectable()
export class DeckValidationService {
  /**
   * Validates a deck against all Riftbound rules
   */
  validate(deck: DeckForValidation): DeckValidationResult {
    const errors: ValidationError[] = [];

    // Group cards by zone
    const cardsByZone = this.groupCardsByZone(deck.cards);

    // Rule 1: Main Deck Size (30-40 cards)
    const mainDeckErrors = this.validateMainDeckSize(cardsByZone.MAIN);
    errors.push(...mainDeckErrors);

    // Rule 2: Rune Deck Size (10-12 cards)
    const runeDeckErrors = this.validateRuneDeckSize(cardsByZone.RUNE);
    errors.push(...runeDeckErrors);

    // Rule 3: Battlefield (exactly 1 card)
    const battlefieldErrors = this.validateBattlefield(cardsByZone.BATTLEFIELD);
    errors.push(...battlefieldErrors);

    // Rule 4: Legend (exactly 1 LEGEND card)
    const legendErrors = this.validateLegend(deck);
    errors.push(...legendErrors);

    // Rule 5: Card Copies (max 3 per zone)
    const copiesErrors = this.validateCardCopies(deck.cards);
    errors.push(...copiesErrors);

    // Rule 6: Domain Restriction (cards must share at least 1 domain with legend)
    if (deck.legend) {
      const domainErrors = this.validateDomainRestriction(deck.cards, deck.legend.domains);
      errors.push(...domainErrors);
    }

    // Rule 7: Zone Matching (card types must be in correct zones)
    const zoneErrors = this.validateZoneMatching(deck.cards);
    errors.push(...zoneErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Groups cards by zone with total quantities
   */
  private groupCardsByZone(cards: DeckCardWithCard[]): Record<string, DeckCardWithCard[]> {
    const zones: Record<string, DeckCardWithCard[]> = {
      MAIN: [],
      RUNE: [],
      BATTLEFIELD: [],
    };

    cards.forEach((card) => {
      if (zones[card.zone]) {
        zones[card.zone].push(card);
      }
    });

    return zones;
  }

  /**
   * Rule 1: Main Deck must have 30-40 cards total
   */
  private validateMainDeckSize(mainDeckCards: DeckCardWithCard[]): ValidationError[] {
    const totalCards = mainDeckCards.reduce((sum, card) => sum + card.quantity, 0);

    if (totalCards < 30) {
      return [
        {
          rule: 'MAIN_DECK_SIZE',
          message: `Main deck must have 30-40 cards. Currently has ${totalCards} cards.`,
          details: { current: totalCards, min: 30, max: 40 },
        },
      ];
    }

    if (totalCards > 40) {
      return [
        {
          rule: 'MAIN_DECK_SIZE',
          message: `Main deck must have 30-40 cards. Currently has ${totalCards} cards.`,
          details: { current: totalCards, min: 30, max: 40 },
        },
      ];
    }

    return [];
  }

  /**
   * Rule 2: Rune Deck must have 10-12 cards total
   */
  private validateRuneDeckSize(runeDeckCards: DeckCardWithCard[]): ValidationError[] {
    const totalCards = runeDeckCards.reduce((sum, card) => sum + card.quantity, 0);

    if (totalCards < 10) {
      return [
        {
          rule: 'RUNE_DECK_SIZE',
          message: `Rune deck must have 10-12 cards. Currently has ${totalCards} cards.`,
          details: { current: totalCards, min: 10, max: 12 },
        },
      ];
    }

    if (totalCards > 12) {
      return [
        {
          rule: 'RUNE_DECK_SIZE',
          message: `Rune deck must have 10-12 cards. Currently has ${totalCards} cards.`,
          details: { current: totalCards, min: 10, max: 12 },
        },
      ];
    }

    return [];
  }

  /**
   * Rule 3: Battlefield must have exactly 1 card
   */
  private validateBattlefield(battlefieldCards: DeckCardWithCard[]): ValidationError[] {
    const totalCards = battlefieldCards.reduce((sum, card) => sum + card.quantity, 0);

    if (totalCards !== 1) {
      return [
        {
          rule: 'BATTLEFIELD_SIZE',
          message: `Battlefield must have exactly 1 card. Currently has ${totalCards} cards.`,
          details: { current: totalCards, required: 1 },
        },
      ];
    }

    return [];
  }

  /**
   * Rule 4: Deck must have exactly 1 LEGEND card as its legend
   */
  private validateLegend(deck: DeckForValidation): ValidationError[] {
    if (!deck.legend) {
      return [
        {
          rule: 'LEGEND_REQUIRED',
          message: 'Deck must have a legend card assigned.',
          details: { legendId: deck.legendId },
        },
      ];
    }

    if (deck.legend.cardType !== 'LEGEND') {
      return [
        {
          rule: 'LEGEND_TYPE',
          message: `Legend must be a LEGEND card type. Currently assigned card is type ${deck.legend.cardType}.`,
          details: { cardType: deck.legend.cardType },
        },
      ];
    }

    return [];
  }

  /**
   * Rule 5: Maximum 3 copies of any card per zone
   */
  private validateCardCopies(cards: DeckCardWithCard[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Group by cardId and zone
    const cardCounts: Record<string, Record<string, number>> = {};

    cards.forEach((deckCard) => {
      const key = `${deckCard.cardId}-${deckCard.zone}`;
      if (!cardCounts[key]) {
        cardCounts[key] = {
          cardId: deckCard.cardId,
          zone: deckCard.zone,
          name: deckCard.card.name,
          count: 0,
        } as any;
      }
      cardCounts[key].count = (cardCounts[key].count || 0) + deckCard.quantity;
    });

    // Check for violations
    Object.values(cardCounts).forEach((cardData: any) => {
      if (cardData.count > 3) {
        errors.push({
          rule: 'CARD_COPIES',
          message: `Card "${cardData.name}" has ${cardData.count} copies in ${cardData.zone} zone. Maximum is 3 copies per zone.`,
          details: {
            cardId: cardData.cardId,
            cardName: cardData.name,
            zone: cardData.zone,
            current: cardData.count,
            max: 3,
          },
        });
      }
    });

    return errors;
  }

  /**
   * Rule 6: All non-legend cards must share at least 1 domain with the legend
   */
  private validateDomainRestriction(
    cards: DeckCardWithCard[],
    legendDomains: string[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    cards.forEach((deckCard) => {
      // Skip legend cards
      if (deckCard.card.cardType === 'LEGEND') {
        return;
      }

      const cardDomains = deckCard.card.domains;

      // Check if card shares at least one domain with legend
      const hasSharedDomain = cardDomains.some((domain) => legendDomains.includes(domain));

      if (!hasSharedDomain) {
        errors.push({
          rule: 'DOMAIN_RESTRICTION',
          message: `Card "${deckCard.card.name}" does not share any domain with the legend. Legend domains: [${legendDomains.join(', ')}]. Card domains: [${cardDomains.join(', ')}].`,
          details: {
            cardId: deckCard.cardId,
            cardName: deckCard.card.name,
            cardDomains,
            legendDomains,
          },
        });
      }
    });

    return errors;
  }

  /**
   * Rule 7: Cards must be in appropriate zones based on their type
   * - RUNE type cards → Rune zone only
   * - BATTLEFIELD type cards → Battlefield zone only
   * - Other cards → Main deck
   */
  private validateZoneMatching(cards: DeckCardWithCard[]): ValidationError[] {
    const errors: ValidationError[] = [];

    cards.forEach((deckCard) => {
      const cardType = deckCard.card.cardType;
      const zone = deckCard.zone;

      // RUNE cards must be in RUNE zone
      if (cardType === 'RUNE' && zone !== 'RUNE') {
        errors.push({
          rule: 'ZONE_MATCHING',
          message: `Card "${deckCard.card.name}" is type RUNE but is in ${zone} zone. RUNE cards must be in RUNE zone.`,
          details: {
            cardId: deckCard.cardId,
            cardName: deckCard.card.name,
            cardType,
            currentZone: zone,
            requiredZone: 'RUNE',
          },
        });
      }

      // BATTLEFIELD cards must be in BATTLEFIELD zone
      if (cardType === 'BATTLEFIELD' && zone !== 'BATTLEFIELD') {
        errors.push({
          rule: 'ZONE_MATCHING',
          message: `Card "${deckCard.card.name}" is type BATTLEFIELD but is in ${zone} zone. BATTLEFIELD cards must be in BATTLEFIELD zone.`,
          details: {
            cardId: deckCard.cardId,
            cardName: deckCard.card.name,
            cardType,
            currentZone: zone,
            requiredZone: 'BATTLEFIELD',
          },
        });
      }

      // Non-RUNE and non-BATTLEFIELD cards should be in MAIN zone
      if (
        cardType !== 'RUNE' &&
        cardType !== 'BATTLEFIELD' &&
        cardType !== 'LEGEND' &&
        zone !== 'MAIN'
      ) {
        errors.push({
          rule: 'ZONE_MATCHING',
          message: `Card "${deckCard.card.name}" is type ${cardType} but is in ${zone} zone. This card type should be in MAIN zone.`,
          details: {
            cardId: deckCard.cardId,
            cardName: deckCard.card.name,
            cardType,
            currentZone: zone,
            requiredZone: 'MAIN',
          },
        });
      }
    });

    return errors;
  }
}
