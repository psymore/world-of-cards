# Court Card Decorative Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a thin decorative rectilinear frame around the center-art illustration on King/Queen/Jack cards, matching the shape and proportions worked out in the design spec.

**Architecture:** One new, zero-logic, `React.memo`'d SVG component (`CourtCardFrame`) following the exact pattern already established by `TableWoodCorners`/`CardBackPattern`/`AbsoluteOverlay` in `packages/ui/src`. `PlayingCard.tsx` renders it conditionally, reusing the same `isFaceCard`/`courtArt` predicate the existing center-art sizing logic already uses (lifted up one level so both consumers share a single source of truth instead of computing it twice).

**Tech Stack:** React Native, `react-native-svg` (already a dependency of `@world-cards/ui`), TypeScript.

## Global Constraints

- Scope is **King, Queen, Jack only** — never Aces, never non-court ranks, never when a card is rendered via the `overlayImage` prop. See `docs/superpowers/specs/2026-07-17-court-card-decorative-frame-design.md` for why Aces are excluded.
- Geometry is fixed: two disconnected straight-line brackets (no diagonals, no continuous single line), exact coordinates given in the spec for both `normal` and `small` sizes — do not re-derive from scratch.
- Style is fixed: solid `#111` stroke, sharp corners, no dashing/ornament (Style 1 from the brainstorm — the other two mocked styles were explicitly deferred).
- No new automated tests — per this project's standing 2026-07-07 mobile-UI testing policy, this is decorative-only UI (same treatment as `CardBackPattern`/`TableWoodCorners`/`PlayerAvatar`). Regression is covered by re-running the existing `PlayingCard.test.tsx` suite and a manual visual pass.
- `apps/playground`'s card template editor is **not** touched by this plan — per the spec's cross-cutting note, whether/how to expose this there is a separate discussion to have explicitly, not something to auto-mirror or silently skip.

---

### Task 1: Create the `CourtCardFrame` component

**Files:**
- Create: `packages/ui/src/CourtCardFrame.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `AbsoluteOverlay` (`packages/ui/src/AbsoluteOverlay.tsx`, takes `children: React.ReactNode`, no other props) and the `PlayingCardSize` type (`'normal' | 'small'`) from `packages/ui/src/PlayingCard.tsx` (type-only import — no runtime circularity).
- Produces: `CourtCardFrame` component and `CourtCardFrameProps` type (`{ size: PlayingCardSize }`), both consumed by Task 2 via `import { CourtCardFrame } from './CourtCardFrame';`.

- [ ] **Step 1: Write the component**

```tsx
// packages/ui/src/CourtCardFrame.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';
import type { PlayingCardSize } from './PlayingCard';

export interface CourtCardFrameProps {
  size: PlayingCardSize;
}

interface FrameGeometry {
  width: number;
  height: number;
  topRightBracket: string;
  bottomLeftBracket: string;
  strokeWidth: number;
}

// Two disconnected straight-line brackets tracing the reference frame in
// docs/references/card-art/frame.png: each is 2 axis-aligned segments meeting at 1 right angle,
// closing at the corner with no rank/suit index (top-right, bottom-left) and stopping just clear
// of the corner that has one (top-left, bottom-right respectively) — no touching/jogging needed,
// which is what keeps the line off the rank text and suit glyph. Coordinates are derived from
// PlayingCard's own CARD_DIMS and CORNER_INDEX_WIDTH per size, not linearly rescaled between
// them — see docs/superpowers/specs/2026-07-17-court-card-decorative-frame-design.md for the
// full derivation (13% inset from the true card edge for the two closed corners, measured
// directly from the user's reference photos with a pixel scanner).
const GEOMETRY: Record<PlayingCardSize, FrameGeometry> = {
  normal: {
    width: 84,
    height: 132,
    topRightBracket: 'M32.5,17.25 L73,17.25 L73,83.5',
    bottomLeftBracket: 'M11,48.5 L11,114.75 L51.5,114.75',
    strokeWidth: 1.5,
  },
  small: {
    width: 54,
    height: 86,
    topRightBracket: 'M22,11 L47,11 L47,52',
    bottomLeftBracket: 'M7,34 L7,75 L32,75',
    strokeWidth: 1,
  },
};

