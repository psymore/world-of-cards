import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { SvgXml } from "react-native-svg";
import type { Card, Suit } from "@world-cards/engine";
import { SuitIcon } from "./SuitIcon";
import { CardBackPattern } from "./CardBackPattern";
import { glowShadow } from "./glowShadow";
import { COURT_CARD_ART } from "./courtCardArt";
import { CARD_RANK_FONT_FAMILY } from "./fonts";

export type PlayingCardSize = "normal" | "small";

export interface PlayingCardBorderSpec {
  width: number;
  color: string;
}

export interface PlayingCardOverlayImage {
  uri?: string;
  kind: "png" | "svg";
  svgXml?: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: PlayingCardSize;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
  // Override props below all default to today's exact hardcoded look when omitted.
  cardRadius?: number;
  borders?: PlayingCardBorderSpec[];
  // null explicitly suppresses the real courtCardArt lookup too (falls back to the plain suit
  // watermark); undefined (the default) leaves today's courtCardArt-or-watermark behavior as-is.
  overlayImage?: PlayingCardOverlayImage | null;
}

const RED_SUITS: Suit[] = ["hearts", "diamonds"];
const SUIT_COLOR = { red: "#c0392b", black: "#111" };
const CORNER_ICON_SIZE = { normal: 18, small: 12 };
// Fixed width (not shrink-wrap) so every rank's corner index shares one consistent center axis:
// the suit icon centers under "10" (the widest rank) exactly as it does under any single-character
// rank, and — since the box width no longer depends on that card's own rank text — the icon's
// absolute offset from the corner is identical across every rank too. Tuned by eye against the
// PTSerif-Bold rank glyphs at each size; confirmed via screenshot, not computed from font metrics.
const CORNER_INDEX_WIDTH = { normal: 28, small: 19 };
const WATERMARK_ICON_SIZE = { normal: 50, small: 31 };
// +10% height vs. the original 120/78, width unchanged — makes the cards read as slightly
// taller/more elegant per the 2026-07-17 deal/selection/trick-motion polish spec.
const CARD_DIMS = {
  normal: { width: 84, height: 132 },
  small: { width: 54, height: 86 },
};
const DEFAULT_BORDERS: PlayingCardBorderSpec[] = [
  { width: 1, color: "#fff" },
  { width: 1, color: "#999" },
];
const OVERLAY_BASE_SIZE = { normal: 60, small: 38 };

function CornerIndex({
  rank,
  suit,
  isSmall,
  suitColor,
  isRed,
  mirrored,
}: {
  rank: string;
  suit: Suit | null | undefined;
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
      <Text
        style={[
          isSmall ? styles.cornerRankSmall : styles.cornerRankNormal,
          isRed && styles.red,
        ]}>
        {rank}
      </Text>
      {suit != null && (
        <SuitIcon
          testID={
            mirrored ? `corner-suit-mirror-${suit}` : `corner-suit-${suit}`
          }
          suit={suit}
          size={isSmall ? CORNER_ICON_SIZE.small : CORNER_ICON_SIZE.normal}
          color={suitColor}
        />
      )}
    </View>
  );
}

// Renders `borders` as concentric rings nested inside the fixed-size outer box (rather than
// adding a single border on top of it), so the card's overall width/height never changes as
// borders are added/thickened — only the innermost face shrinks to make room. Generalizes the
// previous fixed two-ring white/grey frame into an arbitrary-length border stack.
function CardBorders({
  borders,
  outerRadius,
  backgroundColor,
  children,
}: {
  borders: PlayingCardBorderSpec[];
  outerRadius: number;
  backgroundColor: string;
  children: React.ReactNode;
}) {
  const radii: number[] = [];
  let radius = outerRadius;
  for (const border of borders) {
    radii.push(Math.max(radius, 0));
    radius = Math.max(radius - border.width, 0);
  }

  let content: React.ReactNode = (
    <View
      style={[
        styles.frameInnerRing,
        { backgroundColor, borderRadius: radius },
      ]}>
      {children}
    </View>
  );
  for (let i = borders.length - 1; i >= 0; i -= 1) {
    const border = borders[i];
    content = (
      <View
        key={i}
        style={{
          flex: 1,
          borderWidth: border.width,
          borderColor: border.color,
          borderRadius: radii[i],
          overflow: "hidden",
        }}>
        {content}
      </View>
    );
  }
  return <>{content}</>;
}

