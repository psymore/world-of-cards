import { create, StoreApi, UseBoundStore } from 'zustand';
import type { GameState, RuleEngine } from '@world-of-cards/engine';

export interface GameSessionStore<TState extends GameState, TMove> {
  state: TState;
  performMove: (move: TMove) => void;
}

export function createGameSessionStore<TState extends GameState, TMove>(
  ruleEngine: RuleEngine<TState, TMove>,
  initialState: TState
): UseBoundStore<StoreApi<GameSessionStore<TState, TMove>>> {
  return create<GameSessionStore<TState, TMove>>((set, get) => ({
    state: initialState,
    performMove: (move: TMove) => {
      // TEMPORARY DEBUG INSTRUMENTATION — see docs/domains/games/batak/known-issues.md
      // "Animation stutter after several tricks" investigation. Flags a JS-thread block on the
      // rule-engine transition itself (as opposed to rendering/animation).
      const start = __DEV__ ? performance.now() : 0;
      const next = ruleEngine.performMove(get().state, move);
      if (__DEV__) {
        const elapsed = performance.now() - start;
        if (elapsed > 8) {
          console.log(`[BATAK-PERF] performMove took ${elapsed.toFixed(1)}ms`);
        }
      }
      set({ state: next });
    },
  }));
}
