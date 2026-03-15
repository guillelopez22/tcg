'use client';

import { useReducer, useRef } from 'react';

export interface GameCardInfo {
  id: string;
  /** Unique instance ID — distinguishes multiple copies of the same card */
  uid: string;
  name: string;
  cardType: string | null;
  rarity: string;
  domain: string | null;
  imageSmall: string | null;
  energyCost?: number | null;
  powerCost?: number | null;
  might?: number | null;
}

export interface ChanneledRune {
  card: GameCardInfo;
  exhausted: boolean;
}

export interface PlayerGameState {
  mainDeck: GameCardInfo[];
  hand: GameCardInfo[];
  runeDeck: GameCardInfo[];
  channeledRunes: ChanneledRune[];
  legendCard: GameCardInfo | null;
  championCard: GameCardInfo | null;
  base: GameCardInfo[];
  trash: GameCardInfo[];
  /** UIDs of exhausted cards (base, legend, champion) */
  exhaustedUids: string[];
  /**
   * Units deployed to each battlefield slot.
   * Index matches the battlefield index (0, 1, 2...).
   */
  fieldUnits: GameCardInfo[][];
}

/** Card info as provided by the deck builder — uid is assigned later during expansion */
export type DeckCardInfo = Omit<GameCardInfo, 'uid'> & { uid?: string };

export interface LocalDeckEntry {
  cardId: string;
  quantity: number;
  zone: string;
  card: DeckCardInfo;
}

// ---------------------------------------------------------------------------
// Shuffle
// ---------------------------------------------------------------------------

function fisherYates<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

let uidCounter = 0;
function nextUid(): string {
  return `uid-${++uidCounter}`;
}