function CardFrame({
  testID,
  dims,
  backgroundColor,
  highlighted,
  style,
  cardRadius,
  borders,
  children,
}: {
  testID: string;
  dims: StyleProp<ViewStyle>;
  backgroundColor: string;
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
  cardRadius: number;
  borders: PlayingCardBorderSpec[];
  children: React.ReactNode;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.cardOuter,
        { borderRadius: cardRadius },
        dims,
        highlighted && styles.highlighted,
        style,
      ]}>
      <CardBorders
        borders={borders}
        outerRadius={cardRadius}
        backgroundColor={backgroundColor}>
        {children}
      </CardBorders>
    </View>
  );
}

function CenterArt({
  card,
  suitColor,
  isSmall,
  overlayImage,
}: {
  card: Card;
  suitColor: string;
  isSmall: boolean;
  overlayImage: PlayingCardOverlayImage | null | undefined;
}) {
  if (overlayImage !== undefined) {
    if (overlayImage == null) {
      return card.suit != null ? (
        <SuitIcon
          suit={card.suit}
          size={
            isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal
          }
          color={suitColor}
          opacity={1}
        />
      ) : null;
    }
    const baseSize = isSmall
      ? OVERLAY_BASE_SIZE.small
      : OVERLAY_BASE_SIZE.normal;
    const dimension = baseSize * (overlayImage.scale ?? 1);
    const overlayStyle = {
      width: dimension,
      height: dimension,
      transform: [
        { translateX: overlayImage.offsetX ?? 0 },
        { translateY: overlayImage.offsetY ?? 0 },
      ],
    };
    if (overlayImage.kind === "svg" && overlayImage.svgXml != null) {
      return (
        <View
          testID="playing-card-overlay-image"
          style={[styles.overlay, overlayStyle]}>
          <SvgXml xml={overlayImage.svgXml} width="100%" height="100%" />
        </View>
      );
    }
    return (
      <Image
        testID="playing-card-overlay-image"
        source={{ uri: overlayImage.uri }}
        resizeMode="contain"
        style={[styles.overlay, overlayStyle]}
      />
    );
  }

  const courtArt =
    card.suit != null ? COURT_CARD_ART[`${card.rank}-${card.suit}`] : undefined;
  const isFaceCard =
    card.rank === "K" || card.rank === "Q" || card.rank === "J";

  if (courtArt != null) {
    return (
      <View style={styles.courtArtFrame}>
        <Image
          testID="court-card-art"
          source={courtArt}
          style={[
            styles.courtArtImage,
            isFaceCard && styles.courtArtImageEnlarged,
          ]}
          resizeMode="contain"
        />
      </View>
    );
  }

  return card.suit != null ? (
    <SuitIcon
      suit={card.suit}
      size={isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal}
      color={suitColor}
      opacity={1}
    />
  ) : null;
}

