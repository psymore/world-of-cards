import { createRankComparator } from './ranking';

describe('createRankComparator', () => {
  it('orders ranks according to the given order (ace-high example)', () => {
    const compare = createRankComparator([
      '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
    ]);
    expect(compare('A', 'K')).toBeGreaterThan(0);
    expect(compare('2', '3')).toBeLessThan(0);
    expect(compare('Q', 'Q')).toBe(0);
  });

  it('throws for a rank not present in the order', () => {
    const compare = createRankComparator(['A', 'K']);
    expect(() => compare('A', 'joker')).toThrow();
  });
});
