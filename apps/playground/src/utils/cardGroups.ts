import type { Card, Rank, Suit } from '@world-of-cards/engine';
import type { CardGroup } from '../types';

// The gallery deck is generated with includeJokers: false, so 'joker' is
// never passed here in practice; it falls through to 'number' if it were.
export function getCardGroup(rank: Rank): CardGroup {
  if (rank === 'A') return 'ace';
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 'face';
  return 'number';
}

export const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  clubs: 'Clubs',
  diamonds: 'Diamonds',
};

// Used by CardTemplateEditor's per-card preview label (e.g. "7 of Spades") so it's clear
// exactly which of the 52 cards is currently shown while paging through with the ‹/› arrows.
export function formatCardLabel(card: Card): string {
  return card.suit != null ? `${card.rank} of ${SUIT_LABELS[card.suit]}` : card.rank;
}
