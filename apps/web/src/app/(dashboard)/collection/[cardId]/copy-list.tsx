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

export function CopyList({ copies, onCopiesChanged }: CopyListProps) {
  const t = useTranslations('collection');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (copies.length === 0) {
    return <p className="lg-text-secondary text-center py-4">{t('noCopies')}</p>;
  }

  return (
    <div className="space-y-2">
      {copies.map((copy) => {
        const isExpanded = expandedId === copy.id;
        const date = new Date(copy.createdAt as string).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return (
          <div key={copy.id} className="rounded-xl border border-surface-border overflow-hidden">
            {/* Copy row — tap to expand */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : copy.id)}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-elevated transition-colors"
              aria-expanded={isExpanded}
            >
              {/* Photo thumbnail */}
              {copy.photoUrl ? (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={copy.photoUrl}
                    alt="Card photo"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Copy info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="lg-badge bg-surface-elevated text-zinc-300">
                    {CONDITION_LABELS[copy.condition] ?? copy.condition}
                  </span>
                  {copy.variant !== 'normal' && (
                    <span className="lg-badge bg-purple-900/20 text-purple-400">
                      {VARIANT_LABELS[copy.variant] ?? copy.variant}
                    </span>
                  )}
                  {copy.purchasePrice && (
                    <span className="lg-text-muted">${copy.purchasePrice}</span>
                  )}
                </div>
                <p className="lg-text-muted mt-0.5">Added {date}</p>
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
