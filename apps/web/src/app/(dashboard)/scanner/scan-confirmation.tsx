'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { CARD_CONDITIONS, CARD_VARIANTS } from '@la-grieta/shared';

// ── Types ────────────────────────────────────────────────────────────────────

type CardCondition = (typeof CARD_CONDITIONS)[number];
type CardVariant = (typeof CARD_VARIANTS)[number];

export interface ScanMatch {
  cardId: string;
  name: string;
  number: string | null;
  setName: string;
  imageSmall: string | null;
  score: number;
  /** Normalized confidence 0-100 */
  displayPct: number;
}

export interface ConfirmationState {
  match: ScanMatch;
  quantity: number;
  variant: CardVariant;
  condition: CardCondition;
}

interface ScanConfirmationProps {
  state: ConfirmationState;
  isPending: boolean;
  onQuantityChange: (qty: number) => void;
  onVariantChange: (variant: CardVariant) => void;
  onConditionChange: (condition: CardCondition) => void;
  onAdd: () => void;
  onSkip: () => void;
}

// ── Labels ───────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<CardCondition, string> = {
  near_mint: 'NM',
  lightly_played: 'LP',
  moderately_played: 'MP',
  heavily_played: 'HP',
  damaged: 'DMG',
};

const VARIANT_LABELS: Record<CardVariant, string> = {
  normal: 'Normal',
  alt_art: 'Alt-Art',
  overnumbered: 'Overnumbered',
  signature: 'Signature',
};

const MIN_QTY = 1;
const MAX_QTY = 20;

// ── Component ────────────────────────────────────────────────────────────────

export function ScanConfirmation({
  state,
  isPending,
  onQuantityChange,
  onVariantChange,
  onConditionChange,
  onAdd,
  onSkip,
}: ScanConfirmationProps) {
  const t = useTranslations('scanner');
  const { match, quantity, variant, condition } = state;

  function adjustQuantity(delta: number) {
    const next = Math.min(MAX_QTY, Math.max(MIN_QTY, quantity + delta));
    onQuantityChange(next);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end pointer-events-none"
      aria-modal="true"
      role="dialog"
      aria-label={`Confirm ${match.name}`}
    >
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        onClick={onSkip}
        aria-label={t('skip')}
        tabIndex={-1}
      />

      {/* Sheet */}
      <div
        className="relative pointer-events-auto w-full max-w-lg mx-auto rounded-t-2xl bg-surface-card border-t border-surface-border shadow-2xl animate-slide-up"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
      >
        {/* Header drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Card info */}
        <div className="flex gap-4 px-4 pt-2 pb-4">
          {/* Card art */}
          <div className="flex-shrink-0">
            {match.imageSmall ? (
              <div className="relative w-16 rounded-lg overflow-hidden border border-surface-border" style={{ aspectRatio: '2/3' }}>
                <Image
                  src={match.imageSmall}
                  alt={match.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div
                className="w-16 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center"
                style={{ aspectRatio: '2/3' }}
              >
                <span className="text-xs text-zinc-600 text-center px-1">{match.name}</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-white leading-tight">{match.name}</p>
            <p className="text-xs text-zinc-400">{match.setName}</p>
            {match.number && <p className="text-[11px] text-zinc-600">#{match.number}</p>}
            <div className="flex items-center gap-1.5 pt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-rift-400" aria-hidden="true" />
              <span className="text-xs text-rift-300 font-medium">
                {t('confidence')}: {match.displayPct}%
              </span>
            </div>
          </div>

          {/* Skip button */}
          <button
            onClick={onSkip}
            disabled={isPending}
            className="flex-shrink-0 self-start w-7 h-7 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-surface-elevated transition-colors"
            aria-label={t('skip')}
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 space-y-4 pb-safe">
          {/* Variant toggle */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
              {t('variant')}
            </p>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={t('variant')}>
              {CARD_VARIANTS.map((v) => (
                <button
                  key={v}
                  onClick={() => onVariantChange(v)}
                  className={[
                    'py-1.5 px-1 rounded-lg text-[11px] font-medium transition-colors border text-center',
                    variant === v
                      ? 'bg-rift-900/80 text-rift-300 border-rift-700'
                      : 'bg-surface-elevated text-zinc-500 border-surface-border hover:border-zinc-600 hover:text-zinc-300',
                  ].join(' ')}
                  aria-pressed={variant === v}
                >
                  {VARIANT_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Condition */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
              {t('condition')}
            </p>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t('condition')}>
              {CARD_CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => onConditionChange(c)}
                  className={[
                    'px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                    condition === c
                      ? 'bg-rift-900/80 text-rift-300 border-rift-700'
                      : 'bg-surface-elevated text-zinc-500 border-surface-border hover:border-zinc-600 hover:text-zinc-300',
                  ].join(' ')}
                  aria-pressed={condition === c}
                >
                  {CONDITION_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
              {t('quantity')}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjustQuantity(-1)}
                disabled={quantity <= MIN_QTY || isPending}
                className="w-9 h-9 rounded-xl bg-surface-elevated border border-surface-border text-zinc-300 flex items-center justify-center text-lg font-medium hover:border-zinc-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold text-white tabular-nums">
                {quantity}
              </span>
              <button
                onClick={() => adjustQuantity(1)}
                disabled={quantity >= MAX_QTY || isPending}
                className="w-9 h-9 rounded-xl bg-surface-elevated border border-surface-border text-zinc-300 flex items-center justify-center text-lg font-medium hover:border-zinc-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Increase quantity"
              >
                +
              </button>
              <span className="text-xs text-zinc-500">
                {quantity === 1 ? '1 copy' : `${quantity} copies`}
              </span>
            </div>
          </div>

          {/* Add button */}
          <div className="pb-4">
            <button
              onClick={onAdd}
              disabled={isPending}
              className="lg-btn-primary w-full flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="lg-spinner-sm" role="status">
                    <span className="sr-only">Adding...</span>
                  </div>
                  Adding...
                </>
              ) : (
                <>
                  <IconPlus className="w-4 h-4" />
                  {t('addCard')}
                  {quantity > 1 && ` (${quantity})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}
