import { simulateGames } from './simulate';
import { cardDraftGame, CardDraftSetupOptions } from '../rules/__fixtures__/cardDraftGame';
import { cardDraftEasyAI, cardDraftHardAI } from '../rules/__fixtures__/cardDraftGame.ai';

describe('simulateGames', () => {
  it('runs many games without invariant violations', () => {
    const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 0, rowSize: 6 };
    const result = simulateGames({
      ruleEngine: cardDraftGame,
      setupOptions,
      aiStrategies: { p1: cardDraftEasyAI, p2: cardDraftEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('hard AI beats easy AI significantly more than half the time', () => {
    const setupOptions: CardDraftSetupOptions = { players: ['hard', 'easy'], seed: 0, rowSize: 6 };
    const result = simulateGames({
      ruleEngine: cardDraftGame,
      setupOptions,
      aiStrategies: { hard: cardDraftHardAI, easy: cardDraftEasyAI },
      count: 200,
      seedStart: 1,
    });
    const hardWins = result.winCounts['hard'] ?? 0;
    expect(hardWins).toBeGreaterThan(120);
  });
});
