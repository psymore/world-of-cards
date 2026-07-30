# Batak Hand-Fan Demo08 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Batak's `HumanHandFan.tsx` on Demo08's proven pattern (fixed-box + Reanimated transforms + `Gesture.Tap()`/`GestureDetector` + rail/angle geometry), tuned first in an isolated playground tool against real card art and Batak's actual two-row hand shape.

**Architecture:** A new playground demo (`Demo09BatakHandTuning`) reuses `railFanLayout.ts`'s math and `FanConfigControls.tsx`'s sliders against real `PlayingCard`s to tune the geometry live. Production gets a new, Batak-owned rail-math module (two independent rail rows, not importing across the app boundary from `apps/playground`) and two new components (`useBatakCardMotion.ts`, `BatakHandCard.tsx`) that `HumanHandFan.tsx` composes. `BatakTable.tsx`'s `playWithMeasuredOrigin` is simplified to read the new shared values directly instead of its old measurement/re-derivation workaround.

**Tech Stack:** `react-native-reanimated` (shared values, `withTiming`), `react-native-gesture-handler` (`Gesture.Tap()`/`GestureDetector`), existing `@world-cards/ui` `PlayingCard`/`CARD_DIMS`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-30-batak-hand-fan-demo08-migration-design.md` — read it first.
- **Scope: hand-fan only.** Do not touch `TrickCenter.tsx`'s resize behavior, `KittyRevealCard.tsx`, or `CenteredDecisionModal.tsx` — those are a deferred, separate follow-up.
- **`SelectableCard.tsx` stays completely untouched** — Pişti's `PistiTable.tsx` depends on it. `HumanHandFan.tsx` simply stops importing it.
- **No cross-app import.** `apps/mobile` has no dependency on `apps/playground` (confirmed via `apps/mobile/package.json`) — production's rail math is its own file, not an import from the playground.
- **Mirror Demo08's gesture pattern exactly**, including the parts the reverted attempt got wrong: `.onEnd((_e, success) => { if (success) runOnJS(handlePress)(); })` (checking `success`, not just calling unconditionally), and capturing `handlePress` by closure (rebuilt fresh every render) rather than reading a ref inside the worklet callback.
- **No new automated tests**, per the standing 2026-07-07 mobile-UI policy. Existing suite (`npm test` from repo root) must stay green after every task, especially `PistiTable.test.tsx` (the one suite that already proved sensitive to `DeselectableSurface`'s gesture-handler conversion).
- **Reduced motion:** every animated transition must respect `useReducedMotion()` (`apps/mobile/src/components/useReducedMotion`) — instant positioning, no transition, when enabled. This was correctly handled throughout the original `HumanHandFan.tsx`; preserve that.

---

### Task 1: `Demo09BatakHandTuning` — playground rail-fan tuning tool

**Files:**
- Create: `apps/playground/src/animation/demos/Demo09BatakHandTuning.tsx`
- Modify: `apps/playground/src/animation/types.ts` (add `'batak-hand-tuning'` to `DemoId`/`DEMO_ORDER`/`DEMO_LABELS`)
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx` (register the new demo)
- Modify: `apps/playground/src/animation/components/FanConfigControls.tsx` (additive `cardWidth?: number` prop)

**Interfaces:**
- Consumes: `railAngleStepDeg`/`railAngles`/`railPosition`/`RailSlot` from `apps/playground/src/animation/components/railFanLayout.ts` (unchanged), `FanConfigControls` (extended additively), `PlayingCard`/`CARD_DIMS` from `@world-cards/ui`, `createDeck`/`shuffle`/`createRng` from `@world-cards/engine`.
- Produces: nothing consumed by later tasks programmatically — **this task's real output is the tuned numeric values you choose interactively**, which Task 2 hardcodes. Nothing here blocks on Task 2 existing.

- [ ] **Step 1: Add the additive `cardWidth` prop to `FanConfigControls.tsx`**

In `apps/playground/src/animation/components/FanConfigControls.tsx`, add an optional prop and use it for the Spacing slider's range instead of the hardcoded `SIMPLE_CARD_WIDTH`:

```tsx
export interface FanConfigControlsProps {
  overlap: number;
  onOverlapChange: (value: number) => void;
  arcDegrees: number;
  onArcDegreesChange: (value: number) => void;
  maxRotationDeg: number;
  onMaxRotationDegChange: (value: number) => void;
  spacingPx: number;
  onSpacingPxChange: (value: number) => void;
  handSize?: number;
  onHandSizeChange?: (value: number) => void;
  // Overrides the Spacing slider's range (SIMPLE_CARD_WIDTH * 0.2..SIMPLE_CARD_WIDTH by default)
  // — used by Demo09BatakHandTuning, whose real PlayingCard is wider than the playground's
  // SimpleCard. Omitting this reproduces every existing demo's exact slider range.
  cardWidth?: number;
}
```

In the component body, destructure `cardWidth = SIMPLE_CARD_WIDTH` (import already present) and use it for the Spacing `LabeledSlider`'s `minimumValue`/`maximumValue`:

```tsx
  cardWidth = SIMPLE_CARD_WIDTH,
```

```tsx
          <LabeledSlider
            label="Spacing"
            testID="control-spacing"
            minimumValue={cardWidth * 0.2}
            maximumValue={cardWidth}
            step={1}
            value={spacingPx}
            onChange={onSpacingPxChange}
          />
```

- [ ] **Step 2: Register the demo in `types.ts`**

In `apps/playground/src/animation/types.ts`:

