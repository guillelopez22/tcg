'use client';

// Add-cards modal — bottom sheet with fuse.js fuzzy search + multi-select
// Calls trpc.collection.addBulk on confirm (defaults: Normal/NM per user decision)

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Fuse from 'fuse.js';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface CardResult {
  id: string;
  name: string;
  imageSmall: string | null;
  rarity: string;
  setName: string;
}

interface AddCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCardsModal({ isOpen, onClose, onSuccess }: AddCardsModalProps) {
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Map<string, { card: CardResult; count: number }>>(new Map());
  const [allCards, setAllCards] = useState<CardResult[]>([]);
  const [results, setResults] = useState<CardResult[]>([]);
  const [visibleCount, setVisibleCount] = useState(30);
  const fuseRef = useRef<Fuse<CardResult> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch all cards once for local fuzzy search
  const { data: cardsPage1 } = trpc.card.list.useQuery(
    { limit: 100 },
    { enabled: isOpen, staleTime: Infinity },
  );
  const { data: cardsPage2 } = trpc.card.list.useQuery(
    { limit: 100, cursor: cardsPage1?.nextCursor ?? undefined },
    { enabled: isOpen && !!cardsPage1?.nextCursor, staleTime: Infinity },
  );
  const { data: cardsPage3 } = trpc.card.list.useQuery(
    { limit: 100, cursor: cardsPage2?.nextCursor ?? undefined },
    { enabled: isOpen && !!cardsPage2?.nextCursor, staleTime: Infinity },
  );
  const { data: cardsPage4 } = trpc.card.list.useQuery(
    { limit: 100, cursor: cardsPage3?.nextCursor ?? undefined },
    { enabled: isOpen && !!cardsPage3?.nextCursor, staleTime: Infinity },
  );
  const { data: cardsPage5 } = trpc.card.list.useQuery(
    { limit: 100, cursor: cardsPage4?.nextCursor ?? undefined },
    { enabled: isOpen && !!cardsPage4?.nextCursor, staleTime: Infinity },
  );
  const { data: cardsPage6 } = trpc.card.list.useQuery(
    { limit: 100, cursor: cardsPage5?.nextCursor ?? undefined },
    { enabled: isOpen && !!cardsPage5?.nextCursor, staleTime: Infinity },
  );

  useEffect(() => {
    const pages = [cardsPage1, cardsPage2, cardsPage3, cardsPage4, cardsPage5, cardsPage6];
    const cards: CardResult[] = [];
    for (const page of pages) {
      if (page?.items) {
        for (const c of page.items) {
          // Only include playable cards (skip products that have null cardType)
          if (c.cardType) {
            cards.push({
              id: c.id,
              name: c.name,
              imageSmall: c.imageSmall,
              rarity: c.rarity,
              setName: '',
            });
          }
        }
      }
    }
    setAllCards(cards);
    fuseRef.current = new Fuse(cards, {
      keys: ['name', 'setName'],
      threshold: 0.3,
      includeScore: false,
    });
    setVisibleCount(30);
  }, [cardsPage1, cardsPage2, cardsPage3, cardsPage4, cardsPage5, cardsPage6]);

  useEffect(() => {
    if (!search.trim()) {
      setResults(allCards.slice(0, visibleCount));
    } else if (fuseRef.current) {
      const fuseResults = fuseRef.current.search(search);
      setResults(fuseResults.map((r) => r.item));
    }
  }, [search, allCards, visibleCount]);

  // IntersectionObserver: load 30 more when sentinel enters viewport
  useEffect(() => {
    if (search.trim() || visibleCount >= allCards.length) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setVisibleCount((c) => c + 30); },
      { rootMargin: '200px' },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [search, visibleCount, allCards.length]);

