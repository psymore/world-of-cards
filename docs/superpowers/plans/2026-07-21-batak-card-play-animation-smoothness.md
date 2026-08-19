# Batak Card-Play & Hand-Reposition Animation Smoothness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the visual jump/shake when a human plays a card in Batak (a fresh, unrotated, differently-sized card replacing the real in-hand card the instant motion starts) and reduce the tree re-render cost that competes with the hand-reflow animation.

**Architecture:** Extend the existing shared `TravelCard` component with optional, additive rotation/scale interpolation (all driven by one native `Animated.Value`, so translate/rotate/scale stay frame-perfect in sync), thread the played card's real in-hand rotation angle from tap time through to `TrickCenter`, and add targeted `React.memo` to the hand/opponent-seat components that currently re-render in full on every state tick regardless of whether their own visible props changed.

**Tech Stack:** React Native / Expo (apps/mobile), TypeScript, `Animated` API with `useNativeDriver: true` throughout (no new animation library).

## Global Constraints

- Batak only — do not touch Pişti's `PistiTable.tsx`/`PistiScreen.tsx` or its `RevealCard`. (Spec: "Scope.")
- No new automated tests — this is decorative/motion UI, covered by the standing 2026-07-07 testing policy (mobile UI does not get new tests by default). Run the **existing** suite for regression only.
- No proactive screenshot/Playwright verification — the user's standing 2026-07-17 direction. Final visual confirmation happens live in the user's own Expo session, not in this plan.
- Every new/changed prop on shared components (`TravelCard`) must default to today's exact existing behavior when omitted — Pişti and any other consumer must be provably unaffected.
- Read this spec before starting: `docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md`.

---

## Task 1: `TravelCard` — additive rotation/scale interpolation

**Files:**
- Modify: `apps/mobile/src/table/TravelCard.tsx`

**Interfaces:**
- Consumes: nothing new (pure component change).
- Produces: `TravelCardProps` gains three new optional fields — `originRotateDeg?: number` (default `0`), `originScale?: number` (default `1`), `restScale?: number` (default `1`) — all interpolated off the same `progress` Animated.Value that already drives `translateX`/`translateY`. Task 4 consumes these.

- [ ] **Step 1: Replace the full file contents**

Replace the entire contents of `apps/mobile/src/table/TravelCard.tsx` with:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from '../components/useReducedMotion';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from './travelAnimation';

export interface TravelCardProps {
  // Where the card visually travels from, relative to its own rest position (0, 0) — e.g.
  // revealOriginOffset(resolveRevealOrigin(playerId, humanPlayerId, seats)). The destination
  // itself is never a prop: the caller controls it entirely by where it renders this component
  // (see BatakTable's TRICK_SLOT_OFFSETS-positioned trickSlot) — this is the one property that
  // must differ per game, so it's deliberately left outside this component.
  originOffset: { x: number; y: number };
  // Retriggers the animation whenever it changes (e.g. card.id) — explicit rather than relying
  // on the caller always fully unmounting/remounting between cards, so this stays correct even
  // for a future caller that keeps the wrapper mounted and only swaps its `children`.
  resetKey: string | number;
  children: React.ReactNode;
  // Rotation (degrees) and scale the card visually had at departure, interpolated down to 0deg /
  // restScale as it travels. All three default to no-op values (0deg, scale 1→1) so every
  // pre-existing consumer is byte-identical to before these props existed. First real use:
  // Batak's own played card, which departs from its rotated, lifted-scale in-hand appearance
  // rather than a flat, unscaled one — see
  // docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
  originRotateDeg?: number;
  originScale?: number;
  restScale?: number;
}

// Not exported: the reset/timing lifecycle (create the progress value, reset+animate on
// resetKey/reducedMotion change) factored out so promoting it to a standalone hook later (if a
// future caller needs the raw progress value to layer its own extra interpolation on top, e.g.
// a scale-in) is a one-line change instead of a refactor. See
// docs/superpowers/specs/2026-07-18-shared-card-travel-animation-design.md.
function useTravelProgress(resetKey: string | number): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [resetKey, reducedMotion]);

  return progress;
}

