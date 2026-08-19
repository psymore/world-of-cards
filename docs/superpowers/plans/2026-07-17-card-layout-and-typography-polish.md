# Card Corner-Index & AI Hand-Layout Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the corner rank/suit optical-centering bug in the shared `PlayingCard` component, flatten and auto-scale the AI opponent hand fan/stacks in both Pişti and Batak, and widen the human hand's margin on phones — matching the Alper Games Batak reference.

**Architecture:** `packages/ui/src/PlayingCard.tsx`'s corner index switches from a shrink-wrap `flex-start` box to a fixed-width `center`-aligned box (benefits Pişti, Batak, and the playground automatically, since it's the same shared component). `apps/mobile/src/table/seating.ts`'s existing generic `fillWidthMarginPx` helper (already used for the human hand's width-fill) gets reused for opponent-hand spacing too — one continuous formula that spreads a small hand evenly and compresses a large hand automatically — wired into both `PistiTable.tsx` and `BatakTable.tsx` via `onLayout`-measured available space, replacing today's static overlap percentages and the rotated/curved fan. Dead constants get removed once nothing references them.

**Tech Stack:** React Native (Expo 57), TypeScript, `react-native-svg`, Jest (`jest-expo` + RNTL) for regression checks, `playwright-core` + local Chrome for manual visual verification (per `docs/references/batak-and-card-references/` and the established browser-based verification workflow — no on-device access in this environment).

## Global Constraints

- No new automated tests for this change, per the project's standing 2026-07-07 mobile-UI testing policy — existing tests must keep passing unchanged.
- `packages/engine` and engine-level game logic are untouched; this is a presentation-only change.
- The human ("You") hand's own fan in Batak (rotation via `fanRotationDeg`/`fanCurveY` in `HandRow`) is explicitly kept as-is — do not touch it.
- Pişti's human hand row is explicitly kept as-is — it already fits its max-4-card hand comfortably on any phone width.
- Exact pixel/fraction constants below (`CORNER_INDEX_WIDTH`, `*_MAX_GAP`, `*_FRACTION`) are first-pass tuned-by-eye values. Adjust them if the final manual visual-verification task (Task 5) shows something looks wrong (overflow, excessive gaps, clipped text) — note any adjustment you make in that task's summary.

---

### Task 1: Corner index optical centering

**Files:**
- Modify: `packages/ui/src/PlayingCard.tsx:48-60` (constants), `packages/ui/src/PlayingCard.tsx:373-411` (corner styles + comments)

**Interfaces:**
- Consumes: nothing new — pure internal restyle of `CornerIndex`/`styles.cornerNormal` etc., already used by both `apps/mobile` games and `apps/playground`.
- Produces: no new exports. `PlayingCard`'s public props (`PlayingCardProps`) are unchanged.

- [ ] **Step 1: Add the `CORNER_INDEX_WIDTH` constant**

In `packages/ui/src/PlayingCard.tsx`, find:

```ts
const RED_SUITS: Suit[] = ["hearts", "diamonds"];
const SUIT_COLOR = { red: "#c0392b", black: "#111" };
const CORNER_ICON_SIZE = { normal: 18, small: 12 };
const WATERMARK_ICON_SIZE = { normal: 50, small: 31 };
```

Replace with:

```ts
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
```

- [ ] **Step 2: Replace the corner style block**

Find (near the bottom of the `styles` object, right after `highlighted`):

```ts
  // zIndex is explicit (not left to default child order) because centerArt's court-card Image
  // is added after these in the tree and would otherwise paint over the corner index on native
  // platforms, which stack by array order regardless of position — unlike the browser, where
  // position: absolute already happens to paint on top.
  // alignItems: 'flex-start' (not 'center') is load-bearing, not just "hug the corner": this
  // container shrink-wraps to its widest child, and "10" is the only two-character rank — with
  // 'center', the suit icon below it would get centered under a wider box than every other
  // rank's, visibly drifting off-center relative to them. 'flex-start' anchors every child
  // (rank text and suit icon alike) to the same left edge regardless of that child's own width,
  // so the icon lines up identically under every rank, "10" included, with no fixed-width hack.
  // Corner offsets are inset from the card edge (rather than hugging it) so the rank/suit index
  // reads as deliberately placed, not jammed into the corner — keep the mirrored pair's
  // bottom/right values matched to the unmirrored top/left, since it's a 180°-rotated duplicate.
  cornerNormal: {
    position: "absolute",
    top: 4,
    left: 5,
    alignItems: "flex-start",
    zIndex: 1,
  },
  cornerSmall: {
    position: "absolute",
    top: 3,
    left: 3,
    alignItems: "flex-start",
    zIndex: 1,
  },
  cornerNormalMirrored: {
    position: "absolute",
    bottom: 4,
    right: 5,
    alignItems: "flex-start",
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
  cornerSmallMirrored: {
    position: "absolute",
    bottom: 3,
    right: 3,
    alignItems: "flex-start",
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
```