function CourtCardFrameComponent({ size }: CourtCardFrameProps) {
  const { width, height, topRightBracket, bottomLeftBracket, strokeWidth } = GEOMETRY[size];
  return (
    <AbsoluteOverlay>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={topRightBracket} fill="none" stroke="#111" strokeWidth={strokeWidth} />
        <Path d={bottomLeftBracket} fill="none" stroke="#111" strokeWidth={strokeWidth} />
      </Svg>
    </AbsoluteOverlay>
  );
}

// `size` is the only prop and is a per-render-site constant that never changes across a card's
// lifetime — memoize so this never repaints on unrelated table re-renders, same rule already
// applied to TableFelt/TableWoodCorners/CardBackPattern.
export const CourtCardFrame = React.memo(CourtCardFrameComponent);
```

- [ ] **Step 2: Export it from the package's public entry point**

In `packages/ui/src/index.ts`, add these two lines after the existing `export { AbsoluteOverlay } from './AbsoluteOverlay';` line:

```ts
export { CourtCardFrame } from './CourtCardFrame';
export type { CourtCardFrameProps } from './CourtCardFrame';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/CourtCardFrame.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add CourtCardFrame decorative frame component"
```

---

### Task 2: Wire it into `PlayingCard` for K/Q/J

**Files:**
- Modify: `packages/ui/src/PlayingCard.tsx`

**Interfaces:**
- Consumes: `CourtCardFrame` + `CourtCardFrameProps` from Task 1 (`./CourtCardFrame`).
- Produces: `PlayingCard` now renders the frame automatically for K/Q/J cards that have real court art. No public API change — `PlayingCardProps` is unchanged, so every existing call site (Pişti, Batak, `apps/playground`) picks this up with zero changes on their end.

- [ ] **Step 1: Add the `CourtCardFrame` import and the `ImageSourcePropType` type import**

Find this block near the top of `packages/ui/src/PlayingCard.tsx`:

```tsx
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
import { glowShadow } from "./glowShadow";
import { COURT_CARD_ART } from "./courtCardArt";
import { CARD_RANK_FONT_FAMILY } from "./fonts";
```

Replace it with:

```tsx
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
import type { Card, Suit } from "@world-cards/engine";
import { SuitIcon } from "./SuitIcon";
import { glowShadow } from "./glowShadow";
import { COURT_CARD_ART } from "./courtCardArt";
import { CARD_RANK_FONT_FAMILY } from "./fonts";
import { CourtCardFrame } from "./CourtCardFrame";
```

- [ ] **Step 2: Lift `courtArt`/`isFaceCard` out of `CenterArt` and into props**

`CenterArt` currently computes `courtArt` and `isFaceCard` internally, but `PlayingCardComponent` (Step 3 below) also needs to know whether to render `CourtCardFrame` — computing the same predicate twice would let the two drift out of sync. Find the full `CenterArt` function:

```tsx
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
```

Replace it with (only the function signature and the `courtArt`/`isFaceCard` lines change — the JSX bodies are identical):

```tsx
function CenterArt({
  card,
  suitColor,
  isSmall,
  overlayImage,
  courtArt,
  isFaceCard,
}: {
  card: Card;
  suitColor: string;
  isSmall: boolean;
  overlayImage: PlayingCardOverlayImage | null | undefined;
  courtArt: ImageSourcePropType | undefined;
  isFaceCard: boolean;
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
```

- [ ] **Step 3: Compute `courtArt`/`isFaceCard` once in `PlayingCardComponent`, pass to `CenterArt`, and render `CourtCardFrame`**

Find the full `PlayingCardComponent` function:

```tsx
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
    return (
      <CardFrame
        testID="playing-card-back"
        dims={dims}
        backgroundColor="#1c2451"
        highlighted={highlighted}
        style={style}
        cardRadius={cardRadius}
        borders={borders}>
        <Image
          testID="playing-card-back-art"
          source={CARD_BACK_IMAGE}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
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
```

Replace it with:

```tsx
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
    return (
      <CardFrame
        testID="playing-card-back"
        dims={dims}
        backgroundColor="#1c2451"
        highlighted={highlighted}
        style={style}
        cardRadius={cardRadius}
        borders={borders}>
        <Image
          testID="playing-card-back-art"
          source={CARD_BACK_IMAGE}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      </CardFrame>
    );
  }

  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;
  const isFaceCard =
    card.rank === "K" || card.rank === "Q" || card.rank === "J";
  const courtArt =
    overlayImage === undefined && card.suit != null
      ? COURT_CARD_ART[`${card.rank}-${card.suit}`]
      : undefined;

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
          courtArt={courtArt}
          isFaceCard={isFaceCard}
        />
      </View>
      {courtArt != null && isFaceCard && <CourtCardFrame size={size} />}
    </CardFrame>
  );
}
```

Note the `overlayImage === undefined` guard on `courtArt`: this matches `CenterArt`'s existing behavior exactly (the court-art path only runs in the `overlayImage === undefined` branch), so `CourtCardFrame` never renders when a card is shown via `overlayImage` — including `overlayImage: null`, which explicitly requests the plain suit watermark instead.

- [ ] **Step 4: Typecheck both packages**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors in either package.

- [ ] **Step 5: Run the existing `PlayingCard` test suite (regression check)**

Run: `npx jest packages/ui/src/PlayingCard.test.tsx`
Expected: All 4 existing tests still PASS (they only assert on rank text and corner-suit testIDs, unaffected by this change).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/PlayingCard.tsx
git commit -m "feat(ui): render CourtCardFrame around K/Q/J center art"
```

