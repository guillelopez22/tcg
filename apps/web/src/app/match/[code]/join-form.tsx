'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { getMatchSocket } from '@/lib/match-socket';
import { GuestDeckBuilder } from './guest-deck-builder';
import { BattlefieldSelection } from './battlefield-selection';
import { MatchBoard } from './match-board';
import type { TempDeck } from './guest-deck-builder';
import type { MatchState } from './battlefield-selection';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchStateOutput = inferRouterOutputs<AppRouter>['match']['getState'];
type CardData = inferRouterOutputs<AppRouter>['card']['list']['items'][number];

type JoinStep =
  | 'loading'
  | 'not-found'
  | 'join-form'
  | 'build-deck'
  | 'battlefield'
  | 'active'
  | 'completed';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JoinFormProps {
  code: string;
}

export function JoinForm({ code }: JoinFormProps) {
  const [joinStep, setJoinStep] = useState<JoinStep>('loading');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [tempDeck, setTempDeck] = useState<TempDeck | null>(null);
  const [battlefieldCards, setBattlefieldCards] = useState<CardData[]>([]);
  const [matchData, setMatchData] = useState<MatchStateOutput | null>(null);
  const [isSocketDisconnected, setIsSocketDisconnected] = useState(false);

  // ---------------------------------------------------------------
  // Load match state on mount
  // ---------------------------------------------------------------

  const {
    data: stateData,
    isLoading: stateLoading,
    isError: stateError,
  } = trpc.match.getState.useQuery({ code }, { retry: 1 });

  useEffect(() => {
    if (stateLoading) return;

    if (stateError || !stateData) {
      setJoinStep('not-found');
      return;
    }

    setMatchData(stateData);

    const status = (stateData as { status?: string }).status;

    if (status === 'completed' || status === 'abandoned') {
      setJoinStep('completed');
    } else {
      setJoinStep('join-form');
    }
  }, [stateLoading, stateError, stateData]);

  // ---------------------------------------------------------------
  // Join mutation
  // ---------------------------------------------------------------

  const joinMatch = trpc.match.join.useMutation({
    onSuccess(data) {
      const pid = (data as { playerId?: string }).playerId ?? `guest-${Date.now()}`;
      setPlayerId(pid);

      // Establish Socket.IO connection
      const socket = getMatchSocket(code);
      socket.on('disconnect', () => setIsSocketDisconnected(true));
      socket.on('connect', () => setIsSocketDisconnected(false));

      if (role === 'spectator') {
        setJoinStep('active');
      } else if (battlefieldCards.length > 0) {
        // Player built a deck — go to battlefield selection (pick 1 from 3)
        setJoinStep('battlefield');
      } else {
        setJoinStep('active');
      }
    },
  });

  // ---------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------

  function handleJoinSubmit() {
    if (!displayName.trim()) return;
    joinMatch.mutate({ code, displayName: displayName.trim(), role });
  }

  function handleDeckReady(deck: TempDeck) {
    setTempDeck(deck);
    // Extract battlefield cards from temp deck
    const bfCards = deck.entries
      .filter((e) => e.card.cardType === 'Battlefield')
      .map((e) => ({
        id: e.card.id,
        name: e.card.name,
        cardType: e.card.cardType,
        rarity: e.card.rarity,
        domain: e.card.domain,
        imageSmall: e.card.imageSmall,
        imageLarge: null,
        cleanName: e.card.name,
        number: '',
        code: '',
        setId: '',
        energyCost: null,
        powerCost: null,
        might: null,
        description: null,
        flavorText: null,
        set: null,
      })) as unknown as CardData[];
    setBattlefieldCards(bfCards);
    // Deck ready — now join the match (which triggers battlefield selection)
    if (!displayName.trim()) return;
    joinMatch.mutate({ code, displayName: displayName.trim(), role });
  }

  function handleRevealed(_state: MatchState) {
    setJoinStep('active');
  }

  // ---------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------

  if (joinStep === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 max-w-md mx-auto w-full">
        <div className="w-8 h-8 border-2 border-rift-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm lg-text-secondary">Loading match...</p>
      </div>
    );
  }

  if (joinStep === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 max-w-md mx-auto w-full">
        <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-700/40 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-white">Match not found</p>
          <p className="text-sm text-zinc-400 mt-1">
            The code <span className="font-mono text-white">{code}</span> does not match an active match.
          </p>
        </div>
        <a href="/" className="lg-btn-secondary text-sm px-4 py-2">
          Go home
        </a>
      </div>
    );
  }

  if (joinStep === 'completed') {
    const summary = matchData as MatchStateOutput & { players?: Array<{ displayName: string; score?: number; isWinner?: boolean }> };
    return (
      <div className="space-y-6 max-w-md mx-auto w-full">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-white">Match Completed</h1>
          <p className="text-sm text-zinc-400">This match has ended</p>
        </div>

        {summary?.players && summary.players.length > 0 && (
          <div className="space-y-2">
            {summary.players.map((p, i) => (
              <div key={i} className="lg-card p-3 flex items-center justify-between">
                <span className="text-sm text-white">{p.displayName}</span>
                {p.isWinner && (
                  <span className="lg-badge bg-yellow-900/30 text-yellow-400 border-yellow-700/40 border text-xs">
                    Winner
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (joinStep === 'build-deck') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-white">Build Your Deck</h1>
          <p className="text-sm text-zinc-400 mt-1">
            You need a valid deck to join as a player.
          </p>
        </div>
        <GuestDeckBuilder matchCode={code} onDeckReady={handleDeckReady} />
      </div>
    );
  }

  if (joinStep === 'battlefield' && playerId) {
    const socket = getMatchSocket(code);

    return (
      <div className="space-y-4 max-w-md mx-auto w-full">
        {/* Reconnecting banner */}
        {isSocketDisconnected && (
          <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-4 py-2 text-sm text-yellow-400 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            Reconnecting...
          </div>
        )}
        <BattlefieldSelection
          code={code}
          playerId={playerId}
          battlefieldCards={battlefieldCards}
          required={1}
          socket={socket}
          onRevealed={handleRevealed}
        />
      </div>
    );
  }

  if (joinStep === 'active' && playerId) {
    return (
      <MatchBoard
        code={code}
        playerId={playerId}
        role={role}
      />
    );
  }

  // join-form step
  return (
    <div className="space-y-6 max-w-md mx-auto w-full">
      <div>
        <h1 className="text-xl font-bold text-white">Join Match</h1>
        <p className="text-sm text-zinc-400 mt-1">Code: <span className="font-mono text-white">{code}</span></p>
      </div>

      {/* Reconnecting banner */}
      {isSocketDisconnected && (
        <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-4 py-2 text-sm text-yellow-400 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          Reconnecting...
        </div>
      )}

      {/* Name input */}
      <div className="space-y-1.5">
        <label className="text-sm text-zinc-400">Your name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your name"
          maxLength={50}
          onKeyDown={(e) => e.key === 'Enter' && handleJoinSubmit()}
          className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rift-500"
        />
      </div>

      {/* Role selection */}
      <div className="space-y-1.5">
        <label className="text-sm text-zinc-400">Join as</label>
        <div className="grid grid-cols-2 gap-2">
          {(['player', 'spectator'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`py-3 rounded-lg border-2 text-sm font-medium transition-all capitalize ${
                role === r
                  ? 'border-rift-500 bg-rift-900/20 text-white'
                  : 'border-surface-border text-zinc-400 hover:border-surface-hover hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {role === 'player' && (
          <p className="text-xs text-zinc-500">
            You will need to build a temporary deck before joining.
          </p>
        )}
        {role === 'spectator' && (
          <p className="text-xs text-zinc-500">
            Read-only view of the match. No deck required.
          </p>
        )}
      </div>

      {/* Join or proceed to deck builder */}
      <button
        onClick={role === 'player' ? () => setJoinStep('build-deck') : handleJoinSubmit}
        disabled={!displayName.trim() || joinMatch.isPending}
        className="lg-btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {joinMatch.isPending
          ? 'Joining...'
          : role === 'player'
          ? 'Continue to Deck Builder'
          : 'Join as Spectator'}
      </button>

      {joinMatch.error && (
        <p className="text-sm text-red-400 text-center">{joinMatch.error.message}</p>
      )}
    </div>
  );
}
