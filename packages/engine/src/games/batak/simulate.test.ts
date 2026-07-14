import { simulateGames } from '../../testing/simulate';
import { batakGame } from './rules';
import { BatakSetupOptions } from './types';
import { batakEasyAI } from './ai/easy';
import { batakHardAI } from './ai/hard';

describe('batak simulateGames', () => {
  it('runs many 4-player easy-vs-easy-vs-easy-vs-easy games without invariant violations', () => {
    const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    const result = simulateGames({
      ruleEngine: batakGame,
      setupOptions,
      aiStrategies: { p1: batakEasyAI, p2: batakEasyAI, p3: batakEasyAI, p4: batakEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('hard AI beats easy AI significantly more than the 25% pure-chance baseline in a 4-player free-for-all', () => {
    const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    const result = simulateGames({
      ruleEngine: batakGame,
      setupOptions,
      aiStrategies: { p1: batakHardAI, p2: batakEasyAI, p3: batakEasyAI, p4: batakEasyAI },
      count: 200,
      seedStart: 1,
    });
    const hardWins = result.winCounts['p1'] ?? 0;
    expect(hardWins).toBeGreaterThan(70);
  });
});
