import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Card, Suit } from '@world-cards/engine';
import { SuitGlyph } from './SuitGlyph';
import type { CardBorder, CardImage, CardTemplate } from '../types';

export type PlaygroundCardSize = 'large' | 'grid';

export interface PlaygroundCardProps {
  card: Card;
  template: CardTemplate;
  size?: PlaygroundCardSize;
}

const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
const SUIT_COLOR = { red: '#c0392b', black: '#111111' };
// 'grid' is a responsive width (fills ~1/4 of its row, so exactly 4 cards fit per line at
// any screen width, phone included) with a fixed aspect ratio matching the original 54:78
// card proportions, rather than a small fixed pixel size — a fixed small size is what made
// grid cards read as cramped/"clumped" on narrow phone screens.
const CARD_DIMS: Record<PlaygroundCardSize, { width: number | `${number}%`; height?: number; aspectRatio?: number }> = {
  large: { width: 160, height: 224 },
  grid: { width: '22%', aspectRatio: 54 / 78 },
};
const CORNER_FONT_SIZE = { large: 20, grid: 15 };
const CORNER_ICON_SIZE = { large: 20, grid: 16 };
const WATERMARK_ICON_SIZE = { large: 72, grid: 52 };
const OVERLAY_BASE_SIZE = { large: 110, grid: 62 };

function CornerIndex({
  rank,
  suit,
  suitColor,
  isRed,
  fontSize,
  iconSize,
  mirrored,
}: {
  rank: string;
  suit: Suit | null;
  suitColor: string;
  isRed: boolean;
  fontSize: number;
  iconSize: number;
  mirrored?: boolean;
}) {
  return (
    <View style={mirrored ? styles.cornerMirrored : styles.corner}>
      <Text style={[styles.cornerRank, { fontSize }, isRed && styles.red]}>{rank}</Text>
      {suit != null && <SuitGlyph suit={suit} size={iconSize} color={suitColor} />}
    </View>
  );
}

// Renders `borders` as concentric rings inset within a fixed-size parent (borders[0] is the
// outermost ring, matching template.borderRadius; each ring narrows the radius by its own
// width as it nests inward) so the card's overall footprint never changes as borders are
// added/thickened — only the innermost face shrinks to make room, keeping grid sizing stable.
function CardBorders({ borders, outerRadius, children }: { borders: CardBorder[]; outerRadius: number; children: React.ReactNode }) {
  const radii: number[] = [];
  let radius = outerRadius;
  for (const border of borders) {
    radii.push(Math.max(radius, 0));
    radius = Math.max(radius - border.width, 0);
  }

  let content = children;
  for (let i = borders.length - 1; i >= 0; i -= 1) {
    const border = borders[i];
    content = (
      <View
        key={i}
        testID={`playground-card-border-${i}`}
        style={[styles.borderRing, { borderWidth: border.width, borderColor: border.color, borderRadius: radii[i] }]}
      >
        {content}
      </View>
    );
  }
  return <>{content}</>;
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
  const fontSize = CORNER_FONT_SIZE[size];
  const iconSize = CORNER_ICON_SIZE[size];
  const watermarkSize = WATERMARK_ICON_SIZE[size];
  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;

  return (
    <View
      testID="playground-card"
      style={[
        styles.cardOuter,
        {
          width: dims.width,
          height: dims.height,
          aspectRatio: dims.aspectRatio,
          borderRadius: template.borderRadius,
        },
      ]}
    >
      <CardBorders borders={template.borders} outerRadius={template.borderRadius}>
        <View style={styles.cardFace}>
          <CornerIndex
            rank={card.rank}
            suit={card.suit}
            suitColor={suitColor}
            isRed={isRed}
            fontSize={fontSize}
            iconSize={iconSize}
          />
          <CornerIndex
            rank={card.rank}
            suit={card.suit}
            suitColor={suitColor}
            isRed={isRed}
            fontSize={fontSize}
            iconSize={iconSize}
            mirrored
          />
          <View style={styles.centerArt}>
            {card.suit != null && <SuitGlyph suit={card.suit} size={watermarkSize} color={suitColor} opacity={1} />}
            {template.image != null && <OverlayImage image={template.image} baseSize={OVERLAY_BASE_SIZE[size]} />}
          </View>
        </View>
      </CardBorders>
    </View>
  );
}

export const PlaygroundCard = React.memo(PlaygroundCardComponent);

const styles = StyleSheet.create({
  cardOuter: { overflow: 'hidden' },
  borderRing: { flex: 1, overflow: 'hidden' },
  cardFace: { flex: 1, backgroundColor: '#ffffff' },
  corner: { position: 'absolute', top: 6, left: 6, alignItems: 'center', zIndex: 1 },
  cornerMirrored: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
    zIndex: 1,
  },
  cornerRank: { fontWeight: 'bold', color: '#111111' },
  red: { color: '#c0392b' },
  centerArt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute' },
});
