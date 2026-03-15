'use client';

import type { BuildMethod, ImportTab } from '../wizard-types';

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

function IconBuildManually() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0-4-4m4 4 4-4" />
      <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function IconAutoWand() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 4-1 1 1 1 1-1-1-1ZM3 20l9-9M5 6 4 7l1 1 1-1-1-1ZM7 2l-1 1 1 1 1-1-1-1Z" />
      <path d="m20 8-1 1 1 1 1-1-1-1ZM18 4l-1 1 1 1 1-1-1-1Z" />
      <path d="M12 8a4 4 0 0 1 4 4" />
      <path d="M6 18a4 4 0 0 1 4-4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Import sub-panel
// ---------------------------------------------------------------------------

interface ImportPanelProps {
  importTab: ImportTab;
  setImportTab: (tab: ImportTab) => void;
  importText: string;
  setImportText: (s: string) => void;
  importName: string;
  setImportName: (s: string) => void;
  importUrl: string;
  setImportUrl: (s: string) => void;
  importCode: string;
  setImportCode: (s: string) => void;
  importError: string;
  setImportError: (s: string) => void;
  isLoading: boolean;
  deckName: string;
  onBack: () => void;
  onSubmit: () => void;
}

function ImportPanel({
  importTab, setImportTab,
  importText, setImportText,
  importName, setImportName,
  importUrl, setImportUrl,
  importCode, setImportCode,
  importError, setImportError,
  isLoading, deckName,
  onBack, onSubmit,
}: ImportPanelProps) {
  const importTabs: { id: ImportTab; label: string }[] = [
    { id: 'text', label: 'Text Paste' },
    { id: 'url', label: 'URL' },
    { id: 'code', label: 'Share Code' },
  ];

  return (
    <div className="flex flex-col gap-4 p-6 overflow-y-auto">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="lg-text-muted text-xs flex items-center gap-1 mb-3 hover:text-white transition-colors"
          aria-label="Back to method selection"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Back to method selection
        </button>
        <h2 className="lg-page-title mb-1">Import a Deck</h2>
        <p className="lg-text-secondary">Paste a deck list, provide a URL, or enter a share code.</p>
      </div>

      {/* Import tabs */}
      <div className="flex border-b border-surface-border shrink-0">
        {importTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setImportTab(t.id); setImportError(''); }}
            className={t.id === importTab ? 'lg-tab-active' : 'lg-tab-inactive'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-3">
        {importTab === 'text' && (
          <>
            <div className="lg-field">
              <label htmlFor="import-name" className="lg-label">Deck name (optional — overrides wizard name)</label>
              <input
                id="import-name"
                type="text"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder={deckName || 'My Imported Deck'}
                className="lg-input"
              />
            </div>
            <div className="lg-field">
              <label htmlFor="import-text" className="lg-label">Deck list</label>
              <textarea
                id="import-text"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'3x Card Name\n2x Other Card\n...'}
                className="lg-input min-h-[160px] resize-y font-mono text-sm"
                aria-label="Paste deck list text"
              />
            </div>
          </>
        )}

        {importTab === 'url' && (
          <>
            <div className="lg-field">
              <label htmlFor="import-url-name" className="lg-label">Deck name (optional)</label>
              <input
                id="import-url-name"
                type="text"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder={deckName || 'My Imported Deck'}
                className="lg-input"
              />
            </div>
            <div className="lg-field">
              <label htmlFor="import-url" className="lg-label">Deck URL</label>
              <input
                id="import-url"
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
                placeholder="https://riftbound.gg/deck/..."
                className="lg-input"
                aria-label="Enter deck URL"
              />
            </div>
          </>
        )}

        {importTab === 'code' && (
          <div className="lg-field">
            <label htmlFor="import-code" className="lg-label">Share code</label>
            <input
              id="import-code"
              type="text"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
              placeholder="LG-a3Xk9m"
              className="lg-input"
              aria-label="Enter share code"
            />
          </div>
        )}

        {importError && (
          <p className="text-xs text-red-400" role="alert">{importError}</p>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="lg-btn-primary w-full flex items-center justify-center gap-2"
        >
          {isLoading && (
            <div role="status" className="lg-spinner-sm">
              <span className="sr-only">Importing</span>
            </div>
          )}
          {isLoading ? 'Importing…' : 'Import'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-building loading state
// ---------------------------------------------------------------------------

interface AutoBuildLoadingProps {
  legendDomains: (string | undefined)[];
}

function AutoBuildLoading({ legendDomains }: AutoBuildLoadingProps) {
  const domains = legendDomains.filter(Boolean);
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <div role="status" className="lg-spinner">
        <span className="sr-only">Building deck</span>
      </div>
      <p className="text-sm text-white font-medium">Building your deck…</p>
      <p className="lg-text-muted text-xs text-center">
        Selecting cards from {domains.join(' + ')} domain{domains.length > 1 ? 's' : ''}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildModeStep — root component for the method step
// ---------------------------------------------------------------------------

interface BuildModeStepProps {
  buildMethod: BuildMethod | null;
  isAutoBuilding: boolean;
  legendDomains: (string | undefined)[];
  // import props
  importTab: ImportTab;
  setImportTab: (tab: ImportTab) => void;
  importText: string;
  setImportText: (s: string) => void;
  importName: string;
  setImportName: (s: string) => void;
  importUrl: string;
  setImportUrl: (s: string) => void;
  importCode: string;
  setImportCode: (s: string) => void;
  importError: string;
  setImportError: (s: string) => void;
  isImporting: boolean;
  deckName: string;
  // handlers
  onPickManual: () => void;
  onPickImport: () => void;
  onPickAuto: () => void;
  onBackFromImport: () => void;
  onSubmitImport: () => void;
}

export function BuildModeStep({
  buildMethod,
  isAutoBuilding,
  legendDomains,
  importTab, setImportTab,
  importText, setImportText,
  importName, setImportName,
  importUrl, setImportUrl,
  importCode, setImportCode,
  importError, setImportError,
  isImporting,
  deckName,
  onPickManual,
  onPickImport,
  onPickAuto,
  onBackFromImport,
  onSubmitImport,
}: BuildModeStepProps) {
  if (buildMethod === 'import') {
    return (
      <ImportPanel
        importTab={importTab}
        setImportTab={setImportTab}
        importText={importText}
        setImportText={setImportText}
        importName={importName}
        setImportName={setImportName}
        importUrl={importUrl}
        setImportUrl={setImportUrl}
        importCode={importCode}
        setImportCode={setImportCode}
        importError={importError}
        setImportError={setImportError}
        isLoading={isImporting}
        deckName={deckName}
        onBack={onBackFromImport}
        onSubmit={onSubmitImport}
      />
    );
  }

  if (buildMethod === 'auto' && isAutoBuilding) {
    return <AutoBuildLoading legendDomains={legendDomains} />;
  }

  // Default: method picker cards
  const methodCardCls = [
    'lg-card p-5 flex flex-col items-center gap-3 text-center transition-all duration-200',
    'hover:border-rift-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rift-900/30',
    'focus-visible:ring-2 focus-visible:ring-rift-500',
  ].join(' ');

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="lg-page-title mb-1">How do you want to build?</h2>
        <p className="lg-text-secondary">Choose a starting point for your deck.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button type="button" onClick={onPickManual} className={methodCardCls}>
          <div className="w-14 h-14 rounded-2xl bg-rift-900/50 border border-rift-700/50 flex items-center justify-center text-rift-400">
            <IconBuildManually />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Build Manually</p>
            <p className="text-xs text-zinc-500 leading-relaxed">Browse and add cards one by one to craft your ideal deck.</p>
          </div>
        </button>

        <button type="button" onClick={onPickImport} className={methodCardCls}>
          <div className="w-14 h-14 rounded-2xl bg-rift-900/50 border border-rift-700/50 flex items-center justify-center text-rift-400">
            <IconImport />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Import a Deck</p>
            <p className="text-xs text-zinc-500 leading-relaxed">Paste a deck list, enter a URL, or use a share code.</p>
          </div>
        </button>

        <button type="button" onClick={onPickAuto} className={methodCardCls}>
          <div className="w-14 h-14 rounded-2xl bg-rift-900/50 border border-rift-700/50 flex items-center justify-center text-rift-400">
            <IconAutoWand />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Auto-Build for Me</p>
            <p className="text-xs text-zinc-500 leading-relaxed">Instantly fill a complete deck from your legend's domains. Review before saving.</p>
          </div>
        </button>
      </div>
    </div>
  );
}
