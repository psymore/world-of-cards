# Shared UI Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `PlayingCard`/`SuitIcon`/`TableFelt`/`TableWoodCorners`/`CardBackPattern`/etc. into a new shared `packages/ui` workspace package so `apps/playground` previews the real, shipped components (with genuine theming override props) instead of its own duplicate implementations — while `apps/mobile` and `apps/playground` remain fully separate builds/dependency trees.

**Architecture:** New pure-RN, zero-build workspace package (`@world-cards/ui`, consumed directly from `src/`, same pattern as `@world-cards/engine`). `PlayingCard`/`TableWoodCorners` gain optional override props defaulting to today's exact hardcoded look. `apps/mobile` swaps two internal import paths and drops its now-duplicated local files. `apps/playground` drops its own duplicate components, gains its own font-loading gate (Expo font loading is per-app), and wires its existing template-editor state into the real components via a small local adapter. A separate, unrelated grid-sizing bug (playground's card gallery renders far too large on web vs. native) gets fixed in its own task.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, react-native-svg, npm workspaces, jest-expo.

## Global Constraints

- `apps/mobile` and `apps/playground` MUST remain two separate apps/builds. No playground-only dependency (file/image pickers, sliders) may ever be added to `apps/mobile/package.json`. No new screen, feature, or gallery may be added to `apps/mobile` — its only changes in this plan are import-path updates and the deletion of files that moved.
- Every new override prop on `PlayingCard`/`TableWoodCorners` MUST default to today's exact current hardcoded visual behavior when omitted, so `apps/mobile`'s output is provably unchanged.
- `packages/ui` is consumed directly from TypeScript source (`"main": "src/index.ts"`, no build step) — the same convention `packages/engine` already uses.
- No new automated tests beyond relocating `PlayingCard.test.tsx` unmodified, per this project's standing testing policy (existing tests must still pass).

---

