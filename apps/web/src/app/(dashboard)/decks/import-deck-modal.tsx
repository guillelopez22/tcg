'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { ImportPreview } from './import-preview';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

type DeckWithCards = inferRouterOutputs<AppRouter>['deck']['getById'];
type ImportResult = inferRouterOutputs<AppRouter>['deck']['importFromText'];

type ImportTab = 'code' | 'text' | 'url';

interface ImportDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Converts a resolved DeckWithCards to preview-compatible format
function deckWithCardsToPreview(deck: DeckWithCards): {
  resolved: Array<{ cardId: string; quantity: number; zone: string; name?: string; imageSmall?: string | null }>;
  unmatched: string[];
  deckName: string;
} {
  return {
    resolved: deck.cards.map((c) => ({
      cardId: c.card.id,
      quantity: c.quantity,
      zone: c.zone,
      name: c.card.name,
      imageSmall: c.card.imageSmall,
    })),
    unmatched: [],
    deckName: `Copy of ${deck.name}`,
  };
}

// Converts importFromText/URL result to preview-compatible format
function importResultToPreview(result: ImportResult): {
  resolved: Array<{ cardId: string; quantity: number; zone: string; name?: string; imageSmall?: string | null }>;
  unmatched: string[];
  deckName: string;
} {
  return {
    resolved: result.resolved.map((c) => ({
      cardId: c.cardId,
      quantity: c.quantity,
      zone: c.zone,
    })),
    unmatched: result.unmatched,
    deckName: result.deckName,
  };
}