```ts
export type DemoId =
  | 'fan-layout'
  | 'selection'
  | 'play-travel'
  | 'landing'
  | 'transform'
  | 'hand-reposition'
  | 'complete-sequence'
  | 'reanimated-hand-reposition'
  | 'batak-hand-tuning';

export const DEMO_ORDER: DemoId[] = [
  'fan-layout',
  'selection',
  'play-travel',
  'landing',
  'transform',
  'hand-reposition',
  'complete-sequence',
  'reanimated-hand-reposition',
  'batak-hand-tuning',
];

export const DEMO_LABELS: Record<DemoId, string> = {
  'fan-layout': 'Demo 1: Fan Layout',
  selection: 'Demo 2: Selection',
  'play-travel': 'Demo 3: Play Card',
  landing: 'Demo 4: Landing',
  transform: 'Demo 5: Transform',
  'hand-reposition': 'Demo 6: Hand Reposition',
  'complete-sequence': 'Demo 7: Complete Sequence',
  'reanimated-hand-reposition': 'Demo 8: Reanimated Reposition',
  // Tunes the real Batak hand-fan geometry (real PlayingCard, real two-row layout) against
  // Demo08's proven rail/angle model, before those values get hardcoded into production — see
  // docs/superpowers/specs/2026-07-30-batak-hand-fan-demo08-migration-design.md.
  'batak-hand-tuning': 'Demo 9: Batak Hand Tuning',
};
```

- [ ] **Step 3: Write `Demo09BatakHandTuning.tsx`**

Models Batak's real two-row hand: each row is its own independent rail (same radius, angle math identical to Demo08's per-row), with the top row's pivot offset above the bottom row's by a tunable overlap so the two rows imbricate exactly like production's `HAND_ROW_OVERLAP_PX` does today. No tap-to-play interaction (Demo08 already proved that mechanism) — this tool is for eyeballing static layout and reflow (a "remove a random card" button), at real card size, at multiple hand sizes and both layout modes.

```tsx
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Text } from 'react-native';
import { PlayingCard, CARD_DIMS } from '@world-cards/ui';
import { createDeck, createRng, shuffle } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { FanLayoutConfig } from '../components/fanLayout';
import { railAngleStepDeg, railAngles, railPosition } from '../components/railFanLayout';
import { FanConfigControls } from '../components/FanConfigControls';

const CARD_WIDTH = CARD_DIMS.normal.width;
const CARD_HEIGHT = CARD_DIMS.normal.height;

// Provisional starting point (Demo08's own RAIL_RADIUS=230, scaled by the ratio of a real
// PlayingCard's width to the playground SimpleCard's width it was originally tuned against,
// 94/64 ≈ 1.47) — tune this live via the Radius-equivalent slider below; it's the first of the
// values this whole demo exists to let you replace with a real number.
const INITIAL_RAIL_RADIUS = 330;

const DEFAULT_FAN_CONFIG: FanLayoutConfig = {
  overlap: 0.55,
  arcDegrees: 40,
  maxRotationDeg: 18,
  spacingPx: CARD_WIDTH * 0.5,
};

// Standard Batak's steady-state max (13 cards) vs. gömmeli's compact mode (up to 20 mid-kitty-
// exchange) — see HumanHandFan.tsx's own GOMELI_* constants for the production numbers this
// toggle is meant to help you replace.
const HAND_SIZES = [13, 16, 20, 8, 4] as const;

export function Demo09BatakHandTuning() {
  const [radius, setRadius] = useState(INITIAL_RAIL_RADIUS);
  const [overlap, setOverlap] = useState(DEFAULT_FAN_CONFIG.overlap);
  const [arcDegrees, setArcDegrees] = useState(DEFAULT_FAN_CONFIG.arcDegrees);
  const [maxRotationDeg, setMaxRotationDeg] = useState(DEFAULT_FAN_CONFIG.maxRotationDeg);
  const [spacingPx, setSpacingPx] = useState(DEFAULT_FAN_CONFIG.spacingPx);
  const [rowOverlapPx, setRowOverlapPx] = useState(Math.round(CARD_HEIGHT * 0.25));
  const [handSizeIndex, setHandSizeIndex] = useState(0);
  const [compact, setCompact] = useState(false);

  const handSize = HAND_SIZES[handSizeIndex];
  const fanConfig: FanLayoutConfig = useMemo(
    () => ({ overlap, arcDegrees, maxRotationDeg, spacingPx }),
    [overlap, arcDegrees, maxRotationDeg, spacingPx],
  );

  const [seed] = useState(() => Date.now());
  const fullDeck = useMemo(() => shuffle(createDeck({ deckCount: 1, includeJokers: false }), createRng(seed)), [seed]);
  const [removedCount, setRemovedCount] = useState(0);
  const cards = useMemo(
    () => fullDeck.slice(0, Math.max(0, handSize - removedCount)),
    [fullDeck, handSize, removedCount],
  );

  const topCount = Math.ceil(cards.length / 2);
  const topRow = cards.slice(0, topCount);
  const bottomRow = cards.slice(topCount);

  function angleStepFor(rowLength: number) {
    // railAngleStepDeg takes a FanLayoutConfig + a reference hand size; reuse the same formula
    // per row, referenced against that row's own current length (mirrors railAngleStepDeg's own
    // "reference size" role — Demo08 uses the whole hand's size since it's one row; here each
    // row is its own independent rail, so its own length is the right reference).
    return railAngleStepDeg(fanConfig, Math.max(rowLength, 1));
  }

  function renderRow(row: Card[], pivotYOffset: number) {
    const angleStepDeg = angleStepFor(row.length);
    const angles = railAngles(row.length, angleStepDeg, maxRotationDeg);
    return row.map((card, i) => {
      const pos = railPosition(angles[i]);
      return (
        <View
          key={card.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: pivotYOffset,
            marginLeft: -CARD_WIDTH / 2 + pos.x,
            transform: [{ translateY: pos.y - radius }, { rotate: `${pos.rotateDeg}deg` }],
          }}>
          <PlayingCard card={card} size="normal" />
        </View>
      );
    });
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.modeRow}>
          {HAND_SIZES.map((size, i) => (
            <Pressable
              key={size}
              testID={`demo09-handsize-${size}`}
              onPress={() => {
                setHandSizeIndex(i);
                setRemovedCount(0);
              }}
              style={[styles.modeButton, handSizeIndex === i && styles.modeButtonActive]}>
              <Text style={styles.modeButtonText}>{size} cards</Text>
            </Pressable>
          ))}
          <Pressable
            testID="demo09-compact-toggle"
            onPress={() => setCompact(c => !c)}
            style={[styles.modeButton, compact && styles.modeButtonActive]}>
            <Text style={styles.modeButtonText}>{compact ? 'Compact: on' : 'Compact: off'}</Text>
          </Pressable>
          <Pressable
            testID="demo09-remove-card"
            onPress={() => setRemovedCount(n => Math.min(n + 1, cards.length))}
            style={styles.modeButton}>
            <Text style={styles.modeButtonText}>Remove a card</Text>
          </Pressable>
        </View>
        <View style={[styles.handWrapper, { height: CARD_HEIGHT * 2 }]}>
          {renderRow(topRow, 0)}
          {renderRow(bottomRow, CARD_HEIGHT - rowOverlapPx)}
        </View>
        <FanConfigControls
          overlap={overlap}
          onOverlapChange={setOverlap}
          arcDegrees={arcDegrees}
          onArcDegreesChange={setArcDegrees}
          maxRotationDeg={maxRotationDeg}
          onMaxRotationDegChange={setMaxRotationDeg}
          spacingPx={spacingPx}
          onSpacingPxChange={setSpacingPx}
          cardWidth={CARD_WIDTH}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, alignItems: 'center', paddingTop: 20 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16, gap: 8 },
  modeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffffff55',
  },
  modeButtonActive: { backgroundColor: '#ffffff22', borderColor: '#fff' },
  modeButtonText: { color: '#ffffffcc', fontSize: 13 },
  handWrapper: { position: 'relative', alignSelf: 'stretch' },
});
```

