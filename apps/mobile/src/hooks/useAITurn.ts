import { useEffect, useRef } from 'react';
import type { AIStrategy, GameState, PlayerId, RNG, RuleEngine } from '@world-cards/engine';

export interface UseAITurnOptions<TState extends GameState, TMove> {
  state: TState;
  // Every seat controlled by this AI strategy — one for a single opponent, several for a
  // multi-AI table. Whichever of these is currently up gets to move.
  aiPlayerIds: PlayerId[];
  aiStrategy: AIStrategy<TState, TMove>;
  ruleEngine: RuleEngine<TState, TMove>;
  rng: RNG;
  onMove: (move: TMove, playerId: PlayerId) => void;
  thinkingDelayMs?: number;
}

export function useAITurn<TState extends GameState, TMove>({
  state,
  aiPlayerIds,
  aiStrategy,
  ruleEngine,
  rng,
  onMove,
  thinkingDelayMs = 600,
}: UseAITurnOptions<TState, TMove>): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const currentPlayerId = state.players[state.currentPlayerIndex];
  const isAITurn = aiPlayerIds.includes(currentPlayerId);

  useEffect(() => {
    if (!isAITurn || ruleEngine.gameOver(state)) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      const legalMoves = ruleEngine.getLegalMoves(state, currentPlayerId);
      if (legalMoves.length === 0) return;
      // TEMPORARY DEBUG INSTRUMENTATION — see
      // docs/domains/games/batak/known-issues.md "Animation stutter after several tricks"
      // investigation. Flags a slow AI decision (e.g. minimax) blocking the JS thread.
      const start = __DEV__ ? performance.now() : 0;
      const move = aiStrategy.chooseMove(state, currentPlayerId, legalMoves, rng);
      if (__DEV__) {
        const elapsed = performance.now() - start;
        if (elapsed > 16) {
          console.log(`[BATAK-PERF] AI chooseMove (${currentPlayerId}) took ${elapsed.toFixed(1)}ms`);
        }
      }
      onMoveRef.current(move, currentPlayerId);
    }, thinkingDelayMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isAITurn, currentPlayerId, aiStrategy, ruleEngine, rng, thinkingDelayMs]);
}
