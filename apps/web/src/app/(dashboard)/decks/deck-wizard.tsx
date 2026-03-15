'use client';

// Deck creation wizard — 5-step flow:
// 1. Name deck  2. Pick legend  3. Choose method  4. Build (main / rune / battlefield)  5. Review & create
// Rendering: client-only (modal, interactive state machine)

import { useDeckWizard } from './use-deck-wizard';
import { StepIndicator } from './wizard-steps/wizard-shared';
import { NameStep } from './wizard-steps/name-step';
import { LegendStep } from './wizard-steps/legend-step';
import { BuildModeStep } from './wizard-steps/build-mode-step';
import { BuildStep } from './wizard-steps/build-step';
import { ReviewStep } from './wizard-steps/review-step';
import type { DeckWizardProps } from './wizard-types';

export function DeckWizard({ isOpen, onClose, onCreated }: DeckWizardProps) {
  const wiz = useDeckWizard({ isOpen, onClose, onCreated });

  if (!isOpen) return null;

  return (
    <div
      className="lg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Create new deck"
      onClick={(e) => { if (e.target === e.currentTarget) wiz.handleClose(); }}
    >
      <div
        className={[
          'w-full bg-surface-card border border-surface-border overflow-hidden flex flex-col',
          'rounded-t-2xl sm:rounded-2xl',
          wiz.isTallStep
            ? 'sm:max-w-4xl h-[92dvh] sm:h-[85dvh]'
            : 'sm:max-w-lg',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <span className="text-base font-semibold text-white">New Deck</span>
          <button
            type="button"
            onClick={wiz.handleClose}
            aria-label="Close wizard"
            className="lg-btn-ghost p-1.5 rounded-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator current={wiz.step} />

        {/* Step content */}
        <div className={`flex-1 overflow-hidden flex flex-col ${wiz.step === 'build' ? '' : 'overflow-y-auto'}`}>
          {wiz.step === 'name' && (
            <NameStep
              deckName={wiz.deckName}
              setDeckName={wiz.setDeckName}
              nameError={wiz.nameError}
              setNameError={wiz.setNameError}
              nameInputRef={wiz.nameInputRef}
              onNext={wiz.goNext}
            />
          )}

          {wiz.step === 'legend' && (
            <LegendStep
              legendSearch={wiz.legendSearch}
              setLegendSearch={wiz.setLegendSearch}
              legendDomainFilter={wiz.legendDomainFilter}
              setLegendDomainFilter={wiz.setLegendDomainFilter}
              filteredLegends={wiz.filteredLegends}
              legendsLoading={wiz.legendsLoading}
              selectedLegend={wiz.selectedLegend}
              setSelectedLegend={wiz.setSelectedLegend}
            />
          )}

          {wiz.step === 'method' && (
            <BuildModeStep
              buildMethod={wiz.buildMethod}
              isAutoBuilding={wiz.isAutoBuilding}
              legendDomains={wiz.legendDomains}
              importTab={wiz.importTab}
              setImportTab={wiz.setImportTab}
              importText={wiz.importText}
              setImportText={wiz.setImportText}
              importName={wiz.importName}
              setImportName={wiz.setImportName}
              importUrl={wiz.importUrl}
              setImportUrl={wiz.setImportUrl}
              importCode={wiz.importCode}
              setImportCode={wiz.setImportCode}
              importError={wiz.importError}
              setImportError={wiz.setImportError}
              isImporting={wiz.importFromTextMutation.isPending || wiz.importFromUrlMutation.isPending}
              deckName={wiz.deckName}
              onPickManual={wiz.handlePickManual}
              onPickImport={wiz.handlePickImport}
              onPickAuto={wiz.handlePickAuto}
              onBackFromImport={() => { wiz.setBuildMethod(null); wiz.setImportError(''); }}
              onSubmitImport={wiz.handleSubmitImport}
            />
          )}

          {wiz.step === 'build' && wiz.selectedLegend && (
            <BuildStep
              selectedLegend={wiz.selectedLegend}
              legendDomains={wiz.legendDomains}
              entries={wiz.entries}
              browserTab={wiz.browserTab}
              setBrowserTab={wiz.setBrowserTab}
              championEntry={wiz.championEntry}
              mainEntries={wiz.mainEntries}
              runeEntries={wiz.runeEntries}
              battlefieldEntries={wiz.battlefieldEntries}
              sideboardEntries={wiz.sideboardEntries}
              mainCount={wiz.mainCount}
              runeCount={wiz.runeCount}
              battlefieldCount={wiz.battlefieldCount}
              sideboardCount={wiz.sideboardCount}
              validation={wiz.validation}
              onAdd={wiz.addCard}
              onRemove={wiz.removeCard}
              onRemoveFully={wiz.removeCardFully}
            />
          )}

          {wiz.step === 'review' && (
            <ReviewStep
              deckName={wiz.deckName}
              selectedLegend={wiz.selectedLegend}
              buildMethod={wiz.buildMethod}
              legendDomains={wiz.legendDomains}
              entries={wiz.entries}
              legendEntry={wiz.legendEntry}
              championEntry={wiz.championEntry}
              mainEntries={wiz.mainEntries}
              runeEntries={wiz.runeEntries}
              battlefieldEntries={wiz.battlefieldEntries}
              sideboardEntries={wiz.sideboardEntries}
              mainCount={wiz.mainCount}
              runeCount={wiz.runeCount}
              battlefieldCount={wiz.battlefieldCount}
              sideboardCount={wiz.sideboardCount}
              validation={wiz.validation}
            />
          )}
        </div>

        {/* Footer — hidden on method step (method cards are the actions) */}
        {wiz.showFooter && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border shrink-0 gap-3">
            <button
              type="button"
              onClick={wiz.step === 'name' ? wiz.handleClose : wiz.goBack}
              className="lg-btn-secondary"
            >
              {wiz.step === 'name' ? 'Cancel' : 'Back'}
            </button>

            {!wiz.footerOnlyBack && (
              wiz.step === 'review' ? (
                <button
                  type="button"
                  onClick={wiz.handleCreate}
                  disabled={!wiz.validation.isValid || wiz.isCreating}
                  className="lg-btn-primary flex items-center gap-2"
                >
                  {wiz.isCreating ? (
                    <>
                      <div className="lg-spinner-sm" role="status" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    'Create Deck'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={wiz.goNext}
                  disabled={!wiz.canGoNext}
                  className="lg-btn-primary"
                >
                  {wiz.step === 'build' ? 'Review' : 'Next'}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
