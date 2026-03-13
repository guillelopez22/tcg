'use client';

// Add-to-wishlist modal — bottom sheet with fuzzy search to toggle cards onto wantlist or tradelist.
// Reuses the same card picker pattern as AddCardsModal but calls wishlist.toggle.

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

interface AddToWishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'want' | 'trade';
}

export function AddToWishlistModal({ isOpen, onClose, onSuccess, type }: AddToWishlistModalProps) {
  const tCommon = useTranslations('common');
  const tWant = useTranslations('wantlist');
  const tTrade = useTranslations('tradelist');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allCards, setAllCards] = useState<CardResult[]>([]);
  const [results, setResults] = useState<CardResult[]>([]);
  const [adding, setAdding] = useState(false);
  const fuseRef = useRef<Fuse<CardResult> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const title = type === 'want' ? tWant('addToWantlist') : tTrade('addToTradelist');

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
    setResults(cards.slice(0, 30));
  }, [cardsPage1, cardsPage2, cardsPage3, cardsPage4, cardsPage5, cardsPage6]);

  useEffect(() => {
    if (!search.trim()) {
      setResults(allCards.slice(0, 30));
    } else if (fuseRef.current) {
      const fuseResults = fuseRef.current.search(search);
      setResults(fuseResults.map((r) => r.item));
    }
  }, [search, allCards]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
      setSelected(new Set());
    }
  }, [isOpen]);

  const handleCardTap = useCallback((cardId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  const utils = trpc.useUtils();
  const addIfMissingMutation = trpc.wishlist.addIfMissing.useMutation();

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    let added = 0;
    for (const cardId of selected) {
      try {
        const result = await addIfMissingMutation.mutateAsync({ cardId, type });
        if (result.added) added++;
      } catch {
        // skip failures, continue with rest
      }
    }
    setAdding(false);
    void utils.wishlist.list.invalidate();
    const label = type === 'want' ? 'wantlist' : 'tradelist';
    toast.success(`${added} card${added === 1 ? '' : 's'} added to ${label}`);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="lg-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lg-modal-sheet">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border flex-shrink-0">
          <h2 className="lg-page-title text-base">{title}</h2>
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

        {/* Card grid */}
        <div className="overflow-y-auto flex-1 px-4 pb-2">
          {results.length === 0 ? (
            <p className="lg-text-muted text-center py-8">No cards found</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 py-2">
              {results.map((card) => {
                const isSelected = selected.has(card.id);
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardTap(card.id)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all active:scale-95 ${
                      isSelected
                        ? type === 'want'
                          ? 'border-yellow-500'
                          : 'border-rift-500'
                        : 'border-transparent'
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
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-zinc-600 text-center px-1">{card.name}</span>
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        type === 'want'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-rift-500 text-white'
                      }`}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-surface-border flex-shrink-0">
          <button
            onClick={() => void handleConfirm()}
            disabled={selected.size === 0 || adding}
            className={`w-full text-center py-3 rounded-lg font-medium transition-all ${
              type === 'want'
                ? 'bg-yellow-600 hover:bg-yellow-500 text-black disabled:opacity-50'
                : 'lg-btn-primary disabled:opacity-50'
            }`}
          >
            {adding
              ? tCommon('loading')
              : selected.size > 0
              ? `${tCommon('confirm')} (${selected.size} card${selected.size === 1 ? '' : 's'})`
              : tCommon('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