Note: `radius` (from a slider you'll add) isn't yet wired to a control in the snippet above beyond its initial state — add one more `LabeledSlider` (or extend `FanConfigControls` again, your call) for `radius` and `rowOverlapPx` specifically, importing `LabeledSlider` directly from `../components/LabeledSlider` the same way `FanConfigControls` itself does, since these two aren't part of the existing 5-slider set. Wire `setRadius`/`setRowOverlapPx` to it.

- [ ] **Step 4: Register in `AnimationPlaygroundScreen.tsx`**

Add the import and switch case:

```tsx
import { Demo09BatakHandTuning } from './demos/Demo09BatakHandTuning';
```

```tsx
    case 'batak-hand-tuning':
      return <Demo09BatakHandTuning />;
```

- [ ] **Step 5: Typecheck and run the app**

```bash
cd apps/playground && npx tsc --noEmit
```

Run `apps/playground` (`npx expo start`, per this repo's usual playground workflow) and open Demo 9.

- [ ] **Step 6: Tune live and record the final values**

This is the step that actually matters — spend real time here. Try both `compact: false` (13 cards) and `compact: true` (16-20 cards) at several hand sizes via the "Remove a card" button, adjusting radius/overlap/arc/max-rotation/spacing/row-overlap until both rows look right at every size. Write down the final numbers for: `RAIL_RADIUS`, `rowOverlapPx`, and — since Standard and gömmeli likely need different tuning, per production's existing `GOMELI_*` vs. `HUMAN_HAND_*` constant split — two full sets of `{overlap, arcDegrees, maxRotationDeg, spacingPx}`, one per mode. Task 3 hardcodes exactly these numbers; do not let Task 3 proceed with the provisional placeholders above.

- [ ] **Step 7: Commit**

```bash
git add apps/playground/src/animation/demos/Demo09BatakHandTuning.tsx apps/playground/src/animation/types.ts apps/playground/src/animation/AnimationPlaygroundScreen.tsx apps/playground/src/animation/components/FanConfigControls.tsx
git commit -m "feat(playground): add Demo09 Batak hand-fan tuning tool"
```

---

### Task 2: `batakRailFan.ts` — production rail-math module

**Files:**
- Create: `apps/mobile/src/games/batak/table/batakRailFan.ts`

**Interfaces:**
- Consumes: nothing (pure math).
- Produces: `RailAngleConfig` type (`{ radius, overlap, arcDegrees, maxRotationDeg, spacingPx }`), `STANDARD_RAIL_CONFIG`/`COMPACT_RAIL_CONFIG` (the two tuned configs), `railAngleStepDeg(config, referenceRowSize): number`, `railAngles(count, angleStepDeg, maxRotationDeg): number[]`, `railPosition(angleDeg, radius, extraRadius?): { x: number; y: number; rotateDeg: number }`. Consumed by Task 5 (not Task 3 — Task 3's `useBatakCardMotion` is pure motion plumbing with no geometry dependency).

- [ ] **Step 1: Write the file**

Direct, Batak-owned port of `apps/playground/src/animation/components/railFanLayout.ts`'s math (not imported — see Global Constraints), with the playground's `SIMPLE_CARD_WIDTH`-dependent `railFanWidth` dropped (production doesn't need a computed container width the way the playground's centering trick does — `HumanHandFan`'s container is already sized via `styles.handFan`, unchanged from before).

**Design correction found during Task 1's live tuning** (2026-07-30): the original design below assumed one fixed `RAIL_RADIUS` module constant for the whole app, matching Demo08 (where radius must never vary *during a single reflow*, since a reflow interpolates one card's angle along one fixed circle). Live tuning showed Standard Batak (13 cards) and gömmeli/compact (16 cards) genuinely need different radii (520 vs. 430) to look right. This doesn't violate the "must not vary during a reflow" invariant — a hand is always entirely Standard or entirely compact for its whole lifetime (`compact` is set once per table, never toggled mid-hand), so radius is still fixed for the duration of any single reflow, it's just no longer a single global constant. Fix: `radius` moves into `RailAngleConfig` itself, and `railPosition` takes it as an explicit parameter instead of reading a module constant.

**Final tuned values (from Task 1's live session, both confirmed by the user):**

| | Standard (13 cards) | Compact/gömmeli (16 cards) |
|---|---|---|
| `radius` | 520 | 430 |
| `overlap` | 0.55 (default, unchanged) | 0.55 (default, unchanged) |
| `arcDegrees` | 90 | 90 |
| `maxRotationDeg` | 45 | 45 |
| `spacingPx` | 47 (default, unchanged) | 45 |
| row overlap (vertical, shared — see Task 5) | 40px | 40px |

```ts
export interface RailAngleConfig {
  radius: number;
  overlap: number;
  arcDegrees: number;
  maxRotationDeg: number;
  spacingPx: number;
}

// Tuned live against real PlayingCards and Batak's real two-row hand — see Task 1 of
// docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md (Demo09BatakHandTuning).
// radius lives on the config (not a single module constant) because Standard and compact modes
// tuned to genuinely different values (520 vs 430) — still safe: a hand is always entirely one
// mode for its whole lifetime, so radius is still fixed for the duration of any single reflow,
// which is the actual invariant that matters (a reflow interpolates one card's angle along one
// fixed circle; it never needs to blend between two different circles mid-reflow).
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

// The two tuned configs from Task 1 — HumanHandFan.tsx (Task 5) selects between them via its
// existing `compact` prop.
export const STANDARD_RAIL_CONFIG: RailAngleConfig = {
  radius: 520,
  overlap: 0.55,
  arcDegrees: 90,
  maxRotationDeg: 45,
  spacingPx: 47,
};

export const COMPACT_RAIL_CONFIG: RailAngleConfig = {
  radius: 430,
  overlap: 0.55,
  arcDegrees: 90,
  maxRotationDeg: 45,
  spacingPx: 45,
};
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/table/batakRailFan.ts
git commit -m "feat(mobile): add Batak rail-fan geometry module"
```

---

### Task 3: `useBatakCardMotion.ts` — per-card Reanimated motion hook

**Files:**
- Create: `apps/mobile/src/games/batak/table/useBatakCardMotion.ts`

**Interfaces:**
- Consumes: nothing beyond `react-native-reanimated`.
- Produces: `useBatakCardMotion(initial: { x: number; y: number; angleDeg: number; scale: number }): { shared: { translateX, translateY, rotate, scale }, setTarget(target, options?), getValues(): { x, y, angleDeg, scale } }`. Consumed by Task 4.

- [ ] **Step 1: Write the hook**

Mirrors Demo08's `HandCardComponent`'s shared-value shape (translateX/translateY/rotate/scale, `withTiming` per property), generalized into a reusable hook rather than inline in the card component, since `BatakTable.tsx` (Task 6) also needs `getValues()` to read a card's live position without any component render involved.

```tsx
import { useRef } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

export interface BatakCardTarget {
  x?: number;
  y?: number;
  angleDeg?: number;
  scale?: number;
  timing?: { duration: number; easing?: (t: number) => number };
}

const DEFAULT_DURATION_MS = 320;
const DEFAULT_EASING = Easing.inOut(Easing.cubic);

export function useBatakCardMotion(initial: { x: number; y: number; angleDeg: number; scale: number }) {
  const translateX = useSharedValue(initial.x);
  const translateY = useSharedValue(initial.y);
  const rotate = useSharedValue(initial.angleDeg);
  const scale = useSharedValue(initial.scale);

  // JS-thread mirror of each shared value, kept in sync only by setTarget itself (never read from
  // the native/UI thread) — good enough for getValues()'s purpose (BatakTable reading a card's
  // "last commanded target" at tap time, not a frame-accurate live sample), and avoids the
  // permanent per-frame addListener bridge cost this codebase has already identified and removed
  // once (see useCardMotion.ts's own 2026-07-26 fix history).
  const lastValues = useRef({ x: initial.x, y: initial.y, angleDeg: initial.angleDeg, scale: initial.scale });

  function setTarget(target: BatakCardTarget) {
    const duration = target.timing?.duration ?? DEFAULT_DURATION_MS;
    const easing = target.timing?.easing ?? DEFAULT_EASING;
    if (target.x !== undefined) {
      translateX.value = withTiming(target.x, { duration, easing });
      lastValues.current.x = target.x;
    }
    if (target.y !== undefined) {
      translateY.value = withTiming(target.y, { duration, easing });
      lastValues.current.y = target.y;
    }
    if (target.angleDeg !== undefined) {
      rotate.value = withTiming(target.angleDeg, { duration, easing });
      lastValues.current.angleDeg = target.angleDeg;
    }
    if (target.scale !== undefined) {
      scale.value = withTiming(target.scale, { duration, easing });
      lastValues.current.scale = target.scale;
    }
  }

  function getValues() {
    return { ...lastValues.current };
  }

  return { shared: { translateX, translateY, rotate, scale }, setTarget, getValues };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/table/useBatakCardMotion.ts
git commit -m "feat(mobile): add useBatakCardMotion hook"
```

---

### Task 4: `BatakHandCard.tsx` — one card, Demo08-pattern

**Files:**
- Create: `apps/mobile/src/games/batak/table/BatakHandCard.tsx`

**Interfaces:**
- Consumes: `useBatakCardMotion` (Task 3), `PlayingCard` from `@world-cards/ui`.
- Produces: `BatakHandCard` component, props `{ cardId: string; card: Card; initial: {x,y,angleDeg}; interactive: boolean; selected: boolean; onPress: () => void; registerCardRef: (cardId: string, node: View | null) => void; motionRef?: (cardId: string, motion: ReturnType<typeof useBatakCardMotion>) => void }`. Consumed by Task 5.

- [ ] **Step 1: Write the component**

Fixed-box + `Gesture.Tap()`/`GestureDetector`, mirroring Demo08's `HandCardComponent` exactly (including the `success`-checked `.onEnd()` and closure-captured `handlePress` that the reverted attempt got wrong):

```tsx
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import type { Card } from '@world-cards/engine';
import { PlayingCard, CARD_DIMS } from '@world-cards/ui';
import { useBatakCardMotion } from './useBatakCardMotion';

const CARD_WIDTH = CARD_DIMS.normal.width;

export interface BatakHandCardProps {
  cardId: string;
  card: Card;
  // This card's target position/angle at mount — subsequent changes come through the parent
  // re-calling setTarget via the motion object it registers, not through this prop again (this
  // component never re-derives its own position from re-renders, per the fixed-box/shared-value
  // model — see Demo08ReanimatedHandReposition.tsx's own file-level comment).
  initial: { x: number; y: number; angleDeg: number };
  interactive: boolean;
  selected: boolean;
  onPress: () => void;
  registerCardRef: (cardId: string, node: View | null) => void;
  // Hands the parent this card's own motion controller (setTarget/getValues) once, on mount —
  // HumanHandFan uses this to retarget the card on every reflow, and BatakTable's
  // playWithMeasuredOrigin (Task 6) uses it to read the card's real current position at tap time.
  registerMotion: (cardId: string, motion: ReturnType<typeof useBatakCardMotion>) => void;
}

function BatakHandCardComponent({
  cardId,
  card,
  initial,
  interactive,
  selected,
  onPress,
  registerCardRef,
  registerMotion,
}: BatakHandCardProps) {
  const motion = useBatakCardMotion({ x: initial.x, y: initial.y, angleDeg: initial.angleDeg, scale: 1 });

  useEffect(() => {
    registerMotion(cardId, motion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  function handlePress() {
    if (!interactive) return;
    onPress();
  }

  // Captured directly by closure, rebuilt fresh every render — NOT read via a ref inside the
  // worklet callback below. Reading a plain React ref's `.current` from inside a Gesture Handler
  // `.onEnd` worklet is unsafe (Demo08's own file comment documents the exact runtime warning this
  // caused when tried) — see docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md.
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
        testID={`batak-hand-card-${cardId}`}
        style={[
          { position: 'absolute', left: '50%', top: 0, marginLeft: -CARD_WIDTH / 2 },
          animatedStyle,
        ]}>
        <View ref={node => registerCardRef(cardId, node)}>
          <PlayingCard card={card} size="normal" highlighted={selected} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export const BatakHandCard = React.memo(BatakHandCardComponent);
```

Note: `selected` here only drives `highlighted` (a visual glow, per `PlayingCard`'s existing prop) — the actual selected-card *lift* (moving it up along its own rail angle) is a `setTarget` call from the parent (Task 5), not something this component decides on its own, consistent with "this component owns rendering + gesture, the parent owns targeting."

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/table/BatakHandCard.tsx
git commit -m "feat(mobile): add BatakHandCard component"
```

---

### Task 5: Rewrite `HumanHandFan.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/table/HumanHandFan.tsx` (full rewrite)

**Interfaces:**
- Consumes: `batakRailFan.ts` (Task 2), `BatakHandCard` (Task 4), `useReducedMotion`.
- Produces: same public contract as before — `HumanHandFan` component (same props: `slots`, `legalCardIds`, `isHumanInteractive`, `selectedCardId`, `selectCard`, `playEntrance`, `registerCardRef`, `compact`, `departingCard`), plus the same exported helpers other files depend on: `handCardRotationDeg`, `sortHandForDisplay`, `HandSlot` type, `LOCAL_DEPARTURE_DISTANCE`, `LOCAL_DEPARTURE_DURATION_MS`, `SELECTED_LIFT_DISTANCE`. **New export**: `registerMotion`-driven card-motion lookup for Task 6 — see Step 3 below.

This is the largest task in the plan. Read the current (pre-rewrite) file in full before starting — `git show master:apps/mobile/src/games/batak/table/HumanHandFan.tsx` — since several existing behaviors (entrance stagger timing, bury-slot `enterFromOffset`, local-departure) must carry over exactly, just re-expressed on the new motion primitive instead of ported blindly.

- [ ] **Step 1: Design the per-slot angle (replaces `slotTargetX`/`slotTargetY`/`fanRotationDeg`/`fanCurveY`)**

Each row is its own independent rail (Task 2's `STANDARD_RAIL_CONFIG`/`COMPACT_RAIL_CONFIG`), with the bottom row's pivot offset down by `(CARD_DIMS.normal.height - ROW_OVERLAP_PX)` — same imbrication concept as before, just computed once as a Y offset added after `railPosition`'s own row-relative output, instead of a per-slot quadratic curve:

```ts
import { STANDARD_RAIL_CONFIG, COMPACT_RAIL_CONFIG, railAngleStepDeg, railAngles, railPosition } from './batakRailFan';

const ROW_OVERLAP_PX = 40; // Task 1's tuned value, same for both modes.

function slotPosition(slot: HandSlot, compact: boolean): { x: number; y: number; angleDeg: number } {
  const config = compact ? COMPACT_RAIL_CONFIG : STANDARD_RAIL_CONFIG;
  const angleStepDeg = railAngleStepDeg(config, slot.rowCount);
  const angles = railAngles(slot.rowCount, angleStepDeg, config.maxRotationDeg);
  const angleDeg = angles[slot.indexInRow] ?? 0;
  const pos = railPosition(angleDeg, config.radius);
  const rowYOffset = slot.row === 'top' ? 0 : CARD_DIMS.normal.height - ROW_OVERLAP_PX;
  return { x: pos.x, y: pos.y + rowYOffset, angleDeg: pos.rotateDeg };
}
```

`handCardRotationDeg(indexInRow, rowCount)` (still exported, still used by `BatakTable.tsx` for `TravelCard`'s `originRotateDeg`) becomes a thin wrapper: compute the same `angles` array as `slotPosition` does (Standard config only — `BatakTable.tsx`'s existing call sites don't pass `compact`, matching today's behavior, since the played card's rotation at travel-origin time is read before this rewrite ever distinguishes the two modes at this call site; if that turns out wrong once wired up in Task 6, surface it rather than guessing) and index into it.

- [ ] **Step 2: Entrance, local-departure, and bury-slot re-entry — same behavior, new primitive**

All three become `setTarget` calls on the same per-card `useBatakCardMotion` instance (Task 3), never a second wrapping `Animated.View`/opacity layer around `BatakHandCard` — this is the exact bug class that broke the reverted attempt (entrance and position fighting as two separate animation owners on one card). Concretely:

- **Entrance** (deal): on mount, if `playEntrance` is true and this is a genuinely new card (not a re-render), call `motion.setTarget({ scale: ... })`... but since Demo08's model doesn't have a built-in opacity concept and `useBatakCardMotion`'s shared values are position/rotation/scale only (no opacity), extend `useBatakCardMotion` (Task 3) with a fifth optional shared value, OR — simpler, and consistent with "the position/rotation/scale primitive owns everything" — have `BatakHandCard` itself own a plain local `useSharedValue` for entrance opacity, driven once on mount by a `withDelay(index * 40, withTiming(1, {duration: 350}))` exactly matching the original `EntranceCard`'s timing, applied via a *second* `useAnimatedStyle` merged into the same `Animated.View` (not a wrapping component) — i.e., one component, one `Animated.View`, two `useAnimatedStyle`s combined in the `style` array. This preserves "no second animation owner" (it's the same component/element, not a wrapper) while keeping opacity out of `useBatakCardMotion`'s reflow-focused API. Go back and add this to `BatakHandCard.tsx` (Task 4) as part of this task, not as a retroactive edit to already-committed Task 4 code — a `git commit --amend` or a new commit on top, your call, but Task 4's deliverable was described without opacity because this dependency wasn't yet resolved at that point in the plan; resolve it now.
- **Local departure**: when `departingCard?.cardId === slot.card.id`, call `motion.setTarget({ x: current.x - departureDeltaX, y: current.y - LOCAL_DEPARTURE_DISTANCE, timing: { duration: LOCAL_DEPARTURE_DURATION_MS, easing: LOCAL_DEPARTURE_EASING } })` where `current = motion.getValues()` — same vector-preserving logic as the original, just called through the new API.
- **Bury-slot re-entry**: on mount, if `slot.enterFromOffset` is set, call `motion.setTarget({x: target.x + offset.x, y: target.y + offset.y})` with `timing: {duration: 0}` (instant jump) immediately followed by `motion.setTarget({x: target.x, y: target.y})` with the normal reposition timing — same two-step "jump then animate in" as the original.

- [ ] **Step 3: `HumanHandFan` orchestration + motion registry**

```tsx
export function HumanHandFan({
  slots,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  registerCardRef,
  compact = false,
  departingCard = null,
  registerHandMotion,
}: {
  slots: HandSlot[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
  compact?: boolean;
  departingCard?: { cardId: string; deltaX: number } | null;
  // New: hands the caller (BatakTable) each card's live motion controller as it mounts — replaces
  // the old handCardRefs-based measureInWindow approach entirely (see Task 6).
  registerHandMotion: (cardId: string, motion: ReturnType<typeof useBatakCardMotion> | null) => void;
}) {
  return (
    <View style={styles.handFan} testID="human-hand">
      {slots.map(slot => {
        const target = slotPosition(slot, compact);
        return (
          <BatakHandCard
            key={slot.card.id}
            cardId={slot.card.id}
            card={slot.card}
            initial={target}
            interactive={isHumanInteractive && legalCardIds.has(slot.card.id)}
            selected={selectedCardId === slot.card.id}
            onPress={() => selectCard(slot.card.id)}
            registerCardRef={registerCardRef}
            registerMotion={registerHandMotion}
          />
        );
      })}
    </View>
  );
}
```

Reflow (a slot's `target` changing because a sibling was added/removed) needs `BatakHandCard` to call `motion.setTarget` again whenever its `initial`-derived target changes across renders — since `initial` is only consulted at mount time per Task 4's own doc comment, add a `useEffect` inside `BatakHandCardComponent` (Task 4) keyed on the slot's own target values, calling `motion.setTarget({x, y, angleDeg})` with the standard reposition timing whenever they change post-mount. This is the direct analog of the original `AnimatedFanCardComponent`'s reflow `useEffect` keyed on `[targetX, targetY]` — thread `target.x`/`target.y`/`target.angleDeg` into `BatakHandCard`'s props (rename `initial` usage accordingly, or add a parallel `target` prop distinct from `initial` if that reads cleaner) and add that effect. Resolve the exact prop shape when you write this task — the plan's Task 4 code above establishes the pattern, not a frozen final signature.

Selection lift (translating a selected card outward along its own rail angle by `SELECTED_LIFT_DISTANCE`) is also a `setTarget` call, fired from a `useEffect` keyed on `selected`, mirroring Demo08's own select/deselect effect — in production this is `railPosition(angleDeg, config.radius, selected ? SELECTED_LIFT_DISTANCE : 0)` (the `config`/`angleDeg` this slot already computed in Step 1), converted into an `{x, y}` `setTarget` call.

- [ ] **Step 4: Delete everything old**

No `AnimatedFanCard`, no `EntranceCard` wrapper component (its behavior moved into `BatakHandCard` per Step 2), no `SelectableCard` import, no `fanCurveY`/`fanRotationDeg` import from `seating.ts` (grep Pişti usage first — leave those functions in `seating.ts` itself if Pişti still calls them, per the spec's §5).

- [ ] **Step 5: Typecheck, run full suite**

```bash
cd apps/mobile && npx tsc --noEmit
cd d:/CodeSpace/world-cards && npm test
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/batak/table/HumanHandFan.tsx apps/mobile/src/games/batak/table/BatakHandCard.tsx
git commit -m "feat(mobile): rewrite HumanHandFan on the Demo08 rail-fan pattern"
```

---

### Task 6: `BatakTable.tsx` — motion registry + `playWithMeasuredOrigin` replacement

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `HumanHandFan`'s new `registerHandMotion` prop (Task 5), `useBatakCardMotion`'s return shape (Task 3).

- [ ] **Step 1: Add a motion registry**

```tsx
const handMotionRef = useRef(new Map<string, ReturnType<typeof useBatakCardMotion>>()).current;
const registerHandMotion = useCallback((cardId: string, motion: ReturnType<typeof useBatakCardMotion> | null) => {
  if (motion) handMotionRef.set(cardId, motion);
  else handMotionRef.delete(cardId);
}, [handMotionRef]);
```

Pass `registerHandMotion={registerHandMotion}` into the existing `<HumanHandFan ... />` call site (around line 562).

- [ ] **Step 2: Replace `playWithMeasuredOrigin`**

Delete the `slotTargetX` re-derivation and `measureInWindow`/`SELECTED_LIFT_DISTANCE` compensation entirely — read the tapped card's real current position directly:

```tsx
const playWithMeasuredOrigin = useCallback(
  (cardId: string) => {
    const slot = handSlotsRef.current.find((s) => s.card.id === cardId);
    const originRotateDeg = slot ? handCardRotationDeg(slot.indexInRow, slot.rowCount) : undefined;
    const motion = handMotionRef.get(cardId);
    const dest = destCenterRef.current;
    const handCenterX = handAreaCenterXRef.current;
    if (!motion || !dest || !slot || handCenterX == null) {
      onPlayCard(cardId, undefined, originRotateDeg);
      return;
    }
    const values = motion.getValues();
    onPlayCard(
      cardId,
      {
        x: handCenterX + values.x - dest.x,
        y: values.y - dest.y,
      },
      originRotateDeg,
    );
  },
  [handMotionRef, onPlayCard],
);
```

Note this drops the `compact` dependency `slotTargetX` needed (the motion object's `getValues()` already reflects wherever the card actually is, compact or not) and drops the `SELECTED_LIFT_DISTANCE` compensation (the card's real Y, lift included, is already what `getValues()` returns — no need to compensate for something you're now reading directly instead of inferring).

`handCardRefs`/`registerHandCardRef` (the old Y-measurement ref map) may now be entirely unused by this function — check whether anything else in `BatakTable.tsx` still needs it before removing it; if not, remove it and `HumanHandFan`'s now-unnecessary-for-this-purpose `registerCardRef` prop plumbing... but **do not remove `registerCardRef`/`registerHandCardRef` itself** without checking every call site first (it may serve a second purpose elsewhere in the file — grep before deleting).

- [ ] **Step 3: Typecheck, run full suite**

```bash
cd apps/mobile && npx tsc --noEmit
cd d:/CodeSpace/world-cards && npm test
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "feat(mobile): read hand-card position directly for play-travel origin"
```

---

### Task 7: Re-apply `DeselectableSurface.tsx` and the Jest `useEvent` mock

**Files:**
- Modify: `apps/mobile/src/components/DeselectableSurface.tsx`
- Modify: `apps/mobile/__mocks__/react-native-reanimated.js`

**Interfaces:** none — self-contained fixes, previously verified correct (tests green) before being stashed.

These exact diffs were already written and verified working in the reverted attempt (root-caused correctly: a plain `Pressable` ancestor racing against `BatakHandCard`'s `GestureDetector` descendants is an unsupported combination). Re-apply them verbatim:

- [ ] **Step 1: `DeselectableSurface.tsx`**

```tsx
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export interface DeselectableSurfaceProps {
  onDeselect: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Wraps a game table's root content so tapping anywhere without a more specific tappable child
// (a card, a bid button, a suit picker) clears the current card selection.
//
// Uses react-native-gesture-handler's Gesture.Tap(), not a plain Pressable — a plain Pressable
// ancestor racing against a react-native-gesture-handler GestureDetector descendant (e.g. Batak's
// BatakHandCard, migrated to Gesture.Tap() for its rail-fan reflow) is an unsupported combination:
// RN's classic touch-responder negotiation and RNGH's native gesture recognizers don't arbitrate
// against each other, so the outer Pressable can unpredictably win the touch before the
// descendant's gesture ever fires — the observed symptom was cards needing several taps before a
// play registered. RNGH gesture ancestors correctly defer to nested Pressable/Touchable
// descendants (still true for Pişti's Pressable-based SelectableCard), so this direction is safe
// for both games.
export function DeselectableSurface({ onDeselect, style, children }: DeselectableSurfaceProps) {
  const tap = Gesture.Tap().onEnd((_event, success) => {
    if (success) runOnJS(onDeselect)();
  });

  return (
    <GestureDetector gesture={tap}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}
```

- [ ] **Step 2: `apps/mobile/__mocks__/react-native-reanimated.js`**

Add, right after the existing `useAnimatedReaction` stub:

```js
// Used internally by react-native-gesture-handler's GestureDetector (useAnimatedGesture.ts) to
// build a native event handler ref. Tests never assert on real gesture-event-driven animation
// output, so an inert ref satisfies every real call site without needing worklet semantics.
function useEvent(_handler, _eventNames, _rebuild) {
  return React.useRef(null);
}
```

And add `useEvent,` to the `module.exports` object, alongside the existing `useAnimatedReaction,` line.

- [ ] **Step 3: Run the full suite, confirm `PistiTable.test.tsx` specifically passes**

```bash
cd d:/CodeSpace/world-cards && npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx
npm test
```

Expected: both green (this exact combination was verified working before being stashed).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/DeselectableSurface.tsx apps/mobile/__mocks__/react-native-reanimated.js
git commit -m "fix(mobile): make DeselectableSurface gesture-handler-aware"
```

---

### Task 8: Architecture Audit + on-device verification

**Files:**
- Create: `docs/animation/audits/BatakHandFan-Demo08Migration-Audit.md`

- [ ] **Step 1: Confirm Quick vs. full Audit template with the user**

Per standing project convention (`[[feedback_ask_audit_template_choice]]`), do not self-select. This spec's own §6 already states the expectation (full template, new mechanism) — confirm it explicitly before writing the audit, don't just assume the spec settled it silently.

- [ ] **Step 2: Complete the audit**

Follow `docs/animation/audits/AuditTemplate.md`'s structure exactly, covering: Current/Proposed Ownership (position/rotation/scale/gesture, now owned by `useBatakCardMotion`+`BatakHandCard` instead of split across `SelectableCard`+`AnimatedFanCard`), Layer Responsibilities against Constitution §4, Boundary Violations (should be none — verify, don't assume), Risks (rapid card-play/interruption mid-reflow, reduced motion, the `getValues()` staleness tradeoff from Task 3's own doc comment).

- [ ] **Step 3: On-device verification (yours to do, not mine)**

Play a real hand on your phone: select→play (two-tap), rapid re-taps, a full trick, gömmeli's compact mode if reachable, reduced-motion OS setting on. Confirm cards respond to a single tap reliably (the original bug this whole thread started from) and the fan looks right at multiple hand sizes.

- [ ] **Step 4: Commit the audit**

```bash
git add docs/animation/audits/BatakHandFan-Demo08Migration-Audit.md
git commit -m "docs(animation): add Architecture Audit for Batak hand-fan Demo08 migration"
```

---

## Plan Self-Review Notes

- **Spec coverage:** §1 (playground tuning) → Task 1. §2 (production port) → Tasks 2-5. §3 (production-specific behavior mapping) → Task 5 Step 2. §4 (BatakTable origin fix) → Task 6. §5 (cross-game safety, DeselectableSurface/jest mock) → Task 7 + grep instructions throughout. §6 (process) → Task 8.
- **Placeholder scan:** the two numeric placeholders originally in Task 2/Task 5 (radius, row overlap) were resolved during execution once Task 1's live-tuning session completed (2026-07-30) and are now filled in with real, user-confirmed values (`STANDARD_RAIL_CONFIG`/`COMPACT_RAIL_CONFIG`, `ROW_OVERLAP_PX = 40`) — no placeholders remain anywhere in this plan.
- **Type consistency:** `useBatakCardMotion`'s return shape (`{ shared, setTarget, getValues }`) is identical across Tasks 3, 4, 5, 6. `BatakHandCardProps` gains no untracked fields between Task 4's initial definition and Task 5's Step 3 usage — Task 5 explicitly flags where it may need to extend Task 4's prop shape (the opacity/entrance addition, the `target` vs `initial` naming) rather than silently assuming a shape neither task actually froze.
