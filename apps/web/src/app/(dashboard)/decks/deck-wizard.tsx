'use client';

// Deck creation wizard — guides users through building a new deck.
// Three paths: Suggested (import a trending deck), Build Around Legend, Build From Scratch.

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

const DOMAIN_COLORS: Record<string, string> = {
  Fury: 'text-red-400 bg-red-400/10 border-red-400/30',
  Calm: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  Mind: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  Body: 'text-green-400 bg-green-400/10 border-green-400/30',
  Chaos: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  Order: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
};

type WizardPath = null | 'suggested' | 'legend' | 'scratch';
type WizardStep = 'choose-path' | 'pick-suggested' | 'pick-legend' | 'name-deck';

interface DeckWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface LegendCard {
  id: string;
  name: string;
  cleanName: string;
  domain: string;
  imageSmall: string | null;
}

export function DeckWizard({ isOpen, onClose, onCreated }: DeckWizardProps) {
  const router = useRouter();
  const [path, setPath] = useState<WizardPath>(null);
  const [step, setStep] = useState<WizardStep>('choose-path');
  const [selectedLegend, setSelectedLegend] = useState<LegendCard | null>(null);
  const [deckName, setDeckName] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setPath(null);
      setStep('choose-path');
      setSelectedLegend(null);
      setDeckName('');
      setIsBusy(false);
    }
  }, [isOpen]);

  // Fetch legends for the "build around legend" path
  const { data: allCardsData } = trpc.card.list.useQuery(
    { limit: 100 },
    { enabled: isOpen, staleTime: Infinity },
  );
  const { data: allCardsP2 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsData?.nextCursor ?? undefined },
    { enabled: isOpen && !!allCardsData?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP3 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP2?.nextCursor ?? undefined },
    { enabled: isOpen && !!allCardsP2?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP4 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP3?.nextCursor ?? undefined },
    { enabled: isOpen && !!allCardsP3?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP5 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP4?.nextCursor ?? undefined },
    { enabled: isOpen && !!allCardsP4?.nextCursor, staleTime: Infinity },
  );
  const { data: allCardsP6 } = trpc.card.list.useQuery(
    { limit: 100, cursor: allCardsP5?.nextCursor ?? undefined },
    { enabled: isOpen && !!allCardsP5?.nextCursor, staleTime: Infinity },
  );

  const allCards = useMemo(() => {
    const pages = [allCardsData, allCardsP2, allCardsP3, allCardsP4, allCardsP5, allCardsP6];
    const cards: Array<{ id: string; name: string; cleanName: string; domain: string | null; cardType: string | null; imageSmall: string | null; rarity: string }> = [];
    for (const page of pages) {
      if (page?.items) {
        for (const c of page.items) {
          if (c.cardType) cards.push(c as typeof cards[number]);
        }
      }
    }
    return cards;
  }, [allCardsData, allCardsP2, allCardsP3, allCardsP4, allCardsP5, allCardsP6]);

  // Deduplicate legends — keep only the base version (no Overnumbered/Alternate Art)
  const legends = useMemo(() => {
    const seen = new Set<string>();
    return allCards
      .filter((c) => {
        if (c.cardType !== 'Legend') return false;
        // Skip alt-art and overnumbered variants by checking name suffix
        if (c.name.includes('(Overnumbered)') || c.name.includes('(Alternate Art)')) return false;
        // Deduplicate by cleanName
        if (seen.has(c.cleanName)) return false;
        seen.add(c.cleanName);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name)) as LegendCard[];
  }, [allCards]);

  // Fetch trending decks for the "suggested" path
  const { data: trendingData } = trpc.deck.browse.useQuery(
    { limit: 20 },
    { enabled: isOpen && step === 'pick-suggested', staleTime: 60_000 },
  );
  const trendingDecks = trendingData?.items ?? [];

  const utils = trpc.useUtils();
  const createDeck = trpc.deck.create.useMutation();
  const setCards = trpc.deck.setCards.useMutation();

  // Build a starter deck around a legend's domains
  function buildStarterCards(legend: LegendCard): Array<{ cardId: string; quantity: number }> {
    const domains = legend.domain.split(';');
    // Get cards that match any of the legend's domains (excluding other legends and tokens)
    const pool = allCards.filter((c) => {
      if (c.id === legend.id) return false;
      if (c.cardType === 'Legend' || c.cardType === 'Token') return false;
      if (!c.domain) return false;
      // Card matches if its domain is one of the legend's domains, or contains one
      return domains.some((d) => c.domain?.includes(d));
    });

    // Sort by rarity priority (prefer rares/epics for a more interesting deck)
    const rarityOrder: Record<string, number> = { Legendary: 0, Epic: 1, Rare: 2, Uncommon: 3, Common: 4 };
    pool.sort((a, b) => (rarityOrder[a.rarity] ?? 5) - (rarityOrder[b.rarity] ?? 5));

    const cards: Array<{ cardId: string; quantity: number }> = [];
    // Add the legend itself
    cards.push({ cardId: legend.id, quantity: 1 });
    let total = 1;
    const MAX = 40; // Start with 40 cards, user can tweak

    // Add unique cards with quantity based on rarity
    for (const card of pool) {
      if (total >= MAX) break;
      // Skip if already added (shouldn't happen, but safety)
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
      const starterCards = buildStarterCards(selectedLegend);
      const domain = selectedLegend.domain.split(';')[0] ?? undefined;
      const deck = await createDeck.mutateAsync({
        name: deckName.trim(),
        cards: starterCards,
        ...(domain ? {} : {}),
      });
      // Set the cover card to the legend and domain
      await setCards.mutateAsync({ id: deck.id, cards: starterCards });
      toast.success('Deck created! Customize it in the editor.');
      onCreated();
      onClose();
      router.push(`/decks/${deck.id}`);
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

  async function handleImportDeck(deckId: string) {
    setIsBusy(true);
    try {
      const fullDeck = await utils.deck.getById.fetch({ id: deckId });
      if (!fullDeck) throw new Error('Deck not found');
      const cards = fullDeck.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity }));
      const name = fullDeck.name.replace(/^\[RD\]\s*/, '');
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
      setStep('pick-legend');
      setDeckName('');
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
    setStep('name-deck');
  }

  if (!isOpen) return null;

  return (
    <div className="lg-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lg-modal-sheet max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {step !== 'choose-path' && (
              <button onClick={handleBack} className="lg-btn-ghost p-1.5" aria-label="Back">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="lg-page-title text-base">
              {step === 'choose-path' && 'New Deck'}
              {step === 'pick-suggested' && 'Pick a Deck'}
              {step === 'pick-legend' && 'Choose Your Legend'}
              {step === 'name-deck' && 'Name Your Deck'}
            </h2>
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
              <p className="lg-text-muted text-sm mb-2">Pick a meta deck to import as your own. You can edit it after.</p>
              {trendingDecks.length === 0 && (
                <div className="text-center py-8">
                  <div className="lg-spinner-sm mx-auto mb-2" />
                  <p className="lg-text-muted text-sm">Loading trending decks...</p>
                </div>
              )}
              {trendingDecks.map((deck) => {
                const displayName = deck.name.replace(/^\[RD\]\s*/, '');
                const domainPrimary = deck.domain?.split(';')[0] ?? null;
                const cls = (domainPrimary && DOMAIN_COLORS[domainPrimary]) ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
                return (
                  <button
                    key={deck.id}
                    onClick={() => void handleImportDeck(deck.id)}
                    disabled={isBusy}
                    className="w-full text-left rounded-xl border border-surface-border bg-surface-card p-3 hover:border-rift-600/50 transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-zinc-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="1" width="10" height="14" rx="1.5" />
                          <rect x="3" y="3" width="10" height="14" rx="1.5" />
                          <rect x="7" y="5" width="10" height="14" rx="1.5" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{displayName}</p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2b: Pick a legend */}
          {step === 'pick-legend' && (
            <div className="space-y-3">
              <p className="lg-text-muted text-sm mb-2">Choose a Legend to build your deck around.</p>
              {legends.length === 0 && (
                <div className="text-center py-8">
                  <div className="lg-spinner-sm mx-auto mb-2" />
                  <p className="lg-text-muted text-sm">Loading legends...</p>
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {legends.map((legend) => {
                  const domains = legend.domain.split(';');
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
                      {selectedLegend.domain.split(';').map((d) => {
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

        </div>
      </div>
    </div>
  );
}