Replace with:

```ts
  // zIndex is explicit (not left to default child order) because centerArt's court-card Image
  // is added after these in the tree and would otherwise paint over the corner index on native
  // platforms, which stack by array order regardless of position — unlike the browser, where
  // position: absolute already happens to paint on top.
  // width: CORNER_INDEX_WIDTH + alignItems: 'center' (not shrink-wrap + 'flex-start') is what
  // makes the index optically centered: every rank's text and its suit icon center within the
  // same fixed box, so a card's own rank always shares a center axis with its own glyph (fixing
  // "10" drifting from its suit icon), and that box is the same width for every rank, so the
  // glyph's absolute offset from the corner no longer varies card-to-card either.
  // Corner offsets are inset from the card edge (rather than hugging it) so the rank/suit index
  // reads as deliberately placed, not jammed into the corner — keep the mirrored pair's
  // bottom/right values matched to the unmirrored top/left, since it's a 180°-rotated duplicate.
  cornerNormal: {
    position: "absolute",
    top: 4,
    left: 5,
    width: CORNER_INDEX_WIDTH.normal,
    alignItems: "center",
    gap: 2,
    zIndex: 1,
  },
  cornerSmall: {
    position: "absolute",
    top: 3,
    left: 3,
    width: CORNER_INDEX_WIDTH.small,
    alignItems: "center",
    gap: 1,
    zIndex: 1,
  },
  cornerNormalMirrored: {
    position: "absolute",
    bottom: 4,
    right: 5,
    width: CORNER_INDEX_WIDTH.normal,
    alignItems: "center",
    gap: 2,
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
  cornerSmallMirrored: {
    position: "absolute",
    bottom: 3,
    right: 3,
    width: CORNER_INDEX_WIDTH.small,
    alignItems: "center",
    gap: 1,
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
```

- [ ] **Step 3: Run the existing PlayingCard tests**

