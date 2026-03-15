'use client';

import Image from 'next/image';
import { parseDomains } from '../wizard-helpers';
import { DomainBadge } from './wizard-shared';
import type { LegendCard } from '../wizard-types';

interface LegendStepProps {
  legendSearch: string;
  setLegendSearch: (s: string) => void;
  legendDomainFilter: string;
  setLegendDomainFilter: (s: string) => void;
  filteredLegends: LegendCard[];
  legendsLoading: boolean;
  selectedLegend: LegendCard | null;
  setSelectedLegend: (legend: LegendCard) => void;
}

export function LegendStep({
  legendSearch,
  setLegendSearch,
  legendDomainFilter,
  setLegendDomainFilter,
  filteredLegends,
  legendsLoading,
  selectedLegend,
  setSelectedLegend,
}: LegendStepProps) {
  return (
    <div className="flex flex-col gap-4 p-6 overflow-hidden h-full">
      <div>
        <h2 className="lg-page-title mb-1">Pick your Legend</h2>
        <p className="lg-text-secondary">Your Legend defines the deck's domains.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 shrink-0">
        <input
          type="search"
          value={legendSearch}
          onChange={(e) => setLegendSearch(e.target.value)}
          placeholder="Search legends…"
          className="lg-input text-sm"
          aria-label="Search legends"
        />
        <select
          value={legendDomainFilter}
          onChange={(e) => setLegendDomainFilter(e.target.value)}
          className="lg-select text-sm shrink-0"
          aria-label="Filter by domain"
        >
          <option value="all">All domains</option>
          {['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Legend grid */}
      <div className="overflow-y-auto flex-1">
        {legendsLoading ? (
          <div className="flex items-center justify-center py-16" role="status">
            <div className="lg-spinner" />
            <span className="sr-only">Loading legends</span>
          </div>
        ) : filteredLegends.length === 0 ? (
          <p className="lg-text-muted text-center py-8">No legends found</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredLegends.map((legend) => {
              const isSelected = selectedLegend?.id === legend.id;
              const domains = parseDomains(legend.domain);
              return (
                <button
                  key={legend.id}
                  type="button"
                  onClick={() => setSelectedLegend(legend)}
                  aria-pressed={isSelected}
                  className={[
                    'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 text-left group',
                    isSelected
                      ? 'border-rift-500 ring-2 ring-rift-500/40'
                      : 'border-surface-border hover:border-rift-500/50',
                  ].join(' ')}
                >
                  <div className="relative w-full aspect-[2/3] bg-zinc-900">
                    {legend.imageSmall ? (
                      <Image
                        src={legend.imageSmall}
                        alt={legend.name}
                        fill
                        sizes="(max-width: 768px) 45vw, 30vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <span className="text-zinc-500 text-xs text-center px-2">{legend.name}</span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-rift-600/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-rift-600 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">✓</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-surface-card">
                    <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1.5">{legend.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {domains.filter(Boolean).map((d) => (
                        <DomainBadge key={d} domain={d} />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected summary */}
      {selectedLegend && (
        <div className="shrink-0 lg-card p-3 flex items-center gap-3 bg-rift-950/50 border-rift-700/50">
          {selectedLegend.imageSmall && (
            <div className="relative w-10 h-14 rounded overflow-hidden shrink-0">
              <Image src={selectedLegend.imageSmall} alt={selectedLegend.name} fill className="object-cover" sizes="40px" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{selectedLegend.name}</p>
            <div className="flex gap-1 mt-1">
              {parseDomains(selectedLegend.domain).filter(Boolean).map((d) => (
                <DomainBadge key={d} domain={d} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
