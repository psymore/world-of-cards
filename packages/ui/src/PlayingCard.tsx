import React from "react";
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { SvgXml } from "react-native-svg";
import type { Card, Suit } from "@world-of-cards/engine";
import { SuitIcon } from "./SuitIcon";
import { glowShadow } from "./glowShadow";
import { COURT_CARD_ART } from "./courtCardArt";
import { COURT_CARD_ART_V2, CARD_FACE_BACKGROUND_V2_IMAGE, SUIT_GLYPH_V2 } from "./courtCardArtV2";
import { useCardFaceStyleStore } from "./cardFaceStyleStore";
import { CARD_RANK_FONT_FAMILY } from "./fonts";
import { CourtCardFrame } from "./CourtCardFrame";

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
  // Additional relative scale applied to just the corner-index pair and the center watermark
  // icon, layered on top of whatever outer transform the caller applies (e.g. a caller's own
  // wrapping `scale`). Compensates the fact that PlayingCard's "small" variant isn't a uniform
  // scale of "normal" — CORNER_INDEX_WIDTH shrinks to ~68% while WATERMARK_ICON_SIZE shrinks to
  // ~62%, versus the card body's own ~75%/76% — without ever switching size variants (which is
  // what originally caused a landing-moment "pop" — see
  // docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md). Defaults to 1 (no-op), so
  // every existing caller is byte-identical.
  contentScale?: number;
}

const RED_SUITS: Suit[] = ["hearts", "diamonds"];
export const SUIT_COLOR = { red: "#c0392b", black: "#111" };
const CORNER_ICON_SIZE = { normal: 18, small: 12 };
// Fixed width (not shrink-wrap) so every rank's corner index shares one consistent center axis:
// the suit icon centers under "10" (the widest rank) exactly as it does under any single-character
// rank, and — since the box width no longer depends on that card's own rank text — the icon's
// absolute offset from the corner is identical across every rank too. Tuned by eye against the
// PTSerif-Bold rank glyphs at each size; confirmed via screenshot, not computed from font metrics.
const CORNER_INDEX_WIDTH = { normal: 28, small: 19 };
const WATERMARK_ICON_SIZE = { normal: 50, small: 31 };
// v3's centered court-art medallion: a fixed square, not a percentage of the card, sized so its
// bounding box clears CORNER_INDEX_WIDTH/cornerNormal|cornerSmall's rank+suit box vertically
// (cornerNormal's content bottom sits at ~46px into a 132px-tall card, cornerSmall's at ~32px into
// a 101px-tall card) — the old "58%/62% of the full card" sizing put the medallion's bounding box
// directly under the corner index on every face card. Square + contain-fit means the image itself
// (not just this box) never reaches the corners regardless of its own aspect ratio.
const V3_ART_SIZE = { normal: 38, small: 30 };
// +10% height vs. the original 120/78, and widened further per live visual feedback during the
// 2026-07-17 deal/selection/trick-motion polish pass. Exported so call sites doing their own
// layout math around a card (fan curves, trick-slot sizing, travel-card sizing) read the real
// numbers instead of re-hardcoding a copy that can silently drift if these ever change again.
export const CARD_DIMS = {
  normal: { width: 94, height: 132 },
  small: { width: 70, height: 101 },
};
const DEFAULT_BORDERS: PlayingCardBorderSpec[] = [
  { width: 0.8, color: "#fff" },
  { width: 0.8, color: "#c3c3c3" },
];

const BACK_BORDERS: PlayingCardBorderSpec[] = [{ width: 1, color: "#024a64" }];

const OVERLAY_BASE_SIZE = { normal: 60, small: 38 };
// Default face-down back art for every card in the app (Pişti, Batak, and apps/playground all
// consume PlayingCard directly, so this applies everywhere at once — see the 2026-07-17
// deal/selection/trick-motion polish spec for why this is a deliberate "apply everywhere" call,
// not a per-game override). Replaces the earlier hand-drawn SVG lattice (CardBackPattern).
const CARD_BACK_IMAGE = require("../assets/card-art/processed/ai-generated/v1/cards-backround/new-default-card-background.png");

