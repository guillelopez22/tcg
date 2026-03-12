'use client';

// Deck creation wizard — guides users through building a new deck.
// Three paths: Suggested (import a trending deck), Build Around Legend, Build From Scratch.
// Features: tier badges on trending decks, preview step before import, legend search +
// domain filter, deck summary step after legend-path creation, non-Latin name fallback.

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

const DOMAIN_COLORS: Record<string, string> = {
  Fury: 'text-red-400 bg-red-400/10 border-red-400/30',
  Calm: 'text-green-400 bg-green-400/10 border-green-400/30',
  Mind: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  Body: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  Chaos: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  Order: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
};

const TIER_STYLES: Record<string, string> = {
  S: 'bg-yellow-500/20 text-yellow-400',
  A: 'bg-emerald-500/20 text-emerald-400',
  B: 'bg-blue-500/20 text-blue-400',
  C: 'bg-zinc-500/20 text-zinc-400',
};

type WizardPath = null | 'suggested' | 'legend' | 'scratch';
type WizardStep = 'choose-path' | 'pick-suggested' | 'preview-suggested' | 'pick-legend' | 'choose-build-mode' | 'name-deck' | 'deck-summary';
type BuildMode = 'owned_first' | 'best_fit';

interface DeckWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface LegendCard {
  id: string;
  name: string;
  cleanName: string;
  domain: string | null;
  imageSmall: string | null;
}

