import type { ImageSourcePropType } from 'react-native';
import type { Rank, Suit } from '@world-cards/engine';

const KING_OF_SPADES = require('../../assets/card-art/processed/king-of-spades.png');
const KING_OF_HEARTS = require('../../assets/card-art/processed/king-of-hearts.png');
const KING_OF_CLUBS = require('../../assets/card-art/processed/king-of-clubs.png');
const KING_OF_DIAMONDS = require('../../assets/card-art/processed/king-of-diamonds.png');

// Demo-scope coverage: illustrated art exists for K/Q/J only (Aces stay plain), and only
// Spades has an exact match for all three face ranks. Suits lacking exact art reuse their
// King's art across Q/J — see docs/superpowers/specs/2026-07-11-court-card-art-pipeline-design.md.
export const COURT_CARD_ART: Partial<Record<`${Rank}-${Suit}`, ImageSourcePropType>> = {
  'K-spades': KING_OF_SPADES,
  'Q-spades': require('../../assets/card-art/processed/queen-of-spades.png'),
  'J-spades': require('../../assets/card-art/processed/jack-of-spades.png'),
  'K-hearts': KING_OF_HEARTS,
  'Q-hearts': KING_OF_HEARTS,
  'J-hearts': KING_OF_HEARTS,
  'K-clubs': KING_OF_CLUBS,
  'Q-clubs': KING_OF_CLUBS,
  'J-clubs': KING_OF_CLUBS,
  'K-diamonds': KING_OF_DIAMONDS,
  'Q-diamonds': KING_OF_DIAMONDS,
  'J-diamonds': KING_OF_DIAMONDS,
};
