import type { Suit } from '@world-cards/engine';

export function suitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#c0392b' : '#111';
}
