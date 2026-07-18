import React, { useEffect, useRef, useState } from 'react';
import { LayoutAnimation } from 'react-native';
import type { Difficulty, PlayerId, RNG } from '@world-cards/engine';
import { createRng } from '@world-cards/engine';
import { batakDescriptor, BatakState, BatakMove, trickWinnerIndex } from '@world-cards/engine/games/batak';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { useReducedMotion } from '../../components/useReducedMotion';
import { useAITurn } from '../../hooks/useAITurn';
import { useDealSequence } from '../../hooks/useDealSequence';
import { CARD_TRAVEL_DURATION_MS } from '../../table/travelAnimation';
import { BatakSetupView } from './BatakSetupView';
import { BatakTable, PendingBatakPlay, GatheringTrick } from './BatakTable';
import { BatakSettingsModal } from './BatakSettingsModal';

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
// Pause before a non-trick-completing play (1st-3rd card of a trick) commits, giving the new
// play-travel animation (BatakTable's TrickCenter) time to finish before the card's resting state
// takes over — roughly matches CARD_TRAVEL_DURATION_MS (apps/mobile/src/table/travelAnimation.ts).
const PLAY_TRAVEL_DELAY_MS = 300;
// Matches CenteredDecisionModal's own entrance duration (apps/mobile/src/components/
// CenteredDecisionModal.tsx) so the two animations added in this pass feel consistent.
const HAND_REFLOW_DURATION_MS = 220;

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
    const initialState = batakDescriptor.ruleEngine.setup(
      { players: [HUMAN_ID, ...AI_IDS], guaranteeStrongHand: difficulty === 'easy' },
      rng
    );
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
  const [gatheringTrick, setGatheringTrick] = useState<GatheringTrick | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gatherTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealPhase = useDealSequence();
  const reducedMotion = useReducedMotion();

  const aiStrategy = batakDescriptor.aiStrategies[difficulty];

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      if (gatherTimeoutRef.current) clearTimeout(gatherTimeoutRef.current);
    };
  }, []);

  function commitMove(move: BatakMove, playerId: PlayerId, originOffset?: { x: number; y: number }) {
    // Every card play now gets staged (not just the trick-completing 4th) so the new play-travel
    // animation has something to animate from for every play; bid/pass/selectTrump still commit
    // instantly since engine state already reflects them visibly with nothing to bridge.
    if (move.type === 'play') {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      const isTrickCompleting = state.currentTrick.length === 3;
      const delay = isTrickCompleting ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
      // Only the human's own plays remove a card from BatakTable's rendered hand array (see
      // isPendingHuman in BatakTable.tsx) — AI plays never touch it, so they need no trigger.
      if (playerId === HUMAN_ID && !reducedMotion) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(
            HAND_REFLOW_DURATION_MS,
            LayoutAnimation.Types.easeInEaseOut,
            LayoutAnimation.Properties.opacity,
          ),
        );
      }
      setPendingPlay({ playerId, card, originOffset });
      pendingTimeoutRef.current = setTimeout(() => {
        setPendingPlay(null);
        if (!isTrickCompleting) {
          performMove(move);
          return;
        }
        // The trick just completed: snapshot all 4 plays + the winner (computed with the exact same
        // pure function the engine itself uses internally) before committing, so GatherCard has a
        // stable 4-card view to animate away from while engine state is still mid-trick —
        // performMove resolves a completed trick atomically and would otherwise leave nothing to
        // animate.
        const priorEntries = state.currentTrick;
        const priorCards = priorEntries.map(
          (e) => state.table.zones['trick'].cards.find((c) => c.id === e.cardId)!,
        );
        const fullTrickCards = [...priorCards, card];
        const fullTrickPlayerIds = [...priorEntries.map((e) => e.playerId), playerId];
        const winnerPos = trickWinnerIndex(fullTrickCards, state.trumpSuit!);
        const winnerId = fullTrickPlayerIds[winnerPos];
        const entries = fullTrickPlayerIds.map((pid, i) => ({ playerId: pid, card: fullTrickCards[i] }));
        setGatheringTrick({ entries, winnerId });
        gatherTimeoutRef.current = setTimeout(() => {
          performMove(move);
          setGatheringTrick(null);
        }, CARD_TRAVEL_DURATION_MS);
      }, delay);
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

  function handleHumanPlayCard(cardId: string, originOffset?: { x: number; y: number }) {
    commitMove({ type: 'play', cardId }, HUMAN_ID, originOffset);
  }

  const legalMoves =
    state.players[state.currentPlayerIndex] === HUMAN_ID && pendingPlay == null && gatheringTrick == null
      ? batakDescriptor.ruleEngine.getLegalMoves(state, HUMAN_ID)
      : [];

  const gameOver = batakDescriptor.ruleEngine.gameOver(state);

  return (
    <GameScreenLayout
      title="Batak"
      onExit={onBackHome}
      backgroundColor="#0b6623"
      titleColor="#f4c542"
      onSettingsPress={() => setSettingsVisible(true)}>
      <BatakTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={AI_IDS}
        playerNames={PLAYER_NAMES}
        legalMoves={legalMoves}
        onMove={handleHumanMove}
        onPlayCard={handleHumanPlayCard}
        pendingPlay={pendingPlay}
        gatheringTrick={gatheringTrick}
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
      <BatakSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </GameScreenLayout>
  );
}
