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
import { MatchBoard } from '@/app/match/[code]/match-board';
import { GuestDeckBuilder } from '@/app/match/[code]/guest-deck-builder';
import type { TempDeck } from '@/app/match/[code]/guest-deck-builder';
import {
  WIN_TARGET_1V1,
  WIN_TARGET_2V2,
  WIN_TARGET_FFA,
  BATTLEFIELDS_1V1,
  BATTLEFIELDS_2V2,
  BATTLEFIELDS_FFA,
} from '@la-grieta/shared';
// Note: BATTLEFIELDS_* = total zones on the board (1 per player in 1v1).
// Each player always picks exactly 1 battlefield card per match.
import type {
  MatchFormatInput,
  MatchModeInput,
} from '@la-grieta/shared';
import type { MatchState } from '@/app/match/[code]/battlefield-selection';
import type { LocalDeckEntry } from '@/hooks/use-local-game-state';

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
// Step types
// Shared:  1=format, 2=mode, 3=playerNames, 4=firstPlayer
// Local:   5=P1 deck, 6=P1 battlefield, 7=P2 deck build, 8=P2 battlefield, 9=matchBoard
// Synced:  5=deck, 6=share/QR, 7=battlefieldSelection (socket), then redirect
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ---------------------------------------------------------------------------
// Battlefield card picker (inline for local mode steps 6 & 8)
// ---------------------------------------------------------------------------

