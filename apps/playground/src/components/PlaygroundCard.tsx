import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Card, Suit } from '@world-cards/engine';
import { SuitGlyph } from './SuitGlyph';
import type { CardImage, CardTemplate } from '../types';

export type PlaygroundCardSize = 'large' | 'grid';

export interface PlaygroundCardProps {
  card: Card;
  template: CardTemplate;
  size?: PlaygroundCardSize;
}

const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
const SUIT_COLOR = { red: '#c0392b', black: '#111111' };
const CARD_DIMS = { large: { width: 160, height: 224 }, grid: { width: 54, height: 78 } };
const CORNER_ICON_SIZE = { large: 20, grid: 12 };
const WATERMARK_ICON_SIZE = { large: 72, grid: 39 };
const OVERLAY_BASE_SIZE = { large: 110, grid: 40 };

function CornerIndex({
  rank,
  suit,
  suitColor,
  isRed,
  iconSize,
  mirrored,
}: {
  rank: string;
  suit: Suit | null;
  suitColor: string;
  isRed: boolean;
  iconSize: number;
  mirrored?: boolean;
}) {
  return (
    <View style={mirrored ? styles.cornerMirrored : styles.corner}>
      <Text style={[styles.cornerRank, isRed && styles.red]}>{rank}</Text>
      {suit != null && <SuitGlyph suit={suit} size={iconSize} color={suitColor} />}
    </View>
  );
}

function OverlayImage({ image, baseSize }: { image: CardImage; baseSize: number }) {
  const dimension = baseSize * image.scale;
  const overlayStyle = {
    width: dimension,
    height: dimension,
    transform: [{ translateX: image.offsetX }, { translateY: image.offsetY }],
  };
  if (image.kind === 'svg' && image.svgXml != null) {
    return (
      <View testID="playground-card-overlay" style={[styles.overlay, overlayStyle]}>
        <SvgXml xml={image.svgXml} width="100%" height="100%" />
      </View>
    );
  }
  return (
    <Image
      testID="playground-card-overlay"
      source={{ uri: image.uri }}
      resizeMode="contain"
      style={[styles.overlay, overlayStyle]}
    />
  );
}

function PlaygroundCardComponent({ card, template, size = 'large' }: PlaygroundCardProps) {
  const dims = CARD_DIMS[size];
  const iconSize = CORNER_ICON_SIZE[size];
  const watermarkSize = WATERMARK_ICON_SIZE[size];
  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;

  return (
    <View
      testID="playground-card"
      style={[
        styles.card,
        {
          width: dims.width,
          height: dims.height,
          borderRadius: template.borderRadius,
          borderColor: template.borderColor,
        },
      ]}
    >
      <CornerIndex rank={card.rank} suit={card.suit} suitColor={suitColor} isRed={isRed} iconSize={iconSize} />
      <CornerIndex
        rank={card.rank}
        suit={card.suit}
        suitColor={suitColor}
        isRed={isRed}
        iconSize={iconSize}
        mirrored
      />
      <View style={styles.centerArt}>
        {card.suit != null && <SuitGlyph suit={card.suit} size={watermarkSize} color={suitColor} opacity={0.16} />}
        {template.image != null && <OverlayImage image={template.image} baseSize={OVERLAY_BASE_SIZE[size]} />}
      </View>
    </View>
  );
}

export const PlaygroundCard = React.memo(PlaygroundCardComponent);

const styles = StyleSheet.create({
  card: { borderWidth: 2, backgroundColor: '#ffffff', overflow: 'hidden' },
  corner: { position: 'absolute', top: 6, left: 6, alignItems: 'center', zIndex: 1 },
  cornerMirrored: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
    zIndex: 1,
  },
  cornerRank: { fontSize: 16, fontWeight: 'bold', color: '#111111' },
  red: { color: '#c0392b' },
  centerArt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute' },
});
