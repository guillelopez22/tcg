'use client';

import Image from 'next/image';
import {
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  BATTLEFIELD_COUNT,
  SIDEBOARD_SIZE,
} from '@la-grieta/shared';
import { parseDomains, isSignatureCard, getDomainBadge } from '../wizard-helpers';
import type { DeckEntry, LegendCard, BuildMethod } from '../wizard-types';

interface ReviewStepValidation {
  mainOk: boolean;
  runeOk: boolean;
  bfOk: boolean;
  hasChampion: boolean;
}

interface ReviewStepProps {
  deckName: string;
  selectedLegend: LegendCard | null;
  buildMethod: BuildMethod | null;
  legendDomains: (string | undefined)[];
  entries: DeckEntry[];
  legendEntry: DeckEntry | undefined;
  championEntry: DeckEntry | undefined;
  mainEntries: DeckEntry[];
  runeEntries: DeckEntry[];
  battlefieldEntries: DeckEntry[];
  sideboardEntries: DeckEntry[];
  mainCount: number;
  runeCount: number;
  battlefieldCount: number;
  sideboardCount: number;
  validation: ReviewStepValidation;
}

export function ReviewStep({
  deckName,
  selectedLegend,
  buildMethod,
  legendDomains,
  entries,
  legendEntry,
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
}: ReviewStepProps) {
  const validationMessages: string[] = [];
  if (!validation.mainOk) {
    if (!validation.hasChampion) validationMessages.push('Main deck requires exactly 1 Champion Unit');
    if (mainCount !== MAIN_DECK_SIZE) validationMessages.push(`Main deck: ${mainCount}/${MAIN_DECK_SIZE} cards`);
  }
  if (!validation.runeOk) validationMessages.push(`Rune deck: ${runeCount}/${RUNE_DECK_SIZE} runes`);
  if (!validation.bfOk) validationMessages.push(`Battlefields: ${battlefieldCount}/${BATTLEFIELD_COUNT}`);

  if (legendEntry) {
    for (const e of entries) {
      if (isSignatureCard(e.card.cardType) && e.card.domain !== legendEntry.card.domain) {
        validationMessages.push(`${e.card.name} doesn't match your Legend's domain`);
      }
    }
  }

  // Domain breakdown (main + rune)
  const domainCounts: Record<string, number> = {};
  for (const e of [...mainEntries, ...runeEntries]) {
    const domains = parseDomains(e.card.domain || null);
    for (const d of domains.filter(Boolean)) {
      domainCounts[d] = (domainCounts[d] ?? 0) + e.quantity;
    }
  }

  const sections = [
    { label: 'Legend & Champion', items: [legendEntry, championEntry].filter(Boolean) as DeckEntry[], max: 2, count: (legendEntry ? 1 : 0) + (championEntry ? 1 : 0) },
    { label: 'Main Deck', items: mainEntries, max: MAIN_DECK_SIZE, count: mainCount },
    { label: 'Rune Deck', items: runeEntries, max: RUNE_DECK_SIZE, count: runeCount },
    { label: 'Battlefields', items: battlefieldEntries, max: BATTLEFIELD_COUNT, count: battlefieldEntries.length },
    ...(sideboardEntries.length > 0 ? [{ label: 'Sideboard', items: sideboardEntries, max: SIDEBOARD_SIZE, count: sideboardCount }] : []),
  ];

  return (
    <div className="overflow-y-auto flex-1 p-6 space-y-6">
      <div>
        <h2 className="lg-page-title mb-1">Review your deck</h2>
        <p className="lg-text-secondary">"{deckName}" — {selectedLegend?.name}</p>
        {buildMethod === 'auto' && (
          <p className="text-xs text-rift-400 mt-1">Auto-built from {legendDomains.filter(Boolean).join(' + ')} cards. Edit in the Build step if needed.</p>
        )}
        {buildMethod === 'import' && (
          <p className="text-xs text-rift-400 mt-1">Imported deck. Verify the cards look correct before creating.</p>
        )}
      </div>

      {/* Validation messages */}
      {validationMessages.length > 0 && (
        <div className="lg-alert-error space-y-1" role="alert">
          {validationMessages.map((m) => (
            <p key={m} className="flex items-center gap-1.5">
              <span className="text-red-400">!</span> {m}
            </p>
          ))}
        </div>
      )}

      {/* Domain breakdown */}
      <div>
        <h3 className="lg-section-title mb-2">Domain breakdown</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(domainCounts).map(([domain, count]) => (
            <div key={domain} className={`lg-badge border ${getDomainBadge(domain)} gap-1`}>
              <span>{domain}</span>
              <span className="opacity-60">×{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sections summary */}
      {sections.map(({ label, items, max, count }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="lg-section-title">{label}</h3>
            <span className="lg-text-muted">{count}/{max}</span>
          </div>
          {items.length === 0 ? (
            <p className="lg-text-muted">None added</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {items.map((e) => (
                <div key={e.card.id} className="relative">
                  <div className="relative w-full aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden">
                    {e.card.imageSmall ? (
                      <Image
                        src={e.card.imageSmall}
                        alt={e.card.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-zinc-600 text-[9px] text-center px-1">{e.card.name}</span>
                      </div>
                    )}
                    {e.quantity > 1 && <div className="lg-badge-count">{e.quantity}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
