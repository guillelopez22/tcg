'use client';

import Image from 'next/image';

interface ResolvedCard {
  cardId: string;
  quantity: number;
  zone: string;
  name?: string;
  imageSmall?: string | null;
}

interface ImportPreviewProps {
  resolved: ResolvedCard[];
  unmatched: string[];
  deckName: string;
  onImport: () => void;
  onBack: () => void;
  isImporting: boolean;
}

const ZONE_LABELS: Record<string, string> = {
  champion: 'Champion',
  main: 'Main',
  rune: 'Runes',
  sideboard: 'Sideboard',
};

const ZONE_ORDER = ['champion', 'main', 'rune', 'sideboard'];

export function ImportPreview({
  resolved,
  unmatched,
  deckName,
  onImport,
  onBack,
  isImporting,
}: ImportPreviewProps) {
  // Group cards by zone
  const byZone: Record<string, ResolvedCard[]> = {};
  for (const card of resolved) {
    const z = card.zone ?? 'main';
    if (!byZone[z]) byZone[z] = [];
    byZone[z]!.push(card);
  }

  const zones = ZONE_ORDER.filter((z) => byZone[z] && byZone[z]!.length > 0);

  return (
    <div className="space-y-4">
      <h3 className="lg-section-title">{deckName}</h3>

      {unmatched.length > 0 && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3">
          <p className="text-sm text-amber-300 font-medium">
            {unmatched.length} card{unmatched.length !== 1 ? 's' : ''} not found:{' '}
            <span className="font-normal">{unmatched.join(', ')}</span>
          </p>
          <p className="text-xs text-amber-400/70 mt-1">
            Import the {resolved.length} matched card{resolved.length !== 1 ? 's' : ''}?
          </p>
        </div>
      )}

      {resolved.length === 0 && (
        <p className="text-sm text-red-400">No cards could be matched.</p>
      )}

      {zones.map((zone) => (
        <div key={zone} className="space-y-1">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            {ZONE_LABELS[zone] ?? zone}
          </h4>
          <div className="lg-card overflow-hidden divide-y divide-surface-border">
            {byZone[zone]!.map((card, idx) => (
              <div key={`${card.cardId}-${idx}`} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-shrink-0">
                  {card.imageSmall ? (
                    <div className="relative w-8 h-11 rounded overflow-hidden border border-zinc-700">
                      <Image
                        src={card.imageSmall}
                        alt={card.name ?? card.cardId}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-11 rounded bg-surface-elevated border border-surface-border flex items-center justify-center">
                      <span className="text-zinc-600 text-xs" aria-hidden>?</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{card.name ?? card.cardId}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-sm font-bold text-white">&times;{card.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button onClick={onBack} className="lg-btn-secondary" disabled={isImporting}>
          Back
        </button>
        <button
          onClick={onImport}
          disabled={isImporting || resolved.length === 0}
          className="lg-btn-primary disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isImporting && (
            <div role="status" className="lg-spinner-sm">
              <span className="sr-only">Importing</span>
            </div>
          )}
          {isImporting ? 'Importing...' : 'Import to My Decks'}
        </button>
      </div>
    </div>
  );
}
