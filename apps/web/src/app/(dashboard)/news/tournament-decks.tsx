'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-amber-500/20',  text: 'text-amber-400',  border: 'border-amber-500/40' },
  A: { bg: 'bg-green-500/20',  text: 'text-green-400',  border: 'border-green-500/40' },
  B: { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/40' },
  C: { bg: 'bg-zinc-500/20',   text: 'text-zinc-400',   border: 'border-zinc-600/40' },
};

const REGION_STYLES: Record<string, string> = {
  China:           'bg-red-900/30 text-red-400 border-red-700/40',
  Europe:          'bg-blue-900/30 text-blue-400 border-blue-700/40',
  'North America': 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40',
  Asia:            'bg-purple-900/30 text-purple-400 border-purple-700/40',
  'Latin America': 'bg-amber-900/30 text-amber-400 border-amber-700/40',
  International:   'bg-zinc-800/50 text-zinc-400 border-zinc-700/40',
};

type RegionFilter = 'all' | 'China' | 'International';

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const style = TIER_STYLES[tier] ?? TIER_STYLES['C']!;
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold border ${style.bg} ${style.text} ${style.border}`}
    >
      {tier}
    </span>
  );
}

function RegionBadge({ region }: { region: string }) {
  const cls = REGION_STYLES[region] ?? REGION_STYLES['International']!;
  return (
    <span className={`lg-badge border text-[10px] shrink-0 ${cls}`}>{region}</span>
  );
}

function PlacementBadge({ placement }: { placement: number }) {
  const labels: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
  const label = labels[placement];
  if (!label) return null;
  const isWinner = placement === 1;
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
        isWinner ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-white'
      }`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Meta Breakdown skeleton
// ---------------------------------------------------------------------------

