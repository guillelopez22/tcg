'use client';

// Shared small components used across multiple wizard steps

import Image from 'next/image';
import { DOMAIN_COLORS } from '@/lib/design-tokens';
import { FALLBACK_DOMAIN, STEPS } from '../wizard-types';
import { parseDomains, getDomainBadge } from '../wizard-helpers';
import type { Step, CardItem, LegendCard, DeckEntry } from '../wizard-types';

// ---------------------------------------------------------------------------
// StepIndicator
// ---------------------------------------------------------------------------

export function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-surface-border">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={[
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                active ? 'bg-rift-600 text-white' : done ? 'bg-rift-900 text-rift-400' : 'bg-surface-elevated text-zinc-500',
              ].join(' ')}
            >
              {done ? '✓' : idx + 1}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-white' : 'text-zinc-500'}`}>{step.label}</span>
            {idx < STEPS.length - 1 && <div className="w-6 h-px bg-surface-border" />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainBadge
// ---------------------------------------------------------------------------

export function DomainBadge({ domain }: { domain: string }) {
  return (
    <span className={`lg-badge border ${getDomainBadge(domain)}`}>{domain}</span>
  );
}

// ---------------------------------------------------------------------------
// CardThumbnail
// ---------------------------------------------------------------------------

interface CardThumbnailProps {
  card: CardItem | LegendCard;
  onClick?: () => void;
  selected?: boolean;
  count?: number;
  disabled?: boolean;
  actionLabel?: string;
}

export function CardThumbnail({ card, onClick, selected, count, disabled, actionLabel }: CardThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={actionLabel ?? card.name}
      className={[
        'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 text-left',
        'hover:border-rift-500/60 focus-visible:ring-2 focus-visible:ring-rift-500',
        selected ? 'border-rift-500 bg-rift-950/30' : 'border-surface-border bg-surface-card',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <div className="relative w-full aspect-[2/3] bg-zinc-900">
        {card.imageSmall ? (
          <Image
            src={card.imageSmall}
            alt={card.name}
            fill
            sizes="(max-width: 768px) 80px, 100px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-zinc-600 text-[10px] text-center px-1">{card.name}</span>
          </div>
        )}
        {count !== undefined && count > 0 && (
          <div className="lg-badge-count">{count}</div>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-[10px] font-medium text-white line-clamp-2 leading-tight">{card.name}</p>
        {'cardType' in card && card.cardType && (
          <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{card.cardType}</p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  count: number;
  max: number;
  valid: boolean;
  extra?: string;
}

export function SectionHeader({ title, count, max, valid, extra }: SectionHeaderProps) {
  const pct = Math.min(count / max, 1);
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          {extra && <span className="lg-text-muted">{extra}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${count > max ? 'text-red-400' : valid ? 'text-green-400' : 'text-zinc-400'}`}>
            {count}/{max}
          </span>
          {valid && <span className="text-green-400 text-xs">✓</span>}
        </div>
      </div>
      <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${count > max ? 'bg-red-500' : count === max ? 'bg-green-500' : 'bg-rift-500'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeckEntryRow
// ---------------------------------------------------------------------------

interface DeckEntryRowProps {
  entry: DeckEntry;
  onRemove: (cardId: string) => void;
  onRemoveFully: (cardId: string) => void;
}

export function DeckEntryRow({ entry, onRemove, onRemoveFully }: DeckEntryRowProps) {
  const { card, quantity, zone } = entry;
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-elevated group">
      {card.imageSmall && (
        <div className="relative w-7 h-10 rounded overflow-hidden shrink-0">
          <Image src={card.imageSmall} alt={card.name} fill className="object-cover" sizes="28px" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{card.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {zone === 'champion' && (
            <span className="lg-badge bg-rift-900/50 text-rift-300 border border-rift-700/50 text-[9px]">Champion</span>
          )}
          {card.domain && parseDomains(card.domain).filter(Boolean).map((d) => (
            <DomainBadge key={d} domain={d} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs font-bold text-white w-5 text-center">{quantity}</span>
        <button
          type="button"
          onClick={() => onRemove(card.id)}
          aria-label={`Remove one ${card.name}`}
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-elevated transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
