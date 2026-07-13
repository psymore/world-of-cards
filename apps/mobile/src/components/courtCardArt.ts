import type { ImageSourcePropType } from 'react-native';
import type { Rank, Suit } from '@world-cards/engine';

// Full AI-generated art set (docs/superpowers/specs/2026-07-11-court-card-art-pipeline-design.md
// predates this set — it covered demo-scope K/Q/J-with-reuse only). This set has dedicated K/Q/J
// art for all four suits plus Aces where art exists (hearts and spades only — clubs/diamonds
// aces fall back to the plain suit watermark, same as every other non-court rank).
export const COURT_CARD_ART: Partial<Record<`${Rank}-${Suit}`, ImageSourcePropType>> = {
  'A-hearts': require('../../assets/card-art/processed/ai-generated/hearts-nobg/ace-of-hearts-Photoroom.png'),
  'K-hearts': require('../../assets/card-art/processed/ai-generated/hearts-nobg/king-of-hearts-Photoroom.png'),
  'Q-hearts': require('../../assets/card-art/processed/ai-generated/hearts-nobg/queen-of-hearts-Photoroom.png'),
  'J-hearts': require('../../assets/card-art/processed/ai-generated/hearts-nobg/jack-of-hearts-Photoroom.png'),

  'A-spades': require('../../assets/card-art/processed/ai-generated/spades-nobg/ace-of-spades.png'),
  'K-spades': require('../../assets/card-art/processed/ai-generated/spades-nobg/king-of-spades-Photoroom.png'),
  'Q-spades': require('../../assets/card-art/processed/ai-generated/spades-nobg/queen-of-spades-Photoroom.png'),
  'J-spades': require('../../assets/card-art/processed/ai-generated/spades-nobg/jack-of-spades-Photoroom.png'),

  'K-clubs': require('../../assets/card-art/processed/ai-generated/clubs-nobg/king-of-clubs-Photoroom.png'),
  'Q-clubs': require('../../assets/card-art/processed/ai-generated/clubs-nobg/queen_of_clubs-Photoroom.png'),
  'J-clubs': require('../../assets/card-art/processed/ai-generated/clubs-nobg/jack_of_clubs-Photoroom.png'),

  'K-diamonds': require('../../assets/card-art/processed/ai-generated/diamonds-nobg/king-of-diamonds-Photoroom.png'),
  'Q-diamonds': require('../../assets/card-art/processed/ai-generated/diamonds-nobg/queen-of-diamonds-Photoroom.png'),
  'J-diamonds': require('../../assets/card-art/processed/ai-generated/diamonds-nobg/jack-of-diamonds-Photoroom.png'),
};
