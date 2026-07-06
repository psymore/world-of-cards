import { emptyStats, recordGameResult } from './types';

describe('recordGameResult', () => {
  it('increments gamesPlayed and wins on a win', () => {
    const next = recordGameResult(emptyStats, { won: true, score: 42 });
    expect(next).toEqual({ gamesPlayed: 1, wins: 1, losses: 0, highScore: 42 });
  });

  it('increments gamesPlayed and losses on a loss', () => {
    const next = recordGameResult(emptyStats, { won: false, score: 10 });
    expect(next).toEqual({ gamesPlayed: 1, wins: 0, losses: 1, highScore: 10 });
  });

  it('keeps the highest score seen across multiple results', () => {
    const first = recordGameResult(emptyStats, { won: true, score: 50 });
    const second = recordGameResult(first, { won: false, score: 20 });
    expect(second.highScore).toBe(50);
  });

  it('does not mutate the input stats object', () => {
    const before = { ...emptyStats };
    recordGameResult(emptyStats, { won: true, score: 5 });
    expect(emptyStats).toEqual(before);
  });
});
