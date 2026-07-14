import { compareRanks, BATAK_RANK_ORDER } from './ranking';

describe('BATAK_RANK_ORDER', () => {
  it('has all 13 non-joker ranks, ace first (highest)', () => {
    expect(BATAK_RANK_ORDER).toEqual([
      'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2',
    ]);
  });
});

describe('compareRanks', () => {
  it('ranks ace above king', () => {
    expect(compareRanks('A', 'K')).toBeGreaterThan(0);
  });

  it('ranks 10 above 9', () => {
    expect(compareRanks('10', '9')).toBeGreaterThan(0);
  });

  it('ranks 2 as the lowest', () => {
    expect(compareRanks('2', '3')).toBeLessThan(0);
    expect(compareRanks('2', 'A')).toBeLessThan(0);
  });

  it('returns zero for equal ranks', () => {
    expect(compareRanks('Q', 'Q')).toBe(0);
  });

  it('throws for a joker, since Batak is played without jokers', () => {
    expect(() => compareRanks('joker', 'A')).toThrow();
  });
});
