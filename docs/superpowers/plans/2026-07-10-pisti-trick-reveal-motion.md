# Pişti Trick-Reveal Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Pişti table's existing "played card" reveal travel in from the direction of whichever seat played it, instead of appearing already sitting at the center pile — the final item on the reference-checklist polish pass.

**Architecture:** Extend the existing `RevealCard` component in `PistiTable.tsx` (already an `Animated.Value`-driven fade/scale reveal, `useNativeDriver: true`) with translateX/translateY interpolation from a fixed per-direction offset down to the card's resting position. Direction is resolved per reveal (human → `bottom`, AI → that seat's position from the existing `assignSeats`). No new Animated.Value, no new timers, no new components.

**Tech Stack:** React Native `Animated` API (existing dependency, no new packages).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-10-pisti-trick-reveal-motion-design.md`
- No new tests for this change — pure decorative/motion UI, matches how `TableWoodCorners`/`PlayerAvatar`/`CardBackPattern` shipped (per the project's testing policy in `CLAUDE.md`). Existing tests must still pass unchanged.
- Duration changes from the current `200`ms to exactly **530ms**. Easing changes to `Easing.out(Easing.cubic)`.
- Offsets are a **fixed direction-based map** (`top`/`bottom`/`left`/`right` → `{x, y}`), not real `onLayout`-measured seat coordinates. Do not add layout measurement — this is a deliberate simplification, not a gap to fill.
- The "X played" text label (`styles.revealLabel`) is unchanged — it stays fixed above the pile. Only the card itself gains a travel offset.
- No new shared/cross-game component — stays local to `PistiTable.tsx`/`pistiSeating.ts`, per the spec's YAGNI reasoning.
- No changes to the capture/sweep animation or to any layout other than `RevealCard`'s own transform.

---

### Task 1: Add direction-offset geometry and wire it into `RevealCard`

**Files:**
- Modify: `apps/mobile/src/games/pisti/pistiSeating.ts` — add a `RevealOrigin` type, `REVEAL_ORIGIN_OFFSETS` map, `revealOriginOffset` function, and `resolveRevealOrigin` function (append near the end of the file, after `SIDE_CARD_STYLES`).
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx` — add `Easing` to the `react-native` import (currently line 2); add `revealOriginOffset`/`resolveRevealOrigin`/`RevealOrigin` to the `pistiSeating` import (currently lines 12-13); modify `RevealCard` (currently lines 43-75) to accept and use an `originDirection` prop; modify the `RevealCard` call site in `PistiTable` (currently lines 223-232) to pass `originDirection={resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats)}`.

**Interfaces:**
- Produces (from `pistiSeating.ts`, consumed by `PistiTable.tsx`):
  - `export type RevealOrigin = SeatPosition | 'bottom';`
  - `export function revealOriginOffset(origin: RevealOrigin): { x: number; y: number };`
  - `export function resolveRevealOrigin(playerId: string, humanPlayerId: string, seats: Seat[]): RevealOrigin;`
- Consumes: `SeatPosition`, `Seat` (already defined earlier in `pistiSeating.ts`); `assignSeats`'s existing output (`seats`, already computed in `PistiTable` at line 195 as `const seats = assignSeats(opponentPlayerIds);`, before the JSX returned).

- [ ] **Step 1: Add the origin-offset geometry to `pistiSeating.ts`**

Append to the end of `apps/mobile/src/games/pisti/pistiSeating.ts` (after the existing `SIDE_CARD_STYLES` block):

```ts

// The reveal-motion origin a played card travels in from: an opponent seat's position, or
// 'bottom' for the human (who isn't part of the Seat[] array — always rendered separately).
export type RevealOrigin = SeatPosition | 'bottom';

// Fixed direction-based travel offsets for the trick-reveal motion (see
// docs/superpowers/specs/2026-07-10-pisti-trick-reveal-motion-design.md). Deliberately not
// measured from real seat layout (no onLayout) — a fixed offset per direction reads clearly as
// "came from that side" without needing new layout-measurement plumbing.
const REVEAL_ORIGIN_OFFSETS: Record<RevealOrigin, { x: number; y: number }> = {
  top: { x: 0, y: -130 },
  bottom: { x: 0, y: 130 },
  left: { x: -110, y: 0 },
  right: { x: 110, y: 0 },
};

export function revealOriginOffset(origin: RevealOrigin): { x: number; y: number } {
  return REVEAL_ORIGIN_OFFSETS[origin];
}

// Resolves which direction a given play travels in from: the human is always 'bottom' (not part
// of `seats`); an AI seat not found in `seats` (shouldn't happen — every opponentPlayerId gets a
// seat) falls back to 'top', matching assignSeats' own single-opponent fallback.
export function resolveRevealOrigin(playerId: string, humanPlayerId: string, seats: Seat[]): RevealOrigin {
  if (playerId === humanPlayerId) return 'bottom';
  const seat = seats.find((s) => s.playerId === playerId);
  return seat ? seat.position : 'top';
}
```

- [ ] **Step 2: Update imports in `PistiTable.tsx`**

Replace the current top-of-file imports:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
```

with:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
```

Replace the current `pistiSeating` import:

```tsx
import { assignSeats, fanCurveY, fanRotationDeg, OPPONENT_CARD_OVERLAP, SIDE_CARD_STYLES } from './pistiSeating';
import type { Seat } from './pistiSeating';
```

with:

