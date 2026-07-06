import { create, StoreApi, UseBoundStore } from 'zustand';
import type { GameState, RuleEngine } from '@world-cards/engine';

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
      const next = ruleEngine.performMove(get().state, move);
      set({ state: next });
    },
  }));
}
