import React, { useEffect, useRef, useState } from 'react';
import type { Difficulty, PlayerId, RNG } from '@world-cards/engine';
import { createRng } from '@world-cards/engine';
import { batakDescriptor, BatakState, BatakMove } from '@world-cards/engine/games/batak';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { useAITurn } from '../../hooks/useAITurn';
import { useReducedMotion } from '../../components/useReducedMotion';
import { BatakSetupView } from './BatakSetupView';
import { BatakTable, BatakDealPhase, PendingBatakPlay } from './BatakTable';

const HUMAN_ID: PlayerId = 'human';
const AI_IDS: PlayerId[] = ['ai-1', 'ai-2', 'ai-3'];
const PLAYER_NAMES: Record<PlayerId, string> = {
  [HUMAN_ID]: 'You',
  'ai-1': 'AI 1',
  'ai-2': 'AI 2',
  'ai-3': 'AI 3',
};

// Pause before a trick-completing 4th play actually commits, so the full 4-card trick is
// readable before it sweeps to the winner's pile. batakGame.performMove resolves a completed
// trick atomically (computes the winner and sweeps to won-<winner> within one call), so without
// this pause the UI would show the 4th card appear and the whole trick vanish in the same
// instant, with no way to see what everyone played.
const TRICK_COMPLETION_PAUSE_MS = 1100;

const SHUFFLE_MS = 1000;
const CUT_MS = 700;
const DEAL_PAUSE_MS = 1200;

// Runs once per ActiveGame mount (i.e. once per hand — a fresh mount happens on every
// startGame call, both the initial game and every "Play Again", via BatakScreen's
// key={sessionKey}), so no extra reset logic is needed here: a new hand always gets a fresh
// deal sequence for free.
function useDealSequence(): BatakDealPhase {
  const reducedMotion = useReducedMotion();
  const [dealPhase, setDealPhase] = useState<BatakDealPhase>(reducedMotion ? 'revealing' : 'shuffling');

  useEffect(() => {
    if (reducedMotion) {
      setDealPhase('revealing');
      return;
    }
    setDealPhase('shuffling');
    const toCutting = setTimeout(() => setDealPhase('cutting'), SHUFFLE_MS);
    const toRevealing = setTimeout(() => setDealPhase('revealing'), SHUFFLE_MS + CUT_MS + DEAL_PAUSE_MS);
    return () => {
      clearTimeout(toCutting);
      clearTimeout(toRevealing);
    };
  }, [reducedMotion]);

  return dealPhase;
}

export interface BatakScreenProps {
  onExitToHome: () => void;
}

interface BatakSession {
  difficulty: Difficulty;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
}

export function BatakScreen({ onExitToHome }: BatakScreenProps) {
  const [session, setSession] = useState<BatakSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty) {
    const rng = createRng(Date.now());
    const initialState = batakDescriptor.ruleEngine.setup({ players: [HUMAN_ID, ...AI_IDS] }, rng);
    const useSessionStore = createGameSessionStore(batakDescriptor.ruleEngine, initialState);
    setSession({ difficulty, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <BatakSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} onBack={onExitToHome} />;
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() => startGame(session.difficulty)}
      onBackHome={onExitToHome}
    />
  );
}

interface ActiveGameProps {
  difficulty: Difficulty;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({ difficulty, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const [pendingPlay, setPendingPlay] = useState<PendingBatakPlay | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealPhase = useDealSequence();

  const aiStrategy = batakDescriptor.aiStrategies[difficulty];

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  function commitMove(move: BatakMove, playerId: PlayerId) {
    // Only a card play can be the trick-completing 4th card; bid/pass/selectTrump never need
    // staging since engine state already reflects them visibly with nothing to bridge.
    if (move.type === 'play' && state.currentTrick.length === 3) {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      setPendingPlay({ playerId, card });
      pendingTimeoutRef.current = setTimeout(() => {
        performMove(move);
        setPendingPlay(null);
      }, TRICK_COMPLETION_PAUSE_MS);
      return;
    }
    performMove(move);
  }

  useAITurn({
    state,
    aiPlayerIds: AI_IDS,
    aiStrategy,
    ruleEngine: batakDescriptor.ruleEngine,
    rng,
    onMove: commitMove,
  });

  function handleHumanMove(move: BatakMove) {
    commitMove(move, HUMAN_ID);
  }

  const legalMoves =
    state.players[state.currentPlayerIndex] === HUMAN_ID && pendingPlay == null
      ? batakDescriptor.ruleEngine.getLegalMoves(state, HUMAN_ID)
      : [];

  const gameOver = batakDescriptor.ruleEngine.gameOver(state);

  return (
    <GameScreenLayout title="Batak" onExit={onBackHome} backgroundColor="#0b6623" titleColor="#f4c542">
      <BatakTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={AI_IDS}
        playerNames={PLAYER_NAMES}
        legalMoves={legalMoves}
        onMove={handleHumanMove}
        pendingPlay={pendingPlay}
        dealPhase={dealPhase}
      />
      {gameOver && (
        <GameResultModal
          scores={batakDescriptor.ruleEngine.calculateScore(state)}
          winners={batakDescriptor.ruleEngine.determineWinner(state) ?? []}
          playerNames={PLAYER_NAMES}
          humanPlayerId={HUMAN_ID}
          onPlayAgain={onPlayAgain}
          onBackHome={onBackHome}
        />
      )}
    </GameScreenLayout>
  );
}
