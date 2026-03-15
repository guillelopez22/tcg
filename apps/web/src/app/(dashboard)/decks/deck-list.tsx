'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { ListSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import { TournamentDecks } from '../news/tournament-decks';
import { CommunityDecks } from './community-decks';
import { DeckWizard } from './deck-wizard';
import { ImportDeckModal } from './import-deck-modal';

type DeckTab = 'my-decks' | 'community' | 'trending';

function isNonLatinScript(text: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(text);
}

// Sub-component: renders buildability percentage for a single deck
function DeckBuildability({ deckId }: { deckId: string }) {
  const { user } = useAuth();
  const { data, isLoading } = trpc.deck.buildability.useQuery(
    { deckId },
    { enabled: !!user },
  );

  if (isLoading) {
    return <span className="text-xs text-zinc-600">Loading...</span>;
  }

  if (!data) return null;

  const { owned, total, pct } = data;
  const colorClass =
    pct >= 80 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <span className="text-xs text-zinc-500">
      You own {owned}/{total}{' '}
      <span className={`font-medium ${colorClass}`}>({pct}%)</span>
    </span>
  );
}

// Sub-component: renders Draft/Complete status badge
function DeckStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;

  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex-shrink-0">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 6l3 3 5-5" />
        </svg>
        Complete
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex-shrink-0">
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 10V8l6-6 2 2-6 6H2z" />
      </svg>
      Draft
    </span>
  );
}

export function DeckList() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DeckTab>('my-decks');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  const deleteDeck = trpc.deck.delete.useMutation({
    onSuccess() { void utils.deck.list.invalidate(); toast.success('Deck deleted'); },
  });

  const decks = data?.pages.flatMap((page) => page.items) ?? [];

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
    { key: 'community', label: 'Community' },
    { key: 'trending', label: 'Top Events' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <h1 className="lg-page-title">Decks</h1>
        {activeTab === 'my-decks' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="lg-btn-secondary inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 2v9M4 7l4 4 4-4M2 14h12" />
              </svg>
              Import
            </button>
            <button onClick={() => setWizardOpen(true)} className="lg-btn-link">+ New Deck</button>
          </div>
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
      {activeTab === 'trending' && <TournamentDecks />}

      {activeTab === 'community' && <CommunityDecks />}

      {activeTab === 'my-decks' && (
        <>
          {isLoading && (
            <div role="status"><span className="sr-only">Loading decks</span><ListSkeleton count={5} /></div>
          )}

          {isError && (
            <div role="alert" className="lg-alert-error">
              Failed to load decks.
              <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">Try again</button>
            </div>
          )}

          {!isLoading && decks.length === 0 && (
            <div className="text-center py-12">
              <p className="lg-text-secondary mb-3">No decks yet.</p>
              <button onClick={() => setWizardOpen(true)} className="lg-btn-link">Create your first deck</button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {decks.map((deck) => {
              const deckWithStatus = deck as typeof deck & { status?: string | null };
              return (
                <div key={deck.id} className="lg-card overflow-hidden flex">
                  <div className="w-16 flex-shrink-0 bg-surface-elevated flex items-center justify-center relative overflow-hidden">
                    {(deck as { coverCard?: { imageSmall: string | null } | null }).coverCard?.imageSmall ? (
                      <Image
                        src={(deck as { coverCard: { imageSmall: string } }).coverCard.imageSmall}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <IconDecks className="w-6 h-6 text-zinc-700" />
                    )}
                  </div>
                  <div className="flex-1 px-3 py-2 min-w-0">
                    <div className="flex items-start gap-2 justify-between">
                      <Link href={`/decks/${deck.id}`} className="hover:text-rift-400 transition-colors min-w-0">
                        {(() => {
                          const cleanedName = deck.name.replace(/^\[RD\]\s*/, '');
                          const coverCard = (deck as { coverCard?: { id: string; name: string | null; cleanName: string | null; imageSmall: string | null } | null }).coverCard;
                          if (isNonLatinScript(cleanedName) && coverCard?.name) {
                            return (
                              <>
                                <p className="text-sm font-medium text-white truncate">{coverCard.name.split(' - ')[0]}</p>
                                <p className="text-xs text-zinc-500 truncate">({cleanedName})</p>
                              </>
                            );
                          }
                          return <p className="text-sm font-medium text-white truncate">{deck.name}</p>;
                        })()}
                      </Link>
                      <DeckStatusBadge status={deckWithStatus.status} />
                    </div>
                    <p className="lg-text-muted">
                      {deck.domain ?? 'No domain'}
                      {deck.isPublic && <span className="ml-2 text-rift-500">Public</span>}
                    </p>
                    <DeckBuildability deckId={deck.id} />
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
              );
            })}
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

      <DeckWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => void utils.deck.list.invalidate()}
      />

      <ImportDeckModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
      />
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
