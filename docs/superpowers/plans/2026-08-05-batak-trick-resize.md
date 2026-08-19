# Batak Trick-Center Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Batak's trick-center cards visibly shrink from in-hand size down to a smaller trick-center footprint — traveling and resting — without the landing-moment "pop" the current `size="normal"`-everywhere workaround exists to avoid.

**Architecture:** A new additive `contentScale` prop on the shared `PlayingCard` component compensates the corner-index/watermark's disproportionate shrink (never swapping to the real `"small"` variant, which has independently-tuned proportions). A new playground demo tunes the real numbers against real card art. Production wiring: `BatakHandCard`'s existing Reanimated local-departure leg now also shrinks the card (using `useBatakCardMotion`'s existing `scale` field) before handing off to `TravelCard`, which already supports a continuous `originScale`/`restScale` interpolation (unused today) for the AI-play case where no local-departure leg exists. `TrickCenter`'s resting cards and `GatherCard`'s sweep-away flight both hold the same constant shrunk scale.

**Tech Stack:** Plain `Animated` for `TravelCard`/`TrickCenter` (unchanged — matches `ADR-003`'s scoping), `react-native-reanimated` for `BatakHandCard`'s local-departure leg (already in place from the hand-fan migration).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md` — read it first.
- **`PlayingCard.tsx`'s `contentScale` prop must default to `1`** (no-op) so every existing caller — Pişti's `SelectableCard`/`PistiTable`, every other Batak call site — is byte-identical when it's omitted.
- **Never swap to `size="small"`.** The whole point of this design is a single component, continuously scaled, never a variant swap — that's what caused the original landing pop.
- **No cross-app import.** `apps/playground` and `apps/mobile` keep independent implementations, per the Animation Constitution §5.II scope clause. The new playground demo does not import from `apps/mobile`.
- **`TravelCard.tsx`/`GatherCard.tsx`/`TrickCenter.tsx` are Batak-only** (confirmed via a repo-wide grep against `apps/mobile/src/games/pisti` finding zero references) — no Pişti regression risk from changing them.
- **When composing an RN `transform` array, always add to the existing array — never place two style objects that both set `transform` into the same `style={[...]}` array.** RN flattens a style array by taking the *last* value for a given key, not merging entries; two separate `transform` arrays would silently drop one. This bit a similar case during the hand-fan migration.
- **No new automated tests**, per the standing 2026-07-07 mobile-UI policy (motion/visual-only code). Existing suite (`npm test` from repo root) must stay green after every task.
- **Reduced motion:** `BatakHandCard`'s local-departure effect already exits early under `reducedMotion` (no local-departure leg runs at all in that case) — no new reduced-motion branch is needed for the scale addition, since it rides the same guarded call.

---

### Task 1: `PlayingCard.tsx` — additive `contentScale` prop

**Files:**
- Modify: `packages/ui/src/PlayingCard.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PlayingCardProps.contentScale?: number` (default `1`). Consumed by Task 2 (the tuning demo) and Tasks 5–6 (production).

- [ ] **Step 1: Add the prop to `PlayingCardProps`**

In `packages/ui/src/PlayingCard.tsx`, add to the `PlayingCardProps` interface (after `overlayImage`):

```ts
  // Additional relative scale applied to just the corner-index pair and the center watermark
  // icon, layered on top of whatever outer transform the caller applies (e.g. a caller's own
  // wrapping `scale`). Compensates the fact that PlayingCard's "small" variant isn't a uniform
  // scale of "normal" — CORNER_INDEX_WIDTH shrinks to ~68% while WATERMARK_ICON_SIZE shrinks to
  // ~62%, versus the card body's own ~75%/76% — without ever switching size variants (which is
  // what originally caused a landing-moment "pop" — see
  // docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md). Defaults to 1 (no-op), so
  // every existing caller is byte-identical.
  contentScale?: number;
```

- [ ] **Step 2: Thread `contentScale` through `CornerIndex`, composing its transform array correctly**

Replace the `CornerIndex` function with:

```tsx
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
    ? [{ rotate: '180deg' }, { scale: contentScale }]
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
```

- [ ] **Step 3: Remove the now-redundant static rotate from the mirrored corner styles**

In the `styles` `StyleSheet.create` object, `cornerNormalMirrored` and `cornerSmallMirrored` currently each have their own `transform: [{ rotate: '180deg' }]` line — remove just that one line from each (leave `position`/`bottom`/`right`/`width`/`alignItems`/`gap`/`zIndex` untouched). The rotate is now supplied by `CornerIndex`'s own computed `transform` array in Step 2 instead.

- [ ] **Step 4: Thread `contentScale` through `CenterArt`'s watermark-icon branches**

`CenterArt` renders the plain suit-watermark `SuitIcon` in two places (the `overlayImage === null` branch and the final fallback branch) — both need the same wrapping scale. Add `contentScale: number` to `CenterArt`'s prop type, and wrap both `<SuitIcon .../>` returns (not the `overlayImage`/`courtArt` branches, which are out of scope per the design spec) like this:

```tsx
      return card.suit != null ? (
        <View style={{ transform: [{ scale: contentScale }] }}>
          <SuitIcon
            suit={card.suit}
            size={
              isSmall ? WATERMARK_ICON_SIZE.small : WATERMARK_ICON_SIZE.normal
            }
            color={suitColor}
            opacity={1}
          />
        </View>
      ) : null;
```

Apply this same wrapping to both of `CenterArt`'s `<SuitIcon .../>` returns (the `overlayImage === null` early-return and the function's final fallback return) — they're currently identical JSX, so the same replacement applies to both.

- [ ] **Step 5: Wire `contentScale` through `PlayingCardComponent`**

In `PlayingCardComponent`'s destructured props, add `contentScale = 1` (after `overlayImage`). Pass it to both `<CornerIndex .../>` calls (`contentScale={contentScale}`) and to `<CenterArt .../>` (`contentScale={contentScale}`).

- [ ] **Step 6: Typecheck**

```bash
cd packages/ui && npx tsc --noEmit
```

- [ ] **Step 7: Run the full suite**

```bash
cd d:/CodeSpace/world-of-cards && npm test
```

Expected: unchanged pass count (this is a purely additive, default-preserving change).

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/PlayingCard.tsx
git commit -m "feat(ui): add additive contentScale prop to PlayingCard"
```

---

### Task 2: `Demo10BatakTrickResize` — playground tuning tool

**Files:**
- Create: `apps/playground/src/animation/demos/Demo10BatakTrickResize.tsx`
- Modify: `apps/playground/src/animation/types.ts` (add `'batak-trick-resize-tuning'` to `DemoId`/`DEMO_ORDER`/`DEMO_LABELS`)
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx` (register the new demo)

**Interfaces:**
- Consumes: `PlayingCard`/`CARD_DIMS` from `@world-of-cards/ui` (Task 1's `contentScale` prop), `createDeck`/`createRng`/`shuffle` from `@world-of-cards/engine`, `LabeledSlider` from `../components/LabeledSlider`.
- Produces: nothing consumed programmatically by later tasks — this task's real output is the tuned numeric values you choose interactively, which Task 3 hardcodes.

- [ ] **Step 1: Register the demo in `types.ts`**

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
  | 'batak-hand-tuning'
  | 'batak-trick-resize-tuning';

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
  'batak-trick-resize-tuning',
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
  'batak-hand-tuning': 'Demo 9: Batak Hand Tuning',
  // Tunes the real trick-center resize (scale + contentScale) against real PlayingCard art,
  // before those values get hardcoded into production — see
  // docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md.
  'batak-trick-resize-tuning': 'Demo 10: Batak Trick Resize',
};
```

- [ ] **Step 2: Register in `AnimationPlaygroundScreen.tsx`**

Add the import and switch case:

```tsx
import { Demo10BatakTrickResize } from './demos/Demo10BatakTrickResize';
```

```tsx
    case 'batak-trick-resize-tuning':
      return <Demo10BatakTrickResize />;
```

- [ ] **Step 3: Write `Demo10BatakTrickResize.tsx`**

Shows a reference in-hand-size card next to a tunable trick-size card (scale + contentScale sliders), plus a small 4-card cross preview so the overlap/footprint at trick-center scale can be checked too — mirroring `TrickCenter.tsx`'s own `TRICK_SLOT_OFFSETS` cross layout, recomputed locally (not imported from `apps/mobile`, per the Constitution's cross-app SSOT exception).

```tsx
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlayingCard, CARD_DIMS } from '@world-of-cards/ui';
import { createDeck, createRng, shuffle } from '@world-of-cards/engine';
import { LabeledSlider } from '../components/LabeledSlider';

// Starting point: the real CARD_DIMS ratio (small.width / normal.width ≈ 0.745) for the outer
// scale, and a contentScale that lands the corner index at real "small"'s own proportion
// (CORNER_INDEX_WIDTH.small / CORNER_INDEX_WIDTH.normal ≈ 0.679) once composed with that outer
// scale: 0.679 / 0.745 ≈ 0.91. Both are first-pass numbers — tune live via the sliders below;
// they're the two values this whole demo exists to let you replace with real, eyeballed numbers.
const INITIAL_SCALE = 0.75;
const INITIAL_CONTENT_SCALE = 0.91;

// Mirrors TrickCenter.tsx's own TRICK_SLOT_OFFSETS, recomputed locally rather than imported
// (apps/playground never imports from apps/mobile) — proportioned the same relative way (small
// enough that adjacent slots' cards overlap slightly at their inner corners).
const CROSS_OFFSETS = [
  { label: 'top', x: 0, y: -38 },
  { label: 'left', x: -30, y: 0 },
  { label: 'bottom', x: 0, y: 38 },
  { label: 'right', x: 30, y: 0 },
];

export function Demo10BatakTrickResize() {
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [contentScale, setContentScale] = useState(INITIAL_CONTENT_SCALE);

  const [seed] = useState(() => Date.now());
  const sampleCards = useMemo(
    () => shuffle(createDeck({ deckCount: 1, includeJokers: false }), createRng(seed)).slice(0, 4),
    [seed],
  );

  const trickCardWidth = CARD_DIMS.normal.width * scale;
  const trickCardHeight = CARD_DIMS.normal.height * scale;

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.compareRow}>
          <View style={styles.compareColumn}>
            <Text style={styles.label}>In-hand (reference)</Text>
            <PlayingCard card={sampleCards[0]} size="normal" />
          </View>
          <View style={styles.compareColumn}>
            <Text style={styles.label}>Trick center (tuned)</Text>
            <View style={{ transform: [{ scale }] }}>
              <PlayingCard card={sampleCards[0]} size="normal" contentScale={contentScale} />
            </View>
          </View>
        </View>

        <Text style={styles.label}>Trick cross preview (4 tuned cards, overlapping)</Text>
        <View style={[styles.crossWrapper, { width: trickCardWidth + 80, height: trickCardHeight + 80 }]}>
          {CROSS_OFFSETS.map((slot, i) => (
            <View
              key={slot.label}
              style={[
                styles.crossSlot,
                {
                  width: trickCardWidth,
                  height: trickCardHeight,
                  marginLeft: -trickCardWidth / 2,
                  marginTop: -trickCardHeight / 2,
                  zIndex: i + 1,
                  transform: [{ translateX: slot.x * scale }, { translateY: slot.y * scale }],
                },
              ]}>
              <View style={{ transform: [{ scale }] }}>
                <PlayingCard card={sampleCards[i]} size="normal" contentScale={contentScale} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sliders}>
          <LabeledSlider
            label="Trick card scale"
            testID="control-trick-scale"
            minimumValue={0.4}
            maximumValue={1}
            step={0.01}
            value={scale}
            onChange={setScale}
          />
          <LabeledSlider
            label="Content scale (corner index / watermark)"
            testID="control-content-scale"
            minimumValue={0.5}
            maximumValue={1.2}
            step={0.01}
            value={contentScale}
            onChange={setContentScale}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, alignItems: 'center', paddingTop: 20, gap: 16 },
  compareRow: { flexDirection: 'row', gap: 32, alignItems: 'flex-end' },
  compareColumn: { alignItems: 'center', gap: 8 },
  label: { color: '#ffffffcc', fontSize: 13 },
  crossWrapper: { position: 'relative', alignSelf: 'center' },
  crossSlot: { position: 'absolute', left: '50%', top: '50%', alignItems: 'center', justifyContent: 'center' },
  sliders: { alignSelf: 'stretch', paddingTop: 8 },
});
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/playground && npx tsc --noEmit
```

- [ ] **Step 5: Run the app and tune live**

Run `apps/playground` (`npx expo start`, per this repo's usual playground workflow), open Demo 10, and adjust both sliders until the trick-size card's corner index/watermark proportions look right against the reference card, and the 4-card cross preview's overlap looks like a natural, readable trick — not too cramped, not too sparse. Write down the final `scale`/`contentScale` values; Task 3 hardcodes exactly these numbers, replacing `INITIAL_SCALE`/`INITIAL_CONTENT_SCALE`.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/src/animation/demos/Demo10BatakTrickResize.tsx apps/playground/src/animation/types.ts apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "feat(playground): add Demo10 Batak trick-resize tuning tool"
```

---

### Task 3: `trickCardScale.ts` — production shared constants

**Files:**
- Create: `apps/mobile/src/games/batak/table/trickCardScale.ts`

**Interfaces:**
- Consumes: nothing (pure constants).
- Produces: `TRICK_CARD_SCALE`, `TRICK_CARD_CONTENT_SCALE`, `LOCAL_DEPARTURE_SCALE` (all `number`). Consumed by Task 4 (`BatakHandCard.tsx`), Task 5 (`TrickCenter.tsx`), Task 6 (`GatherCard.tsx`).

- [ ] **Step 1: Write the file, using Task 2's tuned values**

The values below (`0.75`/`0.91`) are Task 2's own `INITIAL_SCALE`/`INITIAL_CONTENT_SCALE` starting numbers — overwrite them with whatever you actually landed on during Task 2 Step 5's live tuning session before committing this file; do not leave the untuned starting numbers in place if the sliders moved.

```ts
// Tuned live against real PlayingCards — see Task 2 of
// docs/superpowers/plans/2026-08-05-batak-trick-resize.md (Demo10BatakTrickResize).
export const TRICK_CARD_SCALE = 0.75;
export const TRICK_CARD_CONTENT_SCALE = 0.91;

// First pass: the entire shrink happens during BatakHandCard's local-departure leg; by the time
// TravelCard takes over, a human-played card is already at TRICK_CARD_SCALE, and TravelCard
// holds it constant for the rest of the flight — no scale interpolation needed there for a human
// play (see TrickCenter.tsx's human-pending-play call site). Retune this toward 1 (spreading
// more of the shrink into TravelCard's own flight instead) if the ~200ms local-departure window
// reads as too abrupt once checked live — this exact split was flagged as unconfirmed during
// design (docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md §3), not settled.
export const LOCAL_DEPARTURE_SCALE = TRICK_CARD_SCALE;
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/table/trickCardScale.ts
git commit -m "feat(mobile): add tuned Batak trick-card scale constants"
```

---

### Task 4: `BatakHandCard.tsx` — local-departure gains a scale target

**Files:**
- Modify: `apps/mobile/src/games/batak/table/BatakHandCard.tsx`

**Interfaces:**
- Consumes: `LOCAL_DEPARTURE_SCALE` from `./trickCardScale` (Task 3).
- Produces: no change to `BatakHandCardProps` — this is an internal-only change to the existing local-departure effect.

- [ ] **Step 1: Import the constant**

Add to `BatakHandCard.tsx`'s imports:

```ts
import { LOCAL_DEPARTURE_SCALE } from './trickCardScale';
```

- [ ] **Step 2: Add `scale` to the local-departure `setTarget` call**

Find the local-departure effect (currently the last `useEffect` before `handlePress`, keyed on `[isDeparting, reducedMotion]`) and change its `motion.setTarget` call from:

```tsx
    motion.setTarget({
      x: current.x - departureDeltaX,
      y: current.y - localDepartureDistance,
      timing: { duration: localDepartureDurationMs, easing: Easing.in(Easing.linear) },
    });
```

to:

```tsx
    motion.setTarget({
      x: current.x - departureDeltaX,
      y: current.y - localDepartureDistance,
      scale: LOCAL_DEPARTURE_SCALE,
      timing: { duration: localDepartureDurationMs, easing: Easing.in(Easing.linear) },
    });
```

This is the entire change — `useBatakCardMotion` already supports a `scale` target (used today by the selection lift), so no new plumbing is needed; it's now driven, coordinated with position, by the same `setTarget` call as the departure's `x`/`y`.

- [ ] **Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/table/BatakHandCard.tsx
git commit -m "feat(mobile): shrink the played card during local departure"
```

---

### Task 5: `TrickCenter.tsx` — wire the resize into travel and resting cards

**Files:**
- Modify: `apps/mobile/src/games/batak/table/TrickCenter.tsx`

**Interfaces:**
- Consumes: `TRICK_CARD_SCALE`/`TRICK_CARD_CONTENT_SCALE` from `./trickCardScale` (Task 3), `contentScale` prop on `PlayingCard` (Task 1), `TravelCard`'s existing `originScale`/`restScale` props (already built, previously unused).

- [ ] **Step 1: Import the constants**

Add to `TrickCenter.tsx`'s imports:

```ts
import { TRICK_CARD_SCALE, TRICK_CARD_CONTENT_SCALE } from './trickCardScale';
```

- [ ] **Step 2: Human's pending play — hold the already-shrunk scale constant**

Find the `isHumanPending` branch's `<TravelCard>` call and change it from:

```tsx
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ?? revealOriginOffset('bottom')
                }
                originRotateDeg={pendingPlay?.originRotateDeg ?? 0}
                durationMs={pendingPlay?.travelDurationMs}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" />
              </TravelCard>
```

to:

```tsx
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ?? revealOriginOffset('bottom')
                }
                originRotateDeg={pendingPlay?.originRotateDeg ?? 0}
                // Held constant, not interpolated: BatakHandCard's own local-departure leg
                // already did the shrinking (see trickCardScale.ts's LOCAL_DEPARTURE_SCALE doc
                // comment) before this component ever mounts for a human play.
                originScale={TRICK_CARD_SCALE}
                restScale={TRICK_CARD_SCALE}
                durationMs={pendingPlay?.travelDurationMs}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" contentScale={TRICK_CARD_CONTENT_SCALE} />
              </TravelCard>
```

- [ ] **Step 3: AI's pending play — interpolate the full shrink**

Find the AI-play branch's `<TravelCard>` call (the `else` of the `isHumanPending` ternary) and change it from:

```tsx
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ??
                  revealOriginOffset(
                    resolveRevealOrigin(playerId!, humanPlayerId, seats),
                  )
                }
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" />
              </TravelCard>
```

to:

```tsx
              <TravelCard
                originOffset={
                  pendingPlay?.originOffset ??
                  revealOriginOffset(
                    resolveRevealOrigin(playerId!, humanPlayerId, seats),
                  )
                }
                // No local-departure leg exists for AI plays (no rendered opponent-hand visual
                // to depart from) — TravelCard does the whole shrink itself over the flight.
                originScale={1}
                restScale={TRICK_CARD_SCALE}
                resetKey={card.id}>
                <PlayingCard card={card} size="normal" contentScale={TRICK_CARD_CONTENT_SCALE} />
              </TravelCard>
```

`contentScale` is held constant for the whole flight rather than also interpolated — the corner-index/watermark's own visual size change during a fast flight is not expected to be perceptible; revisit only if on-device verification (Task 7) shows otherwise.

- [ ] **Step 4: Resting (already-landed) cards — hold the shrunk scale permanently**

Find the resting-card render (the final `else` branch, not `isPending`) and change it from:

```tsx
            <PlayingCard
              card={card}
              size="normal"
              style={{
                transform: [
                  { rotate: `${restingRotations?.[playerId!] ?? 0}deg` },
                ],
              }}
            />
```

to:

```tsx
            <PlayingCard
              card={card}
              size="normal"
              contentScale={TRICK_CARD_CONTENT_SCALE}
              style={{
                // Both entries live in ONE transform array (not two style objects each setting
                // `transform`) — see this plan's Global Constraints note on why that matters.
                transform: [
                  { rotate: `${restingRotations?.[playerId!] ?? 0}deg` },
                  { scale: TRICK_CARD_SCALE },
                ],
              }}
            />
```

- [ ] **Step 5: Retune `TRICK_SLOT_OFFSETS` proportionally**

`TRICK_SLOT_OFFSETS`'s existing pixel values were tuned by eye for the current full-size footprint. As a first pass, scale them by `TRICK_CARD_SCALE` so the same relative "loose, corner-touching" overlap is preserved at the new smaller size — change:

```ts
const TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = {
  top: { x: 0, y: -38 },
  bottom: { x: 0, y: 38 },
  left: { x: -30, y: 0 },
  right: { x: 30, y: 0 },
};
```

to:

```ts
// Base pixel values tuned by eye for the original full-size trick card; scaled by
// TRICK_CARD_SCALE below as a first pass to preserve the same relative overlap at the new,
// smaller trick-card footprint — re-tune BASE_TRICK_SLOT_OFFSETS directly if that proportional
// scaling doesn't look right once checked live.
const BASE_TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = {
  top: { x: 0, y: -38 },
  bottom: { x: 0, y: 38 },
  left: { x: -30, y: 0 },
  right: { x: 30, y: 0 },
};
const TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = Object.fromEntries(
  Object.entries(BASE_TRICK_SLOT_OFFSETS).map(([position, offset]) => [
    position,
    { x: offset.x * TRICK_CARD_SCALE, y: offset.y * TRICK_CARD_SCALE },
  ]),
) as Record<TrickPosition, { x: number; y: number }>;
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/games/batak/table/TrickCenter.tsx
git commit -m "feat(mobile): shrink trick-center cards, traveling and resting"
```

---

### Task 6: `GatherCard.tsx` — match the shrunk resting size

**Files:**
- Modify: `apps/mobile/src/table/GatherCard.tsx`

**Interfaces:**
- Consumes: `TRICK_CARD_SCALE`/`TRICK_CARD_CONTENT_SCALE` from `../games/batak/table/trickCardScale` (Task 3).

- [ ] **Step 1: Import the constants**

Add to `GatherCard.tsx`'s imports:

```ts
import { TRICK_CARD_SCALE, TRICK_CARD_CONTENT_SCALE } from '../games/batak/table/trickCardScale';
```

- [ ] **Step 2: Add the scale into `frontStyle`/`backStyle`'s existing transform arrays**

`GATHER_CARD_WIDTH`/`GATHER_CARD_HEIGHT` (the outer `Animated.View`'s layout box) stay unchanged — the outer box's own layout size doesn't need to shrink for its painted content to look smaller; only the flip's own transform needs to compose in the new scale, in the SAME array as its existing `perspective`/`rotateX`/`rotateY` entries (see this plan's Global Constraints note on why a second style object won't work). Change `frontStyle` from:

```tsx
  const frontStyle = useAnimatedStyle(() => {
    const rotateValue = `${interpolate(progress.value, [0, 1], [0, sign * 180])}deg`;
    return {
      backfaceVisibility: 'hidden' as const,
      opacity: interpolate(progress.value, [0, 0.5, 0.5001, 1], [1, 1, 0, 0]),
      transformOrigin,
      transform: [{ perspective: 800 }, axis === 'X' ? { rotateX: rotateValue } : { rotateY: rotateValue }],
    };
  });
```

to:

```tsx
  const frontStyle = useAnimatedStyle(() => {
    const rotateValue = `${interpolate(progress.value, [0, 1], [0, sign * 180])}deg`;
    return {
      backfaceVisibility: 'hidden' as const,
      opacity: interpolate(progress.value, [0, 0.5, 0.5001, 1], [1, 1, 0, 0]),
      transformOrigin,
      transform: [
        { perspective: 800 },
        axis === 'X' ? { rotateX: rotateValue } : { rotateY: rotateValue },
        { scale: TRICK_CARD_SCALE },
      ],
    };
  });
```

Apply the identical `{ scale: TRICK_CARD_SCALE }` addition to `backStyle`'s own transform array (same structure, `sign * 180`→`sign * 360` range — only the new trailing transform entry is being added, nothing else in that function changes).

- [ ] **Step 3: Pass `contentScale` to both `PlayingCard` layers**

Change:

```tsx
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <PlayingCard card={card} size="normal" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <PlayingCard card={card} faceDown size="normal" />
      </Animated.View>
```

to:

```tsx
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <PlayingCard card={card} size="normal" contentScale={TRICK_CARD_CONTENT_SCALE} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <PlayingCard card={card} faceDown size="normal" />
      </Animated.View>
```

(`faceDown` cards have no corner index/watermark to compensate — `contentScale` is a no-op for them either way, so it's omitted rather than added pointlessly.)

- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/table/GatherCard.tsx
git commit -m "feat(mobile): match GatherCard's sweep to the shrunk trick-card size"
```

---

### Task 7: Verification + Architecture Audit

**Files:**
- Create: `docs/animation/audits/BatakTrickResize-Audit.md` (or fold into a Quick Audit — see Step 1)

- [ ] **Step 1: Confirm Quick vs. full Audit template with the user**

Per standing project convention (`[[feedback_ask_audit_template_choice]]`), do not self-select. This change is smaller in scope than the hand-fan migration (an additive shared-component prop, plus tuning an already-audited motion primitive's existing `scale` field and an already-built-but-unused `TravelCard` prop) — it may well qualify for `QuickAuditTemplate.md`'s eligibility checklist, but confirm explicitly rather than assuming either way.

- [ ] **Step 2: Complete the audit**

Cover: `PlayingCard.contentScale`'s ownership (Rendering layer, additive), the local-departure/`TravelCard` scale handoff's Coordinated Property Timelines (§5.VI) reasoning (position+scale fired together in one `setTarget`/one `TravelCard` prop pair, not two separate triggers), and the risk already flagged in `trickCardScale.ts`'s own doc comment (the local-departure/`TravelCard` scale split being a first-pass, unconfirmed choice).

- [ ] **Step 3: Full-suite verification**

```bash
cd apps/mobile && npx tsc --noEmit
cd apps/playground && npx tsc --noEmit
cd packages/ui && npx tsc --noEmit
cd d:/CodeSpace/world-of-cards && npm test
```

Expected: all clean, same test count as before this plan started (no new tests, per the standing policy).

- [ ] **Step 4: On-device verification (yours to do, not mine)**

Play a real hand: watch a human play (does the shrink during local departure look smooth or abrupt? — this is the one genuinely open design question from the spec), watch an AI play (does it land at a visually matching size to the human's?), let a trick complete and gather (does `GatherCard` avoid popping back to normal size?), and check gömmeli's compact mode if reachable.

- [ ] **Step 5: Commit the audit**

```bash
git add docs/animation/audits/BatakTrickResize-Audit.md
git commit -m "docs(animation): add Architecture Audit for Batak trick-center resize"
```

---

## Plan Self-Review Notes

- **Spec coverage:** §1 (`contentScale` prop) → Task 1. §2 (playground tuning) → Task 2. §3 (production wiring: constants module, local departure, `TrickCenter`, `GatherCard`) → Tasks 3–6. §4 (cross-game safety) → Global Constraints + each task's file scope. §5 (process) → Task 7.
- **Placeholder scan:** Task 3's `<TASK_2_SCALE>`/`<TASK_2_CONTENT_SCALE>` are explicit, intentional fill-in-from-live-tuning markers (Task 2's own `INITIAL_SCALE`/`INITIAL_CONTENT_SCALE` are real, usable starting numbers, not placeholders) — the same pattern the hand-fan migration plan used for its own radius/overlap constants, resolved during execution once live tuning completes. No other placeholders remain.
- **Type consistency:** `TRICK_CARD_SCALE`/`TRICK_CARD_CONTENT_SCALE`/`LOCAL_DEPARTURE_SCALE` (all `number`, Task 3) are referenced identically by name across Tasks 4–6. `PlayingCard`'s `contentScale?: number` (Task 1) is passed the same way (`contentScale={TRICK_CARD_CONTENT_SCALE}`) everywhere it's used in Tasks 2, 5, and 6.