function BattlefieldPicker({
  cards,
  selectedId,
  onSelect,
}: {
  cards: { id: string; name: string; imageSmall: string | null }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cards.map((card) => {
        const isSelected = selectedId === card.id;
        return (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${
              isSelected
                ? 'border-rift-400 ring-2 ring-rift-400/40 scale-[0.98]'
                : 'border-surface-border hover:border-surface-hover hover:scale-[0.98]'
            }`}
          >
            {card.imageSmall ? (
              <Image
                src={card.imageSmall}
                alt={card.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 45vw, 33vw"
              />
            ) : (
              <div className="w-full h-full bg-surface-elevated flex items-center justify-center p-2">
                <span className="text-zinc-500 text-xs text-center">{card.name}</span>
              </div>
            )}
            {isSelected && (
              <div className="absolute inset-0 bg-rift-500/20 flex items-start justify-end p-1.5">
                <div className="w-6 h-6 rounded-full bg-rift-500 flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <p className="text-white text-xs font-medium truncate">{card.name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

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

  // P1 deck selection state
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [battlefieldCards, setBattlefieldCards] = useState<
    { id: string; name: string; imageSmall: string | null }[]
  >([]);

  // Local mode: P1 battlefield pick
  const [p1BattlefieldPick, setP1BattlefieldPick] = useState<string | null>(null);

  // Local mode: P2 deck (built via GuestDeckBuilder)
  const [p2TempDeck, setP2TempDeck] = useState<TempDeck | null>(null);
  const [p2BattlefieldCards, setP2BattlefieldCards] = useState<
    { id: string; name: string; imageSmall: string | null }[]
  >([]);

  // Local mode: P2 battlefield pick
  const [p2BattlefieldPick, setP2BattlefieldPick] = useState<string | null>(null);

  // Track battlefield cards used across matches in a series
  const [usedBattlefieldIds, setUsedBattlefieldIds] = useState<string[]>([]);

  // Pre-fill Player 1 name from user profile once auth loads
  useEffect(() => {
    const name = user?.displayName || user?.username || '';
    if (name && !playerNames[0]) {
      setPlayerNames((prev) => [name, ...prev.slice(1)]);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const [matchCode, setMatchCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Real player ID from the server (needed for MatchBoard in local mode)
  const [localHostPlayerId, setLocalHostPlayerId] = useState<string | null>(null);

  // ---------------------------------------------------------------
  // tRPC
  // ---------------------------------------------------------------

  const createMatch = trpc.match.create.useMutation({
    onSuccess(data) {
      setMatchCode(data.code);
      setSessionId(data.sessionId);
      if (mode === 'local') {
        setStep(9); // Match board
      } else {
        setStep(6); // Share/QR
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
  // For local mode, auto-advance from step 5 to P1 battlefield pick
  useEffect(() => {
    if (selectedDeck?.cards) {
      const bfCards = selectedDeck.cards
        .filter((c) => c.zone === 'battlefield')
        .map((c) => ({
          id: c.cardId,
          name: c.card.name,
          imageSmall: c.card.imageSmall,
        }));
      setBattlefieldCards(bfCards);

      // Local mode: auto-advance from deck selection
      if (mode === 'local' && step === 5) {
        setStep(bfCards.length > 0 ? 6 : 7);
      }
    }
  }, [selectedDeck, mode, step]);

  // Send battlefield picks to server when local match is created
  useEffect(() => {
    if (mode === 'local' && step === 9 && matchCode) {
      const cardIds = [p1BattlefieldPick, p2BattlefieldPick].filter(
        (id): id is string => !!id,
      );
      if (cardIds.length > 0) {
        const s = getMatchSocket(matchCode);
        s.emit('battlefield:set-local', { code: matchCode, cardIds });
      }
    }
  }, [mode, step, matchCode, p1BattlefieldPick, p2BattlefieldPick]);

  // ---------------------------------------------------------------
  // Socket (synced mode battlefield selection only)
  // ---------------------------------------------------------------

  const socket =
    mode === 'synced' && step === 7 && matchCode
      ? getMatchSocket(matchCode)
      : null;

  // Query match state to get real player IDs for MatchBoard
  const { data: matchStateData } = trpc.match.getState.useQuery(
    { code: matchCode! },
    { enabled: !!matchCode && mode === 'local' && !localHostPlayerId },
  );

  useEffect(() => {
    if (matchStateData && !localHostPlayerId) {
      const state = matchStateData.state as { players?: Array<{ playerId: string }> } | null;
      const pid = state?.players?.[firstPlayerIndex]?.playerId;
      if (pid) setLocalHostPlayerId(pid);
    }
  }, [matchStateData, localHostPlayerId, firstPlayerIndex]);

  // ---------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------

  function goBack() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  function goNext() {
    if (step < 9) setStep((s) => (s + 1) as WizardStep);
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

  function handleRevealed(state: MatchState) {
    // Track used battlefield card IDs for series reuse prevention
    const newlyUsedIds = state.battlefields.flatMap((bf) =>
      bf.cards.map((c) => c.cardId),
    );
    setUsedBattlefieldIds((prev) => [...prev, ...newlyUsedIds]);

    // Synced mode: redirect to match page
    if (matchCode) {
      router.push(`/match/${matchCode}`);
    }
  }

  function handleP2DeckReady(deck: TempDeck) {
    setP2TempDeck(deck);
    const bfCards = deck.entries
      .filter((e) => e.card.cardType === 'Battlefield')
      .map((e) => ({ id: e.card.id, name: e.card.name, imageSmall: e.card.imageSmall }));
    setP2BattlefieldCards(bfCards);
    if (bfCards.length > 0) {
      setStep(8);
    } else {
      // No battlefields in P2's deck — create match directly
      handleCreateMatch();
    }
  }

  // ---------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------

  function renderProgressDots() {
    const totalSteps = 6;
    let dotIndex: number;
    if (mode === 'local') {
      if (step <= 4) dotIndex = step - 1;
      else if (step <= 6) dotIndex = 4;
      else dotIndex = 5;
    } else {
      dotIndex = Math.min(step - 1, totalSteps - 1);
    }
    return (
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${
              i === dotIndex
                ? 'w-4 h-2 bg-rift-400'
                : i < dotIndex
                ? 'w-2 h-2 bg-rift-600/60'
                : 'w-2 h-2 bg-surface-elevated'
            }`}
          />
        ))}
      </div>
    );
  }

  function renderBackButton(onClick: () => void) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={onClick} className="text-zinc-500 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">New Match</h1>
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
        {renderBackButton(goBack)}
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
        {renderBackButton(goBack)}
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
        {renderBackButton(goBack)}
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
  // Local mode: P1 only — selects saved deck, auto-advances when deck loads
  // Synced mode: Host selects deck and creates match
  if (step === 5) {
    const decks = userDecks?.items ?? [];
    const hasDecks = decks.length > 0;
    const isLocalMode = mode === 'local';
    const currentPlayerName = isLocalMode
      ? (playerNames[0]?.trim() || 'Player 1')
      : undefined;

    function handleDeckSelect(deckId: string) {
      setSelectedDeckId(deckId);
      if (!isLocalMode) {
        // Synced mode: create match immediately
        handleCreateMatch();
      }
      // Local mode: wait for selectedDeck query → effect auto-advances
    }

    function handleSkip() {
      setSelectedDeckId(null);
      setBattlefieldCards([]);
      if (isLocalMode) {
        setStep(7); // Skip P1 deck + battlefield, go to P2 deck build
      } else {
        handleCreateMatch();
      }
    }

    // Show loading while waiting for P1 deck data in local mode
    if (isLocalMode && selectedDeckId && !selectedDeck) {
      return (
        <div className="space-y-6 max-w-md mx-auto text-center py-16">
          <div className="w-8 h-8 border-2 border-rift-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm lg-text-secondary">Loading deck data...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-md mx-auto">
        {renderBackButton(goBack)}
        {renderProgressDots()}

        <div className="space-y-3">
          <div>
            {isLocalMode && currentPlayerName && (
              <p className="text-sm font-medium text-rift-400 mb-1">{currentPlayerName}</p>
            )}
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

        {createMatch.isPending && (
          <div className="text-center py-4">
            <p className="text-sm lg-text-secondary animate-pulse">Creating match...</p>
          </div>
        )}

        {createMatch.error && (
          <p className="text-sm text-red-400 text-center">{createMatch.error.message}</p>
        )}
      </div>
    );
  }

  // Step 6: P1 battlefield pick (local) OR Share/QR (synced)
  if (step === 6) {
    if (mode === 'local') {
      const playerName = playerNames[0]?.trim() || 'Player 1';
      const p2Name = playerNames[1]?.trim() || 'Player 2';

      return (
        <div className="space-y-6 max-w-md mx-auto">
          {renderBackButton(() => {
            setSelectedDeckId(null);
            setBattlefieldCards([]);
            setP1BattlefieldPick(null);
            setStep(5);
          })}
          {renderProgressDots()}

          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-rift-400">{playerName}</p>
            <h2 className="text-lg font-bold text-white">Choose Your Battlefield</h2>
            <p className="text-sm text-zinc-400">
              Pick 1 battlefield card from your deck.
            </p>
          </div>

          <BattlefieldPicker
            cards={battlefieldCards}
            selectedId={p1BattlefieldPick}
            onSelect={setP1BattlefieldPick}
          />

          <button
            onClick={() => setStep(7)}
            disabled={!p1BattlefieldPick}
            className="lg-btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm &mdash; Pass to {p2Name}
          </button>
        </div>
      );
    }

    // Synced mode: Share / wait
    if (!matchCode) {
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

  // Step 7: P2 deck build (local) OR Battlefield selection (synced)
  if (step === 7) {
    if (mode === 'local') {
      const p2Name = playerNames[1]?.trim() || 'Player 2';

      return (
        <div className="space-y-4 max-w-5xl mx-auto w-full">
          {renderBackButton(() => {
            // Go back to P1 battlefield if they had one, otherwise P1 deck
            setP2TempDeck(null);
            setP2BattlefieldCards([]);
            setStep(battlefieldCards.length > 0 ? 6 : 5);
          })}
          {renderProgressDots()}

          <div>
            <p className="text-sm font-medium text-rift-400 mb-1">{p2Name}</p>
            <h2 className="text-base font-semibold text-white">Build Your Deck</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Build a deck to play with. You need a Legend, 40 main deck cards, 12 runes, and 3 battlefields.
            </p>
          </div>

          <GuestDeckBuilder matchCode="local-pending" onDeckReady={handleP2DeckReady} />

          {createMatch.isPending && (
            <div className="text-center py-4">
              <p className="text-sm lg-text-secondary animate-pulse">Creating match...</p>
            </div>
          )}

          {createMatch.error && (
            <p className="text-sm text-red-400 text-center">{createMatch.error.message}</p>
          )}
        </div>
      );
    }

    // Synced mode: Battlefield selection
    if (matchCode && socket) {
      const resolvedNames = playerNames.map((n, i) => n.trim() || `Player ${i + 1}`);

      return (
        <div className="space-y-6 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Battlefield Selection</h1>
          </div>

          <BattlefieldSelection
            code={matchCode}
            playerId={`player-${firstPlayerIndex}`}
            battlefieldCards={battlefieldCards as never[]}
            required={1}
            socket={socket}
            onRevealed={handleRevealed}
            usedBattlefieldIds={usedBattlefieldIds}
          />
        </div>
      );
    }
  }

  // Step 8: P2 battlefield pick (local only)
  if (step === 8 && mode === 'local') {
    const p2Name = playerNames[1]?.trim() || 'Player 2';

    return (
      <div className="space-y-6 max-w-md mx-auto">
        {renderBackButton(() => {
          setP2BattlefieldPick(null);
          setStep(7);
        })}
        {renderProgressDots()}

        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-rift-400">{p2Name}</p>
          <h2 className="text-lg font-bold text-white">Choose Your Battlefield</h2>
          <p className="text-sm text-zinc-400">
            Pick 1 battlefield card from your deck.
          </p>
        </div>

        <BattlefieldPicker
          cards={p2BattlefieldCards}
          selectedId={p2BattlefieldPick}
          onSelect={setP2BattlefieldPick}
        />

        <button
          onClick={handleCreateMatch}
          disabled={!p2BattlefieldPick || createMatch.isPending}
          className="lg-btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMatch.isPending ? 'Creating match...' : 'Confirm \u2014 Start Match'}
        </button>

        {createMatch.error && (
          <p className="text-sm text-red-400 text-center">{createMatch.error.message}</p>
        )}
      </div>
    );
  }

  // Step 9: Match board (local mode)
  // Build localDecks from P1 saved deck + P2 temp deck
  const localDecksForBoard: LocalDeckEntry[][] | undefined = (() => {
    if (mode !== 'local') return undefined;
    const p1Entries: LocalDeckEntry[] = selectedDeck?.cards
      ? selectedDeck.cards.map((c) => ({
          cardId: c.cardId,
          quantity: c.quantity,
          zone: c.zone,
          card: {
            id: c.card.id,
            name: c.card.name,
            cardType: c.card.cardType ?? null,
            rarity: c.card.rarity ?? 'Common',
            domain: c.card.domain ?? null,
            imageSmall: c.card.imageSmall ?? null,
          },
        }))
      : [];
    const p2Entries: LocalDeckEntry[] = p2TempDeck?.entries
      ? p2TempDeck.entries.map((e) => ({
          cardId: e.cardId,
          quantity: e.quantity,
          zone: e.zone,
          card: {
            id: e.card.id,
            name: e.card.name,
            cardType: e.card.cardType ?? null,
            rarity: e.card.rarity,
            domain: e.card.domain ?? null,
            imageSmall: e.card.imageSmall ?? null,
          },
        }))
      : [];
    return [p1Entries, p2Entries];
  })();

  if (step === 9 && matchCode && localHostPlayerId) {
    return (
      <MatchBoard
        code={matchCode}
        playerId={localHostPlayerId}
        role="player"
        localDecks={localDecksForBoard}
      />
    );
  }

  // Fallback / loading state
  return (
    <div className="space-y-6 max-w-md mx-auto text-center py-16">
      <div className="w-8 h-8 border-2 border-rift-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="lg-text-secondary">{step === 9 ? 'Loading match...' : 'Setting up...'}</p>
    </div>
  );
}