### Task 1: Scaffold `packages/ui` and relocate the existing components unchanged

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/jest.config.js`
- Move (git mv, content unchanged except where noted): `apps/mobile/src/components/glowShadow.ts` → `packages/ui/src/glowShadow.ts`; `apps/mobile/src/components/AbsoluteOverlay.tsx` → `packages/ui/src/AbsoluteOverlay.tsx`; `apps/mobile/src/components/SuitIcon.tsx` → `packages/ui/src/SuitIcon.tsx`; `apps/mobile/src/components/CardBackPattern.tsx` → `packages/ui/src/CardBackPattern.tsx`; `apps/mobile/src/components/TableFelt.tsx` → `packages/ui/src/TableFelt.tsx`; `apps/mobile/src/components/TableWoodCorners.tsx` → `packages/ui/src/TableWoodCorners.tsx`; `apps/mobile/src/components/PlayingCard.tsx` → `packages/ui/src/PlayingCard.tsx` (import path fix, see Step 6); `apps/mobile/src/components/PlayingCard.test.tsx` → `packages/ui/src/PlayingCard.test.tsx`; `apps/mobile/src/components/courtCardArt.ts` → `packages/ui/src/courtCardArt.ts` (asset path fix, see Step 7); `apps/mobile/assets/card-art/processed/ai-generated/**` → `packages/ui/assets/card-art/processed/ai-generated/**`; `apps/mobile/src/theme/fonts.ts` → `packages/ui/src/fonts.ts`; `apps/mobile/assets/fonts/**` → `packages/ui/assets/fonts/**`.
- Create: `packages/ui/src/index.ts`
- Modify: `apps/mobile/package.json`, `apps/playground/package.json`, `jest.config.js` (repo root)

**Interfaces:**
- Produces: `@world-cards/ui` package exporting `PlayingCard`, `PlayingCardProps`, `PlayingCardSize`, `SuitIcon`, `SuitIconProps`, `TableFelt`, `TableWoodCorners`, `CardBackPattern`, `AbsoluteOverlay`, `glowShadow`, `FONTS`, `CARD_RANK_FONT_FAMILY` from `packages/ui/src/index.ts`. Task 2 adds new override props to `PlayingCard`/`TableWoodCorners` on top of this.

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@world-cards/ui",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "@testing-library/react-native": "^14.0.1",
    "@types/jest": "^30.0.0",
    "@types/react": "~19.2.2",
    "jest-expo": "^57.0.1",
    "react": "19.2.3",
    "react-native": "0.86.0",
    "react-native-svg": "15.15.4",
    "react-test-renderer": "^19.2.3",
    "typescript": "~6.0.3"
  }
}
```

- [ ] **Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/ui/jest.config.js`**

```js
module.exports = {
  displayName: 'ui',
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
```

- [ ] **Step 4: Register `packages/ui` in the root jest config**

Modify `jest.config.js` (repo root):
```js
module.exports = {
  projects: ['<rootDir>/packages/engine', '<rootDir>/packages/ui', '<rootDir>/apps/mobile'],
};
```

- [ ] **Step 5: Move the zero-dependency and internally-consistent files verbatim**

Run (from repo root):
```bash
mkdir -p packages/ui/src packages/ui/assets
git mv apps/mobile/src/components/glowShadow.ts packages/ui/src/glowShadow.ts
git mv apps/mobile/src/components/AbsoluteOverlay.tsx packages/ui/src/AbsoluteOverlay.tsx
git mv apps/mobile/src/components/SuitIcon.tsx packages/ui/src/SuitIcon.tsx
git mv apps/mobile/src/components/CardBackPattern.tsx packages/ui/src/CardBackPattern.tsx
git mv apps/mobile/src/components/TableFelt.tsx packages/ui/src/TableFelt.tsx
git mv apps/mobile/src/components/TableWoodCorners.tsx packages/ui/src/TableWoodCorners.tsx
git mv apps/mobile/src/components/PlayingCard.tsx packages/ui/src/PlayingCard.tsx
git mv apps/mobile/src/components/PlayingCard.test.tsx packages/ui/src/PlayingCard.test.tsx
git mv apps/mobile/src/components/courtCardArt.ts packages/ui/src/courtCardArt.ts
git mv apps/mobile/src/theme/fonts.ts packages/ui/src/fonts.ts
git mv apps/mobile/assets/card-art/processed/ai-generated packages/ui/assets/card-art/processed/ai-generated
git mv apps/mobile/assets/fonts packages/ui/assets/fonts
```
None of these files' *internal* cross-imports need editing — `apps/mobile/src/components/` was already a flat directory (every file a direct sibling of every other), and `packages/ui/src/` is the same flat shape, so imports like `from './SuitIcon'`, `from './AbsoluteOverlay'`, `from './CardBackPattern'`, `from './glowShadow'`, `from './courtCardArt'` all still resolve correctly unchanged. Only two files need a path fix (font import depth and asset require depth), done in Steps 6-7.

- [ ] **Step 6: Fix `PlayingCard.tsx`'s font import path**

In `packages/ui/src/PlayingCard.tsx`, change:
```ts
import { CARD_RANK_FONT_FAMILY } from '../theme/fonts';
```
to:
```ts
import { CARD_RANK_FONT_FAMILY } from './fonts';
```
(The file used to live at `apps/mobile/src/components/PlayingCard.tsx`, two levels from `apps/mobile/src/theme/fonts.ts`. It now lives at `packages/ui/src/PlayingCard.tsx`, a flat sibling of `packages/ui/src/fonts.ts`.)

- [ ] **Step 7: Fix `courtCardArt.ts`'s asset require paths**

In `packages/ui/src/courtCardArt.ts`, every `require('../../assets/card-art/processed/ai-generated/...')` becomes `require('../assets/card-art/processed/ai-generated/...')` (one `../` instead of two — the file moved from `apps/mobile/src/components/` to `packages/ui/src/`, and `packages/ui/assets/` is one level up from `packages/ui/src/`, not two). The full corrected file:
```ts
import type { ImageSourcePropType } from 'react-native';
import type { Rank, Suit } from '@world-cards/engine';

// Full AI-generated art set (docs/superpowers/specs/2026-07-11-court-card-art-pipeline-design.md
// predates this set — it covered demo-scope K/Q/J-with-reuse only). This set has dedicated K/Q/J
// art for all four suits plus Aces where art exists (hearts and spades only — clubs/diamonds
// aces fall back to the plain suit watermark, same as every other non-court rank).
export const COURT_CARD_ART: Partial<Record<`${Rank}-${Suit}`, ImageSourcePropType>> = {
  'A-hearts': require('../assets/card-art/processed/ai-generated/hearts-nobg/ace-of-hearts-Photoroom.png'),
  'K-hearts': require('../assets/card-art/processed/ai-generated/hearts-nobg/king-of-hearts-Photoroom.png'),
  'Q-hearts': require('../assets/card-art/processed/ai-generated/hearts-nobg/queen-of-hearts-Photoroom.png'),
  'J-hearts': require('../assets/card-art/processed/ai-generated/hearts-nobg/jack-of-hearts-Photoroom.png'),

  'A-spades': require('../assets/card-art/processed/ai-generated/spades-nobg/ace-of-spades.png'),
  'K-spades': require('../assets/card-art/processed/ai-generated/spades-nobg/king-of-spades-Photoroom.png'),
  'Q-spades': require('../assets/card-art/processed/ai-generated/spades-nobg/queen-of-spades-Photoroom.png'),
  'J-spades': require('../assets/card-art/processed/ai-generated/spades-nobg/jack-of-spades-Photoroom.png'),

  'K-clubs': require('../assets/card-art/processed/ai-generated/clubs-nobg/king-of-clubs-Photoroom.png'),
  'Q-clubs': require('../assets/card-art/processed/ai-generated/clubs-nobg/queen_of_clubs-Photoroom.png'),
  'J-clubs': require('../assets/card-art/processed/ai-generated/clubs-nobg/jack_of_clubs-Photoroom.png'),

  'K-diamonds': require('../assets/card-art/processed/ai-generated/diamonds-nobg/king-of-diamonds-Photoroom.png'),
  'Q-diamonds': require('../assets/card-art/processed/ai-generated/diamonds-nobg/queen-of-diamonds-Photoroom.png'),
  'J-diamonds': require('../assets/card-art/processed/ai-generated/diamonds-nobg/jack-of-diamonds-Photoroom.png'),
};
```

- [ ] **Step 8: Create `packages/ui/src/index.ts`**

```ts
export { PlayingCard } from './PlayingCard';
export type { PlayingCardProps, PlayingCardSize } from './PlayingCard';
export { SuitIcon } from './SuitIcon';
export type { SuitIconProps } from './SuitIcon';
export { TableFelt } from './TableFelt';
export { TableWoodCorners } from './TableWoodCorners';
export { CardBackPattern } from './CardBackPattern';
export { AbsoluteOverlay } from './AbsoluteOverlay';
export { glowShadow } from './glowShadow';
export { FONTS, CARD_RANK_FONT_FAMILY } from './fonts';
```

- [ ] **Step 9: Add the `@world-cards/ui` dependency to both apps**

In `apps/mobile/package.json`'s `dependencies`, add (alphabetically, next to `@world-cards/engine`):
```json
"@world-cards/ui": "*",
```
In `apps/playground/package.json`'s `dependencies`, add the same line.

- [ ] **Step 10: Install to link the new workspace package**

Run (from repo root):
```bash
npm install
```
Expected: exits 0; `node_modules/@world-cards/ui` now exists as a workspace symlink.

- [ ] **Step 11: Typecheck the new package**

Run:
```bash
cd packages/ui && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 12: Run the new package's relocated test**

Run:
```bash
cd packages/ui && npx jest
```
Expected: `PlayingCard.test.tsx`'s 4 tests pass unchanged (same assertions as before the move — this step only proves the relocation didn't break anything; no test content changes).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Extract packages/ui: relocate PlayingCard/SuitIcon/TableFelt/etc."
```

---

### Task 2: Add theming override props to `PlayingCard` and `TableWoodCorners`

**Files:**
- Modify: `packages/ui/src/PlayingCard.tsx`
- Create: `packages/ui/src/colorUtils.ts`
- Modify: `packages/ui/src/TableWoodCorners.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: nothing new (builds on Task 1's relocated files).
- Produces: `PlayingCard` gains `cardRadius?: number`, `borders?: PlayingCardBorderSpec[]`, `overlayImage?: PlayingCardOverlayImage | null` props (all optional, default to today's exact look). `TableWoodCorners` gains `woodColor?: string` (optional, defaults to today's exact look). `colorUtils.ts` exports `shadeColor(hex: string, amount: number): string` for later tasks (Task 5's playground adapter doesn't need to call this directly — `TableWoodCorners` calls it internally).

- [ ] **Step 1: Create `packages/ui/src/colorUtils.ts`**

```ts
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// amount in [-1, 1]: negative shades toward black, positive shades toward white.
// Used to derive a light/dark gradient pair from a single base color (e.g. TableWoodCorners'
// woodColor override), so the existing two-tone look is preserved under any base hue.
export function shadeColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const factor = Math.abs(clamp(amount, -1, 1));
  return rgbToHex(r + (target - r) * factor, g + (target - g) * factor, b + (target - b) * factor);
}
```

- [ ] **Step 2: Add `woodColor` prop to `TableWoodCorners.tsx`**

In `packages/ui/src/TableWoodCorners.tsx`, change:
```ts
const WEDGE_SIZE = 140; // 2.5x the original 56dp
const TRIM_COLOR = '#ffd966';
const WOOD_LIGHT = '#5c2a1e';
const WOOD_DARK = '#331209';
const GRAIN_COLOR = '#ffab6b';
```
to:
```ts
import { shadeColor } from './colorUtils';

const WEDGE_SIZE = 140; // 2.5x the original 56dp
const TRIM_COLOR = '#ffd966';
const DEFAULT_WOOD_LIGHT = '#5c2a1e';
const DEFAULT_WOOD_DARK = '#331209';
const GRAIN_COLOR = '#ffab6b';

export interface TableWoodCornersProps {
  // Overrides the wood gradient's base color; the light/dark two-tone gradient is derived from
  // it via shadeColor so the existing textured-wood look is preserved under any base hue.
  // Undefined => today's exact hardcoded mahogany look.
  woodColor?: string;
}
```
(Add the `import` line right after the existing `import { AbsoluteOverlay } from './AbsoluteOverlay';` line.)

Change the `Wedge` function's signature and gradient stops from:
```ts
function Wedge({ corner }: { corner: Corner }) {
  const { fillPath, trimPath, positionStyle } = WEDGE_GEOMETRY[corner];
  const gradId = `woodGradient-${corner}`;
  const grainId = `woodGrain-${corner}`;
  return (
    <View style={[styles.wedgeWrap, positionStyle]} testID={`wood-corner-${corner}`}>
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={WOOD_LIGHT} />
            <Stop offset="100%" stopColor={WOOD_DARK} />
          </LinearGradient>
```
to:
```ts
function Wedge({ corner, woodLight, woodDark }: { corner: Corner; woodLight: string; woodDark: string }) {
  const { fillPath, trimPath, positionStyle } = WEDGE_GEOMETRY[corner];
  const gradId = `woodGradient-${corner}`;
  const grainId = `woodGrain-${corner}`;
  return (
    <View style={[styles.wedgeWrap, positionStyle]} testID={`wood-corner-${corner}`}>
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={woodLight} />
            <Stop offset="100%" stopColor={woodDark} />
          </LinearGradient>
```

Change the component body from:
```ts
function TableWoodCornersComponent() {
  return (
    <AbsoluteOverlay>
      {CORNERS.map((corner) => (
        <Wedge key={corner} corner={corner} />
      ))}
    </AbsoluteOverlay>
  );
}
```
to:
```ts
function TableWoodCornersComponent({ woodColor }: TableWoodCornersProps) {
  const woodLight = woodColor != null ? shadeColor(woodColor, 0.18) : DEFAULT_WOOD_LIGHT;
  const woodDark = woodColor != null ? shadeColor(woodColor, -0.25) : DEFAULT_WOOD_DARK;
  return (
    <AbsoluteOverlay>
      {CORNERS.map((corner) => (
        <Wedge key={corner} corner={corner} woodLight={woodLight} woodDark={woodDark} />
      ))}
    </AbsoluteOverlay>
  );
}
```

- [ ] **Step 3: Add `cardRadius`/`borders`/`overlayImage` props to `PlayingCard.tsx`**

In `packages/ui/src/PlayingCard.tsx`, change the imports from:
```ts
import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';
import { SuitIcon } from './SuitIcon';
import { CardBackPattern } from './CardBackPattern';
import { glowShadow } from './glowShadow';
import { COURT_CARD_ART } from './courtCardArt';
import { CARD_RANK_FONT_FAMILY } from './fonts';
```
to:
```ts
import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Card, Suit } from '@world-cards/engine';
import { SuitIcon } from './SuitIcon';
import { CardBackPattern } from './CardBackPattern';
import { glowShadow } from './glowShadow';
import { COURT_CARD_ART } from './courtCardArt';
import { CARD_RANK_FONT_FAMILY } from './fonts';
```

Change the props/types block from:
```ts
export type PlayingCardSize = 'normal' | 'small';

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: PlayingCardSize;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
}
```
to:
```ts
export type PlayingCardSize = 'normal' | 'small';

export interface PlayingCardBorderSpec {
  width: number;
  color: string;
}

export interface PlayingCardOverlayImage {
  uri?: string;
  kind: 'png' | 'svg';
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
```

Add default-border and overlay-size constants near the other size constants (after `const CARD_DIMS = ...`):
```ts
const DEFAULT_BORDERS: PlayingCardBorderSpec[] = [
  { width: 1, color: '#fff' },
  { width: 1, color: '#999' },
];
const OVERLAY_BASE_SIZE = { normal: 60, small: 38 };
```

Replace the `CardFrame` function — from:
```ts
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
```
to:
```ts
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
    <View style={[styles.frameInnerRing, { backgroundColor, borderRadius: radius }]}>{children}</View>
  );
  for (let i = borders.length - 1; i >= 0; i -= 1) {
    const border = borders[i];
    content = (
      <View
        key={i}
        style={{ flex: 1, borderWidth: border.width, borderColor: border.color, borderRadius: radii[i], overflow: 'hidden' }}
      >
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
      style={[styles.cardOuter, { borderRadius: cardRadius }, dims, highlighted && styles.highlighted, style]}
    >
      <CardBorders borders={borders} outerRadius={cardRadius} backgroundColor={backgroundColor}>
        {children}
      </CardBorders>
    </View>
  );
}
```

Change `PlayingCardComponent`'s signature and body — from:
```ts
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
```
to:
```ts
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
        <SuitIcon suit={card.suit} size={isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal} color={suitColor} opacity={1} />
      ) : null;
    }
    const baseSize = isSmall ? OVERLAY_BASE_SIZE.small : OVERLAY_BASE_SIZE.normal;
    const dimension = baseSize * (overlayImage.scale ?? 1);
    const overlayStyle = {
      width: dimension,
      height: dimension,
      transform: [{ translateX: overlayImage.offsetX ?? 0 }, { translateY: overlayImage.offsetY ?? 0 }],
    };
    if (overlayImage.kind === 'svg' && overlayImage.svgXml != null) {
      return (
        <View testID="playing-card-overlay-image" style={[styles.overlay, overlayStyle]}>
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

  const courtArt = card.suit != null ? COURT_CARD_ART[`${card.rank}-${card.suit}`] : undefined;
  const isFaceCard = card.rank === 'K' || card.rank === 'Q' || card.rank === 'J';

  if (courtArt != null) {
    return (
      <View style={styles.courtArtFrame}>
        <Image
          testID="court-card-art"
          source={courtArt}
          style={[styles.courtArtImage, isFaceCard && styles.courtArtImageEnlarged]}
          resizeMode="contain"
        />
      </View>
    );
  }

  return card.suit != null ? (
    <SuitIcon suit={card.suit} size={isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal} color={suitColor} opacity={1} />
  ) : null;
}

function PlayingCardComponent({
  card,
  faceDown,
  size = 'normal',
  style,
  highlighted,
  cardRadius = CARD_RADIUS,
  borders = DEFAULT_BORDERS,
  overlayImage,
}: PlayingCardProps) {
  const isSmall = size === 'small';
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
        borders={borders}
      >
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
      borders={borders}
    >
      <CornerIndex rank={card.rank} suit={card.suit} isSmall={isSmall} suitColor={suitColor} isRed={isRed} />
      <CornerIndex rank={card.rank} suit={card.suit} isSmall={isSmall} suitColor={suitColor} isRed={isRed} mirrored />
      <View testID="playing-card-center-art" style={styles.centerArt}>
        <CenterArt card={card} suitColor={suitColor} isSmall={isSmall} overlayImage={overlayImage} />
      </View>
    </CardFrame>
  );
}
```

Finally, in the `styles` `StyleSheet.create` block, change:
```ts
const styles = StyleSheet.create({
  cardOuter: { borderRadius: CARD_RADIUS, overflow: 'hidden' },
  // Concentric 1px rings (white outer, grey inner) — see the CardFrame comment above.
  frameOuterRing: { flex: 1, borderWidth: 1, borderColor: '#fff', borderRadius: CARD_RADIUS, overflow: 'hidden' },
  frameInnerRing: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: CARD_RADIUS - 1, overflow: 'hidden' },
```
to:
```ts
const styles = StyleSheet.create({
  cardOuter: { overflow: 'hidden' },
  frameInnerRing: { flex: 1 },
```
and add a new `overlay` style entry alongside the existing `red`/`centerArt`/`courtArtFrame` entries:
```ts
  overlay: { position: 'absolute' },
```
(`frameOuterRing` is now unused — `CardBorders` builds the ring stack dynamically — so it is deleted, not left dead.)

- [ ] **Step 4: Export the new types from the barrel**

In `packages/ui/src/index.ts`, change:
```ts
export { PlayingCard } from './PlayingCard';
export type { PlayingCardProps, PlayingCardSize } from './PlayingCard';
```
to:
```ts
export { PlayingCard } from './PlayingCard';
export type { PlayingCardProps, PlayingCardSize, PlayingCardBorderSpec, PlayingCardOverlayImage } from './PlayingCard';
```
and change:
```ts
export { TableWoodCorners } from './TableWoodCorners';
```
to:
```ts
export { TableWoodCorners } from './TableWoodCorners';
export type { TableWoodCornersProps } from './TableWoodCorners';
```

- [ ] **Step 5: Typecheck and run tests**

Run:
```bash
cd packages/ui && npx tsc --noEmit && npx jest
```
Expected: no type errors; `PlayingCard.test.tsx`'s 4 tests still pass unmodified (none of them pass the new override props, so they exercise the default-value paths — proving the defaults reproduce the exact prior behavior for rank/suit/testID assertions).

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "Add theming override props to PlayingCard and TableWoodCorners"
```

---

### Task 3: Wire `apps/mobile` to consume `@world-cards/ui`

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`
- Modify: `apps/mobile/src/components/SelectableCard.tsx`
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `PlayingCard`, `SuitIcon`, `TableFelt`, `TableWoodCorners`, `CardBackPattern`, `AbsoluteOverlay`, `glowShadow`, `FONTS` from `@world-cards/ui` (Task 1/2).

- [ ] **Step 1: Update `PistiTable.tsx`'s imports**

In `apps/mobile/src/games/pisti/PistiTable.tsx`, the current import block (lines 5-12) is:
```ts
import { PlayingCard } from '../../components/PlayingCard';
import { SelectableCard } from '../../components/SelectableCard';
import { useCardSelection } from '../../components/useCardSelection';
import { TableFelt } from '../../components/TableFelt';
import { TableWoodCorners } from '../../components/TableWoodCorners';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { glowShadow } from '../../components/glowShadow';
import { useReducedMotion } from '../../components/useReducedMotion';
```
Change it to:
```ts
import { PlayingCard, TableFelt, TableWoodCorners, glowShadow } from '@world-cards/ui';
import { SelectableCard } from '../../components/SelectableCard';
import { useCardSelection } from '../../components/useCardSelection';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { useReducedMotion } from '../../components/useReducedMotion';
```
(`SelectableCard`, `useCardSelection`, `PlayerAvatar`, `useReducedMotion` did not move — only their import order shifts since the moved-component imports are now consolidated into one `@world-cards/ui` line.)

- [ ] **Step 2: Update `SelectableCard.tsx`'s import**

In `apps/mobile/src/components/SelectableCard.tsx`, change:
```ts
import { PlayingCard, PlayingCardProps } from './PlayingCard';
```
to:
```ts
import { PlayingCard, PlayingCardProps } from '@world-cards/ui';
```

- [ ] **Step 3: Update `App.tsx`'s font import**

In `apps/mobile/App.tsx`, change:
```ts
import { FONTS } from './src/theme/fonts';
```
to:
```ts
import { FONTS } from '@world-cards/ui';
```

- [ ] **Step 4: Confirm no other references to the moved files remain**

Run:
```bash
cd apps/mobile && grep -rn "components/PlayingCard\|components/SuitIcon\|components/TableFelt\|components/TableWoodCorners\|components/CardBackPattern\|components/AbsoluteOverlay\|components/glowShadow\|components/courtCardArt\|theme/fonts" src App.tsx
```
Expected: no output (empty). If anything prints, fix that file's import the same way as Steps 1-3 before continuing.

- [ ] **Step 5: Typecheck**

Run:
```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: exactly the same two pre-existing errors this project already carries (`Suit | null` vs `Suit | undefined` in `PlayingCard.tsx` — now inside `packages/ui`, so the file:line will point there instead of `apps/mobile`). No *new* errors.

- [ ] **Step 6: Run the full mobile test suite**

Run:
```bash
cd apps/mobile && npx jest
```
Expected: same 38/38 passing as before this task (this task changes only import paths — zero behavior change).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "Wire apps/mobile to consume @world-cards/ui"
```

---

### Task 4: Add font loading to `apps/playground`

**Files:**
- Modify: `apps/playground/package.json`
- Modify: `apps/playground/App.tsx`

**Interfaces:**
- Consumes: `FONTS` from `@world-cards/ui` (Task 1).

- [ ] **Step 1: Install expo-font and expo-splash-screen**

Run:
```bash
cd apps/playground && npx expo install expo-font expo-splash-screen
```
Expected: `apps/playground/package.json`'s `dependencies` now includes `expo-font` and `expo-splash-screen`; `apps/playground/app.json` gains a `"plugins": ["expo-font", "expo-splash-screen"]` entry (the same `expo install` side effect already seen when this was done for `apps/mobile`).

- [ ] **Step 2: Rewrite `App.tsx` with the same font-loading gate `apps/mobile` uses**

Replace the full contents of `apps/playground/App.tsx`:
```tsx
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { FONTS } from '@world-cards/ui';
import { PlaygroundScreen } from './src/PlaygroundScreen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <PlaygroundScreen />
      <StatusBar style="light" />
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
cd apps/playground && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/playground/package.json apps/playground/app.json apps/playground/App.tsx
git commit -m "Add PT Serif font loading to apps/playground"
```

---

### Task 5: Replace playground's duplicate components with the real ones

**Files:**
- Delete: `apps/playground/src/components/PlaygroundCard.tsx`, `apps/playground/src/components/SuitGlyph.tsx`, `apps/playground/src/components/TableBackdrop.tsx`
- Modify: `apps/playground/src/components/CardGallery.tsx`, `apps/playground/src/components/CardTemplateEditor.tsx`, `apps/playground/src/components/TableTemplateEditor.tsx`

**Interfaces:**
- Consumes: `PlayingCard`, `PlayingCardBorderSpec`, `PlayingCardOverlayImage`, `TableFelt`, `TableWoodCorners` from `@world-cards/ui` (Task 1/2).

- [ ] **Step 1: Delete the three duplicate components**

```bash
git rm apps/playground/src/components/PlaygroundCard.tsx
git rm apps/playground/src/components/SuitGlyph.tsx
git rm apps/playground/src/components/TableBackdrop.tsx
```

- [ ] **Step 2: Rewrite `CardGallery.tsx` to render the real `PlayingCard`/`TableFelt`/`TableWoodCorners`**

Replace the full contents of `apps/playground/src/components/CardGallery.tsx`:
```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card, Suit } from '@world-cards/engine';
import { PlayingCard, TableFelt, TableWoodCorners } from '@world-cards/ui';
import { usePlaygroundStore } from '../state/playgroundStore';
import { getCardGroup } from '../utils/cardGroups';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  clubs: 'Clubs',
  diamonds: 'Diamonds',
};

const DECK: Card[] = createDeck({ deckCount: 1, includeJokers: false });

function cardsBySuit(suit: Suit): Card[] {
  return DECK.filter((card) => card.suit === suit);
}

export function CardGallery() {
  const templates = usePlaygroundStore((state) => state.templates);
  const table = usePlaygroundStore((state) => state.table);

  return (
    <View style={[styles.backdrop, { backgroundColor: table.feltColor }]}>
      <TableFelt />
      <TableWoodCorners woodColor={table.woodColor} />
      {SUIT_ORDER.map((suit) => (
        <View key={suit} style={styles.suitSection}>
          <Text style={styles.suitLabel}>{SUIT_LABELS[suit]}</Text>
          <View style={styles.row}>
            {cardsBySuit(suit).map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="small"
                {...toPlayingCardOverrides(templates[getCardGroup(card.rank)])}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'relative', overflow: 'hidden', padding: 14 },
  suitSection: { marginBottom: 16 },
  suitLabel: { color: '#ffffff', fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 12 },
});
```
(This drops the old `size="grid"`/`size="large"` distinction — `PlayingCard` only has `"normal"`/`"small"`, so the gallery now always uses `"small"`, a fixed pixel size rather than the buggy `22%`-of-parent sizing that caused the native/web inconsistency. Task 6 further fixes the overall screen layout; this step alone already removes the percentage-based sizing that was the root cause.)

- [ ] **Step 3: Create the template-to-props adapter**

Create `apps/playground/src/utils/toPlayingCardOverrides.ts`:
```ts
import type { PlayingCardBorderSpec, PlayingCardOverlayImage } from '@world-cards/ui';
import type { CardTemplate } from '../types';

// Maps playground's own CardTemplate state shape to the real PlayingCard's override props.
// This mapping lives in apps/playground (the consumer), not @world-cards/ui (the shared
// package) — the shared package owns its own prop interface and must not depend on any one
// consumer's local types.
export function toPlayingCardOverrides(template: CardTemplate): {
  cardRadius: number;
  borders: PlayingCardBorderSpec[];
  overlayImage: PlayingCardOverlayImage | null;
} {
  return {
    cardRadius: template.borderRadius,
    borders: template.borders.map((border) => ({ width: border.width, color: border.color })),
    overlayImage:
      template.image == null
        ? null
        : {
            uri: template.image.uri,
            kind: template.image.kind,
            svgXml: template.image.svgXml,
            scale: template.image.scale,
            offsetX: template.image.offsetX,
            offsetY: template.image.offsetY,
          },
  };
}
```

- [ ] **Step 4: Rewrite `CardTemplateEditor.tsx` to preview through the real `PlayingCard`**

In `apps/playground/src/components/CardTemplateEditor.tsx`, change the import:
```ts
import { PlaygroundCard } from './PlaygroundCard';
```
to:
```ts
import { PlayingCard } from '@world-cards/ui';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';
```
and change the preview render line:
```tsx
<PlaygroundCard card={GROUP_PREVIEW_CARD[selectedGroup]} template={template} size="large" />
```
to:
```tsx
<PlayingCard card={GROUP_PREVIEW_CARD[selectedGroup]} size="normal" {...toPlayingCardOverrides(template)} />
```
(`GROUP_PREVIEW_CARD`, `GROUP_LABELS`, `GROUP_ORDER`, all the slider/color-picker controls, and every store action stay exactly as they are — only the rendered preview component changes.)

- [ ] **Step 5: Update `TableTemplateEditor.tsx`'s comment**

`TableTemplateEditor.tsx` itself needs no functional change (it only has color pickers and calls `usePlaygroundStore` actions — it never rendered a table preview itself). Update its file-level comment, which currently reads:
```ts
// No standalone preview swatch here on purpose: the CardGallery below is the one real
// table (full felt + wood-corner treatment), and it already reads table color state live
// from the same store — a second, smaller table rendering here would look like a
// different, "redesigned" table instead of the genuine one.
```
to:
```ts
// No standalone preview swatch here on purpose: the CardGallery above now renders the real
// TableFelt/TableWoodCorners components (not a duplicate), and it already reads table color
// state live from the same store — a second, smaller table rendering here would look like a
// different, "redesigned" table instead of the genuine one.
```

- [ ] **Step 6: Typecheck**

Run:
```bash
cd apps/playground && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/playground
git commit -m "Replace playground's duplicate card/table components with the real ones"
```

---

### Task 6: Fix the native/web grid-sizing inconsistency

**Files:**
- Modify: `apps/playground/src/PlaygroundScreen.tsx`

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Cap the screen's content width**

Replace the full contents of `apps/playground/src/PlaygroundScreen.tsx`:
```tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { usePlaygroundStore } from "./state/playgroundStore";
import { TableTemplateEditor } from "./components/TableTemplateEditor";
import { CardTemplateEditor } from "./components/CardTemplateEditor";
import { CardGallery } from "./components/CardGallery";

// The functionality panels below the gallery share the felt color as their background
// (not a fixed dark shade) so the table reads as one continuous surface from the card
// gallery down through the editors, rather than two visually disconnected sections.
//
// contentWrapper caps content at a phone-like width and centers it. Without this, native
// rendering was fine (a phone's own screen width is already narrower than the cap), but
// on web (expo start --web) the root container filled the full desktop browser window —
// often 1500px+ wide — so any percentage-based sizing inside scaled up proportionally,
// making cards render far larger than intended. Capping the width makes web layout match
// native regardless of the actual browser window size.
export function PlaygroundScreen() {
  const feltColor = usePlaygroundStore(state => state.table.feltColor);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: feltColor }]}
      contentContainerStyle={styles.scrollContent}>
      <View style={styles.contentWrapper}>
        <Text style={styles.title}>Card Playground</Text>
        <CardGallery />
        <TableTemplateEditor />
        <CardTemplateEditor />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40, alignItems: "center" },
  contentWrapper: { width: "100%", maxWidth: 480 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f4c542",
    textAlign: "center",
    marginVertical: 16,
  },
});
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd apps/playground && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/PlaygroundScreen.tsx
git commit -m "Cap playground's content width to fix native/web grid-sizing inconsistency"
```

---

### Task 7: Update `CLAUDE.md`'s Card Playground isolation rule

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none.

- [ ] **Step 1: Rewrite the isolation paragraph**

In `CLAUDE.md`'s "Card Playground (`apps/playground`)" section, change the paragraph beginning "**Isolation is deliberate and load-bearing, not incidental:**" from:
```
**Isolation is deliberate and load-bearing, not incidental:** `apps/playground` shares only `packages/engine` (pure TS, zero RN dependency) with the rest of the repo. It never imports from `apps/mobile` — no `PlayingCard`, `TableFelt`, `TableWoodCorners`, `SuitIcon`, etc. — and `apps/mobile` never imports from or links to it, in development or production. Playground-only dependencies (file/image pickers, sliders) must only ever be added to `apps/playground/package.json`, never to `apps/mobile/package.json`.
```
to:
```
**Isolation is deliberate and load-bearing, not incidental:** `apps/playground` shares `packages/engine` (pure TS, zero RN dependency) and, as of 2026-07-14, `packages/ui` (`PlayingCard`, `TableFelt`, `TableWoodCorners`, `SuitIcon`, etc. — see `docs/superpowers/specs/2026-07-14-shared-ui-package-design.md`) with the rest of the repo. It never imports from `apps/mobile` directly, and `apps/mobile` never imports from or links to `apps/playground`, in development or production. Playground-only dependencies (file/image pickers, sliders) must only ever be added to `apps/playground/package.json`, never to `apps/mobile/package.json` or `packages/ui/package.json`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md's playground isolation rule for packages/ui"
```

---

### Task 8: Final visual verification

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Run the full monorepo test suite and typecheck one more time**

Run:
```bash
npx jest
cd packages/engine && npx tsc --noEmit
cd ../ui && npx tsc --noEmit
cd ../../apps/mobile && npx tsc --noEmit
cd ../playground && npx tsc --noEmit
```
Expected: zero errors in all four (`packages/engine`, `packages/ui`, `apps/mobile`, `apps/playground`). The `Suit | null`/`Suit | undefined` mismatch that predated this plan was fixed as an out-of-scope but verified-safe correction during Task 4 (commit `f2af125`, user-approved) — so unlike earlier tasks in this plan, no pre-existing errors are expected anywhere at this point.

- [ ] **Step 2: Start playground's web build and screenshot the card gallery**

Using this project's established browser/Playwright screenshot workflow (system Chrome via `playwright-core`, `npx expo start --web` in `apps/playground`), capture the Card Playground screen at two viewport widths: a narrow one (~400px, phone-like) and a wide one (~1600px, desktop-like).

Expected: card sizes in the gallery are visually consistent between the two widths (the `maxWidth: 480` cap from Task 6 holds) — no repeat of the "incredibly bigger on web" bug. Corner rank text renders in the PT Serif font (Task 4's font loading works). Suit glyph shapes match the refined concave hearts/diamonds/spades and open-center clubs shipped earlier (proving playground now genuinely reflects `apps/mobile`'s current look, the original goal of this whole plan).

- [ ] **Step 3: Screenshot `apps/mobile` once more to confirm zero regression**

Using the same workflow, start a Pişti game in `apps/mobile`'s web build and screenshot the table.

Expected: pixel-equivalent to the pre-this-plan screenshots already taken during the PT Serif and suit-icon work — same fonts, same shapes, same layout. This is the concrete proof that Task 3's import-path-only changes really didn't alter `apps/mobile`'s behavior.

- [ ] **Step 4: Check console output in both apps for new warnings/errors**

Expected: no new warnings beyond the pre-existing, already-documented `react-native-web` noise (`textShadow`/`useNativeDriver`/etc.) in either app.

- [ ] **Step 5: Report results**

Summarize the screenshots and console output for final sign-off, noting explicitly that this is browser-only verification, not a native on-device check (the standing, already-tracked gap for this project's UI work).

---

## Self-Review Notes

- **Spec coverage:** new package scaffold (Task 1), file relocation (Task 1), theming override props for `PlayingCard`/`TableWoodCorners` (Task 2), `apps/mobile` wiring with zero behavior change (Task 3), playground font loading (Task 4), playground's duplicate-component replacement (Task 5), the grid-sizing fix (Task 6), `CLAUDE.md` update (Task 7), and visual verification (Task 8) — every spec section has a corresponding task.
- **Placeholder scan:** no TBDs; every step shows complete, concrete code or exact commands.
- **Type consistency:** `PlayingCardBorderSpec`/`PlayingCardOverlayImage`/`TableWoodCornersProps` are defined once (Task 2) and consumed with matching names in Task 5's adapter and `CardGallery.tsx`/`CardTemplateEditor.tsx`. `FONTS`/`CARD_RANK_FONT_FAMILY` are defined once (Task 1's `fonts.ts` move) and consumed identically by both `apps/mobile/App.tsx` (Task 3) and `apps/playground/App.tsx` (Task 4).
- **Scope check:** `apps/mobile` changes are strictly limited to import-path swaps and file deletions per the Global Constraints — no new screen, feature, or dependency is added there at any point in this plan.
