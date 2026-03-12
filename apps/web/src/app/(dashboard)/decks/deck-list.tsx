'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { ListSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import { TrendingDecks } from './trending-decks';

type DeckTab = 'my-decks' | 'trending';

export function DeckList() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DeckTab>('my-decks');
  const [creating, setCreating] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (deletingId) {
      deleteTimerRef.current = setTimeout(() => setDeletingId(null), 3000);
    }
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, [deletingId]);

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch,
  } = trpc.deck.list.useInfiniteQuery(
    { limit: 10 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor, initialCursor: undefined, enabled: !!user },
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void fetchNextPage(); },
      { rootMargin: '200px' },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const create = trpc.deck.create.useMutation({
    onSuccess() { setCreating(false); setNewDeckName(''); void utils.deck.list.invalidate(); toast.success('Deck created'); },
  });

  const deleteDeck = trpc.deck.delete.useMutation({
    onSuccess() { void utils.deck.list.invalidate(); toast.success('Deck deleted'); },
  });

  const decks = data?.pages.flatMap((page) => page.items) ?? [];

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    create.mutate({ name: newDeckName.trim() });
  }

  function handleDeleteClick(deckId: string) {
    if (deletingId === deckId) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setDeletingId(null);
      deleteDeck.mutate({ id: deckId });
    } else {
      setDeletingId(deckId);
    }
  }

  const tabs: Array<{ key: DeckTab; label: string }> = [
    { key: 'my-decks', label: 'My Decks' },
    { key: 'trending', label: 'Trending' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <h1 className="lg-page-title">Decks</h1>
        {activeTab === 'my-decks' && (
          <button onClick={() => setCreating(true)} className="lg-btn-link">+ New Deck</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="border-b border-surface-border overflow-x-auto scrollbar-hide -mx-4 px-4">
        <nav className="flex gap-1 min-w-max" role="tablist" aria-label="Deck sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key ? 'lg-tab-active' : 'lg-tab-inactive'}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'trending' && <TrendingDecks />}

      {activeTab === 'my-decks' && (
        <>
          {creating && (
            <form onSubmit={handleCreate} className="flex gap-2">
              <input type="text" placeholder="Deck name..." value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)} autoFocus maxLength={100} className="lg-input flex-1" />
              <button type="submit" disabled={create.isPending || !newDeckName.trim()} className="lg-btn-primary">
                {create.isPending ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => { setCreating(false); setNewDeckName(''); }} className="lg-btn-secondary">
                Cancel
              </button>
            </form>
          )}

          {isLoading && (
            <div role="status"><span className="sr-only">Loading decks</span><ListSkeleton count={5} /></div>
          )}

          {isError && (
            <div role="alert" className="lg-alert-error">
              Failed to load decks.
              <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">Try again</button>
            </div>
          )}

          {!isLoading && decks.length === 0 && !creating && (
            <div className="text-center py-12">
              <p className="lg-text-secondary mb-3">No decks yet.</p>
              <button onClick={() => setCreating(true)} className="lg-btn-link">Create your first deck</button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {decks.map((deck) => (
              <div key={deck.id} className="lg-card overflow-hidden flex">
                <div className="w-16 flex-shrink-0 bg-surface-elevated flex items-center justify-center">
                  <IconDecks className="w-6 h-6 text-zinc-700" />
                </div>
                <div className="flex-1 px-3 py-2 min-w-0">
                  <Link href={`/decks/${deck.id}`} className="hover:text-rift-400 transition-colors">
                    <p className="text-sm font-medium text-white truncate">{deck.name}</p>
                  </Link>
                  <p className="lg-text-muted">
                    {deck.domain ?? 'No domain'}
                    {deck.isPublic && <span className="ml-2 text-rift-500">Public</span>}
                  </p>
                </div>
                <div className="flex items-center pr-2">
                  <button
                    onClick={() => handleDeleteClick(deck.id)}
                    disabled={deleteDeck.isPending}
                    className={`min-w-[2.75rem] h-10 px-2 flex items-center justify-center text-xs transition-colors rounded-lg disabled:opacity-50 ${
                      deletingId === deck.id
                        ? 'text-red-400 bg-red-900/20 border border-red-800 font-medium'
                        : 'text-zinc-600 hover:text-red-400'
                    }`}
                    aria-label={deletingId === deck.id ? `Confirm delete ${deck.name}` : `Delete ${deck.name}`}
                  >
                    {deletingId === deck.id ? 'Sure?' : '\u2715'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-6">
              {isFetchingNextPage ? (
                <div role="status" className="lg-spinner-sm"><span className="sr-only">Loading more</span></div>
              ) : (
                <button onClick={() => void fetchNextPage()} className="lg-btn-ghost">Load more</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IconDecks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="1" width="10" height="14" rx="1.5" />
      <rect x="3" y="3" width="10" height="14" rx="1.5" />
      <rect x="7" y="5" width="10" height="14" rx="1.5" />
    </svg>
  );
}