interface DeckSummary {
  deckId: string;
  cardCount: number;
  domainBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Non-Latin script helpers
// ---------------------------------------------------------------------------

function isNonLatinScript(text: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(text);
}

function getDisplayName(rawName: string, legendName?: string | null): { primary: string; subtitle: string | null } {
  const cleaned = rawName.replace(/^\[RD\]\s*/, '');
  if (isNonLatinScript(cleaned)) {
    return { primary: legendName ?? 'Imported Deck', subtitle: cleaned };
  }
  return { primary: cleaned, subtitle: null };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeckWizard({ isOpen, onClose, onCreated }: DeckWizardProps) {
  const router = useRouter();
  const [path, setPath] = useState<WizardPath>(null);
  const [step, setStep] = useState<WizardStep>('choose-path');
  const [selectedLegend, setSelectedLegend] = useState<LegendCard | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [deckSummary, setDeckSummary] = useState<DeckSummary | null>(null);
  const [buildMode, setBuildMode] = useState<BuildMode>('owned_first');

  // Legend search and domain filter state
  const [legendSearch, setLegendSearch] = useState('');
  const [legendDomainFilter, setLegendDomainFilter] = useState<string | null>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setPath(null);
      setStep('choose-path');
      setSelectedLegend(null);
      setSelectedDeckId(null);
      setDeckName('');
      setIsBusy(false);
      setDeckSummary(null);
      setLegendSearch('');
      setLegendDomainFilter(null);
      setBuildMode('owned_first');
    }
  }, [isOpen]);

  // Fetch legends via the dedicated legends endpoint (single query, replaces 6 chained)
  const { data: legendsData } = trpc.card.legends.useQuery(
    undefined,
    { enabled: isOpen, staleTime: Infinity },
  );

  // All legends from the endpoint — deduplicate by cleanName (base version only)
  const allLegends = useMemo((): LegendCard[] => {
    if (!legendsData) return [];
    const seen = new Set<string>();
    return (legendsData as LegendCard[])
      .filter((c) => {
        if (c.name.includes('(Overnumbered)') || c.name.includes('(Alternate Art)')) return false;
        if (seen.has(c.cleanName)) return false;
        seen.add(c.cleanName);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [legendsData]);

  // Unique domains across all legends (for filter chips)
  const legendDomains = useMemo(() => {
    const domains = new Set<string>();
    for (const legend of allLegends) {
      if (!legend.domain) continue;
      for (const d of legend.domain.split(';')) {
        if (d) domains.add(d);
      }
    }
    return Array.from(domains).sort();
  }, [allLegends]);

  // Client-side filtered legends
  const legends = useMemo(() => {
    return allLegends.filter((legend) => {
      const searchMatch = legendSearch
        ? legend.cleanName.toLowerCase().includes(legendSearch.toLowerCase()) ||
          legend.name.toLowerCase().includes(legendSearch.toLowerCase())
        : true;
      const domainMatch = legendDomainFilter
        ? (legend.domain?.split(';').includes(legendDomainFilter) ?? false)
        : true;
      return searchMatch && domainMatch;
    });
  }, [allLegends, legendSearch, legendDomainFilter]);

  // Fetch trending decks for the "suggested" path
  const { data: trendingData } = trpc.deck.browse.useQuery(
    { limit: 20 },
    { enabled: isOpen && step === 'pick-suggested', staleTime: 60_000 },
  );
  const trendingDecks = trendingData?.items ?? [];

  // Fetch selected deck for preview step
  const { data: previewDeck, isLoading: isPreviewLoading } = trpc.deck.getById.useQuery(
    { id: selectedDeckId ?? '' },
    { enabled: !!selectedDeckId && step === 'preview-suggested', staleTime: 60_000 },
  );

  // Group preview deck cards by cardType
  const previewCardGroups = useMemo(() => {
    if (!previewDeck?.cards) return {};
    const groups: Record<string, { name: string; quantity: number }[]> = {};
    for (const dc of previewDeck.cards) {
      const type = dc.card.cardType ?? 'Other';
      if (!groups[type]) groups[type] = [];
      groups[type].push({ name: dc.card.name, quantity: dc.quantity });
    }
    return groups;
  }, [previewDeck]);

  const createDeck = trpc.deck.create.useMutation();
  const setCards = trpc.deck.setCards.useMutation();

  // Load user collection for "Build with my cards" mode (ownership-based sorting)
  const { data: collectionData } = trpc.collection.list.useQuery(
    { limit: 200 },
    { enabled: isOpen && path === 'legend', staleTime: 5 * 60 * 1000 },
  );

  const ownershipSet = useMemo((): Set<string> => {
    const set = new Set<string>();
    if (!collectionData?.items) return set;
    for (const entry of collectionData.items) {
      set.add(entry.card.id);
    }
    return set;
  }, [collectionData]);

  // We still need allCards for buildStarterCardsFromPool. Load them lazily only when legend path is active.
  const { data: allCardsData } = trpc.card.list.useQuery(
    { limit: 100 },
    { enabled: isOpen && path === 'legend', staleTime: Infinity },
  );
  const { data: allCardsP2 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsData?.nextCursor ?? undefined },
    { enabled: isOpen && path === 'legend' && !!allCardsData?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP3 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP2?.nextCursor ?? undefined },
    { enabled: isOpen && path === 'legend' && !!allCardsP2?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP4 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP3?.nextCursor ?? undefined },
    { enabled: isOpen && path === 'legend' && !!allCardsP3?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP5 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP4?.nextCursor ?? undefined },
    { enabled: isOpen && path === 'legend' && !!allCardsP4?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP6 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP5?.nextCursor ?? undefined },
    { enabled: isOpen && path === 'legend' && !!allCardsP5?.nextCursor, staleTime: Infinity },
  );

  const allCards = useMemo(() => {
    const pages = [allCardsData, allCardsP2, allCardsP3, allCardsP4, allCardsP5, allCardsP6];
    const cardArr: Array<{ id: string; name: string; cleanName: string; domain: string | null; cardType: string | null; imageSmall: string | null; rarity: string }> = [];
    for (const page of pages) {
      if (page?.items) {
        for (const c of page.items) {
          if (c.cardType) cardArr.push(c as typeof cardArr[number]);
        }
      }
    }
    return cardArr;
  }, [allCardsData, allCardsP2, allCardsP3, allCardsP4, allCardsP5, allCardsP6]);

  function buildStarterCardsFromPool(legend: LegendCard, mode: BuildMode = 'owned_first'): Array<{ cardId: string; quantity: number }> {
    const domains = legend.domain?.split(';') ?? [];
    const pool = allCards.filter((c) => {
      if (c.id === legend.id) return false;
      if (c.cardType === 'Legend' || c.cardType === 'Token') return false;
      if (!c.domain) return false;
      return domains.some((d) => c.domain?.includes(d));
    });

    const rarityOrder: Record<string, number> = { Legendary: 0, Epic: 1, Rare: 2, Uncommon: 3, Common: 4 };

    if (mode === 'owned_first') {
      // Sort: owned cards first, then by rarity
      pool.sort((a, b) => {
        const aOwned = ownershipSet.has(a.id) ? 0 : 1;
        const bOwned = ownershipSet.has(b.id) ? 0 : 1;
        if (aOwned !== bOwned) return aOwned - bOwned;
        return (rarityOrder[a.rarity] ?? 5) - (rarityOrder[b.rarity] ?? 5);
      });
    } else {
      // best_fit: pure rarity + synergy order
      pool.sort((a, b) => (rarityOrder[a.rarity] ?? 5) - (rarityOrder[b.rarity] ?? 5));
    }

    const cards: Array<{ cardId: string; quantity: number }> = [];
    cards.push({ cardId: legend.id, quantity: 1 });
    let total = 1;
    const MAX = 40;

    for (const card of pool) {
      if (total >= MAX) break;
      if (cards.some((c) => c.cardId === card.id)) continue;
      const qty = card.rarity === 'Common' || card.rarity === 'Uncommon' ? 2 : 1;
      const actualQty = Math.min(qty, MAX - total);
      if (actualQty > 0) {
        cards.push({ cardId: card.id, quantity: actualQty });
        total += actualQty;
      }
    }

    return cards;
  }

  async function handleCreateFromLegend() {
    if (!selectedLegend || !deckName.trim()) return;
    setIsBusy(true);
    try {
      const starterCards = buildStarterCardsFromPool(selectedLegend, buildMode);
      const deck = await createDeck.mutateAsync({
        name: deckName.trim(),
        coverCardId: selectedLegend.id,
        cards: starterCards,
      });

      // Compute domain breakdown for summary
      const domainBreakdown: Record<string, number> = {};
      for (const sc of starterCards) {
        const card = allCards.find((c) => c.id === sc.cardId);
        if (card?.domain) {
          const primaryDomain = card.domain.split(';')[0];
          if (primaryDomain) {
            domainBreakdown[primaryDomain] = (domainBreakdown[primaryDomain] ?? 0) + sc.quantity;
          }
        }
      }

      const totalCards = starterCards.reduce((sum, sc) => sum + sc.quantity, 0);
      setDeckSummary({ deckId: deck.id, cardCount: totalCards, domainBreakdown });
      onCreated();
      setStep('deck-summary');
    } catch {
      toast.error('Failed to create deck');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateScratch() {
    if (!deckName.trim()) return;
    setIsBusy(true);
    try {
      const deck = await createDeck.mutateAsync({ name: deckName.trim() });
      toast.success('Deck created!');
      onCreated();
      onClose();
      router.push(`/decks/${deck.id}`);
    } catch {
      toast.error('Failed to create deck');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmImport() {
    if (!selectedDeckId || !previewDeck) return;
    setIsBusy(true);
    try {
      const cards = previewDeck.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity }));
      const rawName = previewDeck.name;
      // Find the legend card to use its name for non-Latin deck names
      const legendCard = previewDeck.cards.find((c) => c.card.cardType === 'Legend');
      const { primary: name } = getDisplayName(rawName, legendCard?.card.name?.split(' - ')[0]);
      const deck = await createDeck.mutateAsync({ name, cards });
      toast.success('Deck imported! You can customize it.');
      onCreated();
      onClose();
      router.push(`/decks/${deck.id}`);
    } catch {
      toast.error('Failed to import deck');
    } finally {
      setIsBusy(false);
    }
  }

  function choosePath(p: WizardPath) {
    setPath(p);
    if (p === 'suggested') setStep('pick-suggested');
    else if (p === 'legend') setStep('pick-legend');
    else if (p === 'scratch') {
      setStep('name-deck');
      setDeckName('');
    }
  }

  function handleBack() {
    if (step === 'name-deck' && path === 'legend') {
      setStep('choose-build-mode');
      setDeckName('');
    } else if (step === 'choose-build-mode') {
      setStep('pick-legend');
      setSelectedLegend(null);
    } else if (step === 'preview-suggested') {
      setSelectedDeckId(null);
      setStep('pick-suggested');
    } else {
      setStep('choose-path');
      setPath(null);
      setSelectedLegend(null);
      setDeckName('');
    }
  }

  function handleLegendSelect(legend: LegendCard) {
    setSelectedLegend(legend);
    const baseName = legend.name.split(' - ')[0] ?? legend.name;
    setDeckName(`${baseName} Deck`);
    setStep('choose-build-mode');
  }

  function handleSelectTrendingDeck(deckId: string) {
    setSelectedDeckId(deckId);
    setStep('preview-suggested');
  }

  if (!isOpen) return null;

  const stepTitle: Record<WizardStep, string> = {
    'choose-path': 'New Deck',
    'pick-suggested': 'Pick a Deck',
    'preview-suggested': 'Preview Deck',
    'pick-legend': 'Choose Your Legend',
    'choose-build-mode': 'Build Style',
    'name-deck': 'Name Your Deck',
    'deck-summary': 'Deck Created!',
  };

  return (
    <div className="lg-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lg-modal-sheet max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {step !== 'choose-path' && step !== 'deck-summary' && (
              <button onClick={handleBack} className="lg-btn-ghost p-1.5" aria-label="Back">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="lg-page-title text-base">{stepTitle[step]}</h2>
          </div>
          <button onClick={onClose} className="lg-btn-ghost p-1.5" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4">

          {/* Step 1: Choose path */}
          {step === 'choose-path' && (
            <div className="space-y-3">
              <p className="lg-text-muted text-sm mb-4">How would you like to build your deck?</p>

              <button
                onClick={() => choosePath('suggested')}
                className="w-full text-left rounded-xl border border-surface-border bg-surface-card p-4 hover:border-rift-600/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rift-600/20 text-rift-400 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-rift-400 transition-colors">Use a Suggested Deck</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Import a meta deck from riftdecks.com and make it your own</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => choosePath('legend')}
                className="w-full text-left rounded-xl border border-surface-border bg-surface-card p-4 hover:border-yellow-600/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-600/20 text-yellow-400 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-yellow-400 transition-colors">Build Around a Legend</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Pick your champion and get a starter deck with matching cards</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => choosePath('scratch')}
                className="w-full text-left rounded-xl border border-surface-border bg-surface-card p-4 hover:border-zinc-500/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-600/20 text-zinc-400 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-zinc-300 transition-colors">Build From Scratch</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Start with an empty deck and add cards manually</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2a: Pick a suggested/trending deck */}
          {step === 'pick-suggested' && (
            <div className="space-y-3">
              <p className="lg-text-muted text-sm mb-2">Pick a meta deck to preview and import as your own. You can edit it after.</p>
              {trendingDecks.length === 0 && (
                <div className="text-center py-8">
                  <div className="lg-spinner-sm mx-auto mb-2" />
                  <p className="lg-text-muted text-sm">Loading trending decks...</p>
                </div>
              )}
              {trendingDecks.map((deck) => {
                const domainPrimary = deck.domain?.split(';')[0] ?? null;
                const coverCard = (deck as { coverCard?: { name: string; cleanName: string; imageSmall: string | null } | null }).coverCard;
                const legendLabel = coverCard?.name?.split(' - ')[0] ?? null;
                const { primary: displayName, subtitle } = getDisplayName(deck.name, legendLabel);
                const cls = (domainPrimary && DOMAIN_COLORS[domainPrimary]) ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
                const tierStyle = deck.tier ? (TIER_STYLES[deck.tier] ?? TIER_STYLES['C']) : null;
                return (
                  <button
                    key={deck.id}
                    onClick={() => handleSelectTrendingDeck(deck.id)}
                    disabled={isBusy}
                    className="w-full text-left rounded-xl border border-surface-border bg-surface-card p-3 hover:border-rift-600/50 transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      {coverCard?.imageSmall ? (
                        <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 relative bg-surface-elevated">
                          <Image src={coverCard.imageSmall} alt="" fill sizes="40px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-zinc-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="1" width="10" height="14" rx="1.5" />
                            <rect x="3" y="3" width="10" height="14" rx="1.5" />
                            <rect x="7" y="5" width="10" height="14" rx="1.5" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-white truncate">{displayName}</p>
                          {deck.tier && tierStyle && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${tierStyle}`}>
                              {deck.tier}
                            </span>
                          )}
                        </div>
                        {subtitle && (
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">{subtitle}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {domainPrimary && (
                            <span className={`lg-badge border text-[10px] font-semibold ${cls}`}>
                              {domainPrimary}
                            </span>
                          )}
                          {deck.user && (
                            <span className="text-[10px] text-zinc-600">
                              by {deck.user.displayName ?? deck.user.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2a-preview: Preview a trending deck before importing */}
          {step === 'preview-suggested' && (
            <div className="space-y-4">
              {isPreviewLoading || !previewDeck ? (
                <div className="text-center py-8">
                  <div className="lg-spinner-sm mx-auto mb-2" />
                  <p className="lg-text-muted text-sm">Loading deck...</p>
                </div>
              ) : (
                <>
                  <div>
                    {(() => {
                      const previewLegend = previewDeck.cards.find((c) => c.card.cardType === 'Legend');
                      const { primary: displayName, subtitle } = getDisplayName(previewDeck.name, previewLegend?.card.name?.split(' - ')[0]);
                      return (
                        <div className="mb-3">
                          <h3 className="text-base font-semibold text-white">{displayName}</h3>
                          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
                          <p className="text-xs text-zinc-500 mt-1">{previewDeck.cards.length} card types</p>
                        </div>
                      );
                    })()}

                    {/* Cards grouped by type */}
                    <div className="space-y-3">
                      {Object.entries(previewCardGroups).map(([type, typeCards]) => (
                        <div key={type} className="rounded-lg border border-surface-border bg-surface-card/50 p-3">
                          <p className="text-xs font-semibold text-zinc-400 mb-2">
                            {type} <span className="text-zinc-600">({typeCards.reduce((s, c) => s + c.quantity, 0)})</span>
                          </p>
                          <div className="space-y-1">
                            {typeCards.map((c) => (
                              <div key={c.name} className="flex items-center justify-between">
                                <span className="text-xs text-white">{c.name}</span>
                                <span className="text-xs text-zinc-500 tabular-nums">x{c.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => void handleConfirmImport()}
                    disabled={isBusy}
                    className="lg-btn-primary w-full py-3 disabled:opacity-50"
                  >
                    {isBusy ? 'Importing...' : 'Confirm Import'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 2b: Pick a legend with search + domain filters */}
          {step === 'pick-legend' && (
            <div className="space-y-3">
              <p className="lg-text-muted text-sm mb-2">Choose a Legend to build your deck around.</p>

              {/* Search input */}
              <input
                type="text"
                placeholder="Search legends..."
                className="lg-input w-full"
                value={legendSearch}
                onChange={(e) => setLegendSearch(e.target.value)}
              />

              {/* Domain filter chips */}
              {legendDomains.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {legendDomains.map((domain) => {
                    const cls = DOMAIN_COLORS[domain] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
                    const isActive = legendDomainFilter === domain;
                    return (
                      <button
                        key={domain}
                        onClick={() => setLegendDomainFilter(isActive ? null : domain)}
                        className={`text-xs px-2 py-1 rounded-full border font-medium transition-all ${cls} ${
                          isActive ? 'ring-2 ring-current ring-offset-1 ring-offset-transparent' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        {domain}
                      </button>
                    );
                  })}
                </div>
              )}

              {legends.length === 0 && (
                <div className="text-center py-8">
                  {allLegends.length === 0 ? (
                    <>
                      <div className="lg-spinner-sm mx-auto mb-2" />
                      <p className="lg-text-muted text-sm">Loading legends...</p>
                    </>
                  ) : (
                    <p className="lg-text-muted text-sm">No legends match your search.</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {legends.map((legend) => {
                  const domains = legend.domain?.split(';').filter(Boolean) ?? [];
                  return (
                    <button
                      key={legend.id}
                      onClick={() => handleLegendSelect(legend)}
                      className="relative rounded-xl overflow-hidden border border-surface-border bg-surface-card hover:border-yellow-600/50 transition-all active:scale-95"
                    >
                      <div className="aspect-[2/3] relative bg-surface-elevated">
                        {legend.imageSmall ? (
                          <Image
                            src={legend.imageSmall}
                            alt={legend.name}
                            fill
                            sizes="100px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-1">
                            <span className="text-[10px] text-zinc-600 text-center">{legend.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="px-1.5 py-1.5">
                        <p className="text-[10px] font-medium text-white truncate">{legend.name.split(' - ')[0]}</p>
                        <div className="flex gap-0.5 mt-0.5">
                          {domains.map((d) => {
                            const cls = DOMAIN_COLORS[d] ?? 'text-zinc-400 bg-zinc-400/10';
                            return (
                              <span key={d} className={`text-[8px] px-1 py-px rounded font-semibold ${cls}`}>
                                {d}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Name deck (legend path or scratch) */}
          {step === 'name-deck' && (
            <div className="space-y-4">
              {selectedLegend && (
                <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-card p-3">
                  <div className="w-12 h-16 relative rounded-lg overflow-hidden flex-shrink-0 bg-surface-elevated">
                    {selectedLegend.imageSmall && (
                      <Image
                        src={selectedLegend.imageSmall}
                        alt={selectedLegend.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{selectedLegend.name}</p>
                    <div className="flex gap-1 mt-0.5">
                      {(selectedLegend.domain?.split(';').filter(Boolean) ?? []).map((d) => {
                        const cls = DOMAIN_COLORS[d] ?? 'text-zinc-400 bg-zinc-400/10';
                        return (
                          <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${cls}`}>
                            {d}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">~40 matching cards will be added as a starting point</p>
                  </div>
                </div>
              )}

              {path === 'scratch' && (
                <p className="lg-text-muted text-sm">Give your deck a name. You can add cards after.</p>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (path === 'legend') void handleCreateFromLegend();
                  else void handleCreateScratch();
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  placeholder="Deck name..."
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  autoFocus
                  maxLength={100}
                  className="lg-input"
                />
                <button
                  type="submit"
                  disabled={!deckName.trim() || isBusy}
                  className="lg-btn-primary w-full py-3 disabled:opacity-50"
                >
                  {isBusy
                    ? 'Creating...'
                    : path === 'legend'
                    ? 'Create Deck'
                    : 'Create Empty Deck'}
                </button>
              </form>
            </div>
          )}

          {/* Step 5: Deck summary (after legend-path creation) */}
          {step === 'deck-summary' && deckSummary && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-900/30 text-green-400 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Deck Created!</h3>
                <p className="text-sm text-zinc-400 mt-1">{deckSummary.cardCount} cards added as a starting point</p>
              </div>

              {/* Domain breakdown */}
              {Object.keys(deckSummary.domainBreakdown).length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Domain breakdown</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(deckSummary.domainBreakdown).map(([domain, count]) => {
                      const cls = DOMAIN_COLORS[domain] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
                      return (
                        <span key={domain} className={`text-xs px-2 py-1 rounded-full border font-medium tabular-nums ${cls}`}>
                          {domain} {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  onClose();
                  router.push(`/decks/${deckSummary.deckId}`);
                }}
                className="lg-btn-primary w-full py-3"
              >
                Go to Editor
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