function MetaTableSkeleton() {
  return (
    <div className="animate-pulse space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <div className="w-5 h-3 bg-surface-elevated rounded" />
          <div className="w-9 h-9 rounded-full bg-surface-elevated shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-surface-elevated rounded w-32" />
            <div className="h-2.5 bg-surface-elevated rounded w-20" />
          </div>
          <div className="w-32 h-2 bg-surface-elevated rounded hidden sm:block" />
          <div className="w-8 h-5 bg-surface-elevated rounded" />
          <div className="w-8 h-3 bg-surface-elevated rounded" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta Breakdown Table
// ---------------------------------------------------------------------------

function MetaBreakdownTable() {
  const { data, isLoading } = trpc.deck.metaBreakdown.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const entries = data ?? [];

  return (
    <section className="lg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Legend Meta Share</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Distribution across all public decks</p>
        </div>
        {entries.length > 0 && (
          <span className="text-[11px] text-zinc-500">
            {entries.reduce((s, e) => s + e.deckCount, 0)} total decks
          </span>
        )}
      </div>

      {isLoading ? (
        <MetaTableSkeleton />
      ) : entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-zinc-500 text-sm">
          No public decks found yet
        </div>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div className="hidden sm:grid grid-cols-[2rem_2.5rem_1fr_9rem_2.5rem_3.5rem] items-center gap-3 px-4 py-2 border-b border-surface-border bg-surface-elevated/40">
            <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">#</span>
            <span />
            <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">Legend</span>
            <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">Meta share</span>
            <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider text-center">Tier</span>
            <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider text-right">Decks</span>
          </div>

          <ul className="divide-y divide-surface-border">
            {entries.map((entry, idx) => {
              const tierStyle = entry.tier ? (TIER_STYLES[entry.tier] ?? TIER_STYLES['C']!) : null;
              const barWidth = Math.min(100, entry.metaShare);

              return (
                <li
                  key={entry.legendId}
                  className="grid grid-cols-[2rem_2.5rem_1fr_auto] sm:grid-cols-[2rem_2.5rem_1fr_9rem_2.5rem_3.5rem] items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Rank */}
                  <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                    {idx + 1}
                  </span>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-elevated ring-1 ring-surface-border shrink-0 relative">
                    {entry.legendImage ? (
                      <Image
                        src={entry.legendImage}
                        alt={entry.legendName}
                        fill
                        sizes="36px"
                        className="object-cover object-top scale-125"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[9px]">?</div>
                    )}
                  </div>

                  {/* Name + deck count subtitle */}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-tight">
                      {entry.legendCleanName || entry.legendName}
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                      {entry.deckCount} {entry.deckCount === 1 ? 'deck' : 'decks'}
                    </p>
                  </div>

                  {/* Meta share bar — hidden on mobile */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rift-500 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 tabular-nums w-10 text-right shrink-0">
                      {entry.metaShare.toFixed(1)}%
                    </span>
                  </div>

                  {/* Tier badge — hidden on mobile, replaced by inline on mobile */}
                  <div className="hidden sm:flex justify-center">
                    <TierBadge tier={entry.tier} />
                  </div>

                  {/* Deck count — desktop */}
                  <span className="hidden sm:block text-right text-xs font-mono text-zinc-300 tabular-nums">
                    {entry.deckCount}
                  </span>

                  {/* Mobile: tier badge inline */}
                  <div className="flex sm:hidden justify-end">
                    {tierStyle && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}>
                        {entry.tier}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Deck card (tournament grid item)
// ---------------------------------------------------------------------------

type BrowseDeck = {
  id: string;
  name: string;
  domain: string | null;
  tier: string | null;
  tournament: string | null;
  region: string | null;
  placement: number | null;
  coverCard: { imageSmall: string | null } | null;
  user: { username: string; displayName: string | null };
};

function DeckCard({ deck }: { deck: BrowseDeck }) {
  const placement = deck.placement;
  const isWinner = placement === 1;
  const isFinalist = placement !== null && placement !== undefined && placement <= 4;

  return (
    <Link
      href={`/decks/${deck.id}`}
      className={`lg-card overflow-hidden transition-all group ${
        isWinner
          ? 'border-amber-500/50 hover:border-amber-400/70 ring-1 ring-amber-500/20'
          : isFinalist
          ? 'border-zinc-500/40 hover:border-zinc-400/60'
          : 'hover:border-rift-600/50'
      }`}
    >
      <div className="relative h-24 bg-surface-elevated overflow-hidden">
        {deck.coverCard?.imageSmall ? (
          <Image
            src={deck.coverCard.imageSmall}
            alt={deck.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-zinc-600 text-[10px]">No image</span>
          </div>
        )}

        {placement !== null && placement !== undefined && placement <= 4 && (
          <div className="absolute top-1.5 left-1.5">
            <PlacementBadge placement={placement} />
          </div>
        )}

        {deck.tier && (
          <div className="absolute top-1.5 right-1.5">
            <TierBadge tier={deck.tier} />
          </div>
        )}
      </div>

      <div className="p-2.5 space-y-0.5">
        <p
          className={`text-xs truncate leading-tight ${
            isWinner
              ? 'font-bold text-amber-400'
              : isFinalist
              ? 'font-semibold text-white'
              : 'font-medium text-white'
          }`}
        >
          {deck.name}
        </p>
        <p className="text-[10px] text-zinc-500 truncate">
          {deck.domain && <span className="text-zinc-400">{deck.domain}</span>}
          {deck.domain && ' - '}
          {deck.user.displayName ?? deck.user.username}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Tournament section
// ---------------------------------------------------------------------------

function TournamentSection({
  tournament,
  decks,
  defaultExpanded,
}: {
  tournament: string;
  decks: BrowseDeck[];
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const region = (decks[0] as { region?: string | null }).region ?? 'International';

  // Sort by placement
  const sorted = [...decks].sort((a, b) => {
    const pa = a.placement ?? 999;
    const pb = b.placement ?? 999;
    return pa - pb;
  });
  const displayed = expanded ? sorted : sorted.slice(0, 8);

  return (
    <div className="lg-card overflow-hidden">
      {/* Tournament header */}
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between bg-surface-elevated/30">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h3 className="text-sm font-bold text-white">{tournament}</h3>
          <RegionBadge region={region} />
          <span className="text-[10px] text-zinc-500">{decks.length} players</span>
        </div>
        {decks.length > 8 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-rift-400 hover:text-rift-300 transition-colors shrink-0"
          >
            {expanded ? 'Show less' : `All ${decks.length}`}
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="hidden sm:grid grid-cols-[2.5rem_2.5rem_1fr_7rem_3rem_2rem] items-center gap-2 px-4 py-2 border-b border-surface-border text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
        <span>#</span>
        <span />
        <span>Deck</span>
        <span>Domain</span>
        <span>Tier</span>
        <span />
      </div>

      {/* Rows */}
      <ul className="divide-y divide-surface-border">
        {displayed.map((deck) => {
          const placement = deck.placement;
          const isWinner = placement === 1;
          const isFinalist = placement !== null && placement !== undefined && placement <= 4;

          return (
            <li key={deck.id}>
              <Link
                href={`/decks/${deck.id}`}
                className={`grid grid-cols-[2.5rem_2.5rem_1fr_auto] sm:grid-cols-[2.5rem_2.5rem_1fr_7rem_3rem_2rem] items-center gap-2 px-4 py-2.5 hover:bg-white/[0.03] transition-colors ${
                  isWinner ? 'bg-amber-500/[0.04]' : ''
                }`}
              >
                {/* Placement */}
                <span className="flex justify-center">
                  {placement !== null && placement !== undefined && placement <= 4 ? (
                    <PlacementBadge placement={placement} />
                  ) : (
                    <span className="text-[11px] text-zinc-600 tabular-nums">{placement ?? '-'}</span>
                  )}
                </span>

                {/* Avatar */}
                <div className="w-9 h-9 rounded overflow-hidden bg-surface-elevated shrink-0 relative">
                  {deck.coverCard?.imageSmall ? (
                    <Image
                      src={deck.coverCard.imageSmall}
                      alt={deck.name}
                      fill
                      sizes="36px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[9px]">?</div>
                  )}
                </div>

                {/* Deck name */}
                <div className="min-w-0">
                  <p className={`text-xs truncate leading-tight ${
                    isWinner ? 'font-bold text-amber-400' : isFinalist ? 'font-semibold text-white' : 'text-white'
                  }`}>
                    {deck.name.replace(/^\[(RD|Official)\]\s*/, '').replace(/ - (RQ |Summoner ).*$/, '')}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                    by {deck.user.displayName ?? deck.user.username}
                  </p>
                </div>

                {/* Domain — desktop */}
                <span className="hidden sm:block text-[11px] text-zinc-400 truncate">
                  {deck.domain ?? '-'}
                </span>

                {/* Tier — desktop */}
                <span className="hidden sm:flex justify-center">
                  {deck.tier ? <TierBadge tier={deck.tier} /> : <span className="text-[11px] text-zinc-600">-</span>}
                </span>

                {/* Arrow */}
                <span className="hidden sm:flex justify-end text-zinc-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>

                {/* Mobile: domain + tier inline */}
                <div className="flex sm:hidden items-center gap-1.5 justify-end">
                  {deck.domain && <span className="text-[10px] text-zinc-500">{deck.domain}</span>}
                  <TierBadge tier={deck.tier} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function TournamentDecks() {
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = trpc.deck.browse.useQuery(
    { limit: 50 },
    { staleTime: 5 * 60 * 1000 },
  );

  const decks = (data?.items ?? []) as BrowseDeck[];

  const { tournamentGroups, metaDecks } = useMemo(() => {
    let filtered =
      regionFilter === 'all'
        ? decks
        : regionFilter === 'China'
        ? decks.filter((d) => d.region === 'China')
        : decks.filter((d) => d.region !== 'China');

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.domain ?? '').toLowerCase().includes(q) ||
          (d.user.displayName ?? d.user.username).toLowerCase().includes(q) ||
          (d.tournament ?? '').toLowerCase().includes(q),
      );
    }

    const groups = new Map<string, BrowseDeck[]>();
    const meta: BrowseDeck[] = [];

    for (const deck of filtered) {
      if (deck.tournament) {
        const existing = groups.get(deck.tournament) ?? [];
        existing.push(deck);
        groups.set(deck.tournament, existing);
      } else {
        meta.push(deck);
      }
    }

    // Sort tournament groups: most finalists (placement 1-4) first, then by deck count
    const sorted = [...groups.entries()].sort((a, b) => {
      const aFinalists = a[1].filter((d) => d.placement !== null && d.placement <= 4).length;
      const bFinalists = b[1].filter((d) => d.placement !== null && d.placement <= 4).length;
      if (bFinalists !== aFinalists) return bFinalists - aFinalists;
      return b[1].length - a[1].length;
    });

    return { tournamentGroups: sorted, metaDecks: meta };
  }, [decks, regionFilter, search]);

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Section 1: Meta Breakdown Table                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-rift-500" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Meta Breakdown</h2>
        </div>
        <MetaBreakdownTable />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Section 2 + 3: Filters + Tournament Results                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-rift-500" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Top Tournament Events</h2>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search decks, players, tournaments..."
            className="lg-input text-xs py-2 flex-1"
          />
          <div className="flex gap-2 shrink-0">
            {(['all', 'International', 'China'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  regionFilter === r
                    ? 'bg-rift-900/50 text-rift-400 border-rift-700/50'
                    : 'bg-transparent text-zinc-400 border-surface-border hover:border-zinc-600'
                }`}
              >
                {r === 'all' ? 'All Regions' : r}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="lg-card overflow-hidden animate-pulse">
                <div className="h-24 bg-surface-elevated" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3.5 bg-surface-elevated rounded w-3/4" />
                  <div className="h-3 bg-surface-elevated rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : tournamentGroups.length === 0 && metaDecks.length === 0 ? (
          <div className="lg-card p-8 text-center">
            <p className="text-zinc-400 text-sm">
              {search || regionFilter !== 'all'
                ? 'No decks match your filters'
                : 'No tournament decks available yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {/* Tournament groups */}
            {tournamentGroups.map(([tournament, tournamentDecks], idx) => (
              <TournamentSection
                key={tournament}
                tournament={tournament}
                decks={tournamentDecks}
                defaultExpanded={idx === 0}
              />
            ))}

            {/* Community decks (no tournament tag) — same table format */}
            {metaDecks.length > 0 && (
              <TournamentSection
                tournament="Community Meta Decks"
                decks={metaDecks}
                defaultExpanded={tournamentGroups.length === 0}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
