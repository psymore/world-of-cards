import { Rank } from '../../core/types';
import { createRankComparator } from '../../core/ranking';

export const BATAK_RANK_ORDER: Rank[] = [
  'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2',
];

// BATAK_RANK_ORDER is ace-first (highest first), but createRankComparator treats a
// lower index as lower-ranked, so its result must be inverted. The explicit zero
// check avoids returning -0, which fails Jest's Object.is-based `.toBe(0)`.
const baseComparator = createRankComparator(BATAK_RANK_ORDER);
export const compareRanks = (a: Rank, b: Rank) => {
  const result = baseComparator(a, b);
  return result === 0 ? 0 : -result;
};
