import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';
import { SuitIcon } from './SuitIcon';
import { CardBackPattern } from './CardBackPattern';
import { glowShadow } from './glowShadow';
import { COURT_CARD_ART } from './courtCardArt';
import { CARD_RANK_FONT_FAMILY } from '../theme/fonts';

export type PlayingCardSize = 'normal' | 'small';

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: PlayingCardSize;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
}

const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
const SUIT_COLOR = { red: '#c0392b', black: '#111' };
const CORNER_ICON_SIZE = { normal: 18, small: 12 };
const WATERMARK_ICON_SIZE = { normal: 50, small: 31 };
const CARD_DIMS = { normal: { width: 84, height: 120 }, small: { width: 54, height: 78 } };

function CornerIndex({
  rank,
  suit,
  isSmall,
  suitColor,
  isRed,
  mirrored,
}: {
  rank: string;
  suit: Suit | undefined;
  isSmall: boolean;
  suitColor: string;
  isRed: boolean;
  mirrored?: boolean;
}) {
  const containerStyle = mirrored
    ? isSmall
      ? styles.cornerSmallMirrored
      : styles.cornerNormalMirrored
    : isSmall
      ? styles.cornerSmall
      : styles.cornerNormal;

  return (
    <View style={containerStyle}>
      <Text style={[isSmall ? styles.cornerRankSmall : styles.cornerRankNormal, isRed && styles.red]}>{rank}</Text>
      {suit != null && (
        <SuitIcon
          testID={mirrored ? `corner-suit-mirror-${suit}` : `corner-suit-${suit}`}
          suit={suit}
          size={isSmall ? CORNER_ICON_SIZE.small : CORNER_ICON_SIZE.normal}
          color={suitColor}
        />
      )}
    </View>
  );
}

// Renders the card's white/grey frame as two concentric 1px rings nested inside the fixed-size
// outer box (rather than adding a single border on top of it), so the card's overall width/height
// never changes as the frame is added — only the innermost face shrinks by 2px to make room.
function CardFrame({
  testID,
  dims,
  backgroundColor,
  highlighted,
  style,
  children,
}: {
  testID: string;
  dims: StyleProp<ViewStyle>;
  backgroundColor: string;
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View testID={testID} style={[styles.cardOuter, dims, highlighted && styles.highlighted, style]}>
      <View style={styles.frameOuterRing}>
        <View style={[styles.frameInnerRing, { backgroundColor }]}>{children}</View>
      </View>
    </View>
  );
}

function PlayingCardComponent({ card, faceDown, size = 'normal', style, highlighted }: PlayingCardProps) {
  const isSmall = size === 'small';
  const dims = isSmall ? styles.small : styles.normal;

  if (faceDown || !card) {
    const pixelDims = isSmall ? CARD_DIMS.small : CARD_DIMS.normal;
    return (
      <CardFrame testID="playing-card-back" dims={dims} backgroundColor="#1c2451" highlighted={highlighted} style={style}>
        <CardBackPattern width={pixelDims.width} height={pixelDims.height} />
      </CardFrame>
    );
  }

  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;
  const courtArt = card.suit != null ? COURT_CARD_ART[`${card.rank}-${card.suit}`] : undefined;
  const isFaceCard = card.rank === 'K' || card.rank === 'Q' || card.rank === 'J';

  return (
    <CardFrame testID="playing-card-face" dims={dims} backgroundColor="#fff" highlighted={highlighted} style={style}>
      <CornerIndex rank={card.rank} suit={card.suit} isSmall={isSmall} suitColor={suitColor} isRed={isRed} />
      <CornerIndex rank={card.rank} suit={card.suit} isSmall={isSmall} suitColor={suitColor} isRed={isRed} mirrored />
      <View testID="playing-card-center-art" style={styles.centerArt}>
        {courtArt != null ? (
          <View style={styles.courtArtFrame}>
            <Image
              testID="court-card-art"
              source={courtArt}
              style={[styles.courtArtImage, isFaceCard && styles.courtArtImageEnlarged]}
              resizeMode="contain"
            />
          </View>
        ) : (
          card.suit != null && (
            <SuitIcon
              suit={card.suit}
              size={isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal}
              color={suitColor}
              opacity={1}
            />
          )
        )}
      </View>
    </CardFrame>
  );
}

// The engine rebuilds zone arrays on every move but reuses the same Card object references for
// cards that didn't move (see packages/engine/src/core/table.ts), so `card` identity is stable
// across re-renders for every card except the one just played — memoizing skips redrawing the
// other ~20+ cards on the table for each single move.
export const PlayingCard = React.memo(PlayingCardComponent);

const CARD_RADIUS = 6;

const styles = StyleSheet.create({
  cardOuter: { borderRadius: CARD_RADIUS, overflow: 'hidden' },
  // Concentric 1px rings (white outer, grey inner) — see the CardFrame comment above.
  frameOuterRing: { flex: 1, borderWidth: 1, borderColor: '#fff', borderRadius: CARD_RADIUS, overflow: 'hidden' },
  frameInnerRing: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: CARD_RADIUS - 1, overflow: 'hidden' },
  normal: { width: 84, height: 120 },
  small: { width: 54, height: 78 },
  highlighted: {
    borderColor: '#f4c542',
    borderWidth: 2,
    ...glowShadow('#f4c542', 6),
  },
  // zIndex is explicit (not left to default child order) because centerArt's court-card Image
  // is added after these in the tree and would otherwise paint over the corner index on native
  // platforms, which stack by array order regardless of position — unlike the browser, where
  // position: absolute already happens to paint on top.
  cornerNormal: { position: 'absolute', top: 5, left: 6, alignItems: 'center', zIndex: 1 },
  cornerSmall: { position: 'absolute', top: 3, left: 3, alignItems: 'center', zIndex: 1 },
  cornerNormalMirrored: { position: 'absolute', bottom: 5, right: 6, alignItems: 'center', transform: [{ rotate: '180deg' }], zIndex: 1 },
  cornerSmallMirrored: { position: 'absolute', bottom: 3, right: 3, alignItems: 'center', transform: [{ rotate: '180deg' }], zIndex: 1 },
  cornerRankNormal: { fontSize: 24, fontFamily: CARD_RANK_FONT_FAMILY, color: '#111', lineHeight: 25 },
  cornerRankSmall: { fontSize: 17, fontFamily: CARD_RANK_FONT_FAMILY, color: '#111', lineHeight: 18 },
  centerArt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  courtArtFrame: { width: '90%', height: '95%', borderWidth: 1, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  courtArtImage: { width: '70%', height: '70%' },
  // K/Q/J art rendered 1.3x larger than the base 70% (Aces keep the base size).
  courtArtImageEnlarged: { width: '91%', height: '91%' },
  red: { color: '#c0392b' },
});
