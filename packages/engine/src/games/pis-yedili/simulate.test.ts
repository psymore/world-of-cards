import { simulateGames } from '../../testing/simulate';
import { pisYedeliGame } from './rules';
import { PisYedeliSetupOptions } from './types';
import { pisYedeliEasyAI } from './ai/easy';
import { pisYedeliHardAI } from './ai/hard';

describe('pis-yedili simulateGames', () => {
  it('runs many 2-player easy-vs-easy games without invariant violations', () => {
    const setupOptions: PisYedeliSetupOptions = { players: ['p1', 'p2'] };
    const result = simulateGames({
      ruleEngine: pisYedeliGame,
      setupOptions,
      aiStrategies: { p1: pisYedeliEasyAI, p2: pisYedeliEasyAI },
      count: 500,
      seedStart: 1,
      maxMoves: 5000,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('runs many 4-player easy-vs-easy games without invariant violations', () => {
    const setupOptions: PisYedeliSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    const result = simulateGames({
      ruleEngine: pisYedeliGame,
      setupOptions,
      aiStrategies: { p1: pisYedeliEasyAI, p2: pisYedeliEasyAI, p3: pisYedeliEasyAI, p4: pisYedeliEasyAI },
      count: 500,
      seedStart: 1,
      maxMoves: 5000,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('hard AI beats easy AI significantly more than half the time', () => {
    const setupOptions: PisYedeliSetupOptions = { players: ['hard', 'easy'] };
    const result = simulateGames({
      ruleEngine: pisYedeliGame,
      setupOptions,
      aiStrategies: { hard: pisYedeliHardAI, easy: pisYedeliEasyAI },
      count: 200,
      seedStart: 1,
      maxMoves: 5000,
    });
    const hardWins = result.winCounts['hard'] ?? 0;
    expect(hardWins).toBeGreaterThan(120);
  });
});
