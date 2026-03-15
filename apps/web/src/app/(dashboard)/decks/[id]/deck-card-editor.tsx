'use client';

import { useDeckEditor } from './use-deck-editor';
import { CardSearchPanel } from './editor-components/card-search-panel';
import { ZoneTabs } from './editor-components/zone-tabs';
import { DeckCardList } from './editor-components/deck-card-list';
import { EditorToolbar } from './editor-components/editor-toolbar';
import { DeckAnalyticsMini, AutoCompletePreviewPanel } from './editor-components/deck-analytics';
import { ZONE_LABELS, ZONE_LIMITS } from './use-deck-editor';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

type DeckCard = inferRouterOutputs<AppRouter>['deck']['getById']['cards'][number];

interface DeckCardEditorProps {
  deckId: string;
  initialCards: DeckCard[];
  isPublic?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function DeckCardEditor({ deckId, initialCards, isPublic, onClose, onSaved }: DeckCardEditorProps) {
  const ed = useDeckEditor({ deckId, initialCards, isPublic, onClose, onSaved });

  return (
    <div className="space-y-4">

      {/* Validity Status Bar */}
      <div
        role="status"
        aria-live="polite"
        className={`flex items-start gap-2 px-4 py-2.5 rounded-lg border text-sm ${
          ed.isValid
            ? 'bg-green-900/20 border-green-700/40 text-green-300'
            : 'bg-red-900/20 border-red-700/40 text-red-300'
        }`}
      >
        {ed.isValid ? (
          <>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Valid deck format</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <span className="font-medium">Format issues: </span>
              {ed.validationErrors.join(' · ')}
            </div>
          </>
        )}
      </div>

      {ed.saveError && (
        <div role="alert" className="lg-alert-error">{ed.saveError}</div>
      )}

      {/* Two-panel layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Left: Search / Suggestions Panel */}
        <CardSearchPanel
          searchPanel={ed.searchPanel}
          setSearchPanel={ed.setSearchPanel}
          search={ed.search}
          setSearch={ed.setSearch}
          setSlug={ed.setSlug}
          setSetSlug={ed.setSetSlug}
          rarity={ed.rarity}
          setRarity={ed.setRarity}
          domain={ed.domain}
          setDomain={ed.setDomain}
          setsData={ed.setsData}
          searchCards={ed.searchCards}
          isSearchLoading={ed.isSearchLoading}
          hasNextPage={ed.hasNextPage}
          isFetchingNextPage={ed.isFetchingNextPage}
          loadMoreRef={ed.loadMoreRef}
          suggestions={ed.suggestions}
          isSuggestLoading={ed.isSuggestLoading}
          suggestMode={ed.suggestMode}
          setSuggestMode={ed.setSuggestMode}
          refetchSuggestions={ed.refetchSuggestions}
          expandedReason={ed.expandedReason}
          setExpandedReason={ed.setExpandedReason}
          ownershipMap={ed.ownershipMap}
          activeZone={ed.activeZone}
          zoneCounts={ed.zoneCounts}
          getTotalCopies={ed.getTotalCopies}
          getQuantityInZone={ed.getQuantityInZone}
          addedCardId={ed.addedCardId}
          onAddCard={ed.addCard}
          onAddSuggestion={ed.addSuggestion}
        />

        {/* Right: Zone tabs + Deck list */}
        <div className="lg:w-72 xl:w-80 space-y-3 flex-shrink-0">

          <ZoneTabs
            activeZone={ed.activeZone}
            zoneCounts={ed.zoneCounts}
            onZoneChange={(zone) => { ed.setActiveZone(zone); ed.setSwapPrompt(null); }}
          />

          {/* Auto-complete button */}
          {ed.zoneTabsHasSlots && (
            <button
              onClick={ed.handleAutoComplete}
              disabled={ed.searchPanel !== 'suggested' || ed.suggestions.length === 0}
              className="w-full text-xs py-1.5 rounded-lg border border-rift-700/50 text-rift-400 hover:bg-rift-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Auto-complete {ZONE_LABELS[ed.activeZone]} ({ZONE_LIMITS[ed.activeZone] - ed.zoneCounts[ed.activeZone]} slots)
            </button>
          )}

          <DeckCardList
            zoneEntries={ed.zoneEntries}
            activeZone={ed.activeZone}
            swapPrompt={ed.swapPrompt}
            onDismissSwap={() => ed.setSwapPrompt(null)}
            onSwapReplace={ed.handleSwapReplace}
            onIncrement={ed.increment}
            onDecrement={ed.decrement}
            onRemove={ed.remove}
          />

          {/* Mini analytics — only for main zone */}
          {ed.activeZone === 'main' && ed.zoneCounts.main > 0 && (
            <DeckAnalyticsMini
              energyCurveData={ed.energyCurveData}
              domainPieData={ed.domainPieData}
            />
          )}
        </div>
      </div>

      {/* Auto-complete preview */}
      {ed.autoCompletePreview && (
        <AutoCompletePreviewPanel
          zoneLabel={ZONE_LABELS[ed.autoCompletePreview.zone]}
          cards={ed.autoCompletePreview.cards}
          onConfirm={ed.confirmAutoComplete}
          onCancel={() => ed.setAutoCompletePreview(null)}
        />
      )}

      {/* Action buttons */}
      <EditorToolbar
        isPublic={ed.isPublic}
        isGeneratingShareCode={ed.generateShareCode.isPending}
        isSaving={ed.setCardsMutation.isPending}
        onGenerateShareCode={() => ed.generateShareCode.mutate({ deckId })}
        onCancel={ed.onClose}
        onSave={ed.handleSave}
      />
    </div>
  );
}
