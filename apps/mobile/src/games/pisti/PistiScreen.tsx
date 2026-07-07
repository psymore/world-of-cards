import React, { useState } from 'react';
import { createRng, RNG, Difficulty, PlayerId } from '@world-cards/engine';
import { pistiDescriptor, PistiState, PistiMove } from '@world-cards/engine/games/pisti';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { PistiSetupView } from './PistiSetupView';
import { PistiTable } from './PistiTable';
import { useAITurn } from './useAITurn';

const HUMAN_ID: PlayerId = 'human';
const AI_ID: PlayerId = 'ai';
const PLAYER_NAMES: Record<PlayerId, string> = { [HUMAN_ID]: 'You', [AI_ID]: 'Computer' };

export interface PistiScreenProps {
  onExitToHome: () => void;
}

interface PistiSession {
  difficulty: Difficulty;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<PistiState, PistiMove>>;
}

export function PistiScreen({ onExitToHome }: PistiScreenProps) {
  const [session, setSession] = useState<PistiSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty) {
    const rng = createRng(Date.now());
    const initialState = pistiDescriptor.ruleEngine.setup({ players: [HUMAN_ID, AI_ID] }, rng);
    const useSessionStore = createGameSessionStore(pistiDescriptor.ruleEngine, initialState);
    setSession({ difficulty, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <PistiSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} />;
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
  useSessionStore: ReturnType<typeof createGameSessionStore<PistiState, PistiMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({ difficulty, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const [bannerText, setBannerText] = useState<string | null>(null);

  const aiStrategy = pistiDescriptor.aiStrategies[difficulty];

  function applyMove(move: PistiMove, playerId: PlayerId) {
    const bonusBefore = state.pistiBonusPoints[playerId];
    const capturedBefore = state.table.zones[`captured-${playerId}`].cards.length;

    performMove(move);

    const nextState = useSessionStore.getState().state;
    const capturedAfter = nextState.table.zones[`captured-${playerId}`].cards.length;
    const bonusAfter = nextState.pistiBonusPoints[playerId];
    const who = playerId === HUMAN_ID ? 'You' : 'Opponent';

    if (capturedAfter > capturedBefore) {
      const bonusGained = bonusAfter - bonusBefore;
      if (bonusGained === 20) {
        setBannerText('Double Pişti! +20');
      } else if (bonusGained === 10) {
        setBannerText('Pişti! +10');
      } else {
        const gained = capturedAfter - capturedBefore;
        setBannerText(`${who} captured ${gained} card${gained === 1 ? '' : 's'}!`);
      }
    } else {
      setBannerText(null);
    }
  }

  useAITurn({
    state,
    aiPlayerId: AI_ID,
    aiStrategy,
    ruleEngine: pistiDescriptor.ruleEngine,
    rng,
    onMove: (move) => applyMove(move, AI_ID),
  });

  function handlePlayCard(cardId: string) {
    applyMove({ type: 'play', cardId }, HUMAN_ID);
  }

  const gameOver = pistiDescriptor.ruleEngine.gameOver(state);

  return (
    <GameScreenLayout title="Pişti" onExit={onBackHome}>
      <PistiTable
        state={state}
        humanPlayerId={HUMAN_ID}
        aiPlayerId={AI_ID}
        onPlayCard={handlePlayCard}
        bannerText={bannerText}
      />
      {gameOver && (
        <GameResultModal
          scores={pistiDescriptor.ruleEngine.calculateScore(state)}
          winners={pistiDescriptor.ruleEngine.determineWinner(state) ?? []}
          playerNames={PLAYER_NAMES}
          humanPlayerId={HUMAN_ID}
          onPlayAgain={onPlayAgain}
          onBackHome={onBackHome}
        />
      )}
    </GameScreenLayout>
  );
}
