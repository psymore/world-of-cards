# Batak Table UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 7-item Batak table UI polish pass approved in `docs/superpowers/specs/2026-07-16-batak-table-ui-polish-design.md`: wood edge rails, human-seat reordering, a tighter AI 2 fan, a flatter/width-filling human hand, a selected-card front-stacking + tap-to-deselect fix, and a "Dim Unplayable Cards" settings toggle.

**Architecture:** Every task is a small, independent-ish change to the existing Batak table stack (`packages/ui` decorative components, `apps/mobile/src/table/seating.ts` shared geometry, `apps/mobile/src/games/batak/BatakTable.tsx`, `apps/mobile/src/components/SelectableCard.tsx`, and the settings store/screen layer). No engine changes. No new automated tests are written (see Global Constraints) — each task's "test" is a typecheck + full existing-suite regression run, and the final task is a manual visual pass via the project's browser/Playwright workflow.

**Tech Stack:** React Native (Expo SDK 57, RN 0.86), TypeScript, `react-native-svg`, Zustand (`settingsStore`), Jest + `@testing-library/react-native`.

## Global Constraints

- Read the exact versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo-API code (per `AGENTS.md`).
- Testing policy (CLAUDE.md, 2026-07-07): do not write new tests for mobile UI/screens. Re-run the existing suite after every task to catch regressions — do not add coverage.
- Ask before every `git commit` and before any merge, even mid-plan — do not auto-commit at task checkpoints (per standing user preference). Each task below ends with a "stage changes" step, not a commit; commits happen only when the user confirms.
- No native device access in this sandbox — verification uses `expo start --web` + Playwright against local Chrome (per standing project setup). Native-only risk must be called out, not silently assumed fixed.
- This is Batak-only. Do not change Pişti's table beyond the two backward-compatible optional parameters added to `apps/mobile/src/table/seating.ts` (defaults preserve Pişti's exact current output).

---

## File Structure

- `packages/ui/src/TableWoodCorners.tsx` — **modify**: export its wedge-size constant so the new rails can align to it.
- `packages/ui/src/TableEdgeRails.tsx` — **new**: straight wood rail decoration for each of the 4 table edges.
- `packages/ui/src/index.ts` — **modify**: export `TableEdgeRails`.
- `apps/mobile/src/table/seating.ts` — **modify**: optional slope params on `fanRotationDeg`/`fanCurveY`; new `fillWidthMarginPx` helper; remove now-dead `HUMAN_HAND_OVERLAP_PERCENT`.
- `apps/mobile/src/games/batak/BatakTable.tsx` — **modify**: edge rails render call, AI 2 overlap density, human-seat reorder, width-aware human hand spread, selected-card z-order + hitSlop wiring, tap-to-deselect wrapper.
- `apps/mobile/src/components/SelectableCard.tsx` — **modify**: `hitSlop` passthrough prop, lift-to-scale interpolation, `dimUnplayableCards`-gated scrim.
- `apps/mobile/src/state/settingsStore.ts` — **modify**: add `dimUnplayableCards`/`setDimUnplayableCards`.
- `apps/mobile/src/components/GameScreenLayout.tsx` — **modify**: optional `onSettingsPress` prop + gear button.
- `apps/mobile/src/games/batak/BatakSettingsModal.tsx` — **new**: the one-toggle settings popover.
- `apps/mobile/src/games/batak/BatakScreen.tsx` — **modify**: wire the settings modal open/close state.

---

### Task 1: Wood edge rails

**Files:**
- Modify: `packages/ui/src/TableWoodCorners.tsx`
- Create: `packages/ui/src/TableEdgeRails.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx:1-19, 566-570`

**Interfaces:**
- Consumes: `AbsoluteOverlay` (`./AbsoluteOverlay`), `shadeColor` (`./colorUtils`) — both already exported from `packages/ui/src/index.ts` internals, used the same way `TableWoodCorners.tsx` already uses them.
- Produces: `export const CORNER_WEDGE_SIZE = 140` from `TableWoodCorners.tsx`; `export const TableEdgeRails: React.MemoExoticComponent<...>` and `export interface TableEdgeRailsProps { woodColor?: string }` from the new file, both re-exported via `packages/ui/src/index.ts` so `BatakTable.tsx` can `import { TableEdgeRails } from "@world-cards/ui"`.

- [ ] **Step 1: Export the wedge size constant from `TableWoodCorners.tsx`**

In `packages/ui/src/TableWoodCorners.tsx`, change:

```ts
const WEDGE_SIZE = 140; // 2.5x the original 56dp
```

to:

```ts
export const CORNER_WEDGE_SIZE = 140; // 2.5x the original 56dp
```

And a few lines below, change:

```ts
const S = WEDGE_SIZE;
```

to:

```ts
const S = CORNER_WEDGE_SIZE;
```

(`S` is used everywhere else in the file already — this is the only other reference to the old constant name.)

- [ ] **Step 2: Create `TableEdgeRails.tsx`**

Create `packages/ui/src/TableEdgeRails.tsx`:

