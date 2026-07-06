import { RNG } from '../core/rng';

export function pickRandom<T>(items: T[], rng: RNG): T {
  if (items.length === 0) {
    throw new Error('pickRandom: cannot pick from an empty list');
  }
  const index = Math.floor(rng.next() * items.length);
  return items[index];
}

export function pickWeighted<T>(items: T[], weights: number[], rng: RNG): T {
  if (items.length !== weights.length) {
    throw new Error('pickWeighted: items and weights must be the same length');
  }
  if (items.length === 0) {
    throw new Error('pickWeighted: cannot pick from an empty list');
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  let threshold = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return items[i];
  }
  return items[items.length - 1];
}
