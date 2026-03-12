'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CardScanner, loadCooldown } from './card-scanner';
import { ScanSessionSummary } from './scan-session-summary';
import { ScannerSettings } from './scanner-settings';
import type { ScannedEntry } from './card-scanner';
import type { CooldownSeconds } from './scanner-settings';

type View = 'scanning' | 'summary';

export function ScannerOrchestrator() {
  const t = useTranslations('scanner');
  const [view, setView] = useState<View>('scanning');
  const [session, setSession] = useState<ScannedEntry[]>([]);
  const [cooldown, setCooldown] = useState<CooldownSeconds>(3);

  // Load cooldown from localStorage on mount (client-only)
  useEffect(() => {
    setCooldown(loadCooldown());
  }, []);

  const totalAdded = session.reduce((n, e) => n + e.quantity, 0);

  function handleEndSession() {
    setView('summary');
  }

  function handleScanMore() {
    setView('scanning');
    // Do NOT reset session — user returns to add more cards
  }

  if (view === 'summary') {
    return (
      <ScanSessionSummary
        sessionSummary={session}
        onScanMore={handleScanMore}
      />
    );
  }

  return (
    <div className="space-y-0">
      {/* Scanner page header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="lg-page-title">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {session.length > 0 && (
            <button
              onClick={handleEndSession}
              className="lg-btn-ghost text-xs py-1.5 px-3 border border-surface-border hover:border-zinc-500 text-zinc-400 hover:text-zinc-200"
            >
              {t('endSession')}
              {totalAdded > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rift-900 text-rift-300 text-[10px] font-semibold">
                  {totalAdded}
                </span>
              )}
            </button>
          )}
          <ScannerSettings cooldown={cooldown} onCooldownChange={setCooldown} />
        </div>
      </div>

      <CardScanner
        session={session}
        onSessionUpdate={setSession}
        cooldown={cooldown}
        onEndSession={handleEndSession}
      />
    </div>
  );
}
