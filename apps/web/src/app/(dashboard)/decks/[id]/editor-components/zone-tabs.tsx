'use client';

import { DECK_ZONES, type DeckZone } from '@la-grieta/shared';
import { ZONE_LABELS, ZONE_LIMITS } from '../use-deck-editor';

interface ZoneTabsProps {
  activeZone: DeckZone;
  zoneCounts: Record<DeckZone, number>;
  onZoneChange: (zone: DeckZone) => void;
}

export function ZoneTabs({ activeZone, zoneCounts, onZoneChange }: ZoneTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-surface-elevated rounded-lg overflow-x-auto">
      {DECK_ZONES.map((zone) => {
        const count = zoneCounts[zone];
        const limit = ZONE_LIMITS[zone];
        const isActive = zone === activeZone;
        const isFull = count >= limit;
        return (
          <button
            key={zone}
            onClick={() => onZoneChange(zone)}
            className={`flex-1 py-1.5 px-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-surface-card text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className="block">{ZONE_LABELS[zone]}</span>
            <span className={`text-[10px] ${isFull ? 'text-green-400' : isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
              {count}/{limit}
            </span>
          </button>
        );
      })}
    </div>
  );
}
