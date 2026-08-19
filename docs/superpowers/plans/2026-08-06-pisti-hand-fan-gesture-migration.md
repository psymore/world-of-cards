# Pişti Hand-Fan Gesture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Pişti's unplayable hand (confirming second tap silently deselects instead of playing) by porting Batak's proven Reanimated + `Gesture.Tap()` hand-card architecture onto Pişti's hand, adding an arc fan and a persisted landing angle in the pile.

**Architecture:** Two files (`useBatakCardMotion.ts`, `batakRailFan.ts`'s pure math) are promoted from Batak-only to a shared `apps/mobile/src/table/` location, since they were already 100% game-agnostic. Pişti gets its own `pistiRailFan.ts`/`PistiHandFan.tsx`/`PistiHandCard.tsx`, mirroring `HumanHandFan.tsx`/`BatakHandCard.tsx`'s actual gesture/animation logic without importing them directly (matching this codebase's existing cross-game isolation convention). Pişti's bespoke `RevealCard` play-travel component is retired in favor of the already-shared `TravelCard.tsx`, and a new `pileRestingRotations` map persists each landed card's angle in the pile.

**Tech Stack:** `react-native-reanimated` (shared values, `withTiming`), `react-native-gesture-handler` (`Gesture.Tap()`/`GestureDetector`), existing `@world-of-cards/ui` `PlayingCard`/`CARD_DIMS`, plain `Animated` for `TravelCard` (unchanged).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md` — read it first.
- **`PISTI_RAIL_CONFIG` values are fixed by the spec, not to be re-derived:** `{ radius: 320, overlap: 0.5, arcDegrees: 36, maxRotationDeg: 20, spacingPx: 120 }`. Selection lift distance: `24`. These are approved starting points ("adjust live once running" is a follow-up, not part of this plan).
- **AI-played cards always land at `0deg`** ("aligned angles" — see spec §2/§4). Only the human's played card carries a real, non-zero landing angle.
- **Cross-game isolation:** `PistiHandFan.tsx`/`PistiHandCard.tsx`/`pistiRailFan.ts` must not import anything from `apps/mobile/src/games/batak/`, and vice versa. Only the promoted shared files (`apps/mobile/src/table/useCardMotion.ts`, `apps/mobile/src/table/railFan.ts`) are imported by both games.
- **RN transform-array composition:** when a style needs multiple transform entries, always build ONE array — never place two style objects that both set `transform` in the same `style={[...]}` array (RN takes the *last* value for a repeated key, not a merge). This has bitten this codebase twice already (Batak's hand-fan migration, `PlayingCard.tsx`'s `contentScale`).
- **Reduced motion:** every animated transition in `PistiHandCard.tsx` must respect `useReducedMotion()` (`apps/mobile/src/components/useReducedMotion`) — instant positioning, no transition, when enabled. Mirror `BatakHandCard.tsx`'s existing branches exactly.
- **Do not run `npm test` at any checkpoint in this plan** — per explicit instruction this session, the user will run the suite themselves when ready. `npx tsc --noEmit` (per affected package) IS a required checkpoint after every task.
- **`PistiTable.test.tsx`'s 4 tap-driven tests will be removed, not fixed** (Task 7) — `fireEvent.press` cannot trigger a `Gesture.Tap()`-based component, and there's no established RNGH-test-firing pattern in this codebase to replace it with (Batak's own hand has zero test coverage for the same reason). The gap is intentional and documented in Task 7, not an oversight.
- **No new automated tests beyond what Task 7 removes** — matches this repo's standing no-new-gesture-tests convention.

---

### Task 1: Promote `useBatakCardMotion.ts` and `batakRailFan.ts`'s math to shared files

**Files:**
- Create: `apps/mobile/src/table/useCardMotion.ts`
- Create: `apps/mobile/src/table/railFan.ts`
- Delete: `apps/mobile/src/games/batak/table/useBatakCardMotion.ts`
- Modify: `apps/mobile/src/games/batak/table/batakRailFan.ts` (trim to just the two tuned configs, importing the type from the new shared file)
- Modify: `apps/mobile/src/games/batak/table/BatakHandCard.tsx` (import path + call-site rename)
- Modify: `apps/mobile/src/games/batak/table/HumanHandFan.tsx` (import paths)
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx` (import path + type rename)

**Interfaces:**
- Consumes: nothing (pure relocation).
- Produces: `useCardMotion(initial: { x, y, angleDeg, scale }): { shared: { translateX, translateY, rotate, scale }, setTarget(target: CardMotionTarget), getValues(): { x, y, angleDeg, scale } }` from `apps/mobile/src/table/useCardMotion.ts`. `RailAngleConfig`, `railAngleStepDeg(config, referenceRowSize): number`, `railAngles(count, angleStepDeg, maxRotationDeg): number[]`, `RailPosition`, `railPosition(angleDeg, radius, extraRadius?): RailPosition` from `apps/mobile/src/table/railFan.ts`. Both consumed by Task 2 onward (Pişti) and already consumed by Batak (updated in place, this task).

This is a mechanical, behavior-preserving move — the exported function is renamed from `useBatakCardMotion` to `useCardMotion` (matching its new, generic home) but its parameter/return shape is byte-identical. The rail-fan functions keep their existing names (already generic, no "Batak" in them).

- [ ] **Step 1: Create `apps/mobile/src/table/useCardMotion.ts`**

```ts
import { useRef } from 'react';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export interface CardMotionTarget {
  x?: number;
  y?: number;
  angleDeg?: number;
  scale?: number;
  // delay: fires the withTiming itself after this many ms — distinct from duration, which is how
  // long the timing itself takes once it starts.
  timing?: { duration: number; easing?: (t: number) => number; delay?: number };
}

const DEFAULT_DURATION_MS = 320;
const DEFAULT_EASING = Easing.inOut(Easing.cubic);

// Per-card Reanimated shared-value motion primitive (position/rotation/scale), driven entirely by
// setTarget calls — no game-specific logic. Originally Batak-only (useBatakCardMotion.ts),
// promoted here once Pişti's hand needed the identical primitive — see
// docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §1.
export function useCardMotion(initial: { x: number; y: number; angleDeg: number; scale: number }) {
  const translateX = useSharedValue(initial.x);
  const translateY = useSharedValue(initial.y);
  const rotate = useSharedValue(initial.angleDeg);
  const scale = useSharedValue(initial.scale);

  // JS-thread mirror of each shared value, kept in sync only by setTarget itself (never read from
  // the native/UI thread) — good enough for getValues()'s purpose (a caller reading a card's "last
  // commanded target" at tap time, not a frame-accurate live sample), and avoids the permanent
  // per-frame addListener bridge cost this codebase has already identified and removed once.
  const lastValues = useRef({ x: initial.x, y: initial.y, angleDeg: initial.angleDeg, scale: initial.scale });

  function setTarget(target: CardMotionTarget) {
    const duration = target.timing?.duration ?? DEFAULT_DURATION_MS;
    const easing = target.timing?.easing ?? DEFAULT_EASING;
    const delay = target.timing?.delay;
    const animate = (toValue: number) => {
      const timing = withTiming(toValue, { duration, easing });
      return delay ? withDelay(delay, timing) : timing;
    };
    if (target.x !== undefined) {
      translateX.value = animate(target.x);
      lastValues.current.x = target.x;
    }
    if (target.y !== undefined) {
      translateY.value = animate(target.y);
      lastValues.current.y = target.y;
    }
    if (target.angleDeg !== undefined) {
      rotate.value = animate(target.angleDeg);
      lastValues.current.angleDeg = target.angleDeg;
    }
    if (target.scale !== undefined) {
      scale.value = animate(target.scale);
      lastValues.current.scale = target.scale;
    }
  }

  function getValues() {
    return { ...lastValues.current };
  }

  return { shared: { translateX, translateY, rotate, scale }, setTarget, getValues };
}
```

- [ ] **Step 2: Create `apps/mobile/src/table/railFan.ts`**

```ts
export interface RailAngleConfig {
  radius: number;
  overlap: number;
  arcDegrees: number;
  maxRotationDeg: number;
  spacingPx: number;
}

// Pure rail/angle geometry for a fixed-radius card fan: given a config and how many cards share
// the rail, compute each card's angle-step, then its (x, y, rotation) on that circle.
// Game-agnostic — originally Batak-only (batakRailFan.ts), promoted here once Pişti's hand needed
// the identical math with its own tuning — see
// docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §1. Batak's own
// STANDARD_RAIL_CONFIG/COMPACT_RAIL_CONFIG tuning stays in
// apps/mobile/src/games/batak/table/batakRailFan.ts; Pişti's own PISTI_RAIL_CONFIG lives in
// apps/mobile/src/games/pisti/table/pistiRailFan.ts — only the math itself is shared.
export function railAngleStepDeg(config: RailAngleConfig, referenceRowSize: number): number {
  const stepPx = config.spacingPx * (1 - config.overlap);
  const stepDeg = (stepPx / config.radius) * (180 / Math.PI);
  const maxStepDeg =
    referenceRowSize > 1 ? config.arcDegrees / (referenceRowSize - 1) : config.arcDegrees;
  return Math.min(stepDeg, maxStepDeg);
}

export function railAngles(count: number, angleStepDeg: number, maxRotationDeg: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const angles: number[] = [];
  for (let i = 0; i < count; i++) {
    const raw = (i - (count - 1) / 2) * angleStepDeg;
    angles.push(Math.max(-maxRotationDeg, Math.min(maxRotationDeg, raw)));
  }
  return angles;
}

export interface RailPosition {
  x: number;
  y: number;
  rotateDeg: number;
}

// extraRadius pushes a card straight out along its own angle (used for the select-lift) — never
// sideways along the rail.
export function railPosition(angleDeg: number, radius: number, extraRadius = 0): RailPosition {
  const rad = (angleDeg * Math.PI) / 180;
  const r = radius + extraRadius;
  return {
    x: r * Math.sin(rad),
    y: radius - r * Math.cos(rad),
    rotateDeg: angleDeg,
  };
}
```

- [ ] **Step 3: Delete `apps/mobile/src/games/batak/table/useBatakCardMotion.ts`**

- [ ] **Step 4: Trim `apps/mobile/src/games/batak/table/batakRailFan.ts` to just the tuned configs**

Replace the entire file with:

```ts
import type { RailAngleConfig } from '../../../table/railFan';

// Tuned live against real PlayingCards and Batak's real two-row hand — see Task 1 of
// docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md (Demo09BatakHandTuning).
// Re-tuned again on-device after that session (2026-08-06) — STANDARD_RAIL_CONFIG confirmed,
// COMPACT_RAIL_CONFIG still being iterated on.
// radius lives on the config (not a single module constant) rather than each mode sharing one
// module-level value — still safe even where the two configs' radii currently coincide: a hand is
// always entirely one mode for its whole lifetime, so radius is still fixed for the duration of
// any single reflow, which is the actual invariant that matters (a reflow interpolates one card's
// angle along one fixed circle; it never needs to blend between two different circles mid-reflow).
export const STANDARD_RAIL_CONFIG: RailAngleConfig = {
  radius: 320,
  overlap: 0.62,
  arcDegrees: 60,
  maxRotationDeg: 45,
  spacingPx: 120,
};

export const COMPACT_RAIL_CONFIG: RailAngleConfig = {
  radius: 320,
  overlap: 0.5,
  arcDegrees: 90,
  maxRotationDeg: 45,
  spacingPx: 120,
};
```

- [ ] **Step 5: Update `apps/mobile/src/games/batak/table/BatakHandCard.tsx`**

Change:
```ts
import { useBatakCardMotion } from './useBatakCardMotion';
```
to:
```ts
import { useCardMotion } from '../../../table/useCardMotion';
```

Change every remaining `useBatakCardMotion` reference in this file (the `registerMotion` prop type, `const motion = useBatakCardMotion(initial);`) to `useCardMotion`.

- [ ] **Step 6: Update `apps/mobile/src/games/batak/table/HumanHandFan.tsx`**

Change:
```ts
import type { useBatakCardMotion } from "./useBatakCardMotion";
import {
  STANDARD_RAIL_CONFIG,
  COMPACT_RAIL_CONFIG,
  railAngleStepDeg,
  railAngles,
  railPosition,
} from "./batakRailFan";
```
to:
```ts
import type { useCardMotion } from "../../../table/useCardMotion";
import { STANDARD_RAIL_CONFIG, COMPACT_RAIL_CONFIG } from "./batakRailFan";
import { railAngleStepDeg, railAngles, railPosition } from "../../../table/railFan";
```

Change every remaining `useBatakCardMotion` reference in this file (the `registerHandMotion` prop type) to `useCardMotion`.

- [ ] **Step 7: Update `apps/mobile/src/games/batak/BatakTable.tsx`**

Change:
```ts
import type { useBatakCardMotion } from './table/useBatakCardMotion';
```
to:
```ts
import type { useCardMotion } from '../../table/useCardMotion';
```

Change every remaining `useBatakCardMotion` reference in this file (the `handMotionRef` type, `registerHandMotion`'s parameter type) to `useCardMotion`.

- [ ] **Step 8: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: zero errors. This confirms the move touched every call site.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/table/useCardMotion.ts apps/mobile/src/table/railFan.ts apps/mobile/src/games/batak/table/batakRailFan.ts apps/mobile/src/games/batak/table/BatakHandCard.tsx apps/mobile/src/games/batak/table/HumanHandFan.tsx apps/mobile/src/games/batak/BatakTable.tsx
git status
git add -u apps/mobile/src/games/batak/table/useBatakCardMotion.ts
git commit -m "refactor(mobile): promote card-motion hook and rail-fan math to shared table/"
```

(The `git status`/second `git add -u` covers the deleted file — confirm it shows as deleted/staged before committing.)

---

### Task 2: `pistiRailFan.ts` — Pişti's own rail-fan tuning

**Files:**
- Create: `apps/mobile/src/games/pisti/table/pistiRailFan.ts`

**Interfaces:**
- Consumes: `RailAngleConfig` from `apps/mobile/src/table/railFan.ts` (Task 1).
- Produces: `PISTI_RAIL_CONFIG: RailAngleConfig`, `PISTI_SELECTED_LIFT_DISTANCE: number`. Consumed by Task 4 (`PistiHandFan.tsx`).

- [ ] **Step 1: Write the file**

```ts
import type { RailAngleConfig } from '../../../table/railFan';

// Pişti's hand never exceeds 4 cards (dealt 4 max) — a single config, no compact/two-row variant
// (unlike Batak's STANDARD_RAIL_CONFIG/COMPACT_RAIL_CONFIG). radius/spacingPx match Batak's
// STANDARD_RAIL_CONFIG (same physical card size, so the same circle/spacing reads consistently);
// arcDegrees/maxRotationDeg are much smaller than Batak's 60°/45°, which is tuned for up to 13
// fanned cards — the same arc across Pişti's 4-card hand would look absurdly splayed. A picked
// starting point (no dedicated Playground tuning tool this round, per explicit decision) — adjust
// live once running. See docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-
// design.md §2.
export const PISTI_RAIL_CONFIG: RailAngleConfig = {
  radius: 320,
  overlap: 0.5,
  arcDegrees: 36,
  maxRotationDeg: 20,
  spacingPx: 120,
};

// Pushed outward along a card's own rail angle when selected — between Pişti's old flat
// DEFAULT_LIFT_DISTANCE (16, SelectableCard.tsx, deleted in Task 5) and Batak's
// SELECTED_LIFT_DISTANCE (40) — Pişti's arc is much gentler than Batak's, so a smaller lift still
// reads clearly.
export const PISTI_SELECTED_LIFT_DISTANCE = 24;
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pisti/table/pistiRailFan.ts
git commit -m "feat(pisti): add pistiRailFan geometry config"
```

---

### Task 3: `PistiHandCard.tsx` — one card, gesture-driven

**Files:**
- Create: `apps/mobile/src/games/pisti/table/PistiHandCard.tsx`

**Interfaces:**
- Consumes: `useCardMotion` (Task 1), `PlayingCard`/`CARD_DIMS` from `@world-of-cards/ui`, `useReducedMotion` (`apps/mobile/src/components/useReducedMotion`), `useSettingsStore` (`apps/mobile/src/state/settingsStore`).
- Produces: `PistiHandCard` component, props `{ cardId: string; card: Card; restTarget: { x: number; y: number; angleDeg: number }; liftedTarget: { x: number; y: number }; interactive: boolean; selected: boolean; onPress: () => void; registerMotion: (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => void }`. Consumed by Task 4 (`PistiHandFan.tsx`).

Simpler than `BatakHandCard.tsx`: no `enterFromOffset` (no gömmeli-bury equivalent), no entrance stagger (Pişti's hand only ever renders once `dealPhase === 'revealing'`, i.e. after the deal-flight overlay already finished — cards appear directly at their resting slot, same as today), no local-departure leg (no trick-center resize in scope for Pişti).

- [ ] **Step 1: Write the component**

```tsx
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import type { Card } from '@world-of-cards/engine';
import { PlayingCard, CARD_DIMS } from '@world-of-cards/ui';
import { useReducedMotion } from '../../../components/useReducedMotion';
import { useSettingsStore } from '../../../state/settingsStore';
import { useCardMotion } from '../../../table/useCardMotion';

const CARD_WIDTH = CARD_DIMS.normal.width;

// Reflow (a sibling added/removed, shrinking/growing the row) — matches Pişti's pre-migration
// AnimatedHandCard's own HAND_CARD_REPOSITION_DURATION_MS/EASING exactly.
const REPOSITION_DURATION_MS = 220;
const REPOSITION_EASING = Easing.inOut(Easing.ease);

// Selecting snaps instantly (a fast two-tap play must not still be mid-rise when the confirming
// tap lands); deselecting eases back down — matches the pre-migration SelectableCard's own
// LIFT_ANIM_DURATION_MS/asymmetry exactly.
const DESELECT_DURATION_MS = 150;
const SELECT_EASING = Easing.out(Easing.cubic);
// Matches the pre-migration SelectableCard's exported SELECTED_SCALE (1.05) — duplicated rather
// than imported so this file has zero dependency on SelectableCard.tsx/Batak's BatakHandCard.tsx,
// per this migration's cross-game-isolation constraint (see the design spec §1).
const SELECTED_SCALE = 1.05;

export interface PistiHandCardTarget {
  x: number;
  y: number;
  angleDeg: number;
}

export interface PistiHandCardProps {
  cardId: string;
  card: Card;
  // This slot's resting (unselected) position/angle — recomputed by PistiHandFan every render
  // from rail geometry, consulted here at mount time and inside the reflow effect only, never
  // re-read directly during render.
  restTarget: PistiHandCardTarget;
  // Same x/y with the selection lift's extraRadius already applied (same angleDeg) — precomputed
  // by the caller since only it has the RailAngleConfig this needs.
  liftedTarget: { x: number; y: number };
  interactive: boolean;
  selected: boolean;
  onPress: () => void;
  // Hands the parent this card's own motion controller (setTarget/getValues) once, on mount —
  // PistiHandFan uses this to retarget the card on every reflow, and PistiTable's
  // playWithMeasuredOrigin uses it to read the card's real current position at tap time.
  registerMotion: (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => void;
}

function PistiHandCardComponent({
  cardId,
  card,
  restTarget,
  liftedTarget,
  interactive,
  selected,
  onPress,
  registerMotion,
}: PistiHandCardProps) {
  const reducedMotion = useReducedMotion();
  const dimUnplayableCards = useSettingsStore((s) => s.dimUnplayableCards);

  const initialDest = selected ? liftedTarget : restTarget;
  const initial = {
    x: initialDest.x,
    y: initialDest.y,
    angleDeg: restTarget.angleDeg,
    scale: selected ? SELECTED_SCALE : 1,
  };
  const motion = useCardMotion(initial);

  useEffect(() => {
    registerMotion(cardId, motion);
    return () => registerMotion(cardId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // Reflow: this card's resting slot changed because a sibling was added/removed. Skipped on
  // mount — `initial` above already placed it at its resting spot, since Pişti's hand has no
  // entrance flourish of its own (it only ever renders once dealPhase === 'revealing', after the
  // deal-flight overlay's own fly-in animation already finished).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const dest = selected ? liftedTarget : restTarget;
    if (reducedMotion) {
      motion.setTarget({ x: dest.x, y: dest.y, angleDeg: restTarget.angleDeg, timing: { duration: 0 } });
      return;
    }
    motion.setTarget({
      x: dest.x,
      y: dest.y,
      angleDeg: restTarget.angleDeg,
      timing: { duration: REPOSITION_DURATION_MS, easing: REPOSITION_EASING },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restTarget.x, restTarget.y, restTarget.angleDeg, reducedMotion]);

  // Selection lift/scale: a pure radial offset along this card's own angle, snapping in on select
  // and easing back out on deselect. Skipped on mount (a card never mounts pre-selected).
  const selectMounted = useRef(false);
  useEffect(() => {
    if (!selectMounted.current) {
      selectMounted.current = true;
      return;
    }
    const dest = selected ? liftedTarget : restTarget;
    if (reducedMotion) {
      motion.setTarget({ x: dest.x, y: dest.y, scale: selected ? SELECTED_SCALE : 1, timing: { duration: 0 } });
      return;
    }
    motion.setTarget({
      x: dest.x,
      y: dest.y,
      scale: selected ? SELECTED_SCALE : 1,
      timing: { duration: selected ? 0 : DESELECT_DURATION_MS, easing: SELECT_EASING },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, reducedMotion]);

  function handlePress() {
    if (!interactive) return;
    onPress();
  }

  // Captured directly by closure, rebuilt fresh every render — NOT read via a ref inside the
  // worklet callback below (unsafe — see Batak's own ADR-001 for the runtime warning this caused).
  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(handlePress)();
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: motion.shared.translateX.value },
      { translateY: motion.shared.translateY.value },
      { rotate: `${motion.shared.rotate.value}deg` },
      { scale: motion.shared.scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        testID={`pisti-hand-card-${cardId}`}
        style={[{ position: 'absolute', left: '50%', top: 0, marginLeft: -CARD_WIDTH / 2 }, animatedStyle]}>
        <View>
          <PlayingCard card={card} size="normal" highlighted={selected} />
          {!interactive && dimUnplayableCards && (
            // Dark scrim marking the hand as "not currently tappable" while keeping card art fully
            // visible underneath — carries over the pre-migration SelectableCard's exact behavior
            // (BatakHandCard.tsx's own migration dropped this, since Batak dims per-card legality
            // instead; Pişti has no per-card legality, only a whole-hand on/off, so this is the
            // right visual to preserve here).
            <View
              testID="selectable-card-disabled-scrim"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                borderRadius: 6,
                pointerEvents: 'none',
              }}
            />
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// PistiHandFan recomputes restTarget/liftedTarget as fresh object literals every render (rail
// geometry is cheap to recompute, not memoized upstream), which would defeat React.memo's default
// shallow comparison and re-render every hand card whenever any one of them changes. Deliberately
// NOT comparing onPress/registerMotion by reference — those closures behave identically for this
// specific card regardless of identity, as long as every value below is unchanged (mirrors
// BatakHandCard.tsx's own areBatakHandCardPropsEqual reasoning).
function arePistiHandCardPropsEqual(prev: PistiHandCardProps, next: PistiHandCardProps): boolean {
  return (
    prev.cardId === next.cardId &&
    prev.restTarget.x === next.restTarget.x &&
    prev.restTarget.y === next.restTarget.y &&
    prev.restTarget.angleDeg === next.restTarget.angleDeg &&
    prev.liftedTarget.x === next.liftedTarget.x &&
    prev.liftedTarget.y === next.liftedTarget.y &&
    prev.interactive === next.interactive &&
    prev.selected === next.selected
  );
}

export const PistiHandCard = React.memo(PistiHandCardComponent, arePistiHandCardPropsEqual);
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pisti/table/PistiHandCard.tsx
git commit -m "feat(pisti): add PistiHandCard component"
```

---

### Task 4: `PistiHandFan.tsx` — layout/orchestration

**Files:**
- Create: `apps/mobile/src/games/pisti/table/PistiHandFan.tsx`

**Interfaces:**
- Consumes: `pistiRailFan.ts` (Task 2), `PistiHandCard` (Task 3), `railAngleStepDeg`/`railAngles`/`railPosition` from `apps/mobile/src/table/railFan.ts` (Task 1).
- Produces: `PistiHandFan` component (props below), `PistiHandSlot` type, `pistiCardRotationDeg(index, count): number` (exported — consumed by Task 5's `PistiTable.tsx`).

- [ ] **Step 1: Write the file**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-of-cards/engine';
import { CARD_DIMS } from '@world-of-cards/ui';
import { railAngleStepDeg, railAngles, railPosition } from '../../../table/railFan';
import { useCardMotion } from '../../../table/useCardMotion';
import { PISTI_RAIL_CONFIG, PISTI_SELECTED_LIFT_DISTANCE } from './pistiRailFan';
import { PistiHandCard } from './PistiHandCard';

const PISTI_CARD_HEIGHT = CARD_DIMS.normal.height;
// Extra vertical room the arc-fan's curve needs below center (railPosition's y grows away from 0
// as |angle| increases) — computed from PISTI_RAIL_CONFIG's own worst case (a 4-card hand's outer
// card sits near maxRotationDeg): radius * (1 - cos(maxRotationDeg)) ≈ 320 * (1 - cos(20°)) ≈ 19px,
// rounded up for margin. A starting point — adjust live once running, per the design spec.
const FAN_CURVE_MARGIN_PX = 24;
const PISTI_HAND_FAN_HEIGHT = PISTI_CARD_HEIGHT + FAN_CURVE_MARGIN_PX;

// One human-hand card's slot: its index within the row and how many cards currently share the
// row (count, not the initial deal size — the fan recenters as the row shrinks).
export interface PistiHandSlot {
  card: Card;
  index: number;
  count: number;
}

function slotPosition(slot: PistiHandSlot, extraRadius: number): { x: number; y: number; angleDeg: number } {
  const angleStepDeg = railAngleStepDeg(PISTI_RAIL_CONFIG, slot.count);
  const angles = railAngles(slot.count, angleStepDeg, PISTI_RAIL_CONFIG.maxRotationDeg);
  const angleDeg = angles[slot.index] ?? 0;
  const pos = railPosition(angleDeg, PISTI_RAIL_CONFIG.radius, extraRadius);
  return { x: pos.x, y: pos.y, angleDeg };
}

// Exported so PistiTable can compute a card's real fan angle at the moment it's tapped (for the
// played-card travel animation's origin rotation) without duplicating pistiRailFan.ts's formula —
// mirrors Batak's HumanHandFan.handCardRotationDeg.
export function pistiCardRotationDeg(index: number, count: number): number {
  const angleStepDeg = railAngleStepDeg(PISTI_RAIL_CONFIG, count);
  const angles = railAngles(count, angleStepDeg, PISTI_RAIL_CONFIG.maxRotationDeg);
  return angles[index] ?? 0;
}

// Renders every human-hand card under one shared parent. Layout/orchestration only: each
// PistiHandCard owns its own motion (position/rotation/scale) and gesture entirely — this
// component computes targets, it doesn't animate anything itself.
export function PistiHandFan({
  slots,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  registerHandMotion,
  handFanRef,
  onHandFanLayout,
}: {
  slots: PistiHandSlot[];
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  // Hands the caller (PistiTable) each card's live motion controller as it mounts/unmounts —
  // replaces the old handRowRef/measureInWindow approach entirely.
  registerHandMotion: (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => void;
  // Exposes this component's own root View so PistiTable can measure its real absolute window
  // position — every card's motion (translateX/translateY, read via getValues() at tap time) is
  // relative to THIS container's own top/center, not the screen.
  handFanRef: React.RefObject<View | null>;
  onHandFanLayout: () => void;
}) {
  return (
    <View style={styles.handFan} ref={handFanRef} onLayout={onHandFanLayout} testID="human-hand">
      {slots.map((slot) => {
        const restTarget = slotPosition(slot, 0);
        const liftedTarget = slotPosition(slot, PISTI_SELECTED_LIFT_DISTANCE);
        return (
          <PistiHandCard
            key={slot.card.id}
            cardId={slot.card.id}
            card={slot.card}
            restTarget={restTarget}
            liftedTarget={liftedTarget}
            interactive={isHumanInteractive}
            selected={selectedCardId === slot.card.id}
            onPress={() => selectCard(slot.card.id)}
            registerMotion={registerHandMotion}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed height since every card inside is absolutely positioned (see PistiHandCard) and can't
  // contribute to an auto-computed parent height the way normal-flow children would.
  handFan: { height: PISTI_HAND_FAN_HEIGHT },
});
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pisti/table/PistiHandFan.tsx
git commit -m "feat(pisti): add PistiHandFan component"
```

---

### Task 5: Wire `PistiTable.tsx` onto `PistiHandFan`

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`
- Delete: `apps/mobile/src/components/SelectableCard.tsx`

**Interfaces:**
- Consumes: `PistiHandFan`, `pistiCardRotationDeg` (Task 4), `useCardMotion` (Task 1).
- Produces: `PistiTable`'s `onPlayCard` prop signature gains a third parameter (`originRotateDeg?: number`); `PistiRevealCard` gains `originRotateDeg?: number`. Both consumed by Task 6 (`PistiScreen.tsx`).

- [ ] **Step 1: Confirm `SelectableCard.tsx` has no other consumer**

```bash
cd d:/CodeSpace/world-of-cards && grep -rl "components/SelectableCard\|from '\./SelectableCard'" apps/mobile/src --include="*.tsx" --include="*.ts"
```

Expected: only `apps/mobile/src/games/pisti/PistiTable.tsx` (about to be updated by this task). If anything else appears, stop and report it before proceeding — do not delete the file.

- [ ] **Step 2: Update imports**

Remove:
```ts
import { SelectableCard, DEFAULT_LIFT_DISTANCE } from '../../components/SelectableCard';
```

Add:
```ts
import { PistiHandFan, pistiCardRotationDeg } from './table/PistiHandFan';
import { useCardMotion } from '../../table/useCardMotion';
```

Change the React import line from:
```ts
import React, { useEffect, useMemo, useRef, useState } from 'react';
```
to:
```ts
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 3: Delete `AnimatedHandCard` and `handCardSlotX`**

Delete the `handCardSlotX` function (around line 113) and the entire `AnimatedHandCard` function (around lines 117-161) — both fully superseded by `PistiHandFan`/`PistiHandCard`.

Delete the now-unused constants: `HAND_CARD_GAP`, `HAND_CARD_STEP`, `HAND_CARD_REPOSITION_DURATION_MS`, `HAND_CARD_REPOSITION_EASING` (around lines 106-109) — the fan's geometry and reflow timing now live in `pistiRailFan.ts`/`PistiHandFan.tsx`/`PistiHandCard.tsx` instead.

- [ ] **Step 4: Replace `handRowRef`/`handRowCenter`/`handleHandRowLayout` with the hand-fan-container measurement pattern**

Delete:
```ts
const handRowRef = useRef<View>(null);
const [handRowCenter, setHandRowCenter] = useState<{ x: number; y: number } | null>(null);
function handleHandRowLayout() {
  handRowRef.current?.measureInWindow((x, y, width, height) => {
    setHandRowCenter({ x: x + width / 2, y: y + height / 2 });
  });
}
```

Replace with:
```ts
const handFanRef = useRef<View>(null);
const [handFanOrigin, setHandFanOrigin] = useState<{ x: number; y: number } | null>(null);
function handleHandFanLayout() {
  handFanRef.current?.measureInWindow((x, y, width) => {
    setHandFanOrigin({ x: x + width / 2, y });
  });
}
```

- [ ] **Step 5: Add a motion registry**

Add, near the new `handFanRef`/`handFanOrigin` state:
```ts
const handMotionRef = useRef(new Map<string, ReturnType<typeof useCardMotion>>()).current;
const registerHandMotion = useCallback(
  (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => {
    if (motion) handMotionRef.set(cardId, motion);
    else handMotionRef.delete(cardId);
  },
  [handMotionRef],
);
```

- [ ] **Step 6: Replace `playWithMeasuredOrigin`**

Replace the entire function with:

```ts
// Replaces a direct onPlayCard(cardId) call: reads the tapped card's real, currently-committed
// motion (position it's actually rendered at, lift included) directly from its own useCardMotion
// controller, converted into a delta from the pile's measured center — no DOM re-derivation, no
// staleness risk (mirrors BatakTable's playWithMeasuredOrigin, post-fix — see
// docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §3). Falls back to
// a plain onPlayCard(cardId) call (no origin — the pile-landing flight then uses the fixed
// 'bottom' offset, same as today) whenever any measurement isn't ready, which is always the case
// in this project's Jest/RNTL tests (host refs never resolve there) and is a defensive path on a
// real device too.
function playWithMeasuredOrigin(cardId: string) {
  const index = humanHand.findIndex((c) => c.id === cardId);
  if (!handFanOrigin || !destCenter || index < 0) {
    onPlayCard(cardId);
    return;
  }
  const originRotateDeg = pistiCardRotationDeg(index, humanHand.length);
  const motion = handMotionRef.get(cardId);
  if (!motion) {
    onPlayCard(cardId);
    return;
  }
  const values = motion.getValues();
  onPlayCard(
    cardId,
    {
      x: handFanOrigin.x + values.x - destCenter.x,
      y: handFanOrigin.y + values.y - destCenter.y,
    },
    originRotateDeg,
  );
}
```

- [ ] **Step 7: Replace the hand JSX**

Replace:
```tsx
      <HandFrame bottomOffset={handFrameBottomOffset} height={handFrameHeight} />
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handRow} testID="human-hand" ref={handRowRef} onLayout={handleHandRowLayout}>
          {dealPhase === 'revealing' &&
            humanHand.map((card, index) => (
              // Off-turn "not tappable" styling comes from SelectableCard's own disabled scrim
              // now (a dark overlay keeping the card art fully visible), replacing the old
              // 0.5-opacity wrapper — keeping both would double-dim the hand.
              <AnimatedHandCard
                key={card.id}
                card={card}
                index={index}
                count={humanHand.length}
                selected={selectedCardId === card.id}
                disabled={!isHumanInteractive}
                onPress={() => selectCard(card.id)}
              />
            ))}
        </View>
        <PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} statusText={capturedStatusText(capturedHuman)} active={isHumanTurn} isHuman />
      </View>
```
with:
```tsx
      <HandFrame bottomOffset={handFrameBottomOffset} height={handFrameHeight} />
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <PistiHandFan
          slots={
            dealPhase === 'revealing'
              ? humanHand.map((card, index) => ({ card, index, count: humanHand.length }))
              : []
          }
          isHumanInteractive={isHumanInteractive}
          selectedCardId={selectedCardId}
          selectCard={selectCard}
          registerHandMotion={registerHandMotion}
          handFanRef={handFanRef}
          onHandFanLayout={handleHandFanLayout}
        />
        <PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} statusText={capturedStatusText(capturedHuman)} active={isHumanTurn} isHuman />
      </View>
```

- [ ] **Step 8: Remove the now-unused `handRow`/`handCardSlot` styles**

In the `StyleSheet.create` block, delete the `handRow` and `handCardSlot` entries (and their doc comments) — `PistiHandFan` owns its own `handFan` style now.

- [ ] **Step 9: Delete `apps/mobile/src/components/SelectableCard.tsx`**

- [ ] **Step 10: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: zero errors. (`PistiTableProps.onPlayCard`'s signature is widened in Task 6, not this task — a 3rd optional parameter is backward-compatible, so this task's own typecheck should already be clean before Task 6 touches `PistiScreen.tsx`.)

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx
git rm apps/mobile/src/components/SelectableCard.tsx
git commit -m "feat(pisti): wire PistiTable onto PistiHandFan, delete SelectableCard"
```

---

### Task 6: Play-travel via `TravelCard` + persisted pile landing angle

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiScreen.tsx`

**Interfaces:**
- Consumes: `TravelCard` from `apps/mobile/src/table/TravelCard.tsx` (unchanged, already shared).
- Produces: `PistiTableProps.onPlayCard` signature becomes `(cardId: string, originOffset?: { x: number; y: number }, originRotateDeg?: number) => void`; `PistiTableProps` gains `pileRestingRotations?: Record<string, number>`.

- [ ] **Step 1: Delete the `RevealCard` component from `PistiTable.tsx`**

Delete the entire `RevealCard` function (around lines 163-232) and its now-unused `CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING` import if nothing else in the file still uses them (check first — `revealThenCommit`'s pacing constant lives in `PistiScreen.tsx`, not here, so this import may already be `TravelCard`'s own concern; verify via `grep -n "CARD_TRAVEL_DURATION_MS\|CARD_TRAVEL_EASING" apps/mobile/src/games/pisti/PistiTable.tsx` after this task's edits and remove the import only if truly unused).

- [ ] **Step 2: Add the `TravelCard` import**

```ts
import { TravelCard } from '../../table/TravelCard';
```

- [ ] **Step 3: Update `PistiRevealCard` and `PistiTableProps`**

Change:
```ts
export interface PistiRevealCard {
  card: Card;
  playerId: string;
  originOffset?: { x: number; y: number };
}
```
to:
```ts
export interface PistiRevealCard {
  card: Card;
  playerId: string;
  originOffset?: { x: number; y: number };
  // The human's real fan-rotation angle at the moment this card was played, held fixed for the
  // whole flight and kept once landed (see pileRestingRotations below) — undefined/0 for AI plays
  // (no rendered AI hand card to derive an angle from, so they always land flat).
  originRotateDeg?: number;
}
```

Change:
```ts
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void;
```
to:
```ts
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }, originRotateDeg?: number) => void;
```

Add a new prop to `PistiTableProps`:
```ts
  // Each already-landed pile card's angle, keyed by card id — kept once a human-played card lands
  // (see PistiScreen.tsx), so the pile reads as a natural, slightly messy stack instead of every
  // card snapping flat the instant it's buried. Defaults to {} (today's flat-everywhere look) so
  // callers that don't pass it (tests) are unaffected.
  pileRestingRotations?: Record<string, number>;
```

- [ ] **Step 4: Destructure the new prop with a default**

In the `PistiTable` function's destructured props, add `pileRestingRotations = {}` alongside the existing props.

- [ ] **Step 5: Give the resting pile cards their persisted rotation**

Change:
```tsx
              {stackedPile.map((card, i) => (
                <View
                  key={card.id}
                  style={[
                    styles.pileCardSlot,
                    {
                      zIndex: i,
                      transform: [{ translateX: PILE_CARD_OFFSETS[i].x }, { translateY: PILE_CARD_OFFSETS[i].y }],
                    },
                  ]}
                >
                  <PlayingCard card={card} />
                </View>
              ))}
```
to:
```tsx
              {stackedPile.map((card, i) => (
                <View
                  key={card.id}
                  style={[
                    styles.pileCardSlot,
                    {
                      zIndex: i,
                      transform: [
                        { translateX: PILE_CARD_OFFSETS[i].x },
                        { translateY: PILE_CARD_OFFSETS[i].y },
                        { rotate: `${pileRestingRotations[card.id] ?? 0}deg` },
                      ],
                    },
                  ]}
                >
                  <PlayingCard card={card} />
                </View>
              ))}
```

- [ ] **Step 6: Replace the `RevealCard` usage with `TravelCard`**

Change:
```tsx
              {revealCard && (
                <RevealCard
                  revealCard={revealCard}
                  destinationOffset={revealDestinationOffset}
                  label={
                    revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`
                  }
                  originDirection={resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats)}
                />
              )}
```
to:
```tsx
              {revealCard && (
                <>
                  <Text style={styles.revealLabel}>
                    {revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`}
                  </Text>
                  <View
                    style={[
                      styles.pileCardSlot,
                      {
                        zIndex: MAX_STACKED_PILE_CARDS + 1,
                        transform: [
                          { translateX: revealDestinationOffset.x },
                          { translateY: revealDestinationOffset.y },
                        ],
                      },
                    ]}
                  >
                    <TravelCard
                      originOffset={
                        revealCard.originOffset ??
                        revealOriginOffset(resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats))
                      }
                      originRotateDeg={revealCard.originRotateDeg ?? 0}
                      resetKey={revealCard.card.id}
                    >
                      <PlayingCard card={revealCard.card} highlighted />
                    </TravelCard>
                  </View>
                </>
              )}
```

The label stays a direct sibling within `pileStack` (not nested inside `TravelCard`, which moves) — `styles.revealLabel`'s existing absolute positioning is unchanged and already tuned for exactly this position.

- [ ] **Step 7: Thread `originRotateDeg` through `playWithMeasuredOrigin`'s `onPlayCard` call**

This was already added in Task 5 Step 6 (`playWithMeasuredOrigin` already calls `onPlayCard(cardId, {...}, originRotateDeg)`) — no further change needed here, just confirm it's still correct after this task's edits.

- [ ] **Step 8: Update `PistiScreen.tsx`**

Change the `RevealedMove` interface:
```ts
interface RevealedMove {
  move: PistiMove;
  card: Card;
  playerId: PlayerId;
  originOffset?: { x: number; y: number };
}
```
to:
```ts
interface RevealedMove {
  move: PistiMove;
  card: Card;
  playerId: PlayerId;
  originOffset?: { x: number; y: number };
  originRotateDeg?: number;
}
```

Add new state, near `revealedMove`:
```ts
  // Each landed human-played card's angle, keyed by card id, kept for the rest of the hand so the
  // pile reads as a natural stack rather than every card snapping flat once buried — see
  // docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §4. Never pruned:
  // holds at most one entry per card played this hand (≤52), and a new hand/session gets a fresh
  // ActiveGame mount — unlike Batak's per-trick restingRotations, this isn't reused across many
  // plays of the same slot.
  const [pileRestingRotations, setPileRestingRotations] = useState<Record<string, number>>({});
```

Change `revealThenCommit`'s signature and body:
```ts
  function revealThenCommit(move: PistiMove, playerId: PlayerId, originOffset?: { x: number; y: number }) {
    const playedCard = state.table.zones[`hand-${playerId}`].cards.find((c) => c.id === move.cardId);
    if (!playedCard) {
      applyMove(move, playerId);
      return;
    }
    setRevealedMove({ move, card: playedCard, playerId, originOffset });
    revealTimeoutRef.current = setTimeout(() => {
      applyMove(move, playerId);
      setRevealedMove(null);
    }, REVEAL_DELAY_MS);
  }
```
to:
```ts
  function revealThenCommit(
    move: PistiMove,
    playerId: PlayerId,
    originOffset?: { x: number; y: number },
    originRotateDeg?: number,
  ) {
    const playedCard = state.table.zones[`hand-${playerId}`].cards.find((c) => c.id === move.cardId);
    if (!playedCard) {
      applyMove(move, playerId);
      return;
    }
    setRevealedMove({ move, card: playedCard, playerId, originOffset, originRotateDeg });
    setPileRestingRotations((prev) => ({ ...prev, [playedCard.id]: originRotateDeg ?? 0 }));
    revealTimeoutRef.current = setTimeout(() => {
      applyMove(move, playerId);
      setRevealedMove(null);
    }, REVEAL_DELAY_MS);
  }
```

Change `handlePlayCard`:
```ts
  function handlePlayCard(cardId: string, originOffset?: { x: number; y: number }) {
    revealThenCommit({ type: 'play', cardId }, HUMAN_ID, originOffset);
  }
```
to:
```ts
  function handlePlayCard(cardId: string, originOffset?: { x: number; y: number }, originRotateDeg?: number) {
    revealThenCommit({ type: 'play', cardId }, HUMAN_ID, originOffset, originRotateDeg);
  }
```

Update the `<PistiTable ... />` call site: add `originRotateDeg: revealedMove.originRotateDeg` to the `revealCard` object literal, and pass the new `pileRestingRotations` prop:
```tsx
        revealCard={
          revealedMove
            ? {
                card: revealedMove.card,
                playerId: revealedMove.playerId,
                originOffset: revealedMove.originOffset,
                originRotateDeg: revealedMove.originRotateDeg,
              }
            : null
        }
        pileRestingRotations={pileRestingRotations}
```

`useAITurn`'s `onMove: revealThenCommit` needs no change — `revealThenCommit`'s new 4th parameter is optional, and AI plays simply never supply it, defaulting to `0` (flat) when recorded into `pileRestingRotations`.

- [ ] **Step 9: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx apps/mobile/src/games/pisti/PistiScreen.tsx
git commit -m "feat(pisti): land played cards via TravelCard, persist pile rotation"
```

---

### Task 7: Update `PistiTable.test.tsx` — remove the 4 tap-driven tests

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.test.tsx`

**Interfaces:** none — test-only change.

`fireEvent.press` dispatches a synthetic React press event, not a real native touch — it cannot trigger a `Gesture.Tap()`-based component's `onEnd` handler (`PistiHandCard`, as of Task 3). The 4 tests below exercised exactly that path and will fail once run, per the design spec §6. Remove them rather than force-fixing with no working replacement technique (Batak's own hand has zero equivalent coverage for the same reason).

- [ ] **Step 1: Remove the 4 affected tests and the now-unused `fireEvent` import**

Replace the full file content with:

```tsx
import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import { PistiTable } from './PistiTable';
import type { PistiState } from '@world-of-cards/engine/games/pisti';

const PLAYER_NAMES = { human: 'You', ai: 'Computer' };

function makeState(currentPlayerIndex: number): PistiState {
  return {
    gameId: 'pisti',
    players: ['human', 'ai'],
    currentPlayerIndex,
    status: 'in-progress',
    rngState: { seed: 0 },
    lastCapturedBy: null,
    pistiBonusPoints: { human: 0, ai: 0 },
    teams: null,
    table: {
      zones: {
        stock: { id: 'stock', faceUp: false, cards: [] },
        pile: { id: 'pile', faceUp: 'top-only', cards: [{ id: 'p1', suit: 'hearts', rank: '7' }] },
        'hand-human': {
          id: 'hand-human',
          faceUp: true,
          cards: [
            { id: 'h1', suit: 'clubs', rank: '9' },
            { id: 'h2', suit: 'spades', rank: 'K' },
          ],
        },
        'hand-ai': {
          id: 'hand-ai',
          faceUp: true,
          cards: [
            { id: 'a1', suit: 'diamonds', rank: '3' },
            { id: 'a2', suit: 'hearts', rank: '5' },
          ],
        },
        'captured-human': { id: 'captured-human', faceUp: true, cards: [] },
        'captured-ai': { id: 'captured-ai', faceUp: true, cards: [] },
      },
    },
  };
}

describe('PistiTable', () => {
  it('renders the pile top card and count', async () => {
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={() => {}} dealPhase="revealing" />);
    expect(screen.getAllByText('7')).toHaveLength(2);
    expect(screen.getByText('1 card')).toBeTruthy();
  });

  it('renders the opponent hand as face-down cards only', async () => {
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={() => {}} dealPhase="revealing" />);
    expect(within(screen.getByTestId('opponent-hand-ai')).getAllByTestId('playing-card-back')).toHaveLength(2);
    expect(screen.queryByText('3')).toBeNull();
  });

  // Card select/play (tap-to-select, tap-again-to-play) has no automated coverage here — as of
  // the Reanimated + Gesture.Tap() hand-fan migration (see
  // docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §6),
  // PistiHandCard's touch handling is a react-native-gesture-handler GestureDetector, which RNTL's
  // fireEvent.press (a synthetic React event, not a real native touch) cannot trigger. This
  // mirrors Batak's own hand-fan cards, which have had zero equivalent test coverage since their
  // own migration for the same reason — there's no established RNGH-gesture-firing test utility
  // in this codebase. The 4 tests previously here (first-tap-selects, second-tap-plays,
  // switching-selection-deselects, no-play-during-AI-turn) are gone, not rewritten; on-device
  // verification is the only current way to confirm this interaction.

  it('shows the banner text when provided', async () => {
    await render(
      <PistiTable
        state={makeState(0)}
        humanPlayerId="human"
        opponentPlayerIds={['ai']}
        playerNames={PLAYER_NAMES}
        onPlayCard={() => {}}
        bannerText="Pişti! +10"
        dealPhase="revealing"
      />
    );
    expect(screen.getByText('Pişti! +10')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.test.tsx
git commit -m "test(pisti): remove tap-driven select/play tests, gesture-based cards can't be fired via fireEvent.press"
```

---

### Task 8: Architecture Audit + on-device verification

**Files:**
- Create: `docs/animation/audits/PistiHandFanGestureMigration-Audit.md`

- [ ] **Step 1: Confirm Quick vs. full Audit template with the user**

Per standing project convention, do not self-select — ask explicitly. This is a new animation mechanism in production Pişti (not a tuning change to something already shipped), the same category as Batak's own hand-fan migration, which used the full `AuditTemplate.md`.

- [ ] **Step 2: Complete the audit**

Follow `docs/animation/audits/AuditTemplate.md`'s structure, covering: Current/Proposed Ownership (position/rotation/scale/gesture, now owned by `useCardMotion`+`PistiHandCard` instead of `SelectableCard`+`AnimatedHandCard`; play-travel now owned by the shared `TravelCard` instead of the bespoke `RevealCard`), Layer Responsibilities against the Animation Constitution §4, Boundary Violations (should be none — verify the cross-game-isolation constraint actually held, don't assume), Risks (rapid card select/play, reduced motion, the pile's `pileRestingRotations` map growing unboundedly across a very long hand, the `getValues()` staleness tradeoff already documented in `useCardMotion.ts`).

- [ ] **Step 3: On-device verification (yours to do, not mine)**

Play a real hand on your phone and the emulator: select→play (two-tap) for every card in a 4-card hand, rapid re-taps, tapping elsewhere to deselect, a full hand through to a redeal, reduced-motion OS setting on, both 2-player and 4-player table sizes. Confirm cards respond to a single tap reliably (the original bug this whole thread started from), the fan geometry looks reasonable at 1-4 cards, and the pile shows the human's landing angle persisting once buried under later plays.

- [ ] **Step 4: Commit the audit**

```bash
git add docs/animation/audits/PistiHandFanGestureMigration-Audit.md
git commit -m "docs(animation): add Architecture Audit for Pişti hand-fan gesture migration"
```

---

## Plan Self-Review Notes

- **Spec coverage:** §1 (file layout) → Tasks 1-5 (SelectableCard.tsx deletion in Task 5). §2 (hand-fan geometry) → Task 2, consumed by Task 4. §3 (touch & selection) → Tasks 3, 5 (playWithMeasuredOrigin rewrite). §4 (play-travel & pile landing) → Task 6. §5 (edge cases: reduced motion, no enterFromOffset, measurement fallback, player-count independence) → addressed inline across Tasks 3, 5 (reduced motion in Task 3's every setTarget branch; no enterFromOffset by omission from PistiHandCardProps; measurement fallback in Task 5 Step 6; player-count independence needs no task, since PistiHandFan never reads seat/player-count data at all). §6 (testing) → Task 7.
- **Placeholder scan:** no "TBD"/"TODO"/"handle appropriately" anywhere in this plan. Every step shows the actual code, not a description of it. Task 6 Step 1's file-content check ("verify via grep") is a real, executable verification instruction, not a placeholder.
- **Type consistency:** `useCardMotion`'s return shape (`{ shared, setTarget, getValues }`) is identical across Tasks 1, 3, 4, 5. `PistiHandCardProps`/`PistiHandSlot` are defined once (Tasks 3-4) and consumed with the same field names everywhere after (`restTarget`/`liftedTarget`/`interactive`/`selected`/`registerMotion` — no renaming drift). `PistiRevealCard.originRotateDeg`/`RevealedMove.originRotateDeg`/`onPlayCard`'s third parameter all share the same `number | undefined` type and flow in one direction (`PistiHandFan`'s `pistiCardRotationDeg` → `PistiTable`'s `playWithMeasuredOrigin` → `onPlayCard` → `PistiScreen`'s `handlePlayCard`/`revealThenCommit` → `RevealedMove` → `PistiRevealCard` → `TravelCard`'s `originRotateDeg` prop and `pileRestingRotations`'s stored value) with no intermediate reinterpretation.