export function ImportDeckModal({ isOpen, onClose }: ImportDeckModalProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<ImportTab>('code');

  // Share code tab state
  const [shareCode, setShareCode] = useState('');
  const [shareCodePreview, setShareCodePreview] = useState<{
    resolved: Array<{ cardId: string; quantity: number; zone: string; name?: string; imageSmall?: string | null }>;
    unmatched: string[];
    deckName: string;
  } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Text paste tab state
  const [pasteText, setPasteText] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [pastePreview, setPastePreview] = useState<{
    resolved: Array<{ cardId: string; quantity: number; zone: string; name?: string; imageSmall?: string | null }>;
    unmatched: string[];
    deckName: string;
  } | null>(null);

  // URL tab state
  const [importUrl, setImportUrl] = useState('');
  const [urlName, setUrlName] = useState('');
  const [urlPreview, setUrlPreview] = useState<{
    resolved: Array<{ cardId: string; quantity: number; zone: string; name?: string; imageSmall?: string | null }>;
    unmatched: string[];
    deckName: string;
  } | null>(null);

  const importFromText = trpc.deck.importFromText.useMutation({
    onSuccess(result) {
      if (result.resolved.length === 0) {
        toast.error('No cards could be matched from the pasted text.');
        return;
      }
      setPastePreview(importResultToPreview(result));
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const importFromUrl = trpc.deck.importFromUrl.useMutation({
    onSuccess(result) {
      if (result.resolved.length === 0) {
        toast.error('No cards could be matched from that URL.');
        return;
      }
      setUrlPreview(importResultToPreview(result));
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  const createDeck = trpc.deck.create.useMutation({
    onSuccess(deck) {
      void utils.deck.list.invalidate();
      toast.success('Deck imported!');
      onClose();
      router.push(`/decks/${deck.id}`);
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  async function handleLookUpShareCode() {
    const code = shareCode.trim();
    if (!code) return;
    setIsLookingUp(true);
    try {
      const deck = await utils.deck.resolveShareCode.fetch({ code });
      setShareCodePreview(deckWithCardsToPreview(deck));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Share code not found';
      toast.error(message);
    } finally {
      setIsLookingUp(false);
    }
  }

  function handleImportFromShareCode() {
    if (!shareCodePreview) return;
    createDeck.mutate({
      name: shareCodePreview.deckName,
      cards: shareCodePreview.resolved.map((c) => ({
        cardId: c.cardId,
        quantity: c.quantity,
        zone: (c.zone as 'main' | 'rune' | 'champion' | 'sideboard') ?? 'main',
      })),
    });
  }

  function handleImportFromPaste() {
    if (!pastePreview) return;
    createDeck.mutate({
      name: pastePreview.deckName,
      cards: pastePreview.resolved.map((c) => ({
        cardId: c.cardId,
        quantity: c.quantity,
        zone: (c.zone as 'main' | 'rune' | 'champion' | 'sideboard') ?? 'main',
      })),
    });
  }

  function handleImportFromUrl() {
    if (!urlPreview) return;
    createDeck.mutate({
      name: urlPreview.deckName,
      cards: urlPreview.resolved.map((c) => ({
        cardId: c.cardId,
        quantity: c.quantity,
        zone: (c.zone as 'main' | 'rune' | 'champion' | 'sideboard') ?? 'main',
      })),
    });
  }

  function handleClose() {
    // Reset all state
    setActiveTab('code');
    setShareCode('');
    setShareCodePreview(null);
    setPasteText('');
    setPasteName('');
    setPastePreview(null);
    setImportUrl('');
    setUrlName('');
    setUrlPreview(null);
    onClose();
  }

  if (!isOpen) return null;

  const tabs: Array<{ key: ImportTab; label: string }> = [
    { key: 'code', label: 'Share Code' },
    { key: 'text', label: 'Text Paste' },
    { key: 'url', label: 'URL' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Import deck"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg mx-auto bg-surface-elevated rounded-t-2xl sm:rounded-2xl border border-surface-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="lg-section-title">Import Deck</h2>
          <button
            onClick={handleClose}
            className="lg-btn-ghost p-1.5 -mr-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-surface-border overflow-x-auto scrollbar-hide px-5">
          <nav className="flex gap-1 min-w-max" role="tablist" aria-label="Import methods">
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

        <div className="px-5 py-4 space-y-4">
          {/* Share Code tab */}
          {activeTab === 'code' && (
            <>
              {shareCodePreview ? (
                <ImportPreview
                  resolved={shareCodePreview.resolved}
                  unmatched={shareCodePreview.unmatched}
                  deckName={shareCodePreview.deckName}
                  onImport={handleImportFromShareCode}
                  onBack={() => setShareCodePreview(null)}
                  isImporting={createDeck.isPending}
                />
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm text-zinc-300 mb-1.5 block">Share Code</span>
                    <input
                      type="text"
                      value={shareCode}
                      onChange={(e) => setShareCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleLookUpShareCode(); }}
                      placeholder="LG-a3Xk9m"
                      className="lg-input w-full"
                      aria-label="Enter share code"
                    />
                  </label>
                  <button
                    onClick={() => void handleLookUpShareCode()}
                    disabled={isLookingUp || !shareCode.trim()}
                    className="lg-btn-primary w-full disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {isLookingUp && (
                      <div role="status" className="lg-spinner-sm">
                        <span className="sr-only">Looking up</span>
                      </div>
                    )}
                    {isLookingUp ? 'Looking up...' : 'Look Up'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Text Paste tab */}
          {activeTab === 'text' && (
            <>
              {pastePreview ? (
                <ImportPreview
                  resolved={pastePreview.resolved}
                  unmatched={pastePreview.unmatched}
                  deckName={pastePreview.deckName}
                  onImport={handleImportFromPaste}
                  onBack={() => setPastePreview(null)}
                  isImporting={createDeck.isPending}
                />
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm text-zinc-300 mb-1.5 block">Deck Name (optional)</span>
                    <input
                      type="text"
                      value={pasteName}
                      onChange={(e) => setPasteName(e.target.value)}
                      placeholder="My Imported Deck"
                      className="lg-input w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-300 mb-1.5 block">Deck List</span>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={"Paste your deck list here...\n\n3x Card Name\n2x Other Card\n..."}
                      className="lg-input w-full min-h-[160px] resize-y font-mono text-sm"
                      aria-label="Paste deck list text"
                    />
                  </label>
                  <button
                    onClick={() => importFromText.mutate({ text: pasteText, name: pasteName || undefined })}
                    disabled={importFromText.isPending || !pasteText.trim()}
                    className="lg-btn-primary w-full disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {importFromText.isPending && (
                      <div role="status" className="lg-spinner-sm">
                        <span className="sr-only">Parsing</span>
                      </div>
                    )}
                    {importFromText.isPending ? 'Parsing...' : 'Parse'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* URL tab */}
          {activeTab === 'url' && (
            <>
              {urlPreview ? (
                <ImportPreview
                  resolved={urlPreview.resolved}
                  unmatched={urlPreview.unmatched}
                  deckName={urlPreview.deckName}
                  onImport={handleImportFromUrl}
                  onBack={() => setUrlPreview(null)}
                  isImporting={createDeck.isPending}
                />
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm text-zinc-300 mb-1.5 block">Deck Name (optional)</span>
                    <input
                      type="text"
                      value={urlName}
                      onChange={(e) => setUrlName(e.target.value)}
                      placeholder="My Imported Deck"
                      className="lg-input w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-300 mb-1.5 block">Deck URL</span>
                    <input
                      type="url"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          importFromUrl.mutate({ url: importUrl, name: urlName || undefined });
                        }
                      }}
                      placeholder="https://riftbound.gg/deck/..."
                      className="lg-input w-full"
                      aria-label="Enter deck URL"
                    />
                  </label>
                  <button
                    onClick={() => importFromUrl.mutate({ url: importUrl, name: urlName || undefined })}
                    disabled={importFromUrl.isPending || !importUrl.trim()}
                    className="lg-btn-primary w-full disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {importFromUrl.isPending && (
                      <div role="status" className="lg-spinner-sm">
                        <span className="sr-only">Fetching</span>
                      </div>
                    )}
                    {importFromUrl.isPending ? 'Fetching...' : 'Fetch & Parse'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