```tsx
import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';
import { CORNER_WEDGE_SIZE } from './TableWoodCorners';
import { shadeColor } from './colorUtils';

const RAIL_THICKNESS = 24;
const TRIM_COLOR = '#ffd966';
const DEFAULT_WOOD_LIGHT = '#5c2a1e';
const DEFAULT_WOOD_DARK = '#331209';
const GRAIN_COLOR = '#ffab6b';

export interface TableEdgeRailsProps {
  // Same override contract as TableWoodCorners: undefined => today's hardcoded mahogany look.
  woodColor?: string;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';

const EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

// Each rail spans one edge, inset by CORNER_WEDGE_SIZE on both ends so it meets
// TableWoodCorners' quarter-circle wedges without overlapping them.
const EDGE_STYLES: Record<Edge, ViewStyle> = {
  top: { position: 'absolute', top: 0, left: CORNER_WEDGE_SIZE, right: CORNER_WEDGE_SIZE, height: RAIL_THICKNESS },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: CORNER_WEDGE_SIZE,
    right: CORNER_WEDGE_SIZE,
    height: RAIL_THICKNESS,
  },
  left: { position: 'absolute', left: 0, top: CORNER_WEDGE_SIZE, bottom: CORNER_WEDGE_SIZE, width: RAIL_THICKNESS },
  right: {
    position: 'absolute',
    right: 0,
    top: CORNER_WEDGE_SIZE,
    bottom: CORNER_WEDGE_SIZE,
    width: RAIL_THICKNESS,
  },
};

function Rail({ edge, woodLight, woodDark }: { edge: Edge; woodLight: string; woodDark: string }) {
  const gradId = `railGradient-${edge}`;
  const grainId = `railGrain-${edge}`;
  return (
    <View style={EDGE_STYLES[edge]} testID={`wood-rail-${edge}`}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={woodLight} />
            <Stop offset="100%" stopColor={woodDark} />
          </LinearGradient>
          <Pattern id={grainId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <Line x1={0} y1={0} x2={0} y2={6} stroke={GRAIN_COLOR} strokeOpacity={0.1} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${gradId})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${grainId})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill="none" stroke={TRIM_COLOR} strokeOpacity={0.85} strokeWidth={2} />
      </Svg>
    </View>
  );
}

// Zero props (aside from the same optional woodColor override TableWoodCorners takes), output
// never changes — memoized so it paints once, same rule as TableFelt/TableWoodCorners.
function TableEdgeRailsComponent({ woodColor }: TableEdgeRailsProps) {
  const woodLight = woodColor != null ? shadeColor(woodColor, 0.18) : DEFAULT_WOOD_LIGHT;
  const woodDark = woodColor != null ? shadeColor(woodColor, -0.25) : DEFAULT_WOOD_DARK;
  return (
    <AbsoluteOverlay>
      {EDGES.map((edge) => (
        <Rail key={edge} edge={edge} woodLight={woodLight} woodDark={woodDark} />
      ))}
    </AbsoluteOverlay>
  );
}

export const TableEdgeRails = React.memo(TableEdgeRailsComponent);
```

- [ ] **Step 3: Export it from `packages/ui/src/index.ts`**

Add these two lines after the existing `TableWoodCorners` exports:

```ts
export { TableEdgeRails } from './TableEdgeRails';
export type { TableEdgeRailsProps } from './TableEdgeRails';
```

- [ ] **Step 4: Render it in `BatakTable.tsx`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, change the import block (currently lines 13-19):

```ts
import {
  PlayingCard,
  SuitIcon,
  TableFelt,
  TableWoodCorners,
  glowShadow,
} from "@world-cards/ui";
```

to:

```ts
import {
  PlayingCard,
  SuitIcon,
  TableFelt,
  TableWoodCorners,
  TableEdgeRails,
  glowShadow,
} from "@world-cards/ui";
```

And in the `BatakTable` component's render (currently around line 568-569):

```tsx
      <TableFelt />
      <TableWoodCorners />
```

to:

```tsx
      <TableFelt />
      <TableWoodCorners />
      <TableEdgeRails />
```

- [ ] **Step 5: Typecheck and run the existing suite**

Run:
```bash
npx tsc --noEmit -p packages/ui/tsconfig.json
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx jest --selectProjects mobile
```
Expected: all three commands succeed with no errors; the mobile suite reports the same pass count as before this task (no new tests were added, none should fail).

- [ ] **Step 6: Stage changes**

```bash
git add packages/ui/src/TableWoodCorners.tsx packages/ui/src/TableEdgeRails.tsx packages/ui/src/index.ts apps/mobile/src/games/batak/BatakTable.tsx
```

---

### Task 2: AI 2 (top seat) fan density

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx:25-33, 42-46, 187-213`

**Interfaces:**
- Consumes: `overlapMarginPx` from `apps/mobile/src/table/seating.ts` (already imported in this file: `overlapMarginPx(cardWidth: number, overlapPercent: number): number`).
- Produces: no new exports — this is a local constant/usage change only.

- [ ] **Step 1: Remove the now-unused `OPPONENT_CARD_OVERLAP` import**

In the `from "../../table/seating"` import block (currently lines 25-33):

```ts
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  overlapMarginPx,
  splitTwoRows,
  OPPONENT_CARD_OVERLAP,
  HUMAN_HAND_OVERLAP_PERCENT,
} from "../../table/seating";
```

Remove the `OPPONENT_CARD_OVERLAP` line (leave `HUMAN_HAND_OVERLAP_PERCENT` for now — Task 4 removes it):

```ts
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  overlapMarginPx,
  splitTwoRows,
  HUMAN_HAND_OVERLAP_PERCENT,
} from "../../table/seating";
```

- [ ] **Step 2: Add the top-seat overlap constants**

Near the existing `SMALL_CARD_HEIGHT`/`BATAK_SIDE_OVERLAP_PERCENT` constants (currently lines 54-55), add a sibling width constant and the new percent:

```ts
const SMALL_CARD_HEIGHT = 78; // matches PlayingCard's 'small' size height
const SMALL_CARD_WIDTH = 54; // matches PlayingCard's 'small' size width
const BATAK_SIDE_OVERLAP_PERCENT = 85;
// AI 2 (top seat)'s fan previously overlapped by a fixed 21px (~39% of a small card), which read
// as loose/uneven. Reuse the same percentage-overlap approach as the side stacks for a
// consistently tight fan across every AI seat.
const BATAK_TOP_OVERLAP_PERCENT = 85;
```

- [ ] **Step 3: Use it in `OpponentSeat`'s top-seat branch**

In the `OpponentSeat` function, change (currently lines 196-211):

```tsx
            <PlayingCard
              key={i}
              faceDown
              size="small"
              style={[
                i > 0 && { marginLeft: -OPPONENT_CARD_OVERLAP },
                {
                  transform: [
                    { rotate: `${fanRotationDeg(i, arr.length)}deg` },
                    // direction -1 flips the top seat's fan convex: end cards rise instead of
                    // drooping, so the fan arcs away from the side stacks below it.
                    { translateY: fanCurveY(i, arr.length, -1) },
                  ],
                },
              ]}
            />
