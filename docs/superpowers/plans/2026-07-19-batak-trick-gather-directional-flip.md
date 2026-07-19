# Batak Trick-Gather Directional Card Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each gathered trick card's flip rotate around the edge nearest its destination, so the card visually tumbles toward the winning seat instead of spinning on a generic left-right axis.

**Architecture:** `GatherCard`'s flip already interpolates a `rotateY` sweep from 0° to 360° across two crossfading layers (front face-up, back face-down). This plan replaces the hardcoded axis/origin with values derived from the existing `destinationOffset` prop via one new pure helper function — no new prop, no change to any caller.

**Tech Stack:** TypeScript, React Native `Animated` API (native driver), `transformOrigin` style property (supported since RN 0.74; this app is on RN 0.86.0).

## Global Constraints

- Scoped entirely to `apps/mobile/src/table/GatherCard.tsx` — no other file changes.
- No new prop on `GatherCardProps` — the direction is derived from the existing `destinationOffset: { x: number; y: number }`.
- No new automated test (decorative animation component, per the standing 2026-07-07 mobile-UI testing policy — matches this same component's own prior task, which also had no dedicated test).
- The opacity crossfade timing, `backfaceVisibility: 'hidden'`, `useNativeDriver: true`, travel (`translateX`/`translateY` to `destinationOffset`), and fade-out logic are all unaffected by this change — do not modify them.
- Rule (from the spec, validated via the visual companion): rotate around the edge nearest the destination; the opposite edge swings toward it.

| Destination | Axis | Pivot (`transformOrigin`) | Sign |
|---|---|---|---|
| bottom (human) | `rotateX` | `50% 100%` | + |
| top (AI) | `rotateX` | `50% 0%` | − |
| left (AI) | `rotateY` | `0% 50%` | + |
| right (AI) | `rotateY` | `100% 50%` | − |

---

### Task 1: Derive flip axis/sign/pivot from `destinationOffset`

**Files:**
- Modify: `apps/mobile/src/table/GatherCard.tsx`

**Interfaces:**
- Consumes: nothing new — `GatherCardProps.destinationOffset` already exists.
- Produces: no new exports; `GatherCard`'s external behavior (props, rendering contract) is unchanged, only its internal flip geometry changes. No other file needs updating.

- [ ] **Step 1: Add the `resolveFlipGeometry` helper and its types**

In `apps/mobile/src/table/GatherCard.tsx`, add this above the `GatherCard` function (after the `GATHER_CARD_WIDTH`/`GATHER_CARD_HEIGHT` constants, before the component):

```ts
type FlipAxis = 'X' | 'Y';

interface FlipGeometry {
  axis: FlipAxis;
  sign: 1 | -1;
  transformOrigin: string;
}

// Derives which edge the card should pivot around and which way it should swing, purely from
// destinationOffset — Batak's offsets are always axis-aligned (either {x: 0, y: ±195} or
// {x: ±165, y: 0}, per REVEAL_ORIGIN_OFFSETS in ../table/seating.ts), so checking which
// component is non-zero is enough to tell direction. The card pivots at the edge NEAREST the
// destination and the opposite edge swings toward it — see
// docs/superpowers/specs/2026-07-19-batak-trick-gather-directional-flip-design.md for the
// validated rotation-sign table this implements.
function resolveFlipGeometry(destinationOffset: { x: number; y: number }): FlipGeometry {
  if (destinationOffset.y !== 0) {
    return destinationOffset.y > 0
      ? { axis: 'X', sign: 1, transformOrigin: '50% 100%' } // toward bottom (human)
      : { axis: 'X', sign: -1, transformOrigin: '50% 0%' }; // toward top (AI)
  }
  if (destinationOffset.x !== 0) {
    return destinationOffset.x > 0
      ? { axis: 'Y', sign: -1, transformOrigin: '100% 50%' } // toward right (AI)
      : { axis: 'Y', sign: 1, transformOrigin: '0% 50%' }; // toward left (AI)
  }
  // Fallback ({x: 0, y: 0}) — not expected in practice (every real Batak seat resolves to a
  // non-zero direction), but a safe default rather than a special-cased crash: today's original
  // center-pivot rotateY behavior.
  return { axis: 'Y', sign: 1, transformOrigin: '50% 50%' };
}

// Builds the correct transform-array entry for whichever axis this card's geometry uses — RN's
// AnimatedTransform requires a distinct object key (rotateX vs rotateY) per property, so this
// can't be a single shared interpolation object.
function rotationTransform(
  axis: FlipAxis,
  value: Animated.AnimatedInterpolation<string>,
): Record<string, Animated.AnimatedInterpolation<string>> {
  return axis === 'X' ? { rotateX: value } : { rotateY: value };
}
```

- [ ] **Step 2: Use the geometry in `GatherCard`'s render**

Replace the existing rotation interpolation block:

```ts
  // Standard two-layer RN flip: a face-up layer rotating 0deg->180deg and a face-down layer
  // rotating 180deg->360deg, each hard-cut via a doubled input-range opacity swap exactly at the
  // midpoint (0.5). backfaceVisibility alone isn't reliably consistent across iOS/Android/web, so
  // the opacity swap is the real mechanism here, not just a belt-and-suspenders backup.
  const frontRotateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
```

with:

```ts
  // Standard two-layer RN flip: a face-up layer rotating 0deg->(sign*180)deg and a face-down
  // layer rotating (sign*180)deg->(sign*360)deg, each hard-cut via a doubled input-range opacity
  // swap exactly at the midpoint (0.5). backfaceVisibility alone isn't reliably consistent across
  // iOS/Android/web, so the opacity swap is the real mechanism here, not just a
  // belt-and-suspenders backup. Axis, sign, and pivot all come from resolveFlipGeometry, so the
  // card rotates around the edge nearest its destination — see that function's doc comment.
  const { axis, sign, transformOrigin } = resolveFlipGeometry(destinationOffset);
  const frontRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${sign * 180}deg`],
  });
  const backRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${sign * 180}deg`, `${sign * 360}deg`],
  });
```

