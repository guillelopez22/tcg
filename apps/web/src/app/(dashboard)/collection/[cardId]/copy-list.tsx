'use client';

// Copy list — accordion of all copies for a card.
// Tapping a row expands the inline CopyEditForm. Only one row expanded at a time.

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { CopyEditForm } from './copy-edit-form';

const CONDITION_LABELS: Record<string, string> = {
  near_mint: 'NM',
  lightly_played: 'LP',
  moderately_played: 'MP',
  heavily_played: 'HP',
  damaged: 'DMG',
};

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  alt_art: 'Alt Art',
  overnumbered: 'OVN',
  signature: 'SIG',
};

interface Copy {
  id: string;
  variant: string;
  condition: string;
  purchasePrice: string | null;
  notes: string | null;
  photoUrl: string | null;
  photoKey: string | null;
  createdAt: Date | string;
}

interface CopyListProps {
  copies: Copy[];
  onCopiesChanged: () => void;
}

const CONDITION_COLORS: Record<string, string> = {
  near_mint: 'text-green-400 bg-green-900/20',
  lightly_played: 'text-lime-400 bg-lime-900/20',
  moderately_played: 'text-yellow-400 bg-yellow-900/20',
  heavily_played: 'text-orange-400 bg-orange-900/20',
  damaged: 'text-red-400 bg-red-900/20',
};

export function CopyList({ copies, onCopiesChanged }: CopyListProps) {
  const t = useTranslations('collection');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (copies.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <svg className="w-10 h-10 mx-auto text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <p className="lg-text-secondary">{t('noCopies')}</p>
        <p className="text-xs text-zinc-600">Tap "Log a new purchase" above to start tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {copies.map((copy, index) => {
        const isExpanded = expandedId === copy.id;
        const copyNumber = copies.length - index;
        const date = new Date(copy.createdAt as string).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const conditionColor = CONDITION_COLORS[copy.condition] ?? 'text-zinc-400 bg-zinc-800/50';

        return (
          <div key={copy.id} className="rounded-xl border border-surface-border overflow-hidden">
            {/* Copy row — tap to expand */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : copy.id)}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-elevated transition-colors"
              aria-expanded={isExpanded}
            >
              {/* Copy number or photo */}
              {copy.photoUrl ? (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-surface-border">
                  <Image
                    src={copy.photoUrl}
                    alt="Card photo"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-surface-border flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-zinc-300">#{copyNumber}</span>
                </div>
              )}

              {/* Copy info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`lg-badge ${conditionColor}`}>
                    {CONDITION_LABELS[copy.condition] ?? copy.condition}
                  </span>
                  {copy.variant !== 'normal' && (
                    <span className="lg-badge bg-purple-900/20 text-purple-400">
                      {VARIANT_LABELS[copy.variant] ?? copy.variant}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="lg-text-muted text-xs">{date}</span>
                  {copy.purchasePrice && (
                    <span className="text-xs font-medium text-zinc-300">${copy.purchasePrice}</span>
                  )}
                </div>
              </div>

              {/* Expand indicator */}
              <svg
                className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded edit form */}
            {isExpanded && (
              <CopyEditForm
                copy={copy}
                onSaved={() => {
                  setExpandedId(null);
                  onCopiesChanged();
                }}
                onRemoved={() => {
                  setExpandedId(null);
                  onCopiesChanged();
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
