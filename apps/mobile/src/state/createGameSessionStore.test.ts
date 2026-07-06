import { createGameSessionStore } from './createGameSessionStore';
import type { GameState, RuleEngine } from '@world-cards/engine';

interface CounterState extends GameState {
  count: number;
}

type CounterMove = { type: 'increment' };

const counterRuleEngine: RuleEngine<CounterState, CounterMove> = {
  setup: () => ({
    gameId: 'counter',
    players: ['p1'],
    currentPlayerIndex: 0,
    table: { zones: {} },
    rngState: { seed: 0 },
    status: 'in-progress',
    count: 0,
  }),
  validateMove: () => true,
  performMove: (state, _move) => ({ ...state, count: state.count + 1 }),
  getLegalMoves: () => [{ type: 'increment' }],
  calculateScore: (state) => ({ p1: state.count }),
  determineWinner: () => ['p1'],
  gameOver: () => false,
};

describe('createGameSessionStore', () => {
  it('applies performMove through the provided rule engine', () => {
    const initialState = counterRuleEngine.setup(undefined, undefined as any);
    const useStore = createGameSessionStore(counterRuleEngine, initialState);

    expect(useStore.getState().state.count).toBe(0);
    useStore.getState().performMove({ type: 'increment' });
    expect(useStore.getState().state.count).toBe(1);
  });
});
