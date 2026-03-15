'use client';

import Image from 'next/image';
import {
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  BATTLEFIELD_COUNT,
  SIDEBOARD_SIZE,
} from '@la-grieta/shared';
import { parseDomains } from '../wizard-helpers';
import { SectionHeader, DeckEntryRow, DomainBadge } from './wizard-shared';
import { CardBrowser } from './card-browser';
import type { LegendCard, DeckEntry, BrowserTab, CardItem } from '../wizard-types';

interface BuildStepValidation {
  mainOk: boolean;
  runeOk: boolean;
  bfOk: boolean;
  sideboardOk: boolean;
  hasChampion: boolean;
  isValid: boolean;
}

interface BuildStepProps {
  selectedLegend: LegendCard;
  legendDomains: (string | undefined)[];
  entries: DeckEntry[];
  browserTab: BrowserTab;
  setBrowserTab: (tab: BrowserTab) => void;
  championEntry: DeckEntry | undefined;
  mainEntries: DeckEntry[];
  runeEntries: DeckEntry[];
  battlefieldEntries: DeckEntry[];
  sideboardEntries: DeckEntry[];
  mainCount: number;
  runeCount: number;
  battlefieldCount: number;
  sideboardCount: number;
  validation: BuildStepValidation;
  onAdd: (card: CardItem) => void;
  onRemove: (cardId: string) => void;
  onRemoveFully: (cardId: string) => void;
}

export function BuildStep({
  selectedLegend,
  legendDomains,
  entries,
  browserTab,
  setBrowserTab,
  championEntry,
  mainEntries,
  runeEntries,
  battlefieldEntries,
  sideboardEntries,
  mainCount,
  runeCount,
  battlefieldCount,
  sideboardCount,
  validation,
  onAdd,
  onRemove,
  onRemoveFully,
}: BuildStepProps) {
  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Left panel — deck sections */}
      <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-surface-border flex flex-col overflow-hidden">
        <div className="p-4 overflow-y-auto flex-1 space-y-5">

          {/* Legend + Champion */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">Legend & Champion</span>
              <span className={`text-xs ${validation.hasChampion ? 'text-green-400' : 'text-amber-400'}`}>
                {validation.hasChampion ? '✓' : '!'} {championEntry ? '2/2' : '1/2'}
              </span>
            </div>
            <div className="space-y-1.5">
              {/* Legend (locked) */}
              <div className="flex items-center gap-2 lg-card p-2">
                {selectedLegend.imageSmall && (
                  <div className="relative w-8 h-11 rounded overflow-hidden shrink-0">
                    <Image src={selectedLegend.imageSmall} alt={selectedLegend.name} fill className="object-cover" sizes="32px" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{selectedLegend.name}</p>
                  <div className="flex gap-1 mt-0.5">
                    {legendDomains.filter(Boolean).map((d) => (
                      <DomainBadge key={d} domain={d!} />
                    ))}
                  </div>
                </div>
                <span className="lg-badge bg-zinc-800 text-zinc-400 text-[9px] ml-auto shrink-0">Legend</span>
              </div>

              {/* Champion (clickable to swap) */}
              {championEntry ? (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveFully(championEntry.card.id);
                    setBrowserTab('main');
                  }}
                  className="w-full flex items-center gap-2 lg-card p-2 hover:border-rift-600/50 transition-colors text-left"
                  title="Click to remove and pick a different Champion Unit"
                >
                  {championEntry.card.imageSmall && (
                    <div className="relative w-8 h-11 rounded overflow-hidden shrink-0">
                      <Image src={championEntry.card.imageSmall} alt={championEntry.card.name} fill className="object-cover" sizes="32px" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{championEntry.card.name}</p>
                    <p className="text-[10px] text-zinc-500">Champion Unit</p>
                  </div>
                  <span className="lg-badge bg-rift-900/50 text-rift-400 text-[9px] ml-auto shrink-0">Swap</span>
                </button>
              ) : (
                <div className="lg-card p-2 border-dashed">
                  <p className="text-xs text-amber-400 text-center">Add a Champion Unit from the card browser</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Deck */}
          <div>
            <SectionHeader title="Main Deck" count={mainCount} max={MAIN_DECK_SIZE} valid={validation.mainOk} />
            {mainEntries.length === 0 ? (
              <p className="lg-text-muted text-center py-3">No cards yet</p>
            ) : (
              <div className="space-y-1">
                {mainEntries.map((e) => (
                  <DeckEntryRow key={e.card.id} entry={e} onRemove={onRemove} onRemoveFully={onRemoveFully} />
                ))}
              </div>
            )}
          </div>

          {/* Rune Deck */}
          <div>
            <SectionHeader title="Rune Deck" count={runeCount} max={RUNE_DECK_SIZE} valid={validation.runeOk} />
            {runeEntries.length === 0 ? (
              <p className="lg-text-muted text-center py-3">No runes yet</p>
            ) : (
              <div className="space-y-1">
                {runeEntries.map((e) => (
                  <DeckEntryRow key={e.card.id} entry={e} onRemove={onRemove} onRemoveFully={onRemoveFully} />
                ))}
              </div>
            )}
          </div>

          {/* Battlefields */}
          <div>
            <SectionHeader title="Battlefields" count={battlefieldCount} max={BATTLEFIELD_COUNT} valid={validation.bfOk} />
            {battlefieldEntries.length === 0 ? (
              <p className="lg-text-muted text-center py-3">No battlefields yet</p>
            ) : (
              <div className="space-y-1">
                {battlefieldEntries.map((e) => (
                  <DeckEntryRow key={e.card.id} entry={e} onRemove={onRemoveFully} onRemoveFully={onRemoveFully} />
                ))}
              </div>
            )}
          </div>

          {/* Sideboard */}
          <div>
            <SectionHeader title="Sideboard" count={sideboardCount} max={SIDEBOARD_SIZE} valid={validation.sideboardOk} extra="(optional)" />
            {sideboardEntries.length === 0 ? (
              <p className="lg-text-muted text-center py-3">No sideboard cards</p>
            ) : (
              <div className="space-y-1">
                {sideboardEntries.map((e) => (
                  <DeckEntryRow key={e.card.id} entry={e} onRemove={onRemove} onRemoveFully={onRemoveFully} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right panel — card browser */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
        <CardBrowser
          legend={selectedLegend}
          entries={entries}
          onAdd={onAdd}
          activeTab={browserTab}
          onTabChange={setBrowserTab}
        />
      </div>
    </div>
  );
}
