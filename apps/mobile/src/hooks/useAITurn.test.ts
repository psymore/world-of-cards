import { renderHook } from '@testing-library/react-native';
import { useAITurn } from './useAITurn';
import type { GameState, RuleEngine, AIStrategy, RNG } from '@world-of-cards/engine';

interface FakeState extends GameState {
  count: number;
}
type FakeMove = { type: 'noop' };

function makeState(currentPlayerIndex: number, status: GameState['status'] = 'in-progress'): FakeState {
  return {
    gameId: 'fake',
    players: ['human', 'ai'],
    currentPlayerIndex,
    table: { zones: {} },
    rngState: { seed: 0 },
    status,
    count: 0,
  };
}

const fakeRuleEngine: RuleEngine<FakeState, FakeMove> = {
  setup: () => makeState(0),
  validateMove: () => true,
  performMove: (state) => state,
  getLegalMoves: () => [{ type: 'noop' }],
  calculateScore: () => ({ human: 0, ai: 0 }),
  determineWinner: () => null,
  gameOver: (state) => state.status === 'finished',
};

const fakeAIStrategy: AIStrategy<FakeState, FakeMove> = {
  difficulty: 'easy',
  chooseMove: (_state, _playerId, legalMoves) => legalMoves[0],
};

const fakeRng: RNG = { next: () => 0.5, getState: () => ({ seed: 0 }) };

describe('useAITurn', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('calls onMove with the AI move after the thinking delay once it is the AI turn', async () => {
    const onMove = jest.fn();
    renderHook(() =>
      useAITurn({
        state: makeState(1),
        aiPlayerIds: ['ai'],
        aiStrategy: fakeAIStrategy,
        ruleEngine: fakeRuleEngine,
        rng: fakeRng,
        onMove,
        thinkingDelayMs: 600,
      })
    );

    expect(onMove).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(600);
    expect(onMove).toHaveBeenCalledWith({ type: 'noop' }, 'ai');
  });

  it('does not schedule a move when it is the human turn', async () => {
    const onMove = jest.fn();
    renderHook(() =>
      useAITurn({
        state: makeState(0),
        aiPlayerIds: ['ai'],
        aiStrategy: fakeAIStrategy,
        ruleEngine: fakeRuleEngine,
        rng: fakeRng,
        onMove,
      })
    );

    await jest.advanceTimersByTimeAsync(2000);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not schedule a move when the game is already over', async () => {
    const onMove = jest.fn();
    renderHook(() =>
      useAITurn({
        state: makeState(1, 'finished'),
        aiPlayerIds: ['ai'],
        aiStrategy: fakeAIStrategy,
        ruleEngine: fakeRuleEngine,
        rng: fakeRng,
        onMove,
      })
    );

    await jest.advanceTimersByTimeAsync(2000);
    expect(onMove).not.toHaveBeenCalled();
  });
});