function PlayingCardComponent({
  card,
  faceDown,
  size = "normal",
  style,
  highlighted,
  cardRadius = CARD_RADIUS,
  borders = DEFAULT_BORDERS,
  overlayImage,
}: PlayingCardProps) {
  const isSmall = size === "small";
  const dims = isSmall ? styles.small : styles.normal;

  if (faceDown || !card) {
    const pixelDims = isSmall ? CARD_DIMS.small : CARD_DIMS.normal;
    return (
      <CardFrame
        testID="playing-card-back"
        dims={dims}
        backgroundColor="#1c2451"
        highlighted={highlighted}
        style={style}
        cardRadius={cardRadius}
        borders={borders}>
        <CardBackPattern width={pixelDims.width} height={pixelDims.height} />
      </CardFrame>
    );
  }

  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;

  return (
    <CardFrame
      testID="playing-card-face"
      dims={dims}
      backgroundColor="#fff"
      highlighted={highlighted}
      style={style}
      cardRadius={cardRadius}
      borders={borders}>
      <CornerIndex
        rank={card.rank}
        suit={card.suit}
        isSmall={isSmall}
        suitColor={suitColor}
        isRed={isRed}
      />
      <CornerIndex
        rank={card.rank}
        suit={card.suit}
        isSmall={isSmall}
        suitColor={suitColor}
        isRed={isRed}
        mirrored
      />
      <View testID="playing-card-center-art" style={styles.centerArt}>
        <CenterArt
          card={card}
          suitColor={suitColor}
          isSmall={isSmall}
          overlayImage={overlayImage}
        />
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
  cardOuter: { overflow: "hidden" },
  frameInnerRing: { flex: 1 },
  normal: { width: CARD_DIMS.normal.width, height: CARD_DIMS.normal.height },
  small: { width: CARD_DIMS.small.width, height: CARD_DIMS.small.height },
  // Border-free by design: a hard border read as visual noise on top of the lift animation
  // that already signals "selected" (see SelectableCard) — the glow alone is enough.
  highlighted: {
    ...glowShadow("#f4c542", 6),
  },
  // zIndex is explicit (not left to default child order) because centerArt's court-card Image
  // is added after these in the tree and would otherwise paint over the corner index on native
  // platforms, which stack by array order regardless of position — unlike the browser, where
  // position: absolute already happens to paint on top.
  // width: CORNER_INDEX_WIDTH + alignItems: 'center' (not shrink-wrap + 'flex-start') is what
  // makes the index optically centered: every rank's text and its suit icon center within the
  // same fixed box, so a card's own rank always shares a center axis with its own glyph (fixing
  // "10" drifting from its suit icon), and that box is the same width for every rank, so the
  // glyph's absolute offset from the corner no longer varies card-to-card either.
  // Corner offsets sit close to the card edge (a 2026-07-17 change from the previous, more
  // generously-inset look) to read closer to a real playing card's printed index — keep the
  // mirrored pair's bottom/right values matched to the unmirrored top/left, since it's a
  // 180°-rotated duplicate.
  cornerNormal: {
    position: "absolute",
    top: 1,
    left: 2,
    width: CORNER_INDEX_WIDTH.normal,
    alignItems: "center",
    gap: 2,
    zIndex: 1,
  },
  cornerSmall: {
    position: "absolute",
    top: 1,
    left: 1,
    width: CORNER_INDEX_WIDTH.small,
    alignItems: "center",
    gap: 1,
    zIndex: 1,
  },
  cornerNormalMirrored: {
    position: "absolute",
    bottom: 1,
    right: 2,
    width: CORNER_INDEX_WIDTH.normal,
    alignItems: "center",
    gap: 2,
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
  cornerSmallMirrored: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: CORNER_INDEX_WIDTH.small,
    alignItems: "center",
    gap: 1,
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
  cornerRankNormal: {
    fontSize: 24,
    fontFamily: CARD_RANK_FONT_FAMILY,
    color: "#111",
    lineHeight: 25,
  },
  cornerRankSmall: {
    fontSize: 17,
    fontFamily: CARD_RANK_FONT_FAMILY,
    color: "#111",
    lineHeight: 18,
  },
  centerArt: { flex: 1, alignItems: "center", justifyContent: "center" },
  courtArtFrame: {
    width: "90%",
    height: "95%",
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  courtArtImage: { width: "70%", height: "70%" },
  // K/Q/J art rendered 1.3x larger than the base 70% (Aces keep the base size).
  courtArtImageEnlarged: { width: "81%", height: "81%" },
  red: { color: "#c0392b" },
  overlay: { position: "absolute" },
});
