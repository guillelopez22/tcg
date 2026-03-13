'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { MatchQRCode } from '@/components/match-qr-code';
import { getMatchSocket } from '@/lib/match-socket';
import { BattlefieldSelection } from '@/app/match/[code]/battlefield-selection';
import {
  WIN_TARGET_1V1,
  WIN_TARGET_2V2,
  WIN_TARGET_FFA,
  BATTLEFIELDS_1V1,
  BATTLEFIELDS_2V2,
  BATTLEFIELDS_FFA,
} from '@la-grieta/shared';
import type {
  MatchFormatInput,
  MatchModeInput,
} from '@la-grieta/shared';
import type { MatchState } from '@/app/match/[code]/battlefield-selection';

// ---------------------------------------------------------------------------
// Format info
// ---------------------------------------------------------------------------

const FORMAT_INFO: Record<
  MatchFormatInput,
  { label: string; playerCount: string; winTarget: number; battlefieldCount: number }
> = {
  '1v1': {
    label: '1v1',
    playerCount: '2 players',
    winTarget: WIN_TARGET_1V1,
    battlefieldCount: BATTLEFIELDS_1V1,
  },
  '2v2': {
    label: '2v2',
    playerCount: '4 players',
    winTarget: WIN_TARGET_2V2,
    battlefieldCount: BATTLEFIELDS_2V2,
  },
  'ffa': {
    label: 'FFA',
    playerCount: '2-4 players',
    winTarget: WIN_TARGET_FFA,
    battlefieldCount: BATTLEFIELDS_FFA,
  },
};

const FORMATS: MatchFormatInput[] = ['1v1', '2v2', 'ffa'];

// ---------------------------------------------------------------------------
// How many players by format
// ---------------------------------------------------------------------------

function playerCountForFormat(format: MatchFormatInput): number {
  if (format === '1v1') return 2;
  if (format === '2v2') return 4;
  return 3; // FFA default 3, allow 2-4
}