---

### Task 3: Full regression check + manual visual verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: Every existing suite across `packages/engine`, `packages/ui`, and `apps/mobile` PASSES — no game-logic files were touched in this plan, so this should be a clean no-op check.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors in any package.

- [ ] **Step 3: Manual browser/Playwright visual verification**

Done directly (not via subagent — requires visual judgment), using the existing `react-native-web` + `playwright-core` workflow this project already relies on for visual checks (no native device access in this environment). Start the web build (`apps/mobile`: `expo start --web`), screenshot and interact through:

1. **All 12 court cards** (K/Q/J × hearts/spades/clubs/diamonds) at `normal` size, in a real game (Pişti and/or Batak) — confirm the frame renders on every one, both brackets clear their corner index without touching the rank text or suit glyph, and the frame reads as roughly centered/symmetric around the illustration.
2. **Same 12 cards at `small` size** (opponent hand / stacked-card contexts) — confirm the thinner (1px) stroke still reads clearly and both brackets still clear the smaller corner boxes.
3. **A non-court card** (e.g. `10`, `7`) and **the Ace of hearts/spades** — confirm no frame renders on any of them (scope is K/Q/J only; Aces keep their existing ornamental-heart/spade art unframed).
4. **Zero new console errors/warnings.**

- [ ] **Step 4: Fix anything found**

If the stroke width or the open-end clearance from a corner box looks wrong on screen (too thick/thin, or the line reads as touching/crossing an index it shouldn't), adjust the `GEOMETRY` constants in `packages/ui/src/CourtCardFrame.tsx` directly and re-screenshot to confirm, following this codebase's established "tuned by eye, confirmed via screenshot" practice for exactly these kinds of constants.

- [ ] **Step 5: Final commit (only if Step 4 required changes)**

```bash
git add packages/ui/src/CourtCardFrame.tsx
git commit -m "fix(ui): tune CourtCardFrame stroke/clearance after visual check"
```
