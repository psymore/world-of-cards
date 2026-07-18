# Shared Card-Travel Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Batak's existing origin-relative card-travel animation into a shared `TravelCard` component, and wire Batak to use it, with pixel-identical rendered output.

**Architecture:** One new file (`apps/mobile/src/table/TravelCard.tsx`) holding the generic animation — an `Animated.Value` that resets and animates from `originOffset` to `(0, 0)` on `resetKey`/reduced-motion change, wrapping arbitrary `children`. `BatakTable.tsx`'s local `TravelCard` function is deleted and its one call site is updated to use the shared component instead. Pişti's `RevealCard` is untouched.

**Tech Stack:** React Native `Animated` API, TypeScript, existing shared helpers (`apps/mobile/src/table/travelAnimation.ts`, `apps/mobile/src/components/useReducedMotion.ts`).

## Global Constraints

- No new automated tests — decorative animation/timing UI, per the standing 2026-07-07 mobile-UI testing policy (see `docs/superpowers/specs/2026-07-18-shared-card-travel-animation-design.md`, "Testing"). Verification is typecheck + full existing suite (regression) + a manual/visual check, not new test files.
- Batak's rendered output must be pixel-identical to before this change — this is a pure extraction, not a behavior change.
- Pişti's `PistiTable.tsx`/`RevealCard` must not be touched.

---

## Task 1: Extract `TravelCard` into `apps/mobile/src/table/` and wire it into Batak

