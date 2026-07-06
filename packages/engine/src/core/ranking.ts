import { Rank } from './types';

export function createRankComparator(order: Rank[]): (a: Rank, b: Rank) => number {
  const indexOf = new Map(order.map((rank, index) => [rank, index]));
  return (a: Rank, b: Rank): number => {
    const ai = indexOf.get(a);
    const bi = indexOf.get(b);
    if (ai === undefined || bi === undefined) {
      throw new Error(`createRankComparator: rank not in order (${a}, ${b})`);
    }
    return ai - bi;
  };
}
