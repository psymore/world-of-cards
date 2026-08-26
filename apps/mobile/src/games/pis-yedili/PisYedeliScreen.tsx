import React, { useMemo, useState } from 'react';
import { createRng, RNG, Difficulty, PlayerId } from '@world-of-cards/engine';
import { pisYedeliDescriptor, PisYedeliState, PisYedeliMove } from '@world-of-cards/engine/games/pis-yedili';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { PisYedeliSetupView, PisYedeliPlayerCount } from './PisYedeliSetupView';
import { PisYedeliTable } from './PisYedeliTable';
import { useAITurn } from '../../hooks/useAITurn';

const HUMAN_ID: PlayerId = 'human';

function buildAiIds(playerCount: PisYedeliPlayerCount): PlayerId[] {
  return Array.from({ length: playerCount - 1 }, (_, i) => `ai-${i + 1}`);
}

function buildPlayerNames(aiIds: PlayerId[]): Record<PlayerId, string> {
  const names: Record<PlayerId, string> = { [HUMAN_ID]: 'You' };
  if (aiIds.length === 1) {
    names[aiIds[0]] = 'Computer';
  } else {
    aiIds.forEach((id, i) => {
      names[id] = `AI ${i + 1}`;
    });
  }
  return names;
}

export interface PisYedeliScreenProps {
  onExitToHome: () => void;
}

interface PisYedeliSession {
  difficulty: Difficulty;
  aiIds: PlayerId[];
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<PisYedeliState, PisYedeliMove>>;
}

export function PisYedeliScreen({ onExitToHome }: PisYedeliScreenProps) {
  const [session, setSession] = useState<PisYedeliSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty, playerCount: PisYedeliPlayerCount) {
    const aiIds = buildAiIds(playerCount);
    const rng = createRng(Date.now());
    const initialState = pisYedeliDescriptor.ruleEngine.setup({ players: [HUMAN_ID, ...aiIds] }, rng);
    const useSessionStore = createGameSessionStore(pisYedeliDescriptor.ruleEngine, initialState);
    setSession({ difficulty, aiIds, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <PisYedeliSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} onBack={onExitToHome} />;
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      aiIds={session.aiIds}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() => startGame(session.difficulty, (session.aiIds.length + 1) as PisYedeliPlayerCount)}
      onBackHome={onExitToHome}
    />
  );
}

interface ActiveGameProps {
  difficulty: Difficulty;
  aiIds: PlayerId[];
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<PisYedeliState, PisYedeliMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({ difficulty, aiIds, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const playerNames = useMemo(() => buildPlayerNames(aiIds), [aiIds]);
  const aiStrategy = pisYedeliDescriptor.aiStrategies[difficulty];

  useAITurn({
    state,
    aiPlayerIds: aiIds,
    aiStrategy,
    ruleEngine: pisYedeliDescriptor.ruleEngine,
    rng,
    onMove: (move) => performMove(move),
  });

  const gameOver = pisYedeliDescriptor.ruleEngine.gameOver(state);
  const legalMoves = pisYedeliDescriptor.ruleEngine.getLegalMoves(state, HUMAN_ID);

  return (
    <GameScreenLayout
      title="Pis Yedili"
      onExit={onBackHome}
      backgroundColor="#000000"
      titleColor="#f4c542"
      darkGlowHeader
      darkGlowHeaderColor="#000000">
      <PisYedeliTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
        legalMoves={legalMoves}
        onPerformMove={performMove}
      />
      {gameOver && (
        <GameResultModal
          scores={pisYedeliDescriptor.ruleEngine.calculateScore(state)}
          winners={pisYedeliDescriptor.ruleEngine.determineWinner(state) ?? []}
          playerNames={playerNames}
          humanPlayerId={HUMAN_ID}
          onPlayAgain={onPlayAgain}
          onBackHome={onBackHome}
        />
      )}
    </GameScreenLayout>
  );
}
