import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import type { AIStrategy, GameState, PlayerId, RNG, RuleEngine } from '@world-cards/engine';

export interface UseAITurnOptions<TState extends GameState, TMove> {
  state: TState;
  aiPlayerId: PlayerId;
  aiStrategy: AIStrategy<TState, TMove>;
  ruleEngine: RuleEngine<TState, TMove>;
  rng: RNG;
  onMove: (move: TMove) => void;
  thinkingDelayMs?: number;
}

export function useAITurn<TState extends GameState, TMove>({
  state,
  aiPlayerId,
  aiStrategy,
  ruleEngine,
  rng,
  onMove,
  thinkingDelayMs = 600,
}: UseAITurnOptions<TState, TMove>): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const isAITurn = state.players[state.currentPlayerIndex] === aiPlayerId;
    if (!isAITurn || ruleEngine.gameOver(state)) {
      return;
    }

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timeoutRef.current = setTimeout(() => {
        const legalMoves = ruleEngine.getLegalMoves(state, aiPlayerId);
        if (legalMoves.length === 0) return;
        const move = aiStrategy.chooseMove(state, aiPlayerId, legalMoves, rng);
        onMoveRef.current(move);
      }, thinkingDelayMs);
    });

    return () => {
      interactionHandle.cancel();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, aiPlayerId, aiStrategy, ruleEngine, rng, thinkingDelayMs]);
}
