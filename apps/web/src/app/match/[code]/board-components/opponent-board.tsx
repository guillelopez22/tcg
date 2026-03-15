'use client';

import type { GameCardInfo } from '@/hooks/use-local-game-state';
import { ExhaustableCard, ZoneSlot, CARD } from './exhaustable-card';

const PLAYER_COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400' },
  red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-400' },
  green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400' },
  yellow: { bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-400' },
};

interface OpponentBoardProps {
  name: string;
  isActive: boolean;
  color: string;
  legend: GameCardInfo | null;
  champion: GameCardInfo | null;
  base: GameCardInfo[];
  channeledRunes: { card: GameCardInfo; exhausted: boolean }[];
  exhaustedUids: string[];
  deckCount: number;
  handCount: number;
  runeDeckCount: number;
  trashCount: number;
  onToggleExhaust: (uid: string) => void;
}

export function OpponentBoard({
  name,
  isActive,
  color,
  legend,
  champion,
  base,
  channeledRunes,
  exhaustedUids,
  deckCount,
  handCount,
  runeDeckCount,
  trashCount,
  onToggleExhaust,
}: OpponentBoardProps) {
  const colorClasses = PLAYER_COLOR_CLASSES[color] ?? PLAYER_COLOR_CLASSES.blue!;

  return (
    <div className="shrink-0 border-b border-[#c5a84a]/10 bg-[#060e1a]/60 px-2 py-1.5">
      {/* Name + counts */}
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? colorClasses.bg : 'bg-zinc-700'}`} />
        <span className={`text-[11px] font-medium truncate ${isActive ? colorClasses.text : 'text-zinc-500'}`}>
          {name}
          {isActive && <span className="ml-1 opacity-60 text-[10px]">(active)</span>}
        </span>
        <span className="ml-auto text-[10px] text-zinc-500 flex-shrink-0 tabular-nums">
          Deck:{deckCount} Hand:{handCount} Runes:{runeDeckCount} Trash:{trashCount}
        </span>
      </div>

      {/* Runes row */}
      {channeledRunes.length > 0 && (
        <div className="flex items-end gap-1 overflow-x-auto pb-0.5 mb-1">
          {channeledRunes.map((rune, i) => (
            <div key={rune.card.uid} className="flex-shrink-0">
              <div
                style={{
                  width: `${CARD.opponentRune}px`, aspectRatio: '2/3',
                  transform: rune.exhausted ? 'rotate(90deg)' : 'none',
                  opacity: rune.exhausted ? 0.5 : 1,
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                  marginRight: rune.exhausted ? '12px' : '0',
                  marginLeft: rune.exhausted && i > 0 ? '12px' : '0',
                }}
                className="rounded bg-[#0a1628] border border-[#c5a84a]/30 overflow-hidden"
              >
                {rune.card.imageSmall ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={rune.card.imageSmall} alt={rune.card.name} className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full flex items-end justify-center pb-0.5">
                    <span className="text-[5px] text-[#c5a84a]/50 text-center px-0.5 leading-tight">{rune.card.name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend, Champion, Base */}
      <div className="flex items-end gap-1.5 overflow-x-auto pb-0.5">
        {legend ? (
          <ExhaustableCard
            card={legend}
            label="Legend"
            exhausted={exhaustedUids.includes(legend.uid)}
            onTap={() => onToggleExhaust(legend.uid)}
            width={CARD.opponentCard}
          />
        ) : <ZoneSlot label="Legend" width={CARD.opponentCard} />}

        {champion ? (
          <ExhaustableCard
            card={champion}
            label="Champ"
            exhausted={exhaustedUids.includes(champion.uid)}
            onTap={() => onToggleExhaust(champion.uid)}
            width={CARD.opponentCard}
          />
        ) : <ZoneSlot label="Champ" width={CARD.opponentCard} />}

        {base.length > 0 && (
          <div className="w-px h-10 bg-[#c5a84a]/20 mx-0.5 flex-shrink-0" />
        )}

        {base.map((card) => (
          <ExhaustableCard
            key={card.uid}
            card={card}
            label="Base"
            exhausted={exhaustedUids.includes(card.uid)}
            onTap={() => onToggleExhaust(card.uid)}
            width={CARD.opponentCard}
          />
        ))}
      </div>
    </div>
  );
}