  // Focus input when modal opens; reset state on close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
      setSelected(new Map());
      setVisibleCount(30);
    }
  }, [isOpen]);

  // Reset visibleCount whenever the user starts/clears a search query
  useEffect(() => {
    setVisibleCount(30);
  }, [search]);

  const handleCardTap = useCallback((card: CardResult) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const existing = next.get(card.id);
      if (existing) {
        next.set(card.id, { card, count: existing.count + 1 });
      } else {
        next.set(card.id, { card, count: 1 });
      }
      return next;
    });
  }, []);

  const handleDecrement = useCallback((cardId: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const existing = next.get(cardId);
      if (existing && existing.count > 1) {
        next.set(cardId, { ...existing, count: existing.count - 1 });
      } else {
        next.delete(cardId);
      }
      return next;
    });
  }, []);

  const totalSelected = Array.from(selected.values()).reduce((sum, { count }) => sum + count, 0);

  const utils = trpc.useUtils();
  const addBulk = trpc.collection.addBulk.useMutation({
    onSuccess(data) {
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
      toast.success(`${String(data.length)} cards added`);
      onSuccess();
      onClose();
    },
    onError(err) {
      toast.error(err.message ?? tCommon('error'));
    },
  });

  const handleConfirm = () => {
    const entries: Array<{ cardId: string; variant: 'normal'; condition: 'near_mint' }> = [];
    for (const { card, count } of selected.values()) {
      for (let i = 0; i < count; i++) {
        entries.push({ cardId: card.id, variant: 'normal', condition: 'near_mint' });
      }
    }
    if (entries.length === 0) return;
    addBulk.mutate({ entries });
  };

  if (!isOpen) return null;

  return (
    <div className="lg-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lg-modal-sheet">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border flex-shrink-0">
          <h2 className="lg-page-title text-base">{t('addCards')}</h2>
          <button onClick={onClose} className="lg-btn-ghost p-1.5" aria-label={tCommon('close')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            placeholder={`${tCommon('search')} cards...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="lg-input"
          />
        </div>

        {/* Selected cards summary strip */}
        {selected.size > 0 && (
          <div className="px-4 pb-1 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-hide">
              {Array.from(selected.values()).map(({ card, count }) => (
                <div key={card.id} className="relative flex-shrink-0 w-10">
                  <div className="aspect-[2/3] rounded overflow-hidden bg-surface-elevated border border-rift-500">
                    {card.imageSmall ? (
                      <Image src={card.imageSmall} alt={card.name} fill sizes="40px" className="object-cover" unoptimized />
                    ) : null}
                    {!card.imageSmall && (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[8px] text-zinc-500">{card.name.slice(0, 4)}</span>
                      </div>
                    )}
                  </div>
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rift-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {count}
                  </span>
                  <button
                    onClick={() => {
                      setSelected((prev) => {
                        const next = new Map(prev);
                        next.delete(card.id);
                        return next;
                      });
                    }}
                    className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center leading-none touch-manipulation"
                    aria-label={`Remove ${card.name} from selection`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card grid */}
        <div className="overflow-y-auto flex-1 px-4 pb-2">
          {results.length === 0 ? (
            <p className="lg-text-muted text-center py-8">No cards found</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 py-2">
              {results.map((card) => {
                const sel = selected.get(card.id);
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardTap(card)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all active:scale-95 ${
                      sel ? 'border-rift-500' : 'border-transparent'
                    }`}
                    title={card.name}
                  >
                    <div className="aspect-[2/3] bg-surface-elevated">
                      {card.imageSmall ? (
                        <Image
                          src={card.imageSmall}
                          alt={card.name}
                          fill
                          sizes="100px"
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.parentElement?.querySelector('[data-fallback]') as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div data-fallback className={`w-full h-full items-center justify-center absolute inset-0 ${card.imageSmall ? 'hidden' : 'flex'}`}>
                        <span className="text-[10px] text-zinc-500 text-center px-1 leading-tight">{card.name}</span>
                      </div>
                    </div>
                    {sel && (
                      <>
                        <span className="lg-badge-count">{sel.count}</span>
                        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-1 py-1 bg-black/70">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDecrement(card.id); }}
                            className="w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center text-sm font-bold touch-manipulation"
                            aria-label={`Remove one ${card.name}`}
                          >
                            −
                          </button>
                          <span className="text-white font-bold text-xs">{sel.count}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCardTap(card); }}
                            className="w-6 h-6 rounded-full bg-rift-600/90 text-white flex items-center justify-center text-sm font-bold touch-manipulation"
                            aria-label={`Add one more ${card.name}`}
                          >
                            +
                          </button>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {!search.trim() && visibleCount < allCards.length && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              <div className="lg-spinner-sm" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-surface-border flex-shrink-0">
          <button
            onClick={handleConfirm}
            disabled={totalSelected === 0 || addBulk.isPending}
            className="lg-btn-primary w-full text-center"
          >
            {addBulk.isPending
              ? `${tCommon('loading')}`
              : totalSelected > 0
              ? `${tCommon('confirm')} (${totalSelected} card${totalSelected === 1 ? '' : 's'})`
              : tCommon('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
