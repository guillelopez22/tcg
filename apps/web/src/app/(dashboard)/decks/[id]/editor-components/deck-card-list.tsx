'use client';

import Image from 'next/image';
import { type DeckZone } from '@la-grieta/shared';
import { RARITY_COLORS, DOMAIN_COLORS } from '@/lib/design-tokens';
import { ZONE_LABELS, ZONE_LIMITS, type DeckEntry, type SwapPrompt } from '../use-deck-editor';

const FALLBACK_RARITY = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', glow: '' };

interface DeckCardListProps {
  zoneEntries: DeckEntry[];
  activeZone: DeckZone;
  swapPrompt: SwapPrompt | null;
  onDismissSwap: () => void;
  onSwapReplace: (existingCardId: string) => void;
  onIncrement: (cardId: string, zone: DeckZone) => void;
  onDecrement: (cardId: string, zone: DeckZone) => void;
  onRemove: (cardId: string, zone: DeckZone) => void;
}

export function DeckCardList({
  zoneEntries,
  activeZone,
  swapPrompt,
  onDismissSwap,
  onSwapReplace,
  onIncrement,
  onDecrement,
  onRemove,
}: DeckCardListProps) {
  return (
    <>
      {/* Deck card list for active zone */}
      <div className="lg-card overflow-hidden max-h-[360px] overflow-y-auto">
        {zoneEntries.length === 0 ? (
          <p className="text-center py-8 lg-text-muted text-sm">
            No {ZONE_LABELS[activeZone].toLowerCase()} cards.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {zoneEntries.map((entry) => {
              const rarityColors = RARITY_COLORS[entry.card.rarity] ?? FALLBACK_RARITY;
              const primaryDomain = entry.card.domain?.split(';')[0] ?? null;
              const domainColor = primaryDomain ? DOMAIN_COLORS[primaryDomain] : null;
              const cardBorder = domainColor?.border ?? rarityColors.border;
              return (
                <li key={`${entry.cardId}-${entry.zone}`} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-shrink-0">
                    {entry.card.imageSmall ? (
                      <div className={`relative w-8 h-11 rounded overflow-hidden border-2 ${cardBorder}`}>
                        <Image src={entry.card.imageSmall} alt={entry.card.name} fill sizes="32px" className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-11 rounded bg-surface-elevated border border-surface-border flex items-center justify-center">
                        <span className="text-zinc-600 text-xs" aria-hidden>?</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{entry.card.name}</p>
                    {primaryDomain && domainColor ? (
                      <span className={`lg-badge ${domainColor.text} ${domainColor.bg}`}>{primaryDomain}</span>
                    ) : (
                      <span className={`lg-badge ${rarityColors.text} ${rarityColors.bg}`}>{entry.card.rarity}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onDecrement(entry.cardId, entry.zone)}
                      aria-label={`Decrease ${entry.card.name}`}
                      className="lg-qty-btn text-base"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-white" aria-live="polite">
                      {entry.quantity}
                    </span>
                    <button
                      onClick={() => onIncrement(entry.cardId, entry.zone)}
                      aria-label={`Increase ${entry.card.name}`}
                      className="lg-qty-btn text-base"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onRemove(entry.cardId, entry.zone)}
                      aria-label={`Remove ${entry.card.name}`}
                      className="lg-btn-danger ml-1 !py-1 !px-2 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Swap prompt */}
      {swapPrompt && swapPrompt.zone === activeZone && (
        <div className="lg-card px-3 py-3 space-y-2 border-amber-700/40">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-300">
              {ZONE_LABELS[activeZone]} is full. Replace a card?
            </p>
            <button
              onClick={onDismissSwap}
              aria-label="Dismiss swap prompt"
              className="text-zinc-500 hover:text-zinc-300 p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-zinc-500">Adding: <span className="text-white">{swapPrompt.incomingCard.name}</span></p>
          <ul className="divide-y divide-surface-border max-h-40 overflow-y-auto">
            {zoneEntries.map((entry) => (
              <li key={entry.cardId} className="flex items-center justify-between py-1.5 gap-2">
                <span className="text-xs text-white truncate flex-1">{entry.card.name}</span>
                <span className="text-xs text-zinc-500 flex-shrink-0">x{entry.quantity}</span>
                <button
                  onClick={() => onSwapReplace(entry.cardId)}
                  className="text-xs px-2 py-0.5 rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/20 flex-shrink-0 transition-colors"
                >
                  Replace
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
