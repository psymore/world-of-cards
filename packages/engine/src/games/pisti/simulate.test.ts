import { simulateGames } from '../../testing/simulate';
import { pistiGame } from './rules';
import { PistiSetupOptions } from './types';
import { pistiEasyAI } from './ai/easy';
import { pistiHardAI } from './ai/hard';

describe('pisti simulateGames', () => {
  it('runs many easy-vs-easy games without invariant violations', () => {
    const setupOptions: PistiSetupOptions = { players: ['p1', 'p2'] };
    const result = simulateGames({
      ruleEngine: pistiGame,
      setupOptions,
      aiStrategies: { p1: pistiEasyAI, p2: pistiEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('hard AI beats easy AI significantly more than half the time', () => {
    const setupOptions: PistiSetupOptions = { players: ['hard', 'easy'] };
    const result = simulateGames({
      ruleEngine: pistiGame,
      setupOptions,
      aiStrategies: { hard: pistiHardAI, easy: pistiEasyAI },
      count: 200,
      seedStart: 1,
    });
    const hardWins = result.winCounts['hard'] ?? 0;
    expect(hardWins).toBeGreaterThan(120);
  });

  it('runs many 4-player easy-vs-easy games without invariant violations', () => {
    const setupOptions: PistiSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    const result = simulateGames({
      ruleEngine: pistiGame,
      setupOptions,
      aiStrategies: { p1: pistiEasyAI, p2: pistiEasyAI, p3: pistiEasyAI, p4: pistiEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('runs many 4-player team games without invariant violations, and teammates always finish with equal scores', () => {
    const setupOptions: PistiSetupOptions = {
      players: ['p1', 'p2', 'p3', 'p4'],
      teams: [
        ['p1', 'p3'],
        ['p2', 'p4'],
      ],
    };
    const result = simulateGames({
      ruleEngine: pistiGame,
      setupOptions,
      aiStrategies: { p1: pistiEasyAI, p2: pistiEasyAI, p3: pistiEasyAI, p4: pistiEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
    for (const state of result.finalStates) {
      const score = pistiGame.calculateScore(state);
      expect(score['p1']).toBe(score['p3']);
      expect(score['p2']).toBe(score['p4']);
    }
  });
});