Run: `npx jest --selectProjects ui -t PlayingCard`
Expected: PASS (all 4 existing tests in `packages/ui/src/PlayingCard.test.tsx` — they assert on text content and testIDs, not on style values, so they're unaffected by this restyle).

- [ ] **Step 4: Typecheck the ui package**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/PlayingCard.tsx
git commit -m "Fix corner rank/suit optical centering with a fixed-width index box"
```

---

### Task 2: Pişti opponent hand — flat, auto-fit spacing

**Files:**
- Modify: `apps/mobile/src/games/pisti/pistiSeating.ts`
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`

**Interfaces:**
- Consumes: `fillWidthMarginPx(cardDimension: number, count: number, targetSpan: number, maxGap: number): number | undefined` from `apps/mobile/src/table/seating.ts` (already exists, already used for the human hand's width-fill in `BatakTable.tsx` — unchanged signature).
- Produces: no new exports outside this file. `OpponentSeatProps` gains a `sideStackHeight: number` field (internal to this file).

- [ ] **Step 1: Trim `pistiSeating.ts`'s re-exports**

In `apps/mobile/src/games/pisti/pistiSeating.ts`, find:

```ts
export {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  OPPONENT_CARD_OVERLAP,
  SIDE_CARD_STYLES,
} from '../../table/seating';
export type { Seat, SeatPosition } from '../../table/seating';
```

Replace with:

```ts
export {
  assignSeats,
  fillWidthMarginPx,
} from '../../table/seating';
export type { Seat, SeatPosition } from '../../table/seating';
```

(`fanCurveY`/`fanRotationDeg`/`OPPONENT_CARD_OVERLAP`/`SIDE_CARD_STYLES` are no longer used anywhere in Pişti after this task — they stay defined in `../../table/seating` for now since Batak's human hand fan still uses `fanRotationDeg`/`fanCurveY` directly from there; `OPPONENT_CARD_OVERLAP`/`SIDE_CARD_STYLES` get removed from `seating.ts` itself in Task 4, once Task 3 also stops using them.)

- [ ] **Step 2: Update `PistiTable.tsx`'s imports**

Find:

```ts
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-of-cards/engine';
import type { PistiState } from '@world-of-cards/engine/games/pisti';
import { PlayingCard, TableFelt, TableWoodCorners, glowShadow } from '@world-of-cards/ui';
import { SelectableCard } from '../../components/SelectableCard';
import { useCardSelection } from '../../components/useCardSelection';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { useReducedMotion } from '../../components/useReducedMotion';
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  OPPONENT_CARD_OVERLAP,
  resolveRevealOrigin,
  revealOriginOffset,
  SIDE_CARD_STYLES,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
```

Replace with:

```ts
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Card } from '@world-of-cards/engine';
import type { PistiState } from '@world-of-cards/engine/games/pisti';
import { PlayingCard, TableFelt, TableWoodCorners, glowShadow } from '@world-of-cards/ui';
import { SelectableCard } from '../../components/SelectableCard';
import { useCardSelection } from '../../components/useCardSelection';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { useReducedMotion } from '../../components/useReducedMotion';
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
```

- [ ] **Step 3: Add the opponent-fan spacing constants**

Find (right after the `PistiRevealCard` interface / before `MAX_STACKED_PILE_CARDS`):

```ts
export interface PistiRevealCard {
  card: Card;
  playerId: string;
}
```

Leave that as-is, but immediately below the existing `MAX_STACKED_PILE_CARDS`/`PILE_CARD_OFFSETS` block, add:

```ts
const SMALL_CARD_WIDTH = 54; // matches PlayingCard's 'small' size width
const SMALL_CARD_HEIGHT = 78; // matches PlayingCard's 'small' size height
// Opponent hands render flat (no rotation/curve). Spacing auto-scales via fillWidthMarginPx: a
// small hand (Pişti's max-4 opponent cards) spreads into an evenly-gapped row (capped at
// *_MAX_GAP so it doesn't look sparse); a larger hand compresses into overlap automatically as
// count grows — one continuous rule instead of two separate "row" vs. "fan" modes.
const TOP_FAN_WIDTH_FRACTION = 0.85; // fraction of window width the top seat's row may use
const TOP_FAN_MAX_GAP = 10;
const SIDE_STACK_HEIGHT_FRACTION = 0.82; // fraction of the measured middle-row height the side stack may use
const SIDE_FAN_MAX_GAP = 10;
```

- [ ] **Step 4: Rewrite `OpponentSeat`**

Find:

```ts
interface OpponentSeatProps {
  seat: Seat;
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
}

function OpponentSeat({ seat, state, playerNames, revealCard }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  const count = Math.max(isRevealing ? hand.length - 1 : hand.length, 0);
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const isCurrentTurn = state.players[state.currentPlayerIndex] === playerId;

  return (
    <View style={[styles.opponentArea, isSide && styles.opponentAreaSide, isCurrentTurn && styles.activeArea]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        capturedCount={capturedCount}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View style={isSide ? styles.opponentColumn : styles.opponentRow} testID={`opponent-hand-${playerId}`}>
        {Array.from({ length: count }).map((_, i, arr) =>
          isSide ? (
            <PlayingCard key={i} faceDown size="small" style={SIDE_CARD_STYLES[i]} />
          ) : (
            <PlayingCard
              key={i}
              faceDown
              size="small"
              style={[
                i > 0 && { marginLeft: -OPPONENT_CARD_OVERLAP },
                {
                  transform: [
                    { rotate: `${fanRotationDeg(i, arr.length)}deg` },
                    { translateY: fanCurveY(i, arr.length) },
                  ],
                },
              ]}
            />
          )
        )}
      </View>
    </View>
  );
}
```

Replace with:

```ts
interface OpponentSeatProps {
  seat: Seat;
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  // Measured height of the middle row (see PistiTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentSeat({ seat, state, playerNames, revealCard, sideStackHeight }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  const count = Math.max(isRevealing ? hand.length - 1 : hand.length, 0);
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const isCurrentTurn = state.players[state.currentPlayerIndex] === playerId;

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(SMALL_CARD_HEIGHT, count, sideStackHeight * SIDE_STACK_HEIGHT_FRACTION, SIDE_FAN_MAX_GAP)
    : fillWidthMarginPx(SMALL_CARD_WIDTH, count, windowWidth * TOP_FAN_WIDTH_FRACTION, TOP_FAN_MAX_GAP);
  // Precomputed per-index style array (stable reference when count/cardMargin/isSide don't
  // change) so PlayingCard's React.memo can still skip re-rendering unchanged face-down cards —
  // the same reasoning as the PILE_CARD_OFFSETS array above, just computed dynamically instead
  // of statically since the margin now depends on measured layout.
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0 ? undefined : isSide ? { marginTop: cardMargin } : { marginLeft: cardMargin }
      ),
    [count, cardMargin, isSide]
  );

  return (
    <View style={[styles.opponentArea, isSide && styles.opponentAreaSide, isCurrentTurn && styles.activeArea]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        capturedCount={capturedCount}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View style={isSide ? styles.opponentColumn : styles.opponentRow} testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Thread `sideStackHeight` through `OpponentSeatGroup`**

Find:

```ts
function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  revealCard,
}: {
  position: Seat['position'];
  seats: Seat[];
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
}) {
  return (
    <>
      {seats
        .filter((seat) => seat.position === position)
        .map((seat) => (
          <OpponentSeat key={seat.playerId} seat={seat} state={state} playerNames={playerNames} revealCard={revealCard} />
        ))}
    </>
  );
}
```

Replace with:

```ts
function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  revealCard,
  sideStackHeight,
}: {
  position: Seat['position'];
  seats: Seat[];
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  sideStackHeight: number;
}) {
  return (
    <>
      {seats
        .filter((seat) => seat.position === position)
        .map((seat) => (
          <OpponentSeat
            key={seat.playerId}
            seat={seat}
            state={state}
            playerNames={playerNames}
            revealCard={revealCard}
            sideStackHeight={sideStackHeight}
          />
        ))}
    </>
  );
}
```

- [ ] **Step 6: Measure the middle row and wire it through in `PistiTable`**

Find (inside `export function PistiTable({...`):

```ts
  const { selectedCardId, selectCard, clearSelection } = useCardSelection(onPlayCard);
  useEffect(() => {
    if (!isHumanTurn) clearSelection();
  }, [isHumanTurn, clearSelection]);

  const seats = assignSeats(opponentPlayerIds);

  return (
    <View style={styles.container}>
      <TableFelt />
      <TableWoodCorners />
      <OpponentSeatGroup position="top" seats={seats} state={state} playerNames={playerNames} revealCard={revealCard} />

      <View style={styles.middleRow}>
        <OpponentSeatGroup position="left" seats={seats} state={state} playerNames={playerNames} revealCard={revealCard} />
```

Replace with:

```ts
  const { selectedCardId, selectCard, clearSelection } = useCardSelection(onPlayCard);
  useEffect(() => {
    if (!isHumanTurn) clearSelection();
  }, [isHumanTurn, clearSelection]);

  const seats = assignSeats(opponentPlayerIds);

  // Side seats live inside a centered (non-stretching) flex row, so there's no way to derive
  // their available vertical space from window height alone — measure the row itself. 280 is a
  // reasonable pre-layout guess (corrected after the first onLayout pass), the same pattern
  // BatakTable's handAreaWidth already uses for its own width-fill measurement.
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }

  return (
    <View style={styles.container}>
      <TableFelt />
      <TableWoodCorners />
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        revealCard={revealCard}
        sideStackHeight={middleRowHeight}
      />

      <View style={styles.middleRow} onLayout={handleMiddleRowLayout}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          sideStackHeight={middleRowHeight}
        />
```

- [ ] **Step 7: Update the remaining `OpponentSeatGroup` call site (right seat)**

Find:

```ts
        <OpponentSeatGroup position="right" seats={seats} state={state} playerNames={playerNames} revealCard={revealCard} />
      </View>
```

Replace with:

```ts
        <OpponentSeatGroup
          position="right"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          sideStackHeight={middleRowHeight}
        />
      </View>
```

- [ ] **Step 8: Run the existing PistiTable tests**

Run: `npx jest --selectProjects mobile -t PistiTable`
Expected: PASS (all 7 existing tests — none assert on card style/position, only on text/testID presence).

- [ ] **Step 9: Typecheck the mobile app**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/games/pisti/pistiSeating.ts apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "Flatten Pişti's opponent hand fan into auto-fit spacing"
```

---

### Task 3: Batak opponent hand — flat, auto-fit spacing + wider human hand margin

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `fillWidthMarginPx` from `../../table/seating` (already imported in this file).
- Produces: no new exports. `OpponentSeatProps`/`OpponentSeatGroup`'s prop shape gains `sideStackHeight: number`, mirroring Task 2's Pişti version (same name/type, independent implementation per file — these two table components are deliberately not unified, matching this codebase's existing precedent of keeping per-game table components independent).

- [ ] **Step 1: Update imports — add `useMemo`, drop `overlapMarginPx`**

Find:

```ts
import React, { useEffect, useRef, useState } from "react";
```

Replace with:

```ts
import React, { useEffect, useMemo, useRef, useState } from "react";
```

Find:

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

Replace with:

```ts
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
} from "../../table/seating";
```

(`fanRotationDeg`/`fanCurveY` stay imported — they're still used by `HandRow`, the human hand's own fan, which is unchanged by this task.)

- [ ] **Step 2: Bump the human hand's spread fraction**

Find:

```ts
// Reserve a 15% gutter on each side (i.e. cards span the middle 70% of the hand area's real
// width) instead of a fixed-percent overlap that doesn't adapt to device width.
const HUMAN_HAND_SPREAD_FRACTION = 0.7;
```

Replace with:

```ts
// Reserve a small ~4% gutter on each side (i.e. cards span the middle 92% of the hand area's
// real width) instead of a fixed-percent overlap that doesn't adapt to device width — bumped
// from 0.7 (15% gutter) to spread much closer to the Alper Games reference.
const HUMAN_HAND_SPREAD_FRACTION = 0.92;
```

- [ ] **Step 3: Remove the now-superseded opponent-fan constants**

Find:

```ts
// Batak-local override of seating.ts's shared SIDE_CARD_STYLES: with 13-card starting hands, the
// shared 45px flat overlap (~58% of a small card) makes each side stack ~474px tall — taller than
// the middle row on a phone screen. A tighter 85% overlap keeps the full stack ~222px. Kept local
// (rather than changing the shared constant) so Pişti's finalized side-stack look is untouched.
// overlapMarginPx is generic "dimension × percent" despite its cardWidth param name — it's already
// the established way to derive an overlap margin from a percentage (see HUMAN_HAND_MARGIN above).
const SMALL_CARD_HEIGHT = 78; // matches PlayingCard's 'small' size height
const SMALL_CARD_WIDTH = 54; // matches PlayingCard's 'small' size width
const BATAK_SIDE_OVERLAP_PERCENT = 85;
// AI 2 (top seat)'s fan previously overlapped by a fixed 21px (~39% of a small card), which read
// as loose/uneven. Reuse the same percentage-overlap approach as the side stacks for a
// consistently tight fan across every AI seat.
const BATAK_TOP_OVERLAP_PERCENT = 85;
// Sized to 13 to cover Batak's full starting hand (same ceiling reasoning as seating.ts's
// MAX_SIDE_STACK_CARDS) — a stable style object per index keeps PlayingCard's React.memo effective.
const BATAK_MAX_SIDE_STACK_CARDS = 13;
// Front-stacking for the selected card (Section 5 of the design spec): must beat every other
// card's zIndex, both in its own row and the other row (see handFanRow's zIndex removal below).
const SELECTED_CARD_Z_INDEX = 10;
const UNSELECTED_CARD_Z_INDEX = 1;
// Shrinks only the currently-selected card's touchable width — see SelectableCard's hitSlop doc
// comment. Deliberately conservative (not the full ~25px rotation-widened estimate) so the
// selected card stays comfortably tappable for the second tap that plays it.
const SELECTED_CARD_HIT_SLOP = { left: -20, right: -20 };
const BATAK_SIDE_CARD_STYLES: ({ marginTop: number } | undefined)[] =
  Array.from({ length: BATAK_MAX_SIDE_STACK_CARDS }, (_, i) =>
    i > 0
      ? {
          marginTop: overlapMarginPx(
            SMALL_CARD_HEIGHT,
            BATAK_SIDE_OVERLAP_PERCENT,
          ),
        }
      : undefined,
  );
```

Replace with:

```ts
const SMALL_CARD_HEIGHT = 78; // matches PlayingCard's 'small' size height
const SMALL_CARD_WIDTH = 54; // matches PlayingCard's 'small' size width
// Opponent hands render flat (no rotation/curve). Spacing auto-scales via fillWidthMarginPx: a
// small hand spreads into an evenly-gapped row (capped at *_MAX_GAP so it doesn't look sparse); a
// larger hand (Batak's 13-card starting hand) compresses into overlap automatically as count
// grows — one continuous rule instead of two separate "row" vs. "fan" modes.
const TOP_FAN_WIDTH_FRACTION = 0.85; // fraction of window width the top seat's row may use
const TOP_FAN_MAX_GAP = 10;
const SIDE_STACK_HEIGHT_FRACTION = 0.82; // fraction of the measured middle-row height the side stack may use
const SIDE_FAN_MAX_GAP = 10;
// Front-stacking for the selected card (Section 5 of the design spec): must beat every other
// card's zIndex, both in its own row and the other row (see handFanRow's zIndex removal below).
const SELECTED_CARD_Z_INDEX = 10;
const UNSELECTED_CARD_Z_INDEX = 1;
// Shrinks only the currently-selected card's touchable width — see SelectableCard's hitSlop doc
// comment. Deliberately conservative (not the full ~25px rotation-widened estimate) so the
// selected card stays comfortably tappable for the second tap that plays it.
const SELECTED_CARD_HIT_SLOP = { left: -20, right: -20 };
```

- [ ] **Step 4: Rewrite `OpponentSeat`**

Find:

```ts
interface OpponentSeatProps {
  seat: Seat;
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}

function OpponentSeat({
  seat,
  state,
  playerNames,
  pendingPlay,
}: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isPending = pendingPlay != null && pendingPlay.playerId === playerId;
  const count = Math.max(isPending ? hand.length - 1 : hand.length, 0);
  const isCurrentTurn =
    state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  return (
    <View
      style={[
        styles.opponentArea,
        // The top seat's fan is convex (ends rise, see fanCurveY(..., -1) below) — pad it down so
        // the raised end cards don't tuck under the navigation header at full 13-card hand size.
        !isSide && styles.opponentAreaTop,
        isSide && styles.opponentAreaSide,
        isCurrentTurn && styles.activeArea,
      ]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View
        style={isSide ? styles.opponentColumn : styles.opponentRow}
        testID={`opponent-hand-${playerId}`}>
        {Array.from({ length: count }).map((_, i, arr) =>
          isSide ? (
            <PlayingCard
              key={i}
              faceDown
              size="small"
              style={BATAK_SIDE_CARD_STYLES[i]}
            />
          ) : (
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
          ),
        )}
      </View>
    </View>
  );
}
```

Replace with:

```ts
interface OpponentSeatProps {
  seat: Seat;
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  // Measured height of the middle row (see BatakTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentSeat({
  seat,
  state,
  playerNames,
  pendingPlay,
  sideStackHeight,
}: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isPending = pendingPlay != null && pendingPlay.playerId === playerId;
  const count = Math.max(isPending ? hand.length - 1 : hand.length, 0);
  const isCurrentTurn =
    state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(SMALL_CARD_HEIGHT, count, sideStackHeight * SIDE_STACK_HEIGHT_FRACTION, SIDE_FAN_MAX_GAP)
    : fillWidthMarginPx(SMALL_CARD_WIDTH, count, windowWidth * TOP_FAN_WIDTH_FRACTION, TOP_FAN_MAX_GAP);
  // Precomputed per-index style array (stable reference when count/cardMargin/isSide don't
  // change) so PlayingCard's React.memo can still skip re-rendering unchanged face-down cards.
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0 ? undefined : isSide ? { marginTop: cardMargin } : { marginLeft: cardMargin },
      ),
    [count, cardMargin, isSide],
  );

  return (
    <View
      style={[
        styles.opponentArea,
        isSide && styles.opponentAreaSide,
        isCurrentTurn && styles.activeArea,
      ]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View
        style={isSide ? styles.opponentColumn : styles.opponentRow}
        testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}
```

Note: the `!isSide && styles.opponentAreaTop` extra top padding is dropped from the style array — it existed only to keep the old convex fan's raised end-cards clear of the header, and that curve is gone now. `opponentAreaTop`'s style definition itself can stay unused in `StyleSheet.create` (harmless), or be removed in this same step for cleanliness — remove it from the `styles` object too:

Find:

```ts
  opponentAreaTop: { paddingTop: 32 },
```

Delete this line entirely.

- [ ] **Step 5: Thread `sideStackHeight` through `OpponentSeatGroup`**

Find:

```ts
function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  pendingPlay,
}: {
  position: SeatPosition;
  seats: Seat[];
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}) {
  return (
    <>
      {seats
        .filter(seat => seat.position === position)
        .map(seat => (
          <OpponentSeat
            key={seat.playerId}
            seat={seat}
            state={state}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
          />
        ))}
    </>
  );
}
```

Replace with:

```ts
function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  pendingPlay,
  sideStackHeight,
}: {
  position: SeatPosition;
  seats: Seat[];
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  sideStackHeight: number;
}) {
  return (
    <>
      {seats
        .filter(seat => seat.position === position)
        .map(seat => (
          <OpponentSeat
            key={seat.playerId}
            seat={seat}
            state={state}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
            sideStackHeight={sideStackHeight}
          />
        ))}
    </>
  );
}
```

- [ ] **Step 6: Measure the middle row and wire it through in `BatakTable`**

Find (inside `export function BatakTable({...`):

```ts
  const { width: windowWidth } = useWindowDimensions();
  const [handAreaWidth, setHandAreaWidth] = useState(windowWidth);
  function handleHandAreaLayout(event: LayoutChangeEvent) {
    setHandAreaWidth(event.nativeEvent.layout.width);
  }
  const handSpanTarget = handAreaWidth * HUMAN_HAND_SPREAD_FRACTION;
  const topRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, topRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);
  const bottomRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, bottomRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);

  return (
    <Pressable style={styles.container} onPress={clearSelection}>
      <TableFelt />
      <TableWoodCorners />
      <TableEdgeRails />
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        pendingPlay={pendingPlay}
      />

      <View style={styles.middleRow}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          state={state}
          playerNames={playerNames}
          pendingPlay={pendingPlay}
        />
```

Replace with:

```ts
  const { width: windowWidth } = useWindowDimensions();
  const [handAreaWidth, setHandAreaWidth] = useState(windowWidth);
  function handleHandAreaLayout(event: LayoutChangeEvent) {
    setHandAreaWidth(event.nativeEvent.layout.width);
  }
  const handSpanTarget = handAreaWidth * HUMAN_HAND_SPREAD_FRACTION;
  const topRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, topRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);
  const bottomRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, bottomRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);

  // Side seats live inside a centered (non-stretching) flex row, so there's no way to derive
  // their available vertical space from window height alone — measure the row itself. 280 is a
  // reasonable pre-layout guess (corrected after the first onLayout pass), same pattern as
  // handAreaWidth's own default above.
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }

  return (
    <Pressable style={styles.container} onPress={clearSelection}>
      <TableFelt />
      <TableWoodCorners />
      <TableEdgeRails />
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        pendingPlay={pendingPlay}
        sideStackHeight={middleRowHeight}
      />

      <View style={styles.middleRow} onLayout={handleMiddleRowLayout}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          state={state}
          playerNames={playerNames}
          pendingPlay={pendingPlay}
          sideStackHeight={middleRowHeight}
        />
```

- [ ] **Step 7: Update the remaining `OpponentSeatGroup` call site (right seat)**

Find:

```ts
        <OpponentSeatGroup
          position="right"
          seats={seats}
          state={state}
          playerNames={playerNames}
          pendingPlay={pendingPlay}
        />
      </View>
```

Replace with:

```ts
        <OpponentSeatGroup
          position="right"
          seats={seats}
          state={state}
          playerNames={playerNames}
          pendingPlay={pendingPlay}
          sideStackHeight={middleRowHeight}
        />
      </View>
```

- [ ] **Step 8: Typecheck the mobile app**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors. (There is no `BatakTable.test.tsx` today, per the standing mobile-UI testing policy — nothing to run here beyond typecheck.)

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Flatten Batak's opponent hand fan and widen the human hand's margin"
```

---

### Task 4: Remove now-dead shared geometry constants

**Files:**
- Modify: `apps/mobile/src/table/seating.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `apps/mobile/src/table/seating.ts` no longer exports `OPPONENT_CARD_OVERLAP`, `SIDE_CARD_OVERLAP`, `SIDE_CARD_STYLES`, or `overlapMarginPx` (all confirmed dead after Tasks 2 and 3 — verify with the grep in Step 1 before deleting).

- [ ] **Step 1: Confirm nothing still references the constants being removed**

Run: `grep -rn "OPPONENT_CARD_OVERLAP\|SIDE_CARD_STYLES\|SIDE_CARD_OVERLAP\|overlapMarginPx\|MAX_SIDE_STACK_CARDS" apps/mobile/src packages`
Expected: only matches inside `apps/mobile/src/table/seating.ts` itself. If anything else still matches, stop and re-check Tasks 2/3 before proceeding.

- [ ] **Step 2: Remove the dead exports**

Find:

```ts
export const OPPONENT_CARD_OVERLAP = 21;

// Side seats (left/right, 4-player mode) stack their face-down cards vertically instead of
// fanning horizontally — a horizontal fan rotated 90° would keep its unrotated (wide) footprint
// reserved in the layout since RN transforms don't affect sizing, which risks overflowing a
// phone-width row. A vertical stack sidesteps that entirely.
export const SIDE_CARD_OVERLAP = 45;

// Precomputed per-index style for the side stack — a stable object reference per index (instead
// of a fresh `{marginTop: ...}` literal built inline on every render) means PlayingCard's
// React.memo can actually skip re-rendering unchanged face-down cards. Sized to 13 (not Pişti's
// original 8) because Batak hands start at 13 cards, not Pişti's capped-at-4 — a shared ceiling
// has to cover the largest real hand size across every consumer, not just the first one.
const MAX_SIDE_STACK_CARDS = 13;
export const SIDE_CARD_STYLES: ({ marginTop: number } | undefined)[] =
  Array.from({ length: MAX_SIDE_STACK_CARDS }, (_, i) =>
    i > 0 ? { marginTop: -SIDE_CARD_OVERLAP } : undefined,
  );

// The human's own hand (Batak, and any future game with a large face-up hand) splits into two
```

Replace with:

```ts
// The human's own hand (Batak, and any future game with a large face-up hand) splits into two
```

- [ ] **Step 3: Remove the now-unused `overlapMarginPx` function**

Find:

```ts
// Converts a percentage-based overlap (the natural way to describe "cards overlap by X%") into
// the negative marginLeft pixel value consumers actually apply, given the specific card width
// they're rendering at — kept generic here (not hardcoded to one PlayingCard size) since seating.ts
// has no PlayingCard/RN dependency.
export function overlapMarginPx(
  cardWidth: number,
  overlapPercent: number,
): number {
  return -Math.round(cardWidth * (overlapPercent / 100));
}

// Computes the per-card marginLeft needed so a row of `count` cards (each `cardWidth` wide) spans
```

Replace with:

```ts
// Computes the per-card marginLeft needed so a row of `count` cards (each `cardWidth` wide) spans
```

- [ ] **Step 4: Widen `fillWidthMarginPx`'s doc comment to reflect its broader reuse**

Find:

```ts
// Computes the per-card marginLeft needed so a row of `count` cards (each `cardWidth` wide) spans
// close to `targetSpan` total width — negative for overlap (a full hand needs more cards than fit
// at full width), positive for a gap (a near-empty hand where cards alone would undershoot the
// target span). `count <= 1` needs no margin at all (nothing to space). `maxGap` clamps the
// positive case so a 1-2 card hand doesn't scatter across the full target span with unnaturally
// large gaps — once the natural gap would exceed it, extra width is simply left unused around a
// normally-spaced row instead of stretching further.
export function fillWidthMarginPx(
```

Replace with:

```ts
// Computes the per-card marginLeft needed so a row of `count` cards (each `cardWidth` wide) spans
// close to `targetSpan` total width — negative for overlap (a full hand needs more cards than fit
// at full width), positive for a gap (a near-empty hand where cards alone would undershoot the
// target span). `count <= 1` needs no margin at all (nothing to space). `maxGap` clamps the
// positive case so a 1-2 card hand doesn't scatter across the full target span with unnaturally
// large gaps — once the natural gap would exceed it, extra width is simply left unused around a
// normally-spaced row instead of stretching further. Originally written for the human hand's
// width-fill; also reused for opponent hands' auto-fit spacing (both the top seat's horizontal
// row and the side seats' vertical stack — the "cardWidth"/`marginLeft` naming is a leftover from
// that first use, the math itself is dimension-agnostic).
export function fillWidthMarginPx(
```

- [ ] **Step 5: Typecheck the mobile app**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npx jest`
Expected: PASS — every existing suite across `packages/engine`, `packages/ui`, and `apps/mobile` (typecheck already confirmed no dangling references; this confirms no runtime regression either).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/table/seating.ts
git commit -m "Remove dead opponent-fan overlap constants superseded by auto-fit spacing"
```

---

### Task 5: Manual visual verification

**Files:** none (verification only — may produce a fix-up commit if Task 5 surfaces a problem; see Step 6).

**Interfaces:** none.

- [ ] **Step 1: Start the mobile app's web build**

Run (in a background/separate terminal): `npm run web --workspace=world-of-cards-mobile`
Wait for the Metro bundler to report it's ready (typically serving on `http://localhost:8081` or `http://localhost:19006` depending on the Expo CLI version in use — check the terminal output for the actual URL).

- [ ] **Step 2: Screenshot corner-index alignment across ranks**

Write a small Playwright script (following the existing pattern used in prior UI passes — see `.superpowers/sdd/screenshot.js` for the exact `chromium.launch`/`executablePath` boilerplate already proven to work in this environment) that navigates to a Pişti or Batak game screen reaching the `'playing'` phase, and takes a close-up screenshot of the human hand (which shows several different ranks face-up at once). Confirm, by eye, for ranks including "10", "A", "K", "Q", "J", and a plain numeral:
- The suit glyph sits directly centered beneath its own rank text (not shifted left/right).
- The suit glyph's horizontal offset from the card's corner looks the same across different ranks side by side.

If misaligned, adjust `CORNER_INDEX_WIDTH.normal`/`.small` in `packages/ui/src/PlayingCard.tsx` (Task 1) and re-screenshot until it looks right.

- [ ] **Step 3: Screenshot Pişti's opponent hand at both hand-size extremes**

Using the same script pattern, reach a 2-player and a 4-player Pişti game in the `'playing'` phase. Screenshot:
- A full opponent hand (4 cards) — top seat and, in 4-player mode, both side seats.
- A nearly-empty opponent hand (1 card) after a few moves.

Confirm: cards are flat (no rotation), evenly spaced with a small visible gap when the hand has few cards, and no card visibly overflows its seat's area or the screen edge.

- [ ] **Step 4: Screenshot Batak's opponent hand at both hand-size extremes**

Reach a 4-player Batak game in the `'playing'` phase (right after dealing, and again several tricks in). Screenshot the top seat and both side seats at 13 cards and at a reduced count. Confirm the same properties as Step 3, plus: no visible overlap/clipping with the wood corner/edge-rail decorations or the trick-cross center panel.

- [ ] **Step 5: Screenshot Batak's human hand margin**

Screenshot the full-width human hand row in the same Batak game. Confirm it now visibly spans much closer to the screen edges than before (compare against the `current-batak.jpeg` reference in `docs/references/batak-and-card-references/` if useful), without any card being clipped by the screen edge.

- [ ] **Step 6: Check console output and fix anything found**

Capture browser console messages during the above (same pattern as `.superpowers/sdd/console-log.txt` in prior passes). Confirm zero new errors/warnings beyond the already-documented `react-native-web`-only noise (see the CLAUDE.md history's `pointerEvents`/`textShadow`/`useNativeDriver` notes). If Steps 2-5 surfaced a real visual problem, fix the relevant constant(s) in the affected file(s) and re-screenshot to confirm before moving on — commit any such fix-up separately with a message describing what was adjusted and why (e.g. "Tighten Batak side-stack height fraction after overflow found in verification").

- [ ] **Step 7: Stop the web server**

Stop the `npm run web` process started in Step 1.

---

## Plan Self-Review Notes

- **Spec coverage:** Section 1 (corner centering) → Task 1. Section 2 (AI fan) → Tasks 2-4. Section 3 (mobile margin) → Task 3 Step 2. Testing/verification plan → Task 5. All three numbered sections of the spec have a corresponding task.
- **Placeholder scan:** no TBD/TODO; every step shows literal before/after code.
- **Type consistency:** `sideStackHeight: number` is named and typed identically across `OpponentSeatProps`/`OpponentSeatGroup` in both Task 2 (Pişti) and Task 3 (Batak); `fillWidthMarginPx`'s signature is used identically to its existing (unchanged) definition in `seating.ts` in every call site across Tasks 2 and 3.