function CornerIndex({
  rank,
  suit,
  isSmall,
  suitColor,
  isRed,
  mirrored,
  contentScale,
}: {
  rank: string;
  suit: Suit | null | undefined;
  isSmall: boolean;
  suitColor: string;
  isRed: boolean;
  mirrored?: boolean;
  contentScale: number;
}) {
  const containerStyle = mirrored
    ? isSmall
      ? styles.cornerSmallMirrored
      : styles.cornerNormalMirrored
    : isSmall
      ? styles.cornerSmall
      : styles.cornerNormal;
  // Composed here (not split across two style objects in an array) because the mirrored variant
  // already needs its own rotate — RN flattens a style array's `transform` key by taking the
  // last value, not merging entries, so a second style object setting `transform` on its own
  // would silently drop this rotate instead of combining with it.
  const transform = mirrored
    ? [{ rotate: "180deg" }, { scale: contentScale }]
    : [{ scale: contentScale }];

  return (
    <View style={[containerStyle, { transform }]}>
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
  backgroundImage,
  children,
}: {
  borders: PlayingCardBorderSpec[];
  outerRadius: number;
  backgroundColor: string;
  backgroundImage?: ImageSourcePropType;
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
      {backgroundImage != null && (
        <Image
          testID="playing-card-face-background"
          source={backgroundImage}
          resizeMode="stretch"
          style={styles.faceBackgroundImage}
        />
      )}
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
  backgroundImage,
  highlighted,
  style,
  cardRadius,
  borders,
  children,
}: {
  testID: string;
  dims: StyleProp<ViewStyle>;
  backgroundColor: string;
  backgroundImage?: ImageSourcePropType;
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
        backgroundColor={backgroundColor}
        backgroundImage={backgroundImage}>
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
  courtArt,
  centeredArt,
  centerGlyph,
  isFaceCard,
  contentScale,
}: {
  card: Card;
  suitColor: string;
  isSmall: boolean;
  overlayImage: PlayingCardOverlayImage | null | undefined;
  courtArt: ImageSourcePropType | undefined;
  // v3 only: the same baked v2 K/Q/J art (courtCardArtV2.ts), shown smaller and "contain"-fit
  // instead of v2's edge-to-edge stretch — the v2 parchment background stays visible as a margin
  // around it rather than being fully replaced by the art's own baked frame.
  centeredArt: ImageSourcePropType | undefined;
  // v2/v3 only: SUIT_GLYPH_V2's textured PNG for this card's suit, replacing the plain SuitIcon
  // watermark below wherever that watermark would otherwise render (non-face ranks under v2/v3 —
  // face ranks always have centeredArt/courtArt by the time this is reached). undefined under v1,
  // where the flat SVG stays the deliberate baseline.
  centerGlyph: ImageSourcePropType | undefined;
  isFaceCard: boolean;
  contentScale: number;
}) {
  if (overlayImage !== undefined) {
    if (overlayImage == null) {
      if (card.suit == null) return null;
      return (
        <View style={{ transform: [{ scale: contentScale }] }}>
          {centerGlyph != null ? (
            <Image
              testID="playing-card-center-glyph"
              source={centerGlyph}
              resizeMode="contain"
              style={{
                width: isSmall
                  ? WATERMARK_ICON_SIZE.small
                  : WATERMARK_ICON_SIZE.normal,
                height: isSmall
                  ? WATERMARK_ICON_SIZE.small
                  : WATERMARK_ICON_SIZE.normal,
              }}
            />
          ) : (
            <SuitIcon
              suit={card.suit}
              size={
                isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal
              }
              color={suitColor}
              opacity={1}
            />
          )}
        </View>
      );
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

  if (centeredArt != null) {
    const size = isSmall ? V3_ART_SIZE.small : V3_ART_SIZE.normal;
    return (
      <View style={[styles.v3ArtFrame, { width: size, height: size }]}>
        <Image
          testID="court-card-art-v3"
          source={centeredArt}
          style={styles.v3ArtImage}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (courtArt != null) {
    return (
      <View
        style={[
          styles.courtArtFrame,
          isFaceCard && styles.courtArtFrameEnlarged,
        ]}>
        <Image
          testID="court-card-art"
          source={courtArt}
          style={[
            styles.courtArtImage,
            isFaceCard && styles.courtArtImageEnlarged,
          ]}
          // J/Q/K get "stretch" so their height can grow independently of width (see
          // courtArtImageEnlarged below) — the Ace keeps "contain" so its own look is
          // unaffected; both source from the same asset pipeline with no aspect-ratio metadata,
          // so resizeMode is the only thing enforcing (or not) the source image's aspect ratio.
          resizeMode={isFaceCard ? "stretch" : "contain"}
        />
      </View>
    );
  }

  if (card.suit == null) return null;
  return (
    <View style={{ transform: [{ scale: contentScale }] }}>
      {centerGlyph != null ? (
        <Image
          testID="playing-card-center-glyph"
          source={centerGlyph}
          resizeMode="contain"
          style={{
            width: isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal,
            height: isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal,
          }}
        />
      ) : (
        <SuitIcon
          suit={card.suit}
          size={isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal}
          color={suitColor}
          opacity={1}
        />
      )}
    </View>
  );
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
  contentScale = 1,
}: PlayingCardProps) {
  const isSmall = size === "small";
  const dims = isSmall ? styles.small : styles.normal;
  const cardFaceStyle = useCardFaceStyleStore((s) => s.cardFaceStyle);

  if (faceDown || !card) {
    return (
      <CardFrame
        testID="playing-card-back"
        dims={dims}
        backgroundColor="#1c2451"
        highlighted={highlighted}
        style={style}
        cardRadius={cardRadius}
        // Unlike the face, the back art already has its own border baked into the artwork
        // (see cards-backround assets) — wrapping it in the face's white/grey rings too
        // produced a visible double-border. No caller overrides `borders` for the back today.
        borders={BACK_BORDERS}>
        <Image
          testID="playing-card-back-art"
          source={CARD_BACK_IMAGE}
          resizeMode="stretch"
          style={styles.backArt}
        />
      </CardFrame>
    );
  }

  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;
  const isFaceCard =
    card.rank === "K" || card.rank === "Q" || card.rank === "J";
  const isV2 = cardFaceStyle === "v2";
  const isV3 = cardFaceStyle === "v3";
  // v2 and v3 both draw from the same baked K/Q/J art (courtCardArtV2.ts) and the same parchment
  // background/no-border/shadow treatment — they differ only in how that art is presented: v2
  // stretches it edge-to-edge as the card's entire background (see fullBleedArt below), v3 shows
  // it smaller and centered, contain-fit, over the parchment background instead (see centeredArt
  // below). isFaceCardArt is the raw lookup shared by both.
  const isV2Family = isV2 || isV3;
  const faceCardArt =
    isV2Family && overlayImage === undefined && isFaceCard && card.suit != null
      ? COURT_CARD_ART_V2[`${card.rank}-${card.suit}`]
      : undefined;
  // v2 only: replaces CardFrame's entire background, so CenterArt/CourtCardFrame below are
  // skipped for that card entirely (their v1 layout assumes a plain background behind them).
  const fullBleedArt = isV2 ? faceCardArt : undefined;
  // v3 only: same art, shown inside CenterArt instead of replacing the background.
  const centeredArt = isV3 ? faceCardArt : undefined;
  // v1's per-suit court art: used as-is in v1 mode, and as Jack's per-suit fallback in v2/v3 mode
  // for the 3 suits courtCardArtV2.ts deliberately left uncovered (its own doc comment explains
  // why) — but never for non-face-card ranks under v2/v3, where both intentionally keep today's
  // plain suit watermark (just over the new parchment background) rather than mixing in v1's Ace
  // art.
  const courtArt =
    faceCardArt === undefined &&
    overlayImage === undefined &&
    card.suit != null &&
    (!isV2Family || isFaceCard)
      ? COURT_CARD_ART[`${card.rank}-${card.suit}`]
      : undefined;
  const faceBackgroundImage =
    fullBleedArt ?? (isV2Family ? CARD_FACE_BACKGROUND_V2_IMAGE : undefined);
  // Center watermark only (see CenterArt's own doc comment) — undefined under v1, where the flat
  // SVG SuitIcon stays the baseline.
  const centerGlyph =
    isV2Family && card.suit != null ? SUIT_GLYPH_V2[card.suit] : undefined;
  // v1's white/grey rings read as digital-print chrome next to v2/v3's parchment/gold art — every
  // v2/v3 card (not just the K/Q/J ones with their own baked frame) drops them in favor of a soft
  // drop shadow instead, closer to a physical card resting on the felt.
  const faceBorders = isV2Family ? [] : borders;

  return (
    <CardFrame
      testID="playing-card-face"
      dims={dims}
      backgroundColor="#fff"
      backgroundImage={faceBackgroundImage}
      highlighted={highlighted}
      style={[style, isV2Family && styles.v2CardShadow]}
      cardRadius={cardRadius}
      borders={faceBorders}>
      <CornerIndex
        rank={card.rank}
        suit={card.suit}
        isSmall={isSmall}
        suitColor={suitColor}
        isRed={isRed}
        contentScale={contentScale}
      />
      <CornerIndex
        rank={card.rank}
        suit={card.suit}
        isSmall={isSmall}
        suitColor={suitColor}
        isRed={isRed}
        mirrored
        contentScale={contentScale}
      />
      {fullBleedArt == null && (
        <View testID="playing-card-center-art" style={styles.centerArt}>
          <CenterArt
            card={card}
            suitColor={suitColor}
            isSmall={isSmall}
            overlayImage={overlayImage}
            courtArt={courtArt}
            centeredArt={centeredArt}
            centerGlyph={centerGlyph}
            isFaceCard={isFaceCard}
            contentScale={contentScale}
          />
        </View>
      )}
      {courtArt != null && isFaceCard && <CourtCardFrame size={size} />}
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
  // A plain, low-key drop shadow standing in for v1's white/grey border rings (suppressed
  // whenever this applies — see faceBorders in PlayingCardComponent) — small and neutral rather
  // than a colored glow, so it reads as "a card resting on the felt" and doesn't compete with
  // `highlighted` above, which both can layer with here since they're separate style objects.
  v2CardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
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
    zIndex: 1,
  },
  cornerSmallMirrored: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: CORNER_INDEX_WIDTH.small,
    alignItems: "center",
    gap: 1,
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
    width: "70%",
    height: "75%",
    borderWidth: 1,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  // K/Q/J only — taller than the base courtArtFrame (width unchanged) so the enlarged,
  // now vertically-stretched art (courtArtImageEnlarged below) has room without being
  // clipped or bleeding past this frame's own border.
  courtArtFrameEnlarged: { height: "72%" },
  courtArtImage: { width: "70%", height: "70%" },
  // K/Q/J art: width still 1.3x the base 70% (Aces keep the base size and resizeMode="contain",
  // untouched), but height is now independently stretched taller (95% vs. the base 70%/width's
  // own 81%) since resizeMode="stretch" (above) no longer preserves the source art's aspect
  // ratio for face cards — first-pass value, tune once checked live.
  courtArtImageEnlarged: { width: "81%", height: "95%" },
  // v3 only — noticeably smaller than v1/v2's own courtArtFrame (70%/75%): the art already carries
  // its own gold frame baked in, so this is a small centered medallion sitting on the v2 parchment
  // background rather than a court-art insert meant to fill most of the card. Width/height come
  // from V3_ART_SIZE (per isSmall) at the call site, not from this base style.
  v3ArtFrame: { alignItems: "center", justifyContent: "center" },
  v3ArtImage: { width: "100%", height: "100%" },
  red: { color: "#c0392b" },
  overlay: { position: "absolute" },
  // Explicit width/height (not just StyleSheet.absoluteFill's position:absolute + inset:0) is
  // required here: for an absolutely-positioned replaced element (an <img>, per the CSS spec)
  // with auto width/height, browsers size it to its own intrinsic dimensions and only use the
  // inset offsets for position — not for size — so without this the card back rendered at the
  // source PNG's full 1254x1254 resolution instead of filling the card, clipping to a tiny sliver
  // of the image's corner. Confirmed via react-native-web DOM inspection, not just guessed.
  backArt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  // Same absolute-fill-plus-explicit-100%-sizing reasoning as backArt above (react-native-web
  // Image needs explicit width/height, not just inset:0, to fill its container). zIndex 0 (below
  // CornerIndex's explicit zIndex: 1) so v2's corner rank/suit still paints on top of it.
  faceBackgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
});
