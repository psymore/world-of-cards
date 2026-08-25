import type { ImageSourcePropType } from 'react-native';
import type { Rank, Suit } from '@world-of-cards/engine';

// The 2026-08-18 "New card art" batch: unlike COURT_CARD_ART (courtCardArt.ts, dedicated art per
// suit), this set started suit-agnostic — one full card image (background + gold frame + portrait
// already baked together, not a transparent cutout composited by PlayingCard's own CourtCardFrame)
// per rank, reused across all 4 suits. That's safe for K/Q/J's identity: PlayingCard always draws
// its own CornerIndex (rank + real SuitIcon) on top of whatever center art is showing, regardless
// of this lookup, so reusing one image for a suit that has no dedicated art yet doesn't make any
// card misidentified.
//
// 2026-08-25: real per-suit art now exists for every Jack and Queen, and for three of the four
// Kings. King of Spades has no dedicated art yet — until it does, it deliberately reuses King of
// Clubs's image (the closest in tone to spades' black/gold identity of the three), the same
// reuse-as-stand-in this set started with, just narrowed to one remaining gap instead of covering
// every suit. When king-of-spades art is generated, replace KING_OF_SPADES_IMAGE's require below
// and this comment no longer needs to mention the reuse.
const KING_OF_HEARTS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/king-of-hearts-v2.1.png');
const KING_OF_CLUBS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/king-of-clubs-v2.jpg');
const KING_OF_DIAMONDS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/king-of-diamonds-v2.jpg');
const KING_OF_SPADES_IMAGE = KING_OF_CLUBS_IMAGE;

const QUEEN_OF_HEARTS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/queen-of-hearts-v2.jpg');
const QUEEN_OF_CLUBS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/queen-of-clubs.jpg');
const QUEEN_OF_DIAMONDS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/queen-of-diamonds-v2.jpg');
const QUEEN_OF_SPADES_IMAGE = require('../assets/card-art/processed/ai-generated/v2/queen-of-spades-v2.jpg');

const JACK_OF_HEARTS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/jack-of-hearts-v2.png');
const JACK_OF_CLUBS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/jack-of-clubs.png');
const JACK_OF_DIAMONDS_IMAGE = require('../assets/card-art/processed/ai-generated/v2/jack-of-diamonds.png');
const JACK_OF_SPADES_IMAGE = require('../assets/card-art/processed/ai-generated/v2/jack-of-spades.png');

export const COURT_CARD_ART_V2: Partial<Record<`${Rank}-${Suit}`, ImageSourcePropType>> = {
  'K-hearts': KING_OF_HEARTS_IMAGE,
  'K-clubs': KING_OF_CLUBS_IMAGE,
  'K-diamonds': KING_OF_DIAMONDS_IMAGE,
  'K-spades': KING_OF_SPADES_IMAGE,

  'Q-hearts': QUEEN_OF_HEARTS_IMAGE,
  'Q-clubs': QUEEN_OF_CLUBS_IMAGE,
  'Q-diamonds': QUEEN_OF_DIAMONDS_IMAGE,
  'Q-spades': QUEEN_OF_SPADES_IMAGE,

  'J-hearts': JACK_OF_HEARTS_IMAGE,
  'J-clubs': JACK_OF_CLUBS_IMAGE,
  'J-diamonds': JACK_OF_DIAMONDS_IMAGE,
  'J-spades': JACK_OF_SPADES_IMAGE,
};

// A flat cream/parchment card face, replacing the plain '#fff' backgroundColor for every rank
// under cardFaceStyle 'v2' or 'v3' — including non-court ranks, which otherwise keep today's plain
// SVG suit watermark (no v2/v3 art exists for 2-10/Ace; only the background changes for them).
export const CARD_FACE_BACKGROUND_V2_IMAGE: ImageSourcePropType = require('../assets/card-art/processed/ai-generated/v2/card-face-background-v2.png');

// New 2026-08-25 textured/embossed suit glyphs (transparent background), replacing the flat SVG
// SuitIcon just for the center watermark on non-face ranks under cardFaceStyle v2/v3 — see
// PlayingCard.tsx's CenterArt. The corner index and cardFaceStyle 'v1' both keep the flat SVG:
// these are too richly detailed to read well shrunk to a ~12-18px corner icon, and v1 stays the
// deliberately plain baseline style.
export const SUIT_GLYPH_V2: Record<Suit, ImageSourcePropType> = {
  hearts: require('../assets/card-art/processed/ai-generated/v2/glyph-hearts.png'),
  diamonds: require('../assets/card-art/processed/ai-generated/v2/glyph-diamond.png'),
  clubs: require('../assets/card-art/processed/ai-generated/v2/glyph-clubs.png'),
  spades: require('../assets/card-art/processed/ai-generated/v2/glyph-spades.png'),
};