```

to:

```tsx
            <PlayingCard
              key={i}
              faceDown
              size="small"
              style={[
                i > 0 && { marginLeft: overlapMarginPx(SMALL_CARD_WIDTH, BATAK_TOP_OVERLAP_PERCENT) },
                {
                  transform: [
                    { rotate: `${fanRotationDeg(i, arr.length)}deg` },
                    // direction -1 flips the top seat's fan convex: end cards rise instead of
                    // drooping, so the fan arcs away from the side stacks below it.
                    { translateY: fanCurveY(i, arr.length, -1) },
                  ],
                },
              ]}
            />
```

- [ ] **Step 4: Typecheck and run the existing suite**

Run:
```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx jest --selectProjects mobile
```
Expected: no errors, same pass count as before.

- [ ] **Step 5: Stage changes**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
```

---

### Task 3: Human seat reversal (badge above cards)

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx:617-645`

**Interfaces:**
- Consumes: existing `PlayerBadge`, `BidControls`, `HandRow` components (unchanged signatures).
- Produces: none — pure JSX reorder.

- [ ] **Step 1: Reorder the bottom `handArea`'s children**

In `BatakTable`'s render, change this block (currently lines 617-645):

```tsx
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handFan} testID="human-hand">
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
          />
          <HandRow
            cards={bottomRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
          />
        </View>
        {state.phase === "bidding" && isHumanInteractive && (
          <BidControls legalMoves={legalMoves} onMove={onMove} />
        )}
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? "You"}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
      </View>