// Animates `children` traveling from `originOffset` to its resting position (wherever the
// caller renders this component) — opacity fades in alongside the translate. Shared by every
// game's "just-played card travels from its seat to its resting spot" motion (first use:
// Batak's trick cross; Pişti's own reveal-to-pile animation is a separate, untouched
// implementation for now). Rotation/scale interpolation is additive and optional (see
// TravelCardProps) — omitting them reproduces the original translate-only behavior exactly.
export function TravelCard({
  originOffset,
  resetKey,
  children,
  originRotateDeg = 0,
  originScale = 1,
  restScale = 1,
}: TravelCardProps) {
  const progress = useTravelProgress(resetKey);

  return (
    <Animated.View
      style={{
        // Fully opaque for the entire flight (no fade-in) so the card reads as physically
        // traveling along the path, not materializing at the end of it — see
        // docs/superpowers/specs/2026-07-18-card-travel-full-visibility-design.md.
        //
        // All four transforms are driven by the same `progress` value (never separate
        // Animated.Values), so they are guaranteed frame-perfect in sync on the native thread —
        // rotate/scale interpolating even a few frames out of step with translate would itself
        // read as a wobble during flight.
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [originOffset.x, 0],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [originOffset.y, 0],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [`${originRotateDeg}deg`, '0deg'],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [originScale, restScale],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/table/TravelCard.tsx
git commit -m "Add optional rotate/scale interpolation to TravelCard"
```

---

## Task 2: Export `SELECTED_SCALE` and a hand-rotation helper

**Files:**
- Modify: `apps/mobile/src/components/SelectableCard.tsx`
- Modify: `apps/mobile/src/games/batak/table/HumanHandFan.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SELECTED_SCALE` (exported constant, `1.05`) from `SelectableCard.tsx`; `handCardRotationDeg(indexInRow: number, rowCount: number): number` (exported function) from `HumanHandFan.tsx`. Task 3 consumes both.

- [ ] **Step 1: Export `SELECTED_SCALE`**

In `apps/mobile/src/components/SelectableCard.tsx`, find:

```ts
// How much a selected card scales up, on top of its lift, to read as moving toward the camera.
const SELECTED_SCALE = 1.05;
```

Replace with:

```ts
// How much a selected card scales up, on top of its lift, to read as moving toward the camera.
// Exported: Batak's played-card travel animation departs from this exact scale (a played card is
// always selected/lifted at the moment of the second tap) — see TrickCenter.tsx.
export const SELECTED_SCALE = 1.05;
```

- [ ] **Step 2: Export a hand-rotation helper from `HumanHandFan.tsx`**

In `apps/mobile/src/games/batak/table/HumanHandFan.tsx`, find:

```ts
export function sortHandForDisplay(cards: Card[]): Card[] {
```

Insert immediately before it:

```ts
// Exported so BatakTable can compute a card's real fan angle at the moment it's tapped (for the
// played-card travel animation's origin rotation) without duplicating
// HUMAN_HAND_DEGREES_PER_STEP or reimplementing the fan formula.
export function handCardRotationDeg(indexInRow: number, rowCount: number): number {
  return fanRotationDeg(indexInRow, rowCount, HUMAN_HAND_DEGREES_PER_STEP);
}

```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors (both exports currently unused outside their own file — that's fine, Task 3 wires them in).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/SelectableCard.tsx apps/mobile/src/games/batak/table/HumanHandFan.tsx
git commit -m "Export SELECTED_SCALE and a hand-card rotation helper for the travel animation"
```

---

## Task 3: Thread the played card's origin rotation through the play pipeline

**Files:**
- Modify: `apps/mobile/src/games/batak/table/types.ts`
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `handCardRotationDeg` from `./table/HumanHandFan` (Task 2).
- Produces: `PendingBatakPlay.originRotateDeg?: number`; `BatakTableProps.onPlayCard` gains a third optional `originRotateDeg?: number` parameter. Task 4 consumes `pendingPlay.originRotateDeg` in `TrickCenter`.

- [ ] **Step 1: Add `originRotateDeg` to `PendingBatakPlay`**

In `apps/mobile/src/games/batak/table/types.ts`, replace:

```ts
export interface PendingBatakPlay {
  playerId: string;
  card: Card;
  originOffset?: { x: number; y: number };
}
```

with:

```ts
export interface PendingBatakPlay {
  playerId: string;
  card: Card;
  originOffset?: { x: number; y: number };
  // The card's rotation (degrees) in its hand slot at the moment it was played — only ever set
  // for the human's own play (opponents have no rendered per-card hand visual to depart from).
  // Threaded into TravelCard's originRotateDeg so the card eases from its real fan angle down to
  // flat instead of snapping to 0deg the instant it starts moving. See
  // docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
  originRotateDeg?: number;
}
```

- [ ] **Step 2: Thread `originRotateDeg` through `BatakScreen.tsx`**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, replace:

```ts
  function commitMove(move: BatakMove, playerId: PlayerId, originOffset?: { x: number; y: number }) {
```

with:

```ts
  function commitMove(
    move: BatakMove,
    playerId: PlayerId,
    originOffset?: { x: number; y: number },
    originRotateDeg?: number
  ) {
```

Then replace:

```ts
      setPendingPlay({ playerId, card, originOffset });
```

with:

```ts
      setPendingPlay({ playerId, card, originOffset, originRotateDeg });
```

Then replace:

```ts
  function handleHumanPlayCard(cardId: string, originOffset?: { x: number; y: number }) {
    commitMove({ type: 'play', cardId }, HUMAN_ID, originOffset);
  }
```

with:

```ts
  function handleHumanPlayCard(cardId: string, originOffset?: { x: number; y: number }, originRotateDeg?: number) {
    commitMove({ type: 'play', cardId }, HUMAN_ID, originOffset, originRotateDeg);
  }
```

- [ ] **Step 3: Update `onPlayCard`'s type and compute the origin rotation in `BatakTable.tsx`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, update the React import. Replace:

```ts
import { useEffect, useRef, useState } from 'react';
```

with:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Update the `HumanHandFan` import to also bring in the new helper. Replace:

```ts
import { HumanHandFan, HAND_ROW_OVERLAP_PX, sortHandForDisplay } from './table/HumanHandFan';
```

with:

```ts
import { HumanHandFan, HAND_ROW_OVERLAP_PX, sortHandForDisplay, handCardRotationDeg } from './table/HumanHandFan';
```

In `BatakTableProps`, replace:

```ts
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void;
```

with:

```ts
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }, originRotateDeg?: number) => void;
```

Replace the existing `registerHandCardRef`/`playWithMeasuredOrigin` block:

```ts
  // One ref per currently-rendered human hand card, keyed by card id.
  const handCardRefs = useRef(new Map<string, View>()).current;
  function registerHandCardRef(cardId: string, node: View | null) {
    if (node) {
      handCardRefs.set(cardId, node);
    } else {
      handCardRefs.delete(cardId);
    }
  }

  // Replaces a direct onPlayCard(cardId) call: measures the tapped card's real on-screen
  // position relative to the trick slot's, so the travel animation starts from where the card
  // actually was. Falls back to a plain onPlayCard(cardId) call (no origin — TravelCard then
  // uses the fixed 'bottom' offset, same as today) whenever either measurement isn't ready.
  function playWithMeasuredOrigin(cardId: string) {
    const node = handCardRefs.get(cardId);
    if (!node || !destCenter) {
      onPlayCard(cardId);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      onPlayCard(cardId, {
        x: x + width / 2 - destCenter.x,
        y: y + height / 2 - destCenter.y,
      });
    });
  }
```

with:

```ts
  // One ref per currently-rendered human hand card, keyed by card id.
  const handCardRefs = useRef(new Map<string, View>()).current;
  const registerHandCardRef = useCallback((cardId: string, node: View | null) => {
    if (node) {
      handCardRefs.set(cardId, node);
    } else {
      handCardRefs.delete(cardId);
    }
  }, [handCardRefs]);

  // Mirrors handSlots/destCenter into refs, read only inside playWithMeasuredOrigin (an event
  // handler, never during render) — lets that callback stay referentially stable (see its own
  // useCallback below) without ever reading stale data, using the same "keep a ref in sync during
  // render" pattern this file already uses for handLayerRef above.
  const handSlotsRef = useRef(handSlots);
  handSlotsRef.current = handSlots;
  const destCenterRef = useRef(destCenter);
  destCenterRef.current = destCenter;

  // Replaces a direct onPlayCard(cardId) call: measures the tapped card's real on-screen
  // position relative to the trick slot's, so the travel animation starts from where the card
  // actually was, and computes the card's real fan-rotation angle from its current hand slot so
  // the travel animation can ease from that angle down to flat instead of snapping to 0deg. Falls
  // back to a plain onPlayCard(cardId) call (no origin — TravelCard then uses the fixed 'bottom'
  // offset, same as today) whenever either measurement isn't ready.
  const playWithMeasuredOrigin = useCallback(
    (cardId: string) => {
      const slot = handSlotsRef.current.find((s) => s.card.id === cardId);
      const originRotateDeg = slot ? handCardRotationDeg(slot.indexInRow, slot.rowCount) : undefined;
      const node = handCardRefs.get(cardId);
      const dest = destCenterRef.current;
      if (!node || !dest) {
        onPlayCard(cardId, undefined, originRotateDeg);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        onPlayCard(
          cardId,
          { x: x + width / 2 - dest.x, y: y + height / 2 - dest.y },
          originRotateDeg
        );
      });
    },
    [handCardRefs, onPlayCard]
  );
```

Note: `handSlots` and `destCenter` are both defined earlier in this same file (above this block) — no import changes needed for them.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/table/types.ts apps/mobile/src/games/batak/BatakScreen.tsx apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Thread the played card's origin rotation through the Batak play pipeline"
```

---

## Task 4: Wire `TrickCenter` to use the continuous transform for the human's own play

**Files:**
- Modify: `apps/mobile/src/games/batak/table/TrickCenter.tsx`

**Interfaces:**
- Consumes: `SELECTED_SCALE` (Task 2), `pendingPlay.originRotateDeg` (Task 3), `TravelCard`'s new optional props (Task 1).
- Produces: nothing new for later tasks — this is the visible payoff of Fix 1.

- [ ] **Step 1: Import `SELECTED_SCALE` and add the size-ratio constant**

In `apps/mobile/src/games/batak/table/TrickCenter.tsx`, replace:

```ts
import { PlayingCard, SuitIcon, CARD_DIMS } from '@world-of-cards/ui';
import { TravelCard } from '../../../table/TravelCard';
```

with:

```ts
import { PlayingCard, SuitIcon, CARD_DIMS } from '@world-of-cards/ui';
import { TravelCard } from '../../../table/TravelCard';
import { SELECTED_SCALE } from '../../../components/SelectableCard';
```

Then, immediately after the existing `TRICK_SLOT_OFFSETS` constant block, add:

```ts

// The played card travels at its real, in-hand `size="normal"` for the whole flight (never
// swapping the underlying `size` prop mid-flight, which would force a layout recalculation
// instead of a cheap transform) and is scaled down to this ratio by the time it lands, so it
// occupies the exact same footprint as the real `size="small"` resting trick card. See
// docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
const NORMAL_TO_SMALL_SCALE = CARD_DIMS.small.width / CARD_DIMS.normal.width;
```

- [ ] **Step 2: Branch the pending-play render on whether it's the human's own play**

In the same file, replace:

```ts
  function slotFor(position: TrickPosition) {
    const playerId = position === 'bottom' ? humanPlayerId : seats.find((s) => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    const isPending = playerId != null && pendingPlay != null && pendingPlay.playerId === playerId;
    const zIndex = playerId ? Math.max(playOrder.indexOf(playerId) + 1, 1) : 1;
    const offset = TRICK_SLOT_OFFSETS[position];

    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        ref={position === 'bottom' ? destRef : undefined}
        onLayout={position === 'bottom' ? onDestLayout : undefined}
        style={[
          styles.trickSlot,
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            <TravelCard
              originOffset={
                pendingPlay?.originOffset ?? revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))
              }
              resetKey={card.id}>
              <PlayingCard card={card} size="small" />
            </TravelCard>
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
      </View>
    );
  }
```

with:

```ts
  function slotFor(position: TrickPosition) {
    const playerId = position === 'bottom' ? humanPlayerId : seats.find((s) => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    const isPending = playerId != null && pendingPlay != null && pendingPlay.playerId === playerId;
    const isHumanPending = isPending && playerId === humanPlayerId;
    const zIndex = playerId ? Math.max(playOrder.indexOf(playerId) + 1, 1) : 1;
    const offset = TRICK_SLOT_OFFSETS[position];

    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        ref={position === 'bottom' ? destRef : undefined}
        onLayout={position === 'bottom' ? onDestLayout : undefined}
        style={[
          styles.trickSlot,
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            isHumanPending ? (
              // The human's own played card: travels at its real in-hand size, easing its actual
              // fan-rotation angle and selected-lift scale down to flat/resting instead of
              // snapping to a fresh, flat, differently-sized card the instant it starts moving.
              <TravelCard
                originOffset={pendingPlay?.originOffset ?? revealOriginOffset('bottom')}
                originRotateDeg={pendingPlay?.originRotateDeg ?? 0}
                originScale={SELECTED_SCALE}
                restScale={NORMAL_TO_SMALL_SCALE}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" />
              </TravelCard>
            ) : (
              // An AI's played card: no rendered per-card hand visual exists to depart from (see
              // the 2026-07-18 turn-indicator-simplification pass), so this stays translate-only,
              // unchanged from before.
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ??
                  revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))
                }
                resetKey={card.id}>
                <PlayingCard card={card} size="small" />
              </TravelCard>
            )
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
      </View>
    );
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/table/TrickCenter.tsx
git commit -m "Play the human's own card at real size with continuous rotate/scale-down travel"
```

---

## Task 5: Memoize `AnimatedFanCard` (the hand-reflow leaf component)

**Files:**
- Modify: `apps/mobile/src/games/batak/table/HumanHandFan.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new for later tasks — `HumanHandFan`'s own external prop contract (`slots`, `legalCardIds`, `isHumanInteractive`, `selectedCardId`, `selectCard`, `playEntrance`, `registerCardRef`, `compact`) is unchanged, so `BatakTable.tsx`'s `<HumanHandFan .../>` call site needs no edits.

- [ ] **Step 1: Flatten `AnimatedFanCard`'s props to primitives and wrap it in `React.memo`**

In `apps/mobile/src/games/batak/table/HumanHandFan.tsx`, replace:

```tsx
function AnimatedFanCard({
  slot,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  registerCardRef,
  compact,
}: {
  slot: HandSlot;
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
  compact: boolean;
}) {
  const { card } = slot;
```

with:

```tsx
interface AnimatedFanCardProps {
  slot: HandSlot;
  interactive: boolean;
  selected: boolean;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
  compact: boolean;
}

function AnimatedFanCardComponent({
  slot,
  interactive,
  selected,
  selectCard,
  playEntrance,
  registerCardRef,
  compact,
}: AnimatedFanCardProps) {
  const { card } = slot;
```

Then, further down in the same function, replace:

```tsx
  const interactive = isHumanInteractive && legalCardIds.has(card.id);

  return (
    <Animated.View style={[styles.fanCardSlot, { transform: [{ translateX: x }, { translateY: y }] }]}>
      <View ref={(node) => registerCardRef(card.id, node)}>
        <EntranceCard index={slot.indexInRow} playEntrance={playEntrance}>
          <SelectableCard
            card={card}
            size="normal"
            selected={selectedCardId === card.id}
```

with:

```tsx
  return (
    <Animated.View style={[styles.fanCardSlot, { transform: [{ translateX: x }, { translateY: y }] }]}>
      <View ref={(node) => registerCardRef(card.id, node)}>
        <EntranceCard index={slot.indexInRow} playEntrance={playEntrance}>
          <SelectableCard
            card={card}
            size="normal"
            selected={selected}
```

Then, immediately after the closing `}` of `AnimatedFanCardComponent` (right before the `EntranceCard` function definition), add:

```tsx

// Batak is strictly turn-based: only one player's action is ever in flight, and while this
// specific card's `selected`/`interactive` props are unchanged, no engine state that
// `selectCard`/`registerCardRef` close over can have changed in a way that affects THIS card's
// behavior either (the human's own turn, and any card sitting selected during it, is
// uninterrupted the whole time). So it's safe to skip re-rendering — and therefore keep a
// technically-stale `selectCard`/`registerCardRef` closure — whenever slot/interactive/selected/
// compact/playEntrance are all unchanged; those closures behave identically for this card either
// way. Deliberately NOT comparing selectCard/registerCardRef by reference: BatakTable recreates
// selectCard's underlying dependency chain on most renders, so comparing it would defeat the memo
// on nearly every re-render, including the "an AI played elsewhere and nothing about this card
// changed" case this exists to fix — see
// docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
function areFanCardPropsEqual(prev: AnimatedFanCardProps, next: AnimatedFanCardProps): boolean {
  return (
    prev.slot.card.id === next.slot.card.id &&
    prev.slot.row === next.slot.row &&
    prev.slot.indexInRow === next.slot.indexInRow &&
    prev.slot.rowCount === next.slot.rowCount &&
    prev.slot.enterFromOffset?.x === next.slot.enterFromOffset?.x &&
    prev.slot.enterFromOffset?.y === next.slot.enterFromOffset?.y &&
    prev.interactive === next.interactive &&
    prev.selected === next.selected &&
    prev.compact === next.compact &&
    prev.playEntrance === next.playEntrance
  );
}

const AnimatedFanCard = React.memo(AnimatedFanCardComponent, areFanCardPropsEqual);
```

- [ ] **Step 2: Update `HumanHandFan`'s render to pass the flattened props**

Replace:

```tsx
  return (
    <View style={styles.handFan} testID="human-hand">
      {slots.map((slot) => (
        <AnimatedFanCard
          key={slot.card.id}
          slot={slot}
          legalCardIds={legalCardIds}
          isHumanInteractive={isHumanInteractive}
          selectedCardId={selectedCardId}
          selectCard={selectCard}
          playEntrance={playEntrance}
          registerCardRef={registerCardRef}
          compact={compact}
        />
      ))}
    </View>
  );
```

with:

```tsx
  return (
    <View style={styles.handFan} testID="human-hand">
      {slots.map((slot) => (
        <AnimatedFanCard
          key={slot.card.id}
          slot={slot}
          interactive={isHumanInteractive && legalCardIds.has(slot.card.id)}
          selected={selectedCardId === slot.card.id}
          selectCard={selectCard}
          playEntrance={playEntrance}
          registerCardRef={registerCardRef}
          compact={compact}
        />
      ))}
    </View>
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Run the existing mobile test suite**

Run: `npm test`
Expected: all suites pass, same count as before this branch (no new tests added, none should break — `AnimatedFanCard`'s external behavior and `HumanHandFan`'s external prop contract are both unchanged).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/table/HumanHandFan.tsx
git commit -m "Memoize AnimatedFanCard so unrelated table re-renders skip unaffected hand cards"
```

---

## Task 6: Memoize `OpponentSeat` and stabilize `assignSeats`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add `memo`/`useMemo` to the React import (already updated in Task 3 to include `useCallback`/`useMemo`/`useEffect`/`useRef`/`useState` — add `memo`)**

Replace:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

with:

```ts
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 2: Flatten `OpponentSeat`'s props and wrap it in `memo`**

Replace:

```ts
interface OpponentSeatProps {
  seat: Seat;
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}

function OpponentSeat({ seat, state, playerNames, pendingPlay }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const isCurrentTurn = state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  return (
    <View style={[styles.opponentArea, isSide && seatLayoutStyles.opponentAreaSide]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
    </View>
  );
}
```

with:

```ts
interface OpponentSeatProps {
  position: Seat['position'];
  name: string;
  statusText: string;
  active: boolean;
}

function OpponentSeatComponent({ position, name, statusText, active }: OpponentSeatProps) {
  const isSide = position !== 'top';

  return (
    <View style={[styles.opponentArea, isSide && seatLayoutStyles.opponentAreaSide]}>
      <PlayerBadge name={name} statusText={statusText} active={active} isHuman={false} compact={isSide} />
    </View>
  );
}

// Every prop here is a plain primitive derived by the caller (BatakTable), so this memoizes with
// React's default shallow comparison — no custom comparator needed. None of these props are ever
// affected by the human's own hand-selection state, so an opponent seat correctly skips
// re-rendering whenever an unrelated part of the table changes (the human playing their own
// card, a different seat's turn) — see
// docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
const OpponentSeat = memo(OpponentSeatComponent);
```

- [ ] **Step 3: Update the three `OpponentSeat` call sites to pass flattened props**

There are three `renderSeat` call sites in this file (top, left, right), each currently reading:

```tsx
          <OpponentSeat seat={seat} state={state} playerNames={playerNames} pendingPlay={pendingPlay} />
```

Replace **all three occurrences** with:

```tsx
          <OpponentSeat
            position={seat.position}
            name={playerNames[seat.playerId] ?? seat.playerId}
            statusText={statusTextFor(state, seat.playerId)}
            active={state.players[state.currentPlayerIndex] === seat.playerId && pendingPlay == null}
          />
```

(All three call sites are identical text before this change, so this is a safe find-and-replace-all within this file.)

- [ ] **Step 4: Stabilize `assignSeats`**

Replace:

```ts
  const seats = assignSeats(opponentPlayerIds);
```

with:

```ts
  const seats = useMemo(() => assignSeats(opponentPlayerIds), [opponentPlayerIds]);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Run the existing mobile test suite**

Run: `npm test`
Expected: all suites pass — `OpponentSeat` is a local, unexported component with no direct test coverage; `BatakTable.test.tsx` (if it exists) and any snapshot/behavioral tests exercising rendered opponent badges should be unaffected since the visible output (name/statusText/active/compact) is unchanged, only how it's computed and passed.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Memoize OpponentSeat and stabilize assignSeats to cut re-render cost during a play"
```

---

## Task 7: Full regression pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full typecheck across the workspace**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json && npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors in either package.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: every suite passes, same total suite/test count as on `master` before this branch (no new tests were added anywhere in this plan).

- [ ] **Step 3: Report to the user for live verification**

This plan deliberately includes no automated visual verification (per the user's standing 2026-07-17 direction against proactive screenshots). Tell the user the branch is ready for them to test live in their own Expo session, and ask them to specifically check:
- The played card no longer pops in size/rotation the instant it starts moving away from the hand.
- No visible shake/wobble during the card's flight to the trick center.
- The remaining hand cards' reflow feels smoother, especially right after an opponent plays (not just after the human's own play).

---

## Self-Review Notes

- **Spec coverage:** Fix 1 (played-card departure continuity) is covered by Tasks 1–4. Fix 2 (re-render cost reduction) is covered by Tasks 5–6. The spec's "Non-goals" (no trick-card resize, no Pişti changes, no new tests) are respected throughout — no task touches `PistiTable.tsx`/`PistiScreen.tsx`, resizes trick-slot cards outside the traveling state, or adds a `.test.tsx` file.
- **Placeholder scan:** no TBD/TODO markers; every step shows complete, real code.
- **Type consistency:** `originRotateDeg?: number` is spelled identically across `TravelCardProps` (Task 1), `PendingBatakPlay` (Task 3), `commitMove`/`handleHumanPlayCard` (Task 3), and `BatakTableProps.onPlayCard` (Task 3). `handCardRotationDeg(indexInRow: number, rowCount: number): number` (Task 2) is called with matching argument order in Task 3. `SELECTED_SCALE` (Task 2, from `SelectableCard.tsx`) and `NORMAL_TO_SMALL_SCALE` (Task 4, from `CARD_DIMS`) are both used only in `TrickCenter.tsx`, no redefinition elsewhere.
