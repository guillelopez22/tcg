'use client';

import type { RefObject } from 'react';

interface NameStepProps {
  deckName: string;
  setDeckName: (name: string) => void;
  nameError: string;
  setNameError: (err: string) => void;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onNext: () => void;
}

export function NameStep({ deckName, setDeckName, nameError, setNameError, nameInputRef, onNext }: NameStepProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="lg-page-title mb-1">Name your deck</h2>
        <p className="lg-text-secondary">Give your deck a name you'll recognise.</p>
      </div>
      <div className="lg-field">
        <label htmlFor="deck-name" className="lg-label">Deck name</label>
        <input
          id="deck-name"
          ref={nameInputRef}
          type="text"
          value={deckName}
          onChange={(e) => { setDeckName(e.target.value); if (nameError) setNameError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') onNext(); }}
          placeholder="e.g. Leona Aggro"
          maxLength={80}
          className="lg-input"
        />
        {nameError && <p className="text-xs text-red-400 mt-1" role="alert">{nameError}</p>}
        <p className="lg-hint">{deckName.length}/80</p>
      </div>
    </div>
  );
}