```

to:

```tsx
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? "You"}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
        {state.phase === "bidding" && isHumanInteractive && (
          <BidControls legalMoves={legalMoves} onMove={onMove} />
        )}
        <View style={styles.handFan} testID="human-hand">
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
          />
          <HandRow
            cards={bottomRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
          />
        </View>
      </View>
```

(Only the order of the three children changed — `PlayerBadge` first, `BidControls` unchanged in the middle, the two `HandRow`s last.)

- [ ] **Step 2: Typecheck and run the existing suite**

Run:
```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx jest --selectProjects mobile
```
Expected: no errors, same pass count as before.

- [ ] **Step 3: Stage changes**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
```

---

### Task 4: Human hand — flatter slope + width-filling spread

**Files:**
- Modify: `apps/mobile/src/table/seating.ts`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `fanRotationDeg(index: number, count: number, degreesPerStep?: number): number` and `fanCurveY(index: number, count: number, direction?: 1 | -1, curveMultiplier?: number): number` (both backward-compatible — existing 2-arg/3-arg call sites in `PistiTable.tsx` and `BatakTable.tsx`'s top-seat fan are unaffected); `fillWidthMarginPx(cardWidth: number, count: number, targetSpan: number, maxGap: number): number | undefined` — used by Task 5 and Task 6 only insofar as they read `HandRow`'s existing `cardMarginLeft` prop introduced here.

- [ ] **Step 1: Add optional slope parameters to `fanRotationDeg`/`fanCurveY` in `seating.ts`**

Change:

```ts
export function fanRotationDeg(index: number, count: number): number {
  if (count <= 1) return 0;
  const mid = (count - 1) / 2;
  return (index - mid) * OPPONENT_FAN_DEGREES_PER_STEP;
}
```

to:

```ts
export function fanRotationDeg(
  index: number,
  count: number,
  degreesPerStep: number = OPPONENT_FAN_DEGREES_PER_STEP,
): number {
  if (count <= 1) return 0;
  const mid = (count - 1) / 2;
  return (index - mid) * degreesPerStep;
}
```

And change:

```ts
export function fanCurveY(
  index: number,
  count: number,
  direction: 1 | -1 = 1,
): number {
  if (count <= 1) return 0;
  return (
    Math.pow(Math.abs(index - (count - 1) / 2), 2) *
    OPPONENT_FAN_CURVE *
    direction
  );
}
```

to:

```ts
export function fanCurveY(
  index: number,
  count: number,
  direction: 1 | -1 = 1,
  curveMultiplier: number = OPPONENT_FAN_CURVE,
): number {
  if (count <= 1) return 0;
  return (
    Math.pow(Math.abs(index - (count - 1) / 2), 2) *
    curveMultiplier *
    direction
  );
}
```

- [ ] **Step 2: Replace `HUMAN_HAND_OVERLAP_PERCENT` with a width-filling helper in `seating.ts`**

Remove:

```ts
// Calibrated for the 84px-wide 'normal' PlayingCard size the human hand renders at: a full
// 13-card hand's 7-card top row lays out at 84 + 6 × (84 − round(84 × 0.45)) = 360px, fitting a
// ~390px phone viewport with side margin. (The original 16% was tuned for the 54px 'small' size,
// whose 7-card row was ~324px — at 16%, normal-size cards would lay out ~510px wide and overflow.)
export const HUMAN_HAND_OVERLAP_PERCENT = 45;
```

Add in its place:

```ts
// Computes the per-card marginLeft needed so a row of `count` cards (each `cardWidth` wide) spans
// close to `targetSpan` total width — negative for overlap (a full hand needs more cards than fit
// at full width), positive for a gap (a near-empty hand where cards alone would undershoot the
// target span). `count <= 1` needs no margin at all (nothing to space). `maxGap` clamps the
// positive case so a 1-2 card hand doesn't scatter across the full target span with unnaturally
// large gaps — once the natural gap would exceed it, extra width is simply left unused around a
// normally-spaced row instead of stretching further.
export function fillWidthMarginPx(
  cardWidth: number,
  count: number,
  targetSpan: number,
  maxGap: number,
): number | undefined {
  if (count <= 1) return undefined;
  const step = (targetSpan - cardWidth) / (count - 1) - cardWidth;
  return Math.min(step, maxGap);
}
```

- [ ] **Step 3: Update `BatakTable.tsx`'s imports**

Change the `from "../../table/seating"` import block to add `fillWidthMarginPx` and drop `HUMAN_HAND_OVERLAP_PERCENT`:

```ts
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  overlapMarginPx,
  splitTwoRows,
  fillWidthMarginPx,
} from "../../table/seating";
```

Add `useState` and `useWindowDimensions` where needed. Change the top of the file's React import (currently `import React, { useEffect, useRef } from "react";`) to:

```ts
import React, { useEffect, useRef, useState } from "react";
```

And change the `react-native` import block (currently):

```ts
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
```

to:

```ts
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { LayoutChangeEvent } from "react-native";
```

- [ ] **Step 4: Remove the fixed `HUMAN_HAND_MARGIN` constant, add the flatter-slope/spread constants**

Remove:

```ts
const HUMAN_CARD_WIDTH = 84; // matches PlayingCard's 'normal' size width
const HUMAN_HAND_MARGIN = overlapMarginPx(
  HUMAN_CARD_WIDTH,
  HUMAN_HAND_OVERLAP_PERCENT,
);
```

Add in its place:

```ts
const HUMAN_CARD_WIDTH = 84; // matches PlayingCard's 'normal' size width
// A flatter arc than the opponents' default fan (half the rotation-per-card and curve
// multiplier) — first-pass values, tune during the manual visual verification pass if needed.
const HUMAN_HAND_DEGREES_PER_STEP = 4;
const HUMAN_HAND_CURVE_MULTIPLIER = 1.5;
// Reserve a 15% gutter on each side (i.e. cards span the middle 70% of the hand area's real
// width) instead of a fixed-percent overlap that doesn't adapt to device width.
const HUMAN_HAND_SPREAD_FRACTION = 0.7;
// Caps the per-card gap once a near-empty hand (1-2 cards left) would otherwise need to stretch
// across the full target span with unnaturally large gaps.
const HUMAN_HAND_MAX_GAP = 24;
```

- [ ] **Step 5: Update `HandRow` to take a `cardMarginLeft` prop and the flatter-slope constants**

Change the `HandRow` function (currently lines 408-457) from:

```tsx
function HandRow({
  cards,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
}) {
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <EntranceCard
            key={card.id}
            index={i}
            playEntrance={playEntrance}
            // ... (comment updated in Task 5)
            zIndex={selectedCardId === card.id ? 0 : 1}>
            <SelectableCard
              card={card}
              size="normal"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length)}
              curveOffsetY={fanCurveY(i, cards.length)}
              marginLeft={i > 0 ? HUMAN_HAND_MARGIN : undefined}
            />
          </EntranceCard>
        );
      })}
    </View>
  );
}
```

to (leave the `EntranceCard`'s `zIndex`/comment exactly as-is for now — Task 5 changes that part):

```tsx
function HandRow({
  cards,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  cardMarginLeft,
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  cardMarginLeft: number | undefined;
}) {
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <EntranceCard
            key={card.id}
            index={i}
            playEntrance={playEntrance}
            // While a card is selected, unselected neighbors take paint/hit priority over it.
            // In this overlapping fan, the raised card's lower corners jut over the neighboring
            // cards' territory (rotation widens the negative-marginLeft overlap to ~25px at the
            // fan's edges), so a tap aimed at the adjacent card could land on the selected card
            // instead — which reads as a second tap on it and PLAYS it instantly, i.e. the
            // "selected card sometimes disappears when I tap a different card" bug (confirmed
            // empirically via elementFromPoint hit-mapping). With neighbors on top, a boundary
            // tap resolves to the neighbor — a harmless selection switch — while deliberate
            // second taps on the selected card's exposed face still play it.
            zIndex={selectedCardId === card.id ? 0 : 1}>
            <SelectableCard
              card={card}
              size="normal"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length, HUMAN_HAND_DEGREES_PER_STEP)}
              curveOffsetY={fanCurveY(i, cards.length, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
              marginLeft={i > 0 ? cardMarginLeft : undefined}
            />
          </EntranceCard>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 6: Measure the hand area's width and compute each row's margin in `BatakTable`**

In the `BatakTable` function body, after the existing `legalCardIds` computation (currently ending around line 564) and before the `return (`, add:

```ts
  const { width: windowWidth } = useWindowDimensions();
  const [handAreaWidth, setHandAreaWidth] = useState(windowWidth);
  function handleHandAreaLayout(event: LayoutChangeEvent) {
    setHandAreaWidth(event.nativeEvent.layout.width);
  }
  const handSpanTarget = handAreaWidth * HUMAN_HAND_SPREAD_FRACTION;
  const topRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, topRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);
  const bottomRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, bottomRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);
```

(`windowWidth` seeds `handAreaWidth` so the very first render already has a sensible value — `onLayout` then corrects it to the container's exact measured width once it's known, instead of starting at `0` and showing a heavily-overlapped flash of cards for one frame.)

- [ ] **Step 7: Wire the measured width and per-row margins into the JSX**

Change the `handArea` View's opening tag (from Task 3's reordered version) from:

```tsx
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
```

to:

```tsx
      <View
        style={[styles.handArea, isHumanInteractive && styles.activeArea]}
        onLayout={handleHandAreaLayout}>
```

And pass the computed margins to each `HandRow`:

```tsx
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
            cardMarginLeft={topRowMargin}
          />
          <HandRow
            cards={bottomRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
            cardMarginLeft={bottomRowMargin}
          />
```

- [ ] **Step 8: Typecheck and run the existing suite**

Run:
```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx jest --selectProjects mobile
```
Expected: no errors, same pass count as before. Confirm no other file imports `HUMAN_HAND_OVERLAP_PERCENT` (it was `BatakTable.tsx`'s only consumer):
```bash
grep -rn "HUMAN_HAND_OVERLAP_PERCENT" apps/mobile/src packages
```
Expected: no output.

- [ ] **Step 9: Stage changes**

```bash
git add apps/mobile/src/table/seating.ts apps/mobile/src/games/batak/BatakTable.tsx
```

---

### Task 5: Selected card — front stacking, safe hit-box, lift toward camera

**Files:**
- Modify: `apps/mobile/src/components/SelectableCard.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `SelectableCardProps` (existing), the `HandRow`/`EntranceCard` structure from Task 4.
- Produces: `SelectableCardProps.hitSlop?: { top?: number; left?: number; bottom?: number; right?: number }` — a new optional passthrough prop other call sites (Pişti's `PistiTable.tsx`) can ignore with no behavior change.

- [ ] **Step 1: Add `hitSlop` and the lift-to-scale interpolation to `SelectableCard.tsx`**

Change the full file from:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { PlayingCard, PlayingCardProps } from '@world-cards/ui';
import { useReducedMotion } from './useReducedMotion';

export interface SelectableCardProps extends PlayingCardProps {
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  rotateDeg?: number;
  marginLeft?: number;
  liftDistance?: number;
  curveOffsetY?: number;
}

const DEFAULT_LIFT_DISTANCE = 16;
const LIFT_ANIM_DURATION_MS = 150;
// Matches PlayingCard's default CARD_RADIUS, used when the caller doesn't override cardRadius.
const DEFAULT_CARD_RADIUS = 6;

export function SelectableCard({
  selected = false,
  disabled,
  onPress,
  rotateDeg = 0,
  marginLeft,
  liftDistance = DEFAULT_LIFT_DISTANCE,
  curveOffsetY = 0,
  ...cardProps
}: SelectableCardProps) {
  const lift = useRef(new Animated.Value(selected ? -liftDistance : 0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Selecting snaps instantly: a fast player taps once to select and immediately taps again to
    // play, and a 150ms rise would still be mid-flight when that second tap lands. Deselecting
    // (picking a different card, or the selected card unmounting once played) has no such urgency,
    // so it keeps the smooth animated drop for polish — unless the user has reduce-motion enabled,
    // in which case both directions snap instantly.
    if (selected || reducedMotion) {
      lift.setValue(selected ? -liftDistance : 0);
    } else {
      Animated.timing(lift, {
        toValue: 0,
        duration: LIFT_ANIM_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [selected, liftDistance, lift, reducedMotion]);

  return (
    <Animated.View
      style={{ marginLeft, transform: [{ rotate: `${rotateDeg}deg` }, { translateY: Animated.add(lift, curveOffsetY) }] }}
    >
      <Pressable disabled={disabled} onPress={onPress}>
        <PlayingCard {...cardProps} highlighted={selected} />
        {disabled && (
          // Dark scrim marking the card as "not currently tappable" while keeping its art fully
          // visible underneath (richer than dimming the whole card via opacity). A plain local
          // View rather than @world-cards/ui's AbsoluteOverlay: the scrim needs the card's
          // rounded corners on the colored layer itself, which AbsoluteOverlay (a transparent
          // square fill wrapper) would only add as a second nested view. style.pointerEvents
          // (not the deprecated prop form) guarantees it never swallows touches, even though the
          // Pressable above is disabled anyway whenever the scrim shows.
          <View
            testID="selectable-card-disabled-scrim"
            style={[styles.disabledScrim, { borderRadius: cardProps.cardRadius ?? DEFAULT_CARD_RADIUS }]}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disabledScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    pointerEvents: 'none',
  },
});
```

to:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { PlayingCard, PlayingCardProps } from '@world-cards/ui';
import { useReducedMotion } from './useReducedMotion';

export interface SelectableCardHitSlop {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
}

export interface SelectableCardProps extends PlayingCardProps {
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  rotateDeg?: number;
  marginLeft?: number;
  liftDistance?: number;
  curveOffsetY?: number;
  // Shrinks (negative values) or grows (positive) the Pressable's touchable bounds relative to
  // its visual size. Used by Batak's overlapping fan to shrink the SELECTED card's hit box: once
  // lifted and rotated, its axis-aligned touch rectangle is wider than its rotated visual
  // silhouette and can otherwise catch a tap aimed at a neighbor's clearly-exposed face.
  hitSlop?: SelectableCardHitSlop;
}

const DEFAULT_LIFT_DISTANCE = 16;
const LIFT_ANIM_DURATION_MS = 150;
// Matches PlayingCard's default CARD_RADIUS, used when the caller doesn't override cardRadius.
const DEFAULT_CARD_RADIUS = 6;
// How much a selected card scales up, on top of its lift, to read as moving toward the camera.
const SELECTED_SCALE = 1.05;

export function SelectableCard({
  selected = false,
  disabled,
  onPress,
  rotateDeg = 0,
  marginLeft,
  liftDistance = DEFAULT_LIFT_DISTANCE,
  curveOffsetY = 0,
  hitSlop,
  ...cardProps
}: SelectableCardProps) {
  const lift = useRef(new Animated.Value(selected ? -liftDistance : 0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Selecting snaps instantly: a fast player taps once to select and immediately taps again to
    // play, and a 150ms rise would still be mid-flight when that second tap lands. Deselecting
    // (picking a different card, or the selected card unmounting once played) has no such urgency,
    // so it keeps the smooth animated drop for polish — unless the user has reduce-motion enabled,
    // in which case both directions snap instantly.
    if (selected || reducedMotion) {
      lift.setValue(selected ? -liftDistance : 0);
    } else {
      Animated.timing(lift, {
        toValue: 0,
        duration: LIFT_ANIM_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [selected, liftDistance, lift, reducedMotion]);

  // Reuses the same lift driver (no second Animated.Value): fully lifted (-liftDistance) maps to
  // the max scale, at rest (0) maps to 1 — so the scale-up rides the exact same native-driven
  // animation as the lift, with the same instant-select/animated-deselect timing.
  const scale = lift.interpolate({
    inputRange: [-liftDistance, 0],
    outputRange: [SELECTED_SCALE, 1],
  });

  return (
    <Animated.View
      style={{
        marginLeft,
        transform: [
          { rotate: `${rotateDeg}deg` },
          { translateY: Animated.add(lift, curveOffsetY) },
          { scale },
        ],
      }}
    >
      <Pressable disabled={disabled} onPress={onPress} hitSlop={hitSlop}>
        <PlayingCard {...cardProps} highlighted={selected} />
        {disabled && (
          // Dark scrim marking the card as "not currently tappable" while keeping its art fully
          // visible underneath (richer than dimming the whole card via opacity). A plain local
          // View rather than @world-cards/ui's AbsoluteOverlay: the scrim needs the card's
          // rounded corners on the colored layer itself, which AbsoluteOverlay (a transparent
          // square fill wrapper) would only add as a second nested view. style.pointerEvents
          // (not the deprecated prop form) guarantees it never swallows touches, even though the
          // Pressable above is disabled anyway whenever the scrim shows.
          <View
            testID="selectable-card-disabled-scrim"
            style={[styles.disabledScrim, { borderRadius: cardProps.cardRadius ?? DEFAULT_CARD_RADIUS }]}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disabledScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    pointerEvents: 'none',
  },
});
```

- [ ] **Step 2: Flip the z-order in `BatakTable.tsx` and pass the selected card's hitSlop**

Add a constant near the other Batak-local constants (e.g. next to `BATAK_TOP_OVERLAP_PERCENT`):

```ts
// Front-stacking for the selected card (Section 5 of the design spec): must beat every other
// card's zIndex, both in its own row and the other row (see handFanRow's zIndex removal below).
const SELECTED_CARD_Z_INDEX = 10;
const UNSELECTED_CARD_Z_INDEX = 1;
// Shrinks only the currently-selected card's touchable width — see SelectableCard's hitSlop doc
// comment. Deliberately conservative (not the full ~25px rotation-widened estimate) so the
// selected card stays comfortably tappable for the second tap that plays it.
const SELECTED_CARD_HIT_SLOP = { left: -20, right: -20 };
```

In `HandRow`, change:

```tsx
            zIndex={selectedCardId === card.id ? 0 : 1}>
            <SelectableCard
              card={card}
              size="normal"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length, HUMAN_HAND_DEGREES_PER_STEP)}
              curveOffsetY={fanCurveY(i, cards.length, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
              marginLeft={i > 0 ? cardMarginLeft : undefined}
            />
```

to:

```tsx
            zIndex={selectedCardId === card.id ? SELECTED_CARD_Z_INDEX : UNSELECTED_CARD_Z_INDEX}>
            <SelectableCard
              card={card}
              size="normal"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length, HUMAN_HAND_DEGREES_PER_STEP)}
              curveOffsetY={fanCurveY(i, cards.length, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
              marginLeft={i > 0 ? cardMarginLeft : undefined}
              hitSlop={selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined}
            />
```

Also update the comment directly above (currently the long "While a card is selected, unselected neighbors take paint/hit priority..." block) to reflect the new rationale:

```tsx
            // The selected card renders in front of every other card (both its own row and the
            // other row — see handFanRow's zIndex removal below), matching a real lifted card.
            // This is safe from the old "stray tap plays the wrong card" bug because
            // SelectableCard's hitSlop (passed below) shrinks the SELECTED card's touchable
            // bounds specifically — it's the lifted+rotated card whose axis-aligned hit
            // rectangle can otherwise extend past its rotated visual silhouette into a
            // neighbor's clearly-exposed face (confirmed empirically via elementFromPoint
            // hit-mapping in the prior, now-superseded zIndex-inversion fix).
```

- [ ] **Step 3: Remove `handFanRow`'s per-row stacking-context isolation**

In the `styles` object at the bottom of `BatakTable.tsx`, change:

```ts
  handFan: { alignItems: "center", gap: 6 },
  // zIndex: 0 makes each row its own stacking context (rows are flex items), so the per-card
  // zIndex 0/1 dance in HandRow reorders cards only within their row — a selected (zIndex 0)
  // bottom-row card must not slip behind the top row's cards where its lifted top overlaps them.
  // Row-over-row order is unchanged: equal zIndex falls back to render order (bottom row last).
  handFanRow: { flexDirection: "row", justifyContent: "center", zIndex: 0 },
```

to:

```ts
  handFan: { alignItems: "center", gap: 6 },
  // No zIndex here (each row used to be its own stacking context) — removed so a selected
  // bottom-row card's SELECTED_CARD_Z_INDEX also wins against the top row's cards, satisfying
  // "in front of every other card," not just its own row.
  handFanRow: { flexDirection: "row", justifyContent: "center" },
```

- [ ] **Step 4: Typecheck and run the existing suite**

Run:
```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx jest --selectProjects mobile
```
Expected: no errors, same pass count as before.

- [ ] **Step 5: Stage changes**

```bash
git add apps/mobile/src/components/SelectableCard.tsx apps/mobile/src/games/batak/BatakTable.tsx
```

---

### Task 6: Tap-empty-area-to-deselect

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `clearSelection` (already returned by the existing `useCardSelection` hook call in `BatakTable`).
- Produces: none new.

- [ ] **Step 1: Wrap the table's outer container in a `Pressable`**

`Pressable` is already imported in this file (used by `BidControls`/`TrumpSelectionCenter`). Change the component's `return` statement's outermost element from:

```tsx
  return (
    <View style={styles.container}>
      <TableFelt />
```

to:

```tsx
  return (
    <Pressable style={styles.container} onPress={clearSelection}>
      <TableFelt />
```

And change the matching closing tag at the very end of the returned JSX from:

```tsx
      {dealPhase !== "revealing" && <DealAnimationOverlay phase={dealPhase} />}
    </View>
  );
```

to:

```tsx
      {dealPhase !== "revealing" && <DealAnimationOverlay phase={dealPhase} />}
    </Pressable>
  );
```

(Standard React Native touch-responder behavior means any nested `Pressable` — a hand card, a bid button, a trump-suit button — still claims its own tap first; this outer handler only fires for taps that land on felt, wood decoration, layout gaps, or opponent seat areas. `clearSelection` is already idempotent, so this needs no `disabled`/null-check guard.)

- [ ] **Step 2: Typecheck and run the existing suite**

Run:
```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx jest --selectProjects mobile
```
Expected: no errors, same pass count as before.

- [ ] **Step 3: Stage changes**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
```

---

### Task 7: "Dim Unplayable Cards" settings toggle

**Files:**
- Modify: `apps/mobile/src/state/settingsStore.ts`
- Modify: `apps/mobile/src/components/GameScreenLayout.tsx`
- Create: `apps/mobile/src/games/batak/BatakSettingsModal.tsx`
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`
- Modify: `apps/mobile/src/components/SelectableCard.tsx`

**Interfaces:**
- Consumes: `useSettingsStore` (existing Zustand hook).
- Produces: `Settings.dimUnplayableCards: boolean`, `SettingsStore.setDimUnplayableCards(dim: boolean): void`; `GameScreenLayoutProps.onSettingsPress?: () => void`; `BatakSettingsModal({ visible, onClose }): JSX.Element`.

- [ ] **Step 1: Add the setting to `settingsStore.ts`**

Change the full file from:

```ts
import { create } from 'zustand';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Settings {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  defaultDifficulty: Difficulty;
}

export interface SettingsStore extends Settings {
  setTheme: (theme: Settings['theme']) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDefaultDifficulty: (difficulty: Difficulty) => void;
}

export const defaultSettings: Settings = {
  theme: 'light',
  soundEnabled: true,
  defaultDifficulty: 'medium',
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...defaultSettings,
  setTheme: (theme) => set({ theme }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setDefaultDifficulty: (defaultDifficulty) => set({ defaultDifficulty }),
}));
```

to:

```ts
import { create } from 'zustand';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Settings {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  defaultDifficulty: Difficulty;
  // Controls SelectableCard's disabled-scrim visibility (off-turn/illegal cards). Cards that
  // can't be played always stay untappable either way — this only toggles the visual dimming.
  dimUnplayableCards: boolean;
}

export interface SettingsStore extends Settings {
  setTheme: (theme: Settings['theme']) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDefaultDifficulty: (difficulty: Difficulty) => void;
  setDimUnplayableCards: (dim: boolean) => void;
}

export const defaultSettings: Settings = {
  theme: 'light',
  soundEnabled: true,
  defaultDifficulty: 'medium',
  dimUnplayableCards: true,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...defaultSettings,
  setTheme: (theme) => set({ theme }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setDefaultDifficulty: (defaultDifficulty) => set({ defaultDifficulty }),
  setDimUnplayableCards: (dimUnplayableCards) => set({ dimUnplayableCards }),
}));
```

- [ ] **Step 2: Add the gear button to `GameScreenLayout.tsx`**

Change the full file from:

```tsx
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

export interface GameScreenLayoutProps {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
}

export function GameScreenLayout({ title, onExit, children, backgroundColor, titleColor }: GameScreenLayoutProps) {
  function handleExitPress() {
    Alert.alert('Discard this game?', 'Your progress in this hand will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onExit },
    ]);
  }

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null]}>
      <View style={styles.header}>
        <Text style={[styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
        <Pressable onPress={handleExitPress} accessibilityRole="button">
          <Text style={styles.exit}>Exit</Text>
        </Pressable>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  exit: { fontSize: 16, color: '#c0392b' },
  content: { flex: 1 },
});
```

to:

```tsx
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

export interface GameScreenLayoutProps {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
  // When provided, renders a small gear button in the header. Omitted by call sites that don't
  // have a settings surface yet (e.g. Pişti today) — the header is visually unchanged for them.
  onSettingsPress?: () => void;
}

export function GameScreenLayout({
  title,
  onExit,
  children,
  backgroundColor,
  titleColor,
  onSettingsPress,
}: GameScreenLayoutProps) {
  function handleExitPress() {
    Alert.alert('Discard this game?', 'Your progress in this hand will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onExit },
    ]);
  }

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null]}>
      <View style={styles.header}>
        <Text style={[styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
        <View style={styles.headerActions}>
          {onSettingsPress && (
            <Pressable onPress={onSettingsPress} accessibilityRole="button" testID="game-settings-button">
              <Text style={styles.settingsIcon}>⚙</Text>
            </Pressable>
          )}
          <Pressable onPress={handleExitPress} accessibilityRole="button">
            <Text style={styles.exit}>Exit</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingsIcon: { fontSize: 20 },
  exit: { fontSize: 16, color: '#c0392b' },
  content: { flex: 1 },
});
```

- [ ] **Step 3: Create `BatakSettingsModal.tsx`**

Create `apps/mobile/src/games/batak/BatakSettingsModal.tsx`:

```tsx
import React from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '../../state/settingsStore';

export interface BatakSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BatakSettingsModal({ visible, onClose }: BatakSettingsModalProps) {
  const dimUnplayableCards = useSettingsStore((s) => s.dimUnplayableCards);
  const setDimUnplayableCards = useSettingsStore((s) => s.setDimUnplayableCards);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.heading}>Settings</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dim Unplayable Cards</Text>
            <Switch value={dimUnplayableCards} onValueChange={setDimUnplayableCards} />
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 260 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 15, flexShrink: 1 },
  closeButton: { marginTop: 20, alignSelf: 'center' },
  closeText: { fontSize: 16, color: '#2f5fa8', fontWeight: '600' },
});
```

- [ ] **Step 4: Wire it into `BatakScreen.tsx`**

Add the import (alongside the other local imports):

```ts
import { BatakSettingsModal } from './BatakSettingsModal';
```

In the `ActiveGame` function, add state near the existing `pendingPlay` state:

```ts
  const [settingsVisible, setSettingsVisible] = useState(false);
```

Change the `<GameScreenLayout ...>` call from:

```tsx
    <GameScreenLayout title="Batak" onExit={onBackHome} backgroundColor="#0b6623" titleColor="#f4c542">
```

to:

```tsx
    <GameScreenLayout
      title="Batak"
      onExit={onBackHome}
      backgroundColor="#0b6623"
      titleColor="#f4c542"
      onSettingsPress={() => setSettingsVisible(true)}>
```

And add the modal as a sibling of `BatakTable`/`GameResultModal` inside that same `GameScreenLayout`:

```tsx
      <BatakSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
```

- [ ] **Step 5: Gate `SelectableCard`'s scrim on the setting**

In `apps/mobile/src/components/SelectableCard.tsx`, add the import:

```ts
import { useSettingsStore } from '../state/settingsStore';
```

Inside the `SelectableCard` function body (after the existing `reducedMotion` line), add:

```ts
  const dimUnplayableCards = useSettingsStore((s) => s.dimUnplayableCards);
```

Change:

```tsx
        {disabled && (
```

to:

```tsx
        {disabled && dimUnplayableCards && (
```

- [ ] **Step 6: Typecheck and run the existing suite**

Run:
```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx jest --selectProjects mobile
```
Expected: no errors. `GameScreenLayout.test.tsx` and `settingsStore.test.ts` (both pre-existing, neither asserts on the new field/prop) must still pass; overall pass count is unchanged since no new tests were added.

- [ ] **Step 7: Stage changes**

```bash
git add apps/mobile/src/state/settingsStore.ts apps/mobile/src/components/GameScreenLayout.tsx apps/mobile/src/games/batak/BatakSettingsModal.tsx apps/mobile/src/games/batak/BatakScreen.tsx apps/mobile/src/components/SelectableCard.tsx
```

---

### Task 8: Manual visual verification

**Files:** none (no code changes — this task validates Tasks 1-7 together).

This task requires visual judgment, so it's done directly (via the browser/Playwright workflow already established for this project — see `[[dev_sandbox_no_device_access]]`), not dispatched to a subagent.

- [ ] **Step 1: Start the web build**

```bash
npx expo start --web
```

- [ ] **Step 2: Screenshot and verify each item**

Using Playwright against the running `expo start --web` server, drive a Batak game through setup, bidding, and several tricks, and confirm:
- Edge rails render on all 4 sides, meeting the existing corner wedges without gaps or overlap.
- The human's "You" badge sits above the cards (closer to the middle row); the hand fan hugs the bottom edge.
- AI 2 (top seat)'s fan reads as tightly overlapped, matching the side stacks' density — no visible gaps between its cards.
- The human hand shows a visibly flatter arc than before, with a consistent gutter on both left and right sides, at both a full (13-card) hand and a near-empty (1-2 card) hand late in a trick-playing sequence.
- Selecting a hand card: it visually lifts, scales up slightly, and paints in front of both its own-row neighbors and the other row (a bottom-row selection should visibly overlap on top of the top row where they're close).
- Using `elementFromPoint` at the visual boundary between the selected card and its neighbor confirms the tap resolves to whichever card is actually on top there — explicitly note in the verification writeup that this only validates web hit-testing, and that native Android view-flattening (the same risk flagged for the original zIndex fix) still needs an on-device spot-check when available.
- Tapping empty felt/wood/gap space deselects a selected card (it drops back to rest); tapping a bid button, a trump-suit button, or a different card still works normally and doesn't get eaten by the new deselect handler.
- The new gear button appears in Batak's header (not Pişti's); opening it shows the "Dim Unplayable Cards" switch; toggling it off removes the dark scrim from illegal/off-turn cards while they remain untappable; toggling it back on restores today's look exactly.

- [ ] **Step 3: Report findings**

If anything looks wrong (e.g. the flatter-slope constants from Task 4 or the rail thickness from Task 1 need retuning), fix it directly in the relevant file, re-screenshot to confirm, then stage the fix:

```bash
git add -u
```

- [ ] **Step 4: Stop the dev server**

Stop the `expo start --web` process once verification is complete.

---

## Self-Review Notes

- **Spec coverage:** Item 1 → Task 1. Item 2 → Task 3. Item 3 → Task 5. Item 4 → Task 6. Item 5 → Task 7. Item 6 → Task 2. Item 7 → Task 4. All 7 spec items map to a task; manual verification (Task 8) covers all of them together.
- **Placeholder scan:** no TBD/TODO; every step shows complete, real code.
- **Type consistency:** `fanRotationDeg`/`fanCurveY`'s new optional parameters are named and typed identically everywhere they're used (Task 4's `seating.ts` definition and `BatakTable.tsx`'s call sites). `SelectableCardProps.hitSlop` (Task 5) matches the `SELECTED_CARD_HIT_SLOP` shape used in `BatakTable.tsx`. `cardMarginLeft` (Task 4) is threaded through `HandRow`'s props and both call sites consistently. `dimUnplayableCards`/`setDimUnplayableCards` (Task 7) match between `settingsStore.ts`'s interface and `SelectableCard.tsx`'s/`BatakSettingsModal.tsx`'s usage.

## Next Step

Plan complete and saved to `docs/superpowers/plans/2026-07-16-batak-table-ui-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
