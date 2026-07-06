import { pickRandom, pickWeighted } from './weightedRandom';
import { createRng } from '../core/rng';

describe('pickRandom', () => {
  it('always returns an item from the list', () => {
    const rng = createRng(5);
    for (let i = 0; i < 20; i++) {
      expect(['a', 'b', 'c']).toContain(pickRandom(['a', 'b', 'c'], rng));
    }
  });

  it('throws for an empty list', () => {
    expect(() => pickRandom([], createRng(1))).toThrow();
  });
});

describe('pickWeighted', () => {
  it('always picks the only item when it has all the weight', () => {
    const rng = createRng(1);
    expect(pickWeighted(['a', 'b'], [1, 0], rng)).toBe('a');
  });

  it('throws when items and weights lengths differ', () => {
    expect(() => pickWeighted(['a'], [1, 2], createRng(1))).toThrow();
  });
});
