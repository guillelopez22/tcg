'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { trpc } from '@/lib/trpc';
import {
  DECK_ZONES,
  type DeckZone,
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  CHAMPION_COUNT,
  SIDEBOARD_SIZE,
  SIGNATURE_TYPES,
  getZoneForCardType,
  validateDeckFormat,
} from '@la-grieta/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardItem = inferRouterOutputs<AppRouter>['card']['list']['items'][number];

export interface TempDeckEntry {
  cardId: string;
  quantity: number;
  zone: DeckZone;
  card: {
    id: string;
    name: string;
    rarity: string;
    cardType: string | null;
    domain: string | null;
    imageSmall: string | null;
  };
}

export interface TempDeck {
  matchCode: string;
  entries: TempDeckEntry[];
  battlefieldCardIds: string[];
}

interface GuestDeckBuilderProps {
  matchCode: string;
  onDeckReady: (deck: TempDeck) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZONE_LABELS: Record<DeckZone, string> = {
  main: 'Main',
  rune: 'Runes',
  champion: 'Champion',
  sideboard: 'Sideboard',
};

const ZONE_LIMITS: Record<DeckZone, number> = {
  main: MAIN_DECK_SIZE,
  rune: RUNE_DECK_SIZE,
  champion: CHAMPION_COUNT,
  sideboard: SIDEBOARD_SIZE,
};

const STORAGE_KEY_PREFIX = 'lagrieta_temp_deck_';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function saveTempDeck(
  matchCode: string,
  entries: TempDeckEntry[],
  battlefieldCardIds: string[],
) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${STORAGE_KEY_PREFIX}${matchCode}`,
      JSON.stringify({ entries, battlefieldCardIds }),
    );
  } catch {
    // sessionStorage may be unavailable in private/incognito modes
  }
}

function loadTempDeck(
  matchCode: string,
): { entries: TempDeckEntry[]; battlefieldCardIds: string[] } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${matchCode}`);
    if (!raw) return null;
    return JSON.parse(raw) as {
      entries: TempDeckEntry[];
      battlefieldCardIds: string[];
    };
  } catch {
    return null;
  }
}

