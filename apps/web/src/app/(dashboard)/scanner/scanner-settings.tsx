'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

// ── Constants ────────────────────────────────────────────────────────────────

export const COOLDOWN_OPTIONS = [1, 2, 3, 5, 10] as const;
export type CooldownSeconds = (typeof COOLDOWN_OPTIONS)[number];
export const DEFAULT_COOLDOWN: CooldownSeconds = 3;

const STORAGE_KEY = 'scanner:cooldown';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function loadCooldown(): CooldownSeconds {
  if (typeof window === 'undefined') return DEFAULT_COOLDOWN;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return (COOLDOWN_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as CooldownSeconds)
    : DEFAULT_COOLDOWN;
}

function saveCooldown(value: CooldownSeconds): void {
  window.localStorage.setItem(STORAGE_KEY, String(value));
}

// ── Component ────────────────────────────────────────────────────────────────

interface ScannerSettingsProps {
  cooldown: CooldownSeconds;
  onCooldownChange: (value: CooldownSeconds) => void;
}

export function ScannerSettings({ cooldown, onCooldownChange }: ScannerSettingsProps) {
  const t = useTranslations('scanner');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function handleCooldownSelect(value: CooldownSeconds) {
    saveCooldown(value);
    onCooldownChange(value);
    setOpen(false);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-elevated transition-colors"
        aria-label={t('settings')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <IconSettings className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-surface-border bg-surface-card shadow-xl z-50 overflow-hidden"
          role="dialog"
          aria-label={t('settings')}
        >
          <div className="px-3 py-2 border-b border-surface-border">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              {t('settings')}
            </p>
          </div>

          <div className="px-3 py-2">
            <p className="text-xs text-zinc-400 mb-2">{t('cooldownLabel')}</p>
            <div className="flex gap-1 flex-wrap">
              {COOLDOWN_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleCooldownSelect(s)}
                  className={[
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    cooldown === s
                      ? 'bg-rift-900 text-rift-300 border border-rift-700'
                      : 'bg-surface-elevated text-zinc-400 border border-surface-border hover:border-rift-700 hover:text-zinc-200',
                  ].join(' ')}
                  aria-pressed={cooldown === s}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icon ─────────────────────────────────────────────────────────────────────

function IconSettings({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