```tsx
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

- [ ] **Step 3: Replace `RevealCard` to travel in from `originDirection`**

Replace the current `RevealCard` function (lines 43-75):

```tsx
function RevealCard({ revealCard, label }: { revealCard: PistiRevealCard; label: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealCard.card.id]);

  const offset = PILE_CARD_OFFSETS[MAX_STACKED_PILE_CARDS];

  return (
    <>
      <Text style={styles.revealLabel}>{label}</Text>
      <Animated.View
        style={[
          styles.pileCardSlot,
          {
            zIndex: MAX_STACKED_PILE_CARDS + 1,
            opacity: anim,
            transform: [
              { translateX: offset.x },
              { translateY: offset.y },
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            ],
          },
        ]}
      >
        <PlayingCard card={revealCard.card} highlighted />
      </Animated.View>
    </>
  );
}
```

with:

```tsx
function RevealCard({
  revealCard,
  label,
  originDirection,
}: {
  revealCard: PistiRevealCard;
  label: string;
  originDirection: RevealOrigin;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 530,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealCard.card.id]);

  const offset = PILE_CARD_OFFSETS[MAX_STACKED_PILE_CARDS];
  const origin = revealOriginOffset(originDirection);

  return (
    <>
      <Text style={styles.revealLabel}>{label}</Text>
      <Animated.View
        style={[
          styles.pileCardSlot,
          {
            zIndex: MAX_STACKED_PILE_CARDS + 1,
            opacity: anim,
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [offset.x + origin.x, offset.x],
                }),
              },
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [offset.y + origin.y, offset.y],
                }),
              },
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            ],
          },
        ]}
      >
        <PlayingCard card={revealCard.card} highlighted />
      </Animated.View>
    </>
  );
}
```

- [ ] **Step 4: Pass `originDirection` at the `RevealCard` call site**

In `PistiTable`, replace the current call site (lines 223-232):

```tsx
              {revealCard && (
                <RevealCard
                  revealCard={revealCard}
                  label={
                    revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`
                  }
                />
              )}
```

with:

```tsx
              {revealCard && (
                <RevealCard
                  revealCard={revealCard}
                  label={
                    revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`
                  }
                  originDirection={resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats)}
                />
              )}
```

(`seats` is already in scope here — it's computed at the top of `PistiTable`'s body via `const seats = assignSeats(opponentPlayerIds);`, line 195, before this JSX.)

- [ ] **Step 5: Typecheck**

Run (from repo root): `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no new errors. (Pre-existing `*.test.tsx` errors from the tsconfig's missing `"types": ["jest"]` are a known, already-documented gap unrelated to this change — ignore those; confirm only that no error mentions `pistiSeating.ts` or `PistiTable.tsx`.)

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: same pass count as before this change (30 suites, all green, including `PistiTable.test.tsx`). No new tests are added in this task — this step only confirms nothing broke.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/games/pisti/pistiSeating.ts apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "Animate Pişti trick-reveal card traveling in from the playing seat"
```

---

### Task 2: Visual verification

**Files:** none (verification-only task; no code changes expected unless the screenshot reveals a defect, in which case fix `pistiSeating.ts` or `PistiTable.tsx` in place before committing).

**Interfaces:**
- Consumes: the running `expo start --web` dev server and the existing Playwright/system-Chrome screenshot workflow already used for the prior Pişti UI passes (per the `dev_sandbox_no_device_access` memory) — no new tooling.
- Produces: nothing consumed by later tasks; this is the last task in the plan.

- [ ] **Step 1: Start the web dev server**

Run: `npx expo start --web` from `apps/mobile`.
Expected: Metro bundles successfully, web preview reachable on localhost.

- [ ] **Step 2: Screenshot the 2-player table's AI reveal**

Navigate to Home → Pişti → 2-player, any difficulty → start a hand and let the AI play a card (or advance until it does). Take a screenshot capturing the moment the reveal animation is in flight (mid-travel, not just the final resting frame — may need a couple of attempts/screenshots given the ~530ms window).
Expected: the AI's played card visibly travels downward from above (from the top seat) toward the center pile, not just fading in already at rest.

- [ ] **Step 3: Screenshot the human's play**

Play a card as the human. Screenshot the reveal in flight.
Expected: the card visibly travels upward from below (from the human's hand position) toward the pile.

- [ ] **Step 4: Screenshot all four directions in 4-player mode**

Start a 4-player hand (free-for-all or partner mode, either is fine). Advance through enough turns to capture at least one reveal from each of the four seats (bottom/human, top, left, right) — screenshot each in flight.
Expected: each seat's reveal travels in from its own correct direction (top seat's card travels down, left seat's card travels right-and-in, right seat's card travels left-and-in, human's card travels up), all landing at the same shared center pile.

- [ ] **Step 5: Confirm the label is unaffected**

In any of the screenshots above, check the "X played" text label.
Expected: it still appears in its existing fixed position above the pile, unaffected by the card's new travel direction.

- [ ] **Step 6: Check the browser console**

Expected: no new warnings attributable to this change.

- [ ] **Step 7: Fix forward if anything looks wrong**

If a direction's travel reads unclear or a screenshot shows the card originating from the wrong side: the fix is adjusting the relevant `{x, y}` entry in `REVEAL_ORIGIN_OFFSETS` (`pistiSeating.ts`) — re-screenshot to confirm before proceeding. This is a values-only fix; the mechanism itself should not need to change.

- [ ] **Step 8: Commit if any fix was needed**

```bash
git add apps/mobile/src/games/pisti/pistiSeating.ts
git commit -m "Tune Pişti trick-reveal origin offsets"
```

(Skip this step if Step 7 required no changes — nothing to commit.)
