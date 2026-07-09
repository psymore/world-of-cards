import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';
import { SuitIcon } from './SuitIcon';
import { CardBackPattern } from './CardBackPattern';
import { glowShadow } from './glowShadow';

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
const CORNER_ICON_SIZE = { normal: 12, small: 8 };
const WATERMARK_ICON_SIZE = { normal: 42, small: 26 };
const CARD_DIMS = { normal: { width: 56, height: 80 }, small: { width: 36, height: 52 } };

function PlayingCardComponent({ card, faceDown, size = 'normal', style, highlighted }: PlayingCardProps) {
  const isSmall = size === 'small';
  const dims = isSmall ? styles.small : styles.normal;

  if (faceDown || !card) {
    const pixelDims = isSmall ? CARD_DIMS.small : CARD_DIMS.normal;
    return (
      <View testID="playing-card-back" style={[styles.card, styles.back, dims, highlighted && styles.highlighted, style]}>
        <CardBackPattern width={pixelDims.width} height={pixelDims.height} />
      </View>
    );
  }

  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;

  return (
    <View testID="playing-card-face" style={[styles.card, dims, highlighted && styles.highlighted, style]}>
      <View style={isSmall ? styles.cornerSmall : styles.cornerNormal}>
        <Text style={[isSmall ? styles.cornerRankSmall : styles.cornerRankNormal, isRed && styles.red]}>
          {card.rank}
        </Text>
        {card.suit != null && (
          <SuitIcon
            testID={`corner-suit-${card.suit}`}
            suit={card.suit}
            size={isSmall ? CORNER_ICON_SIZE.small : CORNER_ICON_SIZE.normal}
            color={suitColor}
          />
        )}
      </View>
      <View testID="playing-card-center-art" style={styles.centerArt}>
        {card.suit != null && (
          <SuitIcon
            suit={card.suit}
            size={isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal}
            color={suitColor}
            opacity={0.16}
          />
        )}
      </View>
    </View>
  );
}

// The engine rebuilds zone arrays on every move but reuses the same Card object references for
// cards that didn't move (see packages/engine/src/core/table.ts), so `card` identity is stable
// across re-renders for every card except the one just played — memoizing skips redrawing the
// other ~20+ cards on the table for each single move.
export const PlayingCard = React.memo(PlayingCardComponent);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  normal: { width: 56, height: 80 },
  small: { width: 36, height: 52 },
  back: { backgroundColor: '#1c2451', borderColor: '#0f1638', overflow: 'hidden' },
  highlighted: {
    borderColor: '#f4c542',
    borderWidth: 2,
    ...glowShadow('#f4c542', 6),
  },
  cornerNormal: { position: 'absolute', top: 3, left: 4, alignItems: 'center' },
  cornerSmall: { position: 'absolute', top: 2, left: 2, alignItems: 'center' },
  cornerRankNormal: { fontSize: 13, fontWeight: 'bold', color: '#111', lineHeight: 14 },
  cornerRankSmall: { fontSize: 9, fontWeight: 'bold', color: '#111', lineHeight: 10 },
  centerArt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  red: { color: '#c0392b' },
});