function expandEntries(entries: LocalDeckEntry[]): GameCardInfo[] {
  const cards: GameCardInfo[] = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.quantity; i++) {
      const { uid: _existingUid, ...rest } = entry.card;
      cards.push({ ...rest, uid: nextUid() });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface LocalGameState {
  gameState: PlayerGameState[] | null;
  mulliganPhase: number | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'INIT'; players: PlayerGameState[] }
  | { type: 'MULLIGAN'; playerIndex: number; cardIndices: number[] }
  | { type: 'SKIP_MULLIGAN'; playerIndex: number }
  | { type: 'CHANNEL_RUNES'; playerIndex: number; count: number }
  | { type: 'DRAW_CARD'; playerIndex: number }
  | { type: 'READY_ALL'; playerIndex: number }
  | { type: 'TOGGLE_RUNE_EXHAUST'; playerIndex: number; runeIndex: number }
  | { type: 'RECYCLE_RUNE'; playerIndex: number; runeIndex: number }
  | { type: 'PLAY_TO_BASE'; playerIndex: number; cardUid: string }
  | { type: 'DISCARD_TO_TRASH'; playerIndex: number; cardUid: string }
  | { type: 'RETURN_FROM_BASE'; playerIndex: number; cardUid: string }
  | { type: 'DISCARD_FROM_BASE'; playerIndex: number; cardUid: string }
  | { type: 'TOGGLE_CARD_EXHAUST'; playerIndex: number; cardUid: string }
  | { type: 'MOVE_TO_FIELD'; playerIndex: number; cardUid: string; battlefieldIndex: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawCards(
  deck: GameCardInfo[],
  hand: GameCardInfo[],
  count: number,
): { deck: GameCardInfo[]; hand: GameCardInfo[] } {
  const drawCount = Math.min(count, deck.length);
  const drawn = deck.slice(0, drawCount);
  return {
    deck: deck.slice(drawCount),
    hand: [...hand, ...drawn],
  };
}

function updatePlayer(
  players: PlayerGameState[],
  index: number,
  updater: (p: PlayerGameState) => PlayerGameState,
): PlayerGameState[] {
  return players.map((p, i) => (i === index ? updater(p) : p));
}

function advanceMulligan(current: number | null): number | null {
  if (current === 0) return 1;
  if (current === 1) return null;
  return null;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: LocalGameState, action: Action): LocalGameState {
  switch (action.type) {
    case 'INIT': {
      return {
        gameState: action.players,
        mulliganPhase: 0,
      };
    }

    case 'MULLIGAN': {
      if (state.gameState === null) return state;
      const { playerIndex, cardIndices } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      // Validate: max 2 cards
      const indices = cardIndices.slice(0, 2);

      const returnedCards: GameCardInfo[] = [];
      const keptCards: GameCardInfo[] = [];
      player.hand.forEach((card, i) => {
        if (indices.includes(i)) {
          returnedCards.push(card);
        } else {
          keptCards.push(card);
        }
      });

      // Put returned cards on bottom of deck
      const deckWithReturned = [...player.mainDeck, ...returnedCards];

      // Draw same number of new cards from top
      const { deck: newDeck, hand: drawnCards } = drawCards(
        deckWithReturned,
        [],
        returnedCards.length,
      );

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        hand: [...keptCards, ...drawnCards],
        mainDeck: newDeck,
      }));

      return {
        gameState: newPlayers,
        mulliganPhase: advanceMulligan(state.mulliganPhase),
      };
    }

    case 'SKIP_MULLIGAN': {
      return {
        ...state,
        mulliganPhase: advanceMulligan(state.mulliganPhase),
      };
    }

    case 'CHANNEL_RUNES': {
      if (state.gameState === null) return state;
      const { playerIndex, count } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      const drawCount = Math.min(count, player.runeDeck.length);
      const newRunes: ChanneledRune[] = player.runeDeck
        .slice(0, drawCount)
        .map((card) => ({ card, exhausted: false }));

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        runeDeck: p.runeDeck.slice(drawCount),
        channeledRunes: [...p.channeledRunes, ...newRunes],
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'DRAW_CARD': {
      if (state.gameState === null) return state;
      const { playerIndex } = action;
      const player = state.gameState[playerIndex];
      if (!player || player.mainDeck.length === 0) return state;

      const { deck, hand } = drawCards(player.mainDeck, player.hand, 1);

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        mainDeck: deck,
        hand,
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'READY_ALL': {
      if (state.gameState === null) return state;
      const { playerIndex } = action;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        channeledRunes: p.channeledRunes.map((r) => ({
          ...r,
          exhausted: false,
        })),
        exhaustedUids: [],
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'TOGGLE_RUNE_EXHAUST': {
      if (state.gameState === null) return state;
      const { playerIndex, runeIndex } = action;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        channeledRunes: p.channeledRunes.map((r, i) =>
          i === runeIndex ? { ...r, exhausted: !r.exhausted } : r,
        ),
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'RECYCLE_RUNE': {
      if (state.gameState === null) return state;
      const { playerIndex, runeIndex } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      const rune = player.channeledRunes[runeIndex];
      if (!rune) return state;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        channeledRunes: p.channeledRunes.filter((_, i) => i !== runeIndex),
        runeDeck: [...p.runeDeck, rune.card],
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'PLAY_TO_BASE': {
      if (state.gameState === null) return state;
      const { playerIndex, cardUid } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      const cardIndex = player.hand.findIndex((c) => c.uid === cardUid);
      if (cardIndex === -1) return state;
      const card = player.hand[cardIndex]!;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        hand: p.hand.filter((_, i) => i !== cardIndex),
        base: [...p.base, card],
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'DISCARD_TO_TRASH': {
      if (state.gameState === null) return state;
      const { playerIndex, cardUid } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      const cardIndex = player.hand.findIndex((c) => c.uid === cardUid);
      if (cardIndex === -1) return state;
      const card = player.hand[cardIndex]!;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        hand: p.hand.filter((_, i) => i !== cardIndex),
        trash: [...p.trash, card],
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'RETURN_FROM_BASE': {
      if (state.gameState === null) return state;
      const { playerIndex, cardUid } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      const cardIndex = player.base.findIndex((c) => c.uid === cardUid);
      if (cardIndex === -1) return state;
      const card = player.base[cardIndex]!;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        base: p.base.filter((_, i) => i !== cardIndex),
        hand: [...p.hand, card],
        exhaustedUids: p.exhaustedUids.filter((uid) => uid !== cardUid),
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'DISCARD_FROM_BASE': {
      if (state.gameState === null) return state;
      const { playerIndex, cardUid } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      const cardIndex = player.base.findIndex((c) => c.uid === cardUid);
      if (cardIndex === -1) return state;
      const card = player.base[cardIndex]!;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        base: p.base.filter((_, i) => i !== cardIndex),
        trash: [...p.trash, card],
        exhaustedUids: p.exhaustedUids.filter((uid) => uid !== cardUid),
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'TOGGLE_CARD_EXHAUST': {
      if (state.gameState === null) return state;
      const { playerIndex, cardUid } = action;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => ({
        ...p,
        exhaustedUids: p.exhaustedUids.includes(cardUid)
          ? p.exhaustedUids.filter((uid) => uid !== cardUid)
          : [...p.exhaustedUids, cardUid],
      }));

      return { ...state, gameState: newPlayers };
    }

    case 'MOVE_TO_FIELD': {
      if (state.gameState === null) return state;
      const { playerIndex, cardUid, battlefieldIndex } = action;
      const player = state.gameState[playerIndex];
      if (!player) return state;

      const cardIndex = player.base.findIndex((c) => c.uid === cardUid);
      if (cardIndex === -1) return state;
      const card = player.base[cardIndex]!;

      const newPlayers = updatePlayer(state.gameState, playerIndex, (p) => {
        const newFieldUnits = p.fieldUnits.map((units, i) =>
          i === battlefieldIndex ? [...units, card] : units,
        );
        return {
          ...p,
          base: p.base.filter((_, i) => i !== cardIndex),
          fieldUnits: newFieldUnits,
        };
      });

      return { ...state, gameState: newPlayers };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Initial state builder
// ---------------------------------------------------------------------------

function buildInitialPlayerState(entries: LocalDeckEntry[]): PlayerGameState {
  let legendCard: GameCardInfo | null = null;
  let championCard: GameCardInfo | null = null;
  const mainEntries: LocalDeckEntry[] = [];
  const runeEntries: LocalDeckEntry[] = [];

  for (const entry of entries) {
    if (entry.zone === 'legend') {
      legendCard = { ...entry.card, uid: nextUid() };
    } else if (entry.zone === 'champion') {
      championCard = { ...entry.card, uid: nextUid() };
    } else if (entry.zone === 'main') {
      mainEntries.push(entry);
    } else if (entry.zone === 'rune') {
      runeEntries.push(entry);
    }
    // 'battlefield' zone is ignored
  }

  const shuffledMain = fisherYates(expandEntries(mainEntries));
  const shuffledRunes = fisherYates(expandEntries(runeEntries));

  const { deck: mainDeck, hand } = drawCards(shuffledMain, [], 4);

  return {
    mainDeck,
    hand,
    runeDeck: shuffledRunes,
    channeledRunes: [],
    legendCard,
    championCard,
    base: [],
    trash: [],
    exhaustedUids: [],
    // Pre-allocate 3 battlefield slots (indices 0, 1, 2)
    fieldUnits: [[], [], []],
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const INITIAL_STATE: LocalGameState = {
  gameState: null,
  mulliganPhase: null,
};

export function useLocalGameState(
  localDecks: LocalDeckEntry[][] | undefined,
  activePlayerId: string | undefined,
  playerIds: string[],
) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const initialized = useRef(false);

  // Initialize once when localDecks becomes available
  if (!initialized.current && localDecks && localDecks.length >= 2) {
    initialized.current = true;
    const players = localDecks.map((entries) =>
      buildInitialPlayerState(entries),
    );
    dispatch({ type: 'INIT', players });
  }

  // Derive active player index
  const activePlayerIndex =
    activePlayerId !== undefined
      ? Math.max(0, playerIds.indexOf(activePlayerId))
      : 0;

  const opponentIndex = activePlayerIndex === 0 ? 1 : 0;

  const currentPlayer = state.gameState?.[activePlayerIndex] ?? null;
  const opponentPlayer = state.gameState?.[opponentIndex] ?? null;

  return {
    gameState: state.gameState,
    mulliganPhase: state.mulliganPhase,
    activePlayerIndex,

    // Current player convenience
    currentHand: currentPlayer?.hand ?? [],
    currentDeckCount: currentPlayer?.mainDeck.length ?? 0,
    currentRuneDeckCount: currentPlayer?.runeDeck.length ?? 0,
    currentChanneledRunes: currentPlayer?.channeledRunes ?? [],
    currentLegend: currentPlayer?.legendCard ?? null,
    currentChampion: currentPlayer?.championCard ?? null,
    currentBase: currentPlayer?.base ?? [],
    currentTrash: currentPlayer?.trash ?? [],
    currentFieldUnits: currentPlayer?.fieldUnits ?? [[], [], []],

    // Opponent visible info (counts only — for synced mode)
    opponentDeckCount: opponentPlayer?.mainDeck.length ?? 0,
    opponentHandCount: opponentPlayer?.hand.length ?? 0,
    opponentRuneDeckCount: opponentPlayer?.runeDeck.length ?? 0,
    opponentChanneledRunes: opponentPlayer?.channeledRunes ?? [],

    // Opponent full state (for local mode — both boards visible)
    opponentLegend: opponentPlayer?.legendCard ?? null,
    opponentChampion: opponentPlayer?.championCard ?? null,
    opponentBase: opponentPlayer?.base ?? [],
    opponentTrash: opponentPlayer?.trash ?? [],
    opponentExhaustedUids: opponentPlayer?.exhaustedUids ?? [],

    // Current player exhaust info
    currentExhaustedUids: currentPlayer?.exhaustedUids ?? [],

    // Actions
    mulligan(cardIndices: number[]) {
      const phase = state.mulliganPhase;
      if (phase === null) return;
      dispatch({ type: 'MULLIGAN', playerIndex: phase, cardIndices });
    },

    skipMulligan() {
      const phase = state.mulliganPhase;
      if (phase === null) return;
      dispatch({ type: 'SKIP_MULLIGAN', playerIndex: phase });
    },

    channelRunes(playerIndex: number, count: number) {
      dispatch({ type: 'CHANNEL_RUNES', playerIndex, count });
    },

    drawCard(playerIndex: number) {
      dispatch({ type: 'DRAW_CARD', playerIndex });
    },

    readyAll(playerIndex: number) {
      dispatch({ type: 'READY_ALL', playerIndex });
    },

    toggleRuneExhaust(playerIndex: number, runeIndex: number) {
      dispatch({ type: 'TOGGLE_RUNE_EXHAUST', playerIndex, runeIndex });
    },

    recycleRune(playerIndex: number, runeIndex: number) {
      dispatch({ type: 'RECYCLE_RUNE', playerIndex, runeIndex });
    },

    playToBase(playerIndex: number, cardUid: string) {
      dispatch({ type: 'PLAY_TO_BASE', playerIndex, cardUid });
    },

    discardToTrash(playerIndex: number, cardUid: string) {
      dispatch({ type: 'DISCARD_TO_TRASH', playerIndex, cardUid });
    },

    returnFromBase(playerIndex: number, cardUid: string) {
      dispatch({ type: 'RETURN_FROM_BASE', playerIndex, cardUid });
    },

    discardFromBase(playerIndex: number, cardUid: string) {
      dispatch({ type: 'DISCARD_FROM_BASE', playerIndex, cardUid });
    },

    toggleCardExhaust(playerIndex: number, cardUid: string) {
      dispatch({ type: 'TOGGLE_CARD_EXHAUST', playerIndex, cardUid });
    },

    moveToField(playerIndex: number, cardUid: string, battlefieldIndex: number) {
      dispatch({ type: 'MOVE_TO_FIELD', playerIndex, cardUid, battlefieldIndex });
    },
  } as const;
}