**Files:**
- Create: `apps/mobile/src/table/TravelCard.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Produces: `TravelCard` component and `TravelCardProps` interface, exported from `apps/mobile/src/table/TravelCard.tsx`:
  ```ts
  export interface TravelCardProps {
    originOffset: { x: number; y: number };
    resetKey: string | number;
    children: React.ReactNode;
  }
  export function TravelCard(props: TravelCardProps): JSX.Element;
  ```
- Consumes (from existing code, unchanged): `CARD_TRAVEL_DURATION_MS`, `CARD_TRAVEL_EASING` from `apps/mobile/src/table/travelAnimation.ts`; `useReducedMotion` from `apps/mobile/src/components/useReducedMotion.ts`; `revealOriginOffset`, `resolveRevealOrigin` from `apps/mobile/src/table/seating.ts` (already imported by `BatakTable.tsx`).

- [ ] **Step 1: Create the shared `TravelCard` component**

Write `apps/mobile/src/table/TravelCard.tsx`:

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
// implementation for now).
export function TravelCard({ originOffset, resetKey, children }: TravelCardProps) {
  const progress = useTravelProgress(resetKey);

  return (
    <Animated.View
      style={{
        opacity: progress,
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
        ],
      }}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck (new file only, nothing wired yet)**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors (the new file is self-contained and not yet imported anywhere, so this only confirms `TravelCard.tsx` itself is valid).

- [ ] **Step 3: Remove Batak's local `TravelCard` function**

In `apps/mobile/src/games/batak/BatakTable.tsx`, delete this entire block (currently lines 319–357 — confirm exact line numbers with `grep -n "^function TravelCard" apps/mobile/src/games/batak/BatakTable.tsx` before deleting, since earlier edits in this session may have shifted them slightly):

```tsx
// Animates a just-played card traveling from its seat's direction to its resting position in the
// trick cross — the parent slot (see TrickCenter) already sits at the resting TRICK_SLOT_OFFSETS
// position, so this only needs to interpolate from the origin vector down to (0, 0) relative to
// that slot. Mirrors Pişti's PistiTable.RevealCard, sharing the same timing constants
// (../../table/travelAnimation) so both games' play-travel motion feels consistent.
function TravelCard({ card, origin }: { card: Card; origin: RevealOrigin }) {
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
  }, [card.id, reducedMotion]);

  const originVector = revealOriginOffset(origin);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [originVector.x, 0] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [originVector.y, 0] }) },
        ],
      }}>
      <PlayingCard card={card} size="small" />
    </Animated.View>
  );
}
```

- [ ] **Step 4: Update `TrickCenter.slotFor`'s call site**

Still in `apps/mobile/src/games/batak/BatakTable.tsx`, find (inside `slotFor`, in the `card ? (isPending ? ... ) : null` block):

```tsx
        {card ? (
          isPending ? (
            <TravelCard card={card} origin={resolveRevealOrigin(playerId!, humanPlayerId, seats)} />
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
```

Replace with:

```tsx
        {card ? (
          isPending ? (
            <TravelCard
              originOffset={revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))}
              resetKey={card.id}>
              <PlayingCard card={card} size="small" />
            </TravelCard>
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
```

- [ ] **Step 5: Add the import and remove now-unused imports**

Still in `apps/mobile/src/games/batak/BatakTable.tsx`, find this import block near the top of the file:

```tsx
import { DealFlightOverlay } from "../../table/DealFlightOverlay";
import type { DealFlightSeat } from "../../table/DealFlightOverlay";
import type { DealPhase } from "../../hooks/useDealSequence";
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from "../../table/travelAnimation";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from "../../table/seating";
import type { Seat, SeatPosition, RevealOrigin } from "../../table/seating";
```

Replace with (drops the now-unused `CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING` import — `TravelCard.tsx` now owns that usage — and drops `RevealOrigin` from the type import, since after Step 3/4 nothing in this file references that type anymore; adds the new `TravelCard` import):

```tsx
import { DealFlightOverlay } from "../../table/DealFlightOverlay";
import type { DealFlightSeat } from "../../table/DealFlightOverlay";
import type { DealPhase } from "../../hooks/useDealSequence";
import { TravelCard } from "../../table/TravelCard";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from "../../table/seating";
import type { Seat, SeatPosition } from "../../table/seating";
```

Before moving on, confirm no other symbol in this file still needs `CARD_TRAVEL_DURATION_MS`, `CARD_TRAVEL_EASING`, or the `RevealOrigin` type:

Run: `grep -n "CARD_TRAVEL_DURATION_MS\|CARD_TRAVEL_EASING\|RevealOrigin\b" apps/mobile/src/games/batak/BatakTable.tsx`
Expected: no output (all three names no longer appear anywhere in the file).

- [ ] **Step 6: Typecheck the full mobile app**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors. If it reports unused-import or unused-variable errors for anything else, re-check Step 5's replacement was applied exactly as shown (a leftover unused import is the most likely cause).

- [ ] **Step 7: Run the full test suite for regression**

Run: `npx jest` (from the repo root)
Expected: all suites pass, same counts as before this change (39 suites / 229 tests as of the last run in this session). No new tests are expected or required — this step is purely a regression check per the plan's Global Constraints.

- [ ] **Step 8: Manual verification**

This is decorative animation timing/positioning — not something a unit test meaningfully covers, and no proactive screenshot pass is being taken per the project's standing policy (only do so if asked). If a live Expo session is already running (Fast Refresh picks up the change automatically), play a few tricks in a Batak game and confirm: played cards still travel in from the correct seat direction to the correct trick-cross position, at the same speed/easing as before this change, with no console errors. This step has no pass/fail command — it's a prompt for whoever is running the plan to actually look, not something to skip silently.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/table/TravelCard.tsx apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "$(cat <<'EOF'
Extract Batak's card-travel animation into a shared TravelCard

Pure extraction of the existing origin-relative animation pattern into
apps/mobile/src/table/TravelCard.tsx, so a future game can reuse it by
supplying its own destination layout, without touching this component's
animation logic. Pisti's RevealCard (scale-in, label, baked-in
destination) is untouched and out of scope for this change.
EOF
)"
```

---

## Self-Review

**Spec coverage:** The spec (`docs/superpowers/specs/2026-07-18-shared-card-travel-animation-design.md`) calls for: (1) a new `TravelCard` component at `apps/mobile/src/table/TravelCard.tsx` with the exact `{ originOffset, resetKey, children }` API — Step 1. (2) The internal reset/timing helper factored out but not exported — Step 1 (`useTravelProgress`, no `export`). (3) Batak's local `TravelCard` deleted and its call site updated to pixel-identical behavior — Steps 3–4. (4) Now-unused imports cleaned up — Step 5. (5) No new tests, existing suite re-run — Steps 6–7. (6) Pişti untouched — no task in this plan touches `PistiTable.tsx` anywhere. All spec sections are covered.

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate X" language anywhere in the steps above; every code block is complete, copy-pasteable code, not a description of code.

**Type consistency:** `TravelCardProps` is defined once in Step 1 (`originOffset: { x: number; y: number }`, `resetKey: string | number`, `children: React.ReactNode`) and the Step 4 call site matches it exactly (`originOffset={...}`, `resetKey={card.id}`, `children` passed as JSX children rather than a prop — consistent with `React.ReactNode` typing). No other task references this component's shape, so there's no cross-task drift to check.