Then update the two `Animated.View` layers lower in the same `return` statement. Replace:

```tsx
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: frontOpacity,
            transform: [{ perspective: 800 }, { rotateY: frontRotateY }],
          },
        ]}>
        <PlayingCard card={card} size="small" />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: backOpacity,
            transform: [{ perspective: 800 }, { rotateY: backRotateY }],
          },
        ]}>
        <PlayingCard card={card} faceDown size="small" />
      </Animated.View>
```

with:

```tsx
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: frontOpacity,
            transformOrigin,
            transform: [{ perspective: 800 }, rotationTransform(axis, frontRotate)],
          },
        ]}>
        <PlayingCard card={card} size="small" />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: backOpacity,
            transformOrigin,
            transform: [{ perspective: 800 }, rotationTransform(axis, backRotate)],
          },
        ]}>
        <PlayingCard card={card} faceDown size="small" />
      </Animated.View>
```

(Everything else in the file — the imports, `GatherCardProps`, `GATHER_CARD_WIDTH`/`HEIGHT`,
`useEffect`'s `Animated.timing` block, `translateX`/`translateY`/`groupOpacity`, `frontOpacity`/
`backOpacity`, and the outer `Animated.View` — stays exactly as-is.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors. (If `Animated.AnimatedInterpolation<string>` isn't the exact type name in
this RN version's typings and produces an error, use the type TypeScript infers for
`progress.interpolate({...})`'s return value instead — check via hovering/`tsc`'s own error
message rather than guessing a second type name.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/table/GatherCard.tsx
git commit -m "Animate Batak's trick-gather flip toward each card's destination edge"
```

---

## Self-Review Notes

- **Spec coverage:** the full rotation-sign table (bottom/top/left/right, axis, pivot, sign) is
  implemented verbatim in `resolveFlipGeometry` ✓; the fallback for a theoretical `{x:0,y:0}`
  offset (mentioned in the spec) is included ✓; "everything else stays untouched" (opacity
  crossfade, backface-visibility, travel, fade, native driver, duration/easing reuse) is
  preserved by construction — Step 2's diff touches only the rotation interpolations and adds
  `transformOrigin`, nothing else in the file changes ✓; no new prop, no caller changes ✓ (spec's
  "What changes, what doesn't" section).
- **Placeholder scan:** none — every step has literal, complete code.
- **Type consistency:** `resolveFlipGeometry`'s return type (`FlipGeometry`) is used consistently
  by both the destructuring in Step 2 and `rotationTransform`'s `axis` parameter; `frontRotate`/
  `backRotate` (renamed from `frontRotateY`/`backRotateY` to reflect that they're no longer
  always a Y-axis rotation) are used consistently in both the interpolation definitions and the
  two `Animated.View` transform arrays.