// ---------------------------------------------------------------------------
// Step types — 7 steps total
// 1=format, 2=mode, 3=playerNames, 4=firstPlayer, 5=deckSelection, 6=QR/share, 7=battlefieldSelection
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewMatchPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<WizardStep>(1);
  const [format, setFormat] = useState<MatchFormatInput>('1v1');
  const [mode, setMode] = useState<MatchModeInput>('synced');
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [firstPlayerIndex, setFirstPlayerIndex] = useState(0);

  // Deck selection state
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [battlefieldCards, setBattlefieldCards] = useState<
    { cardId: string; name: string; imageSmall: string | null }[]
  >([]);

  // Pre-fill Player 1 name from user profile once auth loads
  useEffect(() => {
    const name = user?.displayName || user?.username || '';
    if (name && !playerNames[0]) {
      setPlayerNames((prev) => [name, ...prev.slice(1)]);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const [matchCode, setMatchCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ---------------------------------------------------------------
  // tRPC
  // ---------------------------------------------------------------

  const createMatch = trpc.match.create.useMutation({
    onSuccess(data) {
      setMatchCode(data.code);
      setSessionId(data.sessionId);
      if (mode === 'local') {
        setStep(7);
      } else {
        setStep(6);
      }
    },
  });

  // Fetch user decks when on deck selection step (step 5)
  const { data: userDecks } = trpc.deck.list.useQuery(
    { limit: 50 },
    { enabled: step >= 5 },
  );

  // Fetch selected deck details to extract battlefield cards
  const { data: selectedDeck } = trpc.deck.getById.useQuery(
    { id: selectedDeckId! },
    { enabled: !!selectedDeckId },
  );

  // When selected deck data arrives, extract battlefield zone cards
  useEffect(() => {
    if (selectedDeck?.cards) {
      const bfCards = selectedDeck.cards
        .filter((c) => c.zone === 'battlefield')
        .map((c) => ({
          cardId: c.cardId,
          name: c.card.name,
          imageSmall: c.card.imageSmall,
        }));
      setBattlefieldCards(bfCards);
    }
  }, [selectedDeck]);

  // ---------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------

  function goBack() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  function goNext() {
    if (step < 7) setStep((s) => (s + 1) as WizardStep);
  }

  function handleFormatSelect(f: MatchFormatInput) {
    setFormat(f);
    const count = playerCountForFormat(f);
    const profileName = user?.displayName || user?.username || '';
    setPlayerNames(Array.from({ length: count }, (_, i) => (i === 0 ? profileName : '')));
  }

  function handleModeSelect(m: MatchModeInput) {
    setMode(m);
    goNext();
  }

  function handleCreateMatch() {
    const validNames = playerNames.map((n, i) => n.trim() || `Player ${i + 1}`);
    const firstPlayerId = `player-${firstPlayerIndex}`;
    createMatch.mutate({
      format,
      mode,
      playerNames: validNames,
      firstPlayerId,
    });
  }

  function handleRevealed(_state: MatchState) {
    if (sessionId) {
      router.push(`/match/${matchCode}`);
    }
  }

  // ---------------------------------------------------------------
  // Socket + battlefield cards for step 7
  // ---------------------------------------------------------------

  const socket =
    step === 7 && matchCode ? getMatchSocket(matchCode) : null;

  // ---------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------

  function renderProgressDots() {
    const totalSteps = 6;
    const current = Math.min(step - 1, totalSteps - 1);
    return (
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${
              i === current
                ? 'w-4 h-2 bg-rift-400'
                : i < current
                ? 'w-2 h-2 bg-rift-600/60'
                : 'w-2 h-2 bg-surface-elevated'
            }`}
          />
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------

  // Step 1: Format selection
  if (step === 1) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/match" className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-white">New Match</h1>
        </div>

        {renderProgressDots()}

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Choose Format</h2>
          <div className="space-y-2">
            {FORMATS.map((f) => {
              const info = FORMAT_INFO[f];
              const isSelected = format === f;
              return (
                <button
                  key={f}
                  onClick={() => handleFormatSelect(f)}
                  className={`w-full lg-card p-4 text-left transition-all border-2 ${
                    isSelected ? 'border-rift-500 bg-rift-900/20' : 'border-surface-border hover:border-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-white">{info.label}</p>
                      <p className="text-sm text-zinc-400 mt-0.5">{info.playerCount}</p>
                    </div>
                    <div className="text-right text-sm text-zinc-500">
                      <p>Win at {info.winTarget} pts</p>
                      <p>{info.battlefieldCount} battlefields</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={goNext} className="lg-btn-primary w-full py-3">
          Next
        </button>
      </div>
    );
  }

  // Step 2: Mode selection
  if (step === 2) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">New Match</h1>
        </div>

        {renderProgressDots()}

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Match Mode</h2>
          <div className="space-y-3">
            <button
              onClick={() => handleModeSelect('local')}
              className="w-full lg-card p-4 text-left transition-all border-2 border-surface-border hover:border-rift-600/50 group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <svg className="w-6 h-6 text-zinc-400 group-hover:text-rift-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="1.5" />
                    <circle cx="12" cy="18" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Local Match</p>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    One device, shared screen. Pass the phone between players.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleModeSelect('synced')}
              className="w-full lg-card p-4 text-left transition-all border-2 border-surface-border hover:border-rift-600/50 group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <svg className="w-6 h-6 text-zinc-400 group-hover:text-rift-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect x="2" y="4" width="9" height="16" rx="1.5" strokeWidth="1.5" />
                    <rect x="13" y="4" width="9" height="16" rx="1.5" strokeWidth="1.5" />
                    <circle cx="6.5" cy="17" r="0.75" fill="currentColor" />
                    <circle cx="17.5" cy="17" r="0.75" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Synced Match</p>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Each player uses their own phone. Share a QR code to join.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Player names
  if (step === 3) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">New Match</h1>
        </div>

        {renderProgressDots()}

        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">
            {mode === 'synced' ? 'Your Name' : 'Player Names'}
          </h2>
          {(mode === 'synced' ? [0] : playerNames.map((_, i) => i)).map((i) => (
            <div key={i} className="space-y-1.5">
              <label className="text-sm text-zinc-400">
                {mode === 'synced' ? 'Your name' : `Player ${i + 1}`}
              </label>
              <input
                type="text"
                value={playerNames[i] ?? ''}
                onChange={(e) => {
                  const updated = [...playerNames];
                  updated[i] = e.target.value;
                  setPlayerNames(updated);
                }}
                placeholder={`Player ${i + 1}`}
                maxLength={50}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rift-500"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={goBack} className="lg-btn-secondary flex-1 py-2.5">
            Back
          </button>
          <button onClick={goNext} className="lg-btn-primary flex-1 py-2.5">
            Next
          </button>
        </div>
      </div>
    );
  }

  // Step 4: First player selection
  if (step === 4) {
    const names = playerNames.map((n, i) => n.trim() || `Player ${i + 1}`);
    const displayNames = mode === 'synced' ? [names[0] ?? 'Host'] : names;

    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">New Match</h1>
        </div>

        {renderProgressDots()}

        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Who goes first?</h2>
            <p className="text-sm text-zinc-400 mt-1">
              First player draws 3 runes in the Channel phase (instead of 2).
            </p>
          </div>

          <div className="space-y-2">
            {displayNames.map((name, i) => (
              <button
                key={i}
                onClick={() => setFirstPlayerIndex(i)}
                className={`w-full lg-card p-4 text-left flex items-center gap-3 border-2 transition-all ${
                  firstPlayerIndex === i
                    ? 'border-rift-500 bg-rift-900/20'
                    : 'border-surface-border hover:border-surface-hover'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                  firstPlayerIndex === i
                    ? 'border-rift-400 bg-rift-400'
                    : 'border-zinc-600'
                }`} />
                <span className="text-sm font-medium text-white">{name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={goBack} className="lg-btn-secondary flex-1 py-2.5">
            Back
          </button>
          <button onClick={goNext} className="lg-btn-primary flex-1 py-2.5">
            Next
          </button>
        </div>
      </div>
    );
  }

  // Step 5: Deck selection
  if (step === 5) {
    const decks = userDecks?.items ?? [];
    const hasDecks = decks.length > 0;

    function handleDeckSelect(deckId: string) {
      setSelectedDeckId(deckId);
      handleCreateMatch();
    }

    function handleSkip() {
      setSelectedDeckId(null);
      setBattlefieldCards([]);
      handleCreateMatch();
    }

    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">New Match</h1>
        </div>

        {renderProgressDots()}

        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-white">Select Your Deck</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Choose a deck to use your battlefield cards during selection.
            </p>
          </div>

          {!hasDecks && (
            <div className="lg-card p-4 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                No decks found. Create a deck first or skip to play without battlefield cards.
              </p>
              <button onClick={handleSkip} className="lg-btn-secondary px-6 py-2">
                Skip (no deck)
              </button>
            </div>
          )}

          {hasDecks && (
            <div className="space-y-2">
              {decks.map((deck) => {
                const isSelected = selectedDeckId === deck.id;
                return (
                  <button
                    key={deck.id}
                    onClick={() => handleDeckSelect(deck.id)}
                    className={`w-full lg-card p-4 text-left transition-all border-2 ${
                      isSelected
                        ? 'border-rift-500 bg-rift-900/20'
                        : 'border-surface-border hover:border-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {deck.coverCard?.imageSmall ? (
                        <div className="relative w-8 h-11 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={deck.coverCard.imageSmall}
                            alt={deck.name}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-11 rounded bg-surface-elevated flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{deck.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 capitalize">{deck.domain ?? deck.status}</p>
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-rift-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {hasDecks && (
            <button
              onClick={handleSkip}
              disabled={createMatch.isPending}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-2 disabled:opacity-50"
            >
              Skip (play without a deck)
            </button>
          )}
        </div>

        {createMatch.error && (
          <p className="text-sm text-red-400 text-center">{createMatch.error.message}</p>
        )}
      </div>
    );
  }

  // Step 6: Share / wait (synced mode only) — match already created in step 5
  if (step === 6) {
    if (!matchCode) {
      // Still creating — show loading
      return (
        <div className="space-y-6 max-w-md mx-auto text-center py-16">
          <p className="lg-text-secondary">Creating match...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Match Created</h1>
        </div>

        <div className="lg-card p-6 space-y-6">
          <MatchQRCode code={matchCode} />

          <div className="text-center space-y-1">
            <p className="text-sm text-zinc-400">Share this code with your opponent</p>
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              Waiting for players to join...
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep(7)}
          className="lg-btn-secondary w-full py-2.5"
        >
          Proceed to Battlefield Selection
        </button>
      </div>
    );
  }

  // Step 7: Battlefield selection
  if (step === 7 && matchCode && socket) {
    const resolvedNames = playerNames.map((n, i) => n.trim() || `Player ${i + 1}`);
    const bfCount = FORMAT_INFO[format].battlefieldCount;

    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Battlefield Selection</h1>
        </div>

        <BattlefieldSelection
          code={matchCode}
          playerId={`player-${firstPlayerIndex}`}
          battlefieldCards={battlefieldCards as never}
          required={bfCount}
          socket={socket}
          onRevealed={handleRevealed}
          localMode={mode === 'local'}
          localPlayerNames={mode === 'local' ? resolvedNames : undefined}
        />
      </div>
    );
  }

  // Fallback / loading state
  return (
    <div className="space-y-6 max-w-md mx-auto text-center py-16">
      <p className="lg-text-secondary">Creating match...</p>
    </div>
  );
}