export function clearTempDeck(matchCode: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${matchCode}`);
  } catch {
    // ignore
  }
}

function getZoneCount(entries: TempDeckEntry[], zone: DeckZone): number {
  return entries
    .filter((e) => e.zone === zone)
    .reduce((sum, e) => sum + e.quantity, 0);
}

function buildCardTypeMap(entries: TempDeckEntry[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const e of entries) {
    map.set(e.cardId, e.card.cardType);
  }
  return map;
}

function isSignatureType(cardType: string | null): boolean {
  return (SIGNATURE_TYPES as readonly string[]).includes(cardType ?? '');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuestDeckBuilder({ matchCode, onDeckReady }: GuestDeckBuilderProps) {
  const [step, setStep] = useState<'champion' | 'cards'>('champion');
  const [activeZone, setActiveZone] = useState<DeckZone>('main');
  const [entries, setEntries] = useState<TempDeckEntry[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Restore from sessionStorage on mount
  useEffect(() => {
    const saved = loadTempDeck(matchCode);
    if (saved && saved.entries.length > 0) {
      setEntries(saved.entries);
      const hasChampion = saved.entries.some((e) => e.zone === 'champion');
      if (hasChampion) setStep('cards');
    }
  }, [matchCode]);

  // Persist on changes
  useEffect(() => {
    const battlefieldIds = entries
      .filter((e) => e.card.cardType === 'Battlefield')
      .map((e) => e.cardId);
    saveTempDeck(matchCode, entries, battlefieldIds);
  }, [entries, matchCode]);

  // Card search query
  const { data: cardData, isLoading: cardsLoading } = trpc.card.list.useQuery(
    {
      search: debouncedSearch || undefined,
      cardType: step === 'champion' ? 'Legend' : undefined,
      limit: 24,
    },
    { staleTime: 60_000 },
  );

  const cards = cardData?.items ?? [];

  // ---------------------------------------------------------------
  // Deck manipulation
  // ---------------------------------------------------------------

  const addCard = useCallback((card: CardItem) => {
    const zone = getZoneForCardType(card.cardType) as DeckZone;

    setEntries((prev) => {
      const existing = prev.find((e) => e.cardId === card.id && e.zone === zone);
      const zoneCount = getZoneCount(prev, zone);
      const zoneLimit = ZONE_LIMITS[zone];
      const cardCount = existing?.quantity ?? 0;
      const maxCopies = isSignatureType(card.cardType) ? MAX_SIGNATURE_COPIES : MAX_COPIES_PER_CARD;

      if (zoneCount >= zoneLimit || cardCount >= maxCopies) return prev;

      if (existing) {
        return prev.map((e) =>
          e.cardId === card.id && e.zone === zone
            ? { ...e, quantity: e.quantity + 1 }
            : e,
        );
      }

      return [
        ...prev,
        {
          cardId: card.id,
          quantity: 1,
          zone,
          card: {
            id: card.id,
            name: card.name,
            rarity: card.rarity ?? 'Common',
            cardType: card.cardType,
            domain: card.domain,
            imageSmall: card.imageSmall,
          },
        },
      ];
    });
  }, []);

  // Increment a card already in the deck using stored entry data
  const addCardFromEntry = useCallback((entry: TempDeckEntry) => {
    setEntries((prev) => {
      const existing = prev.find(
        (e) => e.cardId === entry.cardId && e.zone === entry.zone,
      );
      const zoneCount = getZoneCount(prev, entry.zone);
      const zoneLimit = ZONE_LIMITS[entry.zone];
      const cardCount = existing?.quantity ?? 0;
      const maxCopies = isSignatureType(entry.card.cardType)
        ? MAX_SIGNATURE_COPIES
        : MAX_COPIES_PER_CARD;
      if (zoneCount >= zoneLimit || cardCount >= maxCopies) return prev;
      return prev.map((e) =>
        e.cardId === entry.cardId && e.zone === entry.zone
          ? { ...e, quantity: e.quantity + 1 }
          : e,
      );
    });
  }, []);

  const removeCard = useCallback((cardId: string, zone: DeckZone) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.cardId === cardId && e.zone === zone);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter((e) => !(e.cardId === cardId && e.zone === zone));
      }
      return prev.map((e) =>
        e.cardId === cardId && e.zone === zone ? { ...e, quantity: e.quantity - 1 } : e,
      );
    });
  }, []);

  // ---------------------------------------------------------------
  // Format validation
  // ---------------------------------------------------------------

  const cardTypeMap = buildCardTypeMap(entries);
  const validationErrors = validateDeckFormat(entries, cardTypeMap);
  const isValid = validationErrors.length === 0;

  const battlefieldCardIds = entries
    .filter((e) => e.card.cardType === 'Battlefield')
    .map((e) => e.cardId);

  function handleReady() {
    onDeckReady({ matchCode, entries, battlefieldCardIds });
  }

  // ---------------------------------------------------------------
  // Champion selection step
  // ---------------------------------------------------------------

  if (step === 'champion') {
    const championEntry = entries.find((e) => e.zone === 'champion');

    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-white">Choose your Champion</h2>
          <p className="text-sm lg-text-secondary">
            Every deck is built around a Legend card. Pick yours first.
          </p>
        </div>

        {/* Currently selected champion */}
        {championEntry && (
          <div className="lg-card p-3 flex items-center gap-3">
            {championEntry.card.imageSmall && (
              <div className="relative w-10 h-14 rounded overflow-hidden flex-shrink-0">
                <Image
                  src={championEntry.card.imageSmall}
                  alt={championEntry.card.name}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {championEntry.card.name}
              </p>
              <p className="text-xs text-zinc-500">Selected champion</p>
            </div>
            <button
              onClick={() => {
                setEntries((prev) => prev.filter((e) => e.zone !== 'champion'));
              }}
              className="text-zinc-500 hover:text-red-400 transition-colors text-xs"
            >
              Change
            </button>
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search legends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rift-500"
        />

        {/* Legend cards grid */}
        {cardsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[2/3] bg-surface-elevated rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {cards.map((card) => {
              const isSelected = entries.some(
                (e) => e.cardId === card.id && e.zone === 'champion',
              );
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    // Replace existing champion
                    setEntries((prev) => prev.filter((e) => e.zone !== 'champion'));
                    addCard(card);
                  }}
                  className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-rift-400 ring-2 ring-rift-400/40'
                      : 'border-surface-border hover:border-surface-hover'
                  }`}
                >
                  {card.imageSmall ? (
                    <Image
                      src={card.imageSmall}
                      alt={card.name}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-elevated flex items-center justify-center p-1">
                      <span className="text-zinc-500 text-xs text-center">{card.name}</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-rift-500/20 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-rift-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => {
            setStep('cards');
            setSearch('');
          }}
          disabled={!championEntry}
          className="lg-btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Build Deck
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Card building step
  // ---------------------------------------------------------------

  const zoneEntries = entries.filter((e) => e.zone === activeZone);
  const zoneCount = getZoneCount(entries, activeZone);
  const zoneLimit = ZONE_LIMITS[activeZone];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Build Your Deck</h2>
        <button
          onClick={() => {
            setStep('champion');
            setSearch('');
          }}
          className="text-xs text-zinc-500 hover:text-white transition-colors"
        >
          Change champion
        </button>
      </div>

      {/* Zone tabs */}
      <div className="flex gap-1 bg-surface-elevated rounded-lg p-1">
        {(DECK_ZONES as readonly DeckZone[]).map((zone) => {
          const count = getZoneCount(entries, zone);
          const limit = ZONE_LIMITS[zone];
          const isFull = count >= limit;
          return (
            <button
              key={zone}
              onClick={() => setActiveZone(zone)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all flex flex-col items-center gap-0.5 ${
                activeZone === zone
                  ? 'bg-surface-card text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>{ZONE_LABELS[zone]}</span>
              <span
                className={`text-[10px] ${
                  isFull ? 'text-green-400' : 'text-zinc-600'
                }`}
              >
                {count}/{limit}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current zone card list */}
      {zoneEntries.length > 0 && (
        <div className="space-y-1">
          {zoneEntries.map((entry) => (
            <div
              key={entry.cardId}
              className="flex items-center gap-2 bg-surface-elevated rounded-lg px-3 py-2"
            >
              {entry.card.imageSmall && (
                <div className="relative w-7 h-10 rounded overflow-hidden flex-shrink-0">
                  <Image
                    src={entry.card.imageSmall}
                    alt={entry.card.name}
                    fill
                    className="object-cover"
                    sizes="28px"
                  />
                </div>
              )}
              <span className="flex-1 text-sm text-white truncate">{entry.card.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => removeCard(entry.cardId, activeZone)}
                  className="w-6 h-6 rounded-full bg-surface-card text-zinc-400 hover:text-white flex items-center justify-center text-lg leading-none transition-colors"
                >
                  -
                </button>
                <span className="w-5 text-center text-sm text-white font-medium">
                  {entry.quantity}
                </span>
                <button
                  onClick={() => addCardFromEntry(entry)}
                  className="w-6 h-6 rounded-full bg-surface-card text-zinc-400 hover:text-white flex items-center justify-center text-lg leading-none transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone capacity indicator */}
      <div className="text-xs text-zinc-500 text-right">
        {zoneCount}/{zoneLimit} cards in {ZONE_LABELS[activeZone]}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={`Search cards for ${ZONE_LABELS[activeZone]}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rift-500"
      />

      {/* Card search results */}
      {cardsLoading ? (
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-surface-elevated rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {cards.map((card) => {
            const cardZone = getZoneForCardType(card.cardType) as DeckZone;
            const existing = entries.find(
              (e) => e.cardId === card.id && e.zone === cardZone,
            );
            const count = existing?.quantity ?? 0;
            const maxCopies = isSignatureType(card.cardType)
              ? MAX_SIGNATURE_COPIES
              : MAX_COPIES_PER_CARD;
            const currentZoneCount = getZoneCount(entries, cardZone);
            const atMax = count >= maxCopies || currentZoneCount >= ZONE_LIMITS[cardZone];

            return (
              <button
                key={card.id}
                onClick={() => !atMax && addCard(card)}
                disabled={atMax}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all ${
                  atMax
                    ? 'opacity-40 cursor-not-allowed bg-surface-elevated'
                    : 'bg-surface-elevated hover:bg-surface-card'
                }`}
              >
                {card.imageSmall && (
                  <div className="relative w-7 h-10 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={card.imageSmall}
                      alt={card.name}
                      fill
                      className="object-cover"
                      sizes="28px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{card.name}</p>
                  <p className="text-xs text-zinc-500">
                    {card.cardType}
                    {card.rarity ? ` · ${card.rarity}` : ''}
                  </p>
                </div>
                {count > 0 && (
                  <span className="text-xs text-rift-400 font-medium">x{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Validation feedback */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-3 space-y-1">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-red-400">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Ready button */}
      <button
        onClick={handleReady}
        disabled={!isValid}
        className="lg-btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isValid ? 'Deck Ready — Continue' : 'Complete your deck to continue'}
      </button>
    </div>
  );
}
