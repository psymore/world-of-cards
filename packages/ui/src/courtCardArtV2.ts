import type { ImageSourcePropType } from 'react-native';
import type { Rank, Suit } from '@world-of-cards/engine';

// The 2026-08-18 "New card art" batch: unlike COURT_CARD_ART (courtCardArt.ts, dedicated art per
// suit), this set is suit-agnostic — one full card image (background + gold frame + portrait
// already baked together, not a transparent cutout composited by PlayingCard's own CourtCardFrame)
// per rank, reused across all 4 suits. That's safe for K/Q/J's identity: PlayingCard always draws
// its own CornerIndex (rank + real SuitIcon) on top of whatever center art is showing, regardless
// of this lookup, so reusing one King image for every suit doesn't make any card misidentified.
//
// Jack is the one exception: both Jack candidates in this batch have their own "J♥" index baked
// directly into the art (a real corner-index column, not a small removable glyph), committing that
// specific image to hearts. Rather than risk a fragile paint-over of hand-painted gold scrollwork,
// this is registered only as 'J-hearts' — J-clubs/J-spades/J-diamonds simply have no v2 entry and
// fall back to v1's existing COURT_CARD_ART for that suit (see PlayingCard.tsx), the same
// partial-coverage-with-fallback shape COURT_CARD_ART itself already uses for its two Aces.
const KING_V2_IMAGE = require('../assets/card-art/processed/ai-generated/v2/king-v2.jpg');
const QUEEN_V2_IMAGE = require('../assets/card-art/processed/ai-generated/v2/queen-v2.jpg');
const JACK_OF_HEARTS_V2_IMAGE = require('../assets/card-art/processed/ai-generated/v2/jack-of-hearts-v2.jpg');

export const COURT_CARD_ART_V2: Partial<Record<`${Rank}-${Suit}`, ImageSourcePropType>> = {
  'K-hearts': KING_V2_IMAGE,
  'K-spades': KING_V2_IMAGE,
  'K-clubs': KING_V2_IMAGE,
  'K-diamonds': KING_V2_IMAGE,

  'Q-hearts': QUEEN_V2_IMAGE,
  'Q-spades': QUEEN_V2_IMAGE,
  'Q-clubs': QUEEN_V2_IMAGE,
  'Q-diamonds': QUEEN_V2_IMAGE,

  'J-hearts': JACK_OF_HEARTS_V2_IMAGE,
};

// A flat cream/parchment card face, replacing the plain '#fff' backgroundColor for every rank
// under cardFaceStyle 'v2' or 'v3' — including non-court ranks, which otherwise keep today's plain
// SVG suit watermark (no v2/v3 art exists for 2-10/Ace; only the background changes for them).
export const CARD_FACE_BACKGROUND_V2_IMAGE: ImageSourcePropType = require('../assets/card-art/processed/ai-generated/v2/card-face-background-v2.png');
