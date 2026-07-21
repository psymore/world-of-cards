import React, { useEffect, useRef, useState } from 'react';
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
import type { BatakVariant } from './batakVariant';

const HUMAN_ID: PlayerId = 'human';

const AI_IDS_BY_VARIANT: Record<BatakVariant, PlayerId[]> = {
  standard: ['ai-1', 'ai-2', 'ai-3'],
  gomeli: ['ai-1', 'ai-2'],
};

const PLAYER_NAMES_BY_VARIANT: Record<BatakVariant, Record<PlayerId, string>> = {
  standard: {
    [HUMAN_ID]: 'You',
    'ai-1': 'AI 1',
    'ai-2': 'AI 2',
    'ai-3': 'AI 3',
  },
  gomeli: {
    [HUMAN_ID]: 'You',
    'ai-1': 'AI 1',
    'ai-2': 'AI 2',
  },
};

// Pause before a trick-completing 4th play actually commits, so the full 4-card trick is
// readable before it sweeps to the winner's pile. batakGame.performMove resolves a completed
// trick atomically (computes the winner and sweeps to won-<winner> within one call), so without
// this pause the UI would show the 4th card appear and the whole trick vanish in the same
// instant, with no way to see what everyone played.
const TRICK_COMPLETION_PAUSE_MS = 1100;
// Pause before a non-trick-completing play (1st-3rd card of a trick) commits, giving the new
// play-travel animation (BatakTable's TrickCenter) time to finish before the card's resting state
// takes over. Derived directly from CARD_TRAVEL_DURATION_MS (the actual TravelCard flight
// duration) plus a small buffer, rather than a separately hand-picked number — this was
// previously a bare 300 next to a 530ms flight, so the commit fired ~230ms before TravelCard
// finished, snapping the card the rest of the way to its resting spot instead of easing in.
const PLAY_TRAVEL_DELAY_MS = CARD_TRAVEL_DURATION_MS + 40;

export interface BatakScreenProps {
  onExitToHome: () => void;
}

interface BatakSession {
  difficulty: Difficulty;
  variant: BatakVariant;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
}

export function BatakScreen({ onExitToHome }: BatakScreenProps) {
  const [session, setSession] = useState<BatakSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty, variant: BatakVariant) {
    const rng = createRng(Date.now());
    const aiIds = AI_IDS_BY_VARIANT[variant];
    const initialState = batakDescriptor.ruleEngine.setup(
      { players: [HUMAN_ID, ...aiIds], guaranteeStrongHand: difficulty === 'easy' },
      rng
    );
    const useSessionStore = createGameSessionStore(batakDescriptor.ruleEngine, initialState);
    setSession({ difficulty, variant, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <BatakSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} onBack={onExitToHome} />;
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      variant={session.variant}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() => startGame(session.difficulty, session.variant)}
      onBackHome={onExitToHome}
    />
  );
}

interface ActiveGameProps {
  difficulty: Difficulty;
  variant: BatakVariant;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({ difficulty, variant, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const aiIds = AI_IDS_BY_VARIANT[variant];
  const playerNames = PLAYER_NAMES_BY_VARIANT[variant];
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
      // Generalized from the old hardcoded `=== 3` (which only worked for the fixed 4-player
      // game): a trick completes once every player but the current one has already played.
      const isTrickCompleting = state.currentTrick.length === state.players.length - 1;
      const delay = isTrickCompleting ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
      // The human hand's own reflow (remaining cards sliding/rising into their new slots) is now
      // animated internally by BatakTable's AnimatedFanCard, driven directly off the shrinking
      // hand array — no LayoutAnimation trigger needed here anymore.
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
        //
        // The non-null assertions below are safe specifically because `state` here is the
        // pre-4th-play snapshot (captured when this commitMove call started, before performMove
        // has run): the trick zone is guaranteed to already hold the 3 prior cards, and trumpSuit
        // is always set once the game has reached the playing phase.
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
        if (reducedMotion) {
          // GatherCard jumps straight to its faded-out end state under reduced motion (see
          // GatherCard.tsx), so there's nothing left to wait for — arming the full-duration timer
          // here would just leave an empty trick center for CARD_TRAVEL_DURATION_MS before the
          // score updates, with no animation happening to justify the wait.
          performMove(move);
          setGatheringTrick(null);
        } else {
          gatherTimeoutRef.current = setTimeout(() => {
            performMove(move);
            setGatheringTrick(null);
          }, CARD_TRAVEL_DURATION_MS);
        }
      }, delay);
      return;
    }
    performMove(move);
  }

  useAITurn({
    state,
    aiPlayerIds: aiIds,
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
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
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
          playerNames={playerNames}
          humanPlayerId={HUMAN_ID}
          onPlayAgain={onPlayAgain}
          onBackHome={onBackHome}
        />
      )}
      <BatakSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </GameScreenLayout>
  );
}
