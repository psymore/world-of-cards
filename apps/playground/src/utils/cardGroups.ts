import type { Rank } from '@world-cards/engine';
import type { CardGroup } from '../types';

// The gallery deck is generated with includeJokers: false, so 'joker' is
// never passed here in practice; it falls through to 'number' if it were.
export function getCardGroup(rank: Rank): CardGroup {
  if (rank === 'A') return 'ace';
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 'face';
  return 'number';
}
