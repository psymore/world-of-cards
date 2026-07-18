# Batak Trick-Gathering Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Batak trick completes, the 4 played cards flip face-down and fly toward the winning player's seat before the move commits, instead of vanishing instantly.

**Architecture:** A pure `trickWinnerIndex` export lets `BatakScreen` know the winner before calling `performMove` (which resolves the trick atomically). A new `GatherCard` component (sibling to the existing `TravelCard`) combines a two-layer flip with an outward directional travel + fade. `BatakScreen` snapshots the completed trick into new `gatheringTrick` state after its existing hold pause, and only commits the move once the gather animation finishes.

**Tech Stack:** TypeScript, React Native `Animated` API (native driver), existing `@world-cards/engine` and `@world-cards/ui` workspace packages.

## Global Constraints

- Batak only — do not touch Pişti's `RevealCard` or any Pişti file.
- No new automated tests for UI/animation components (decorative motion, per the standing 2026-07-07 mobile-UI testing policy) — only Task 1's engine-export-surface test is new.
- No proactive screenshot/visual verification (per the 2026-07-17 direction) — verification is a live manual check in the user's own running session, not scripted.
- Reuse `CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING` from `apps/mobile/src/table/travelAnimation.ts` rather than introducing a new duration constant, so the gather animation's visual duration and the timer that commits the move after it never drift apart.
- Fixed direction offsets only (`REVEAL_ORIGIN_OFFSETS` in `apps/mobile/src/table/seating.ts`) — no new `onLayout`/`measureInWindow` plumbing for seat positions.

---

### Task 1: Export `trickWinnerIndex` from the Batak engine subpath

**Files:**
- Modify: `packages/engine/src/games/batak/index.ts`
- Modify: `apps/mobile/src/games/batak/engineImport.smoke.test.ts`

**Interfaces:**
- Consumes: `trickWinnerIndex(trick: Card[], trumpSuit: Suit): number` — already defined and exported from `packages/engine/src/games/batak/rules.ts:153`, already covered by multi-candidate trick-resolution tests in `rules.test.ts` (no logic changes, no new logic tests needed here).
- Produces: `trickWinnerIndex` importable from `@world-cards/engine/games/batak`, for Task 3 to use in `BatakScreen.tsx`.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/games/batak/engineImport.smoke.test.ts` (append to the existing file, keep the existing `it` block untouched):

```ts
import { batakDescriptor, trickWinnerIndex } from '@world-cards/engine/games/batak';
import type { BatakState, BatakMove } from '@world-cards/engine/games/batak';
import { createRng } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';

describe('@world-cards/engine/games/batak subpath', () => {
  it('resolves batakDescriptor with a working rule engine', () => {
    // ...existing test body, unchanged...
  });

  it('exposes trickWinnerIndex from the public subpath', () => {
    const trick: Card[] = [
      { id: 'c1', suit: 'hearts', rank: '2' },
      { id: 'c2', suit: 'hearts', rank: 'K' },
      { id: 'c3', suit: 'spades', rank: '3' },
      { id: 'c4', suit: 'hearts', rank: 'A' },
    ];
    // Only c3 is trump (spades); trumps always beat non-trumps regardless of rank, so it wins
    // even though c4 (Ace of hearts) is the highest-ranked card overall.
    expect(trickWinnerIndex(trick, 'spades')).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/mobile/src/games/batak/engineImport.smoke.test.ts`
Expected: FAIL — `trickWinnerIndex` is not exported from `@world-cards/engine/games/batak` (TypeScript error / undefined import).

- [ ] **Step 3: Add the export**

In `packages/engine/src/games/batak/index.ts`, change:

```ts
export * from './types';
export { compareRanks } from './ranking';
```

to:

```ts
export * from './types';
export { compareRanks } from './ranking';
export { trickWinnerIndex } from './rules';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/mobile/src/games/batak/engineImport.smoke.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/batak/index.ts apps/mobile/src/games/batak/engineImport.smoke.test.ts
git commit -m "Export trickWinnerIndex from the Batak engine subpath"
```

---

### Task 2: `GatherCard` component (flip + travel-out)

**Files:**
- Create: `apps/mobile/src/table/GatherCard.tsx`

**Interfaces:**
- Consumes: `PlayingCard` from `@world-cards/ui` (props: `card`, `faceDown`, `size`), `Card` type from `@world-cards/engine`, `useReducedMotion()` from `../components/useReducedMotion`, `CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING` from `./travelAnimation`.
- Produces: `GatherCard({ card, destinationOffset }: GatherCardProps)` — a self-contained animated component, for Task 3 to render inside `BatakTable.tsx`'s `TrickCenter`.

  ```ts
  export interface GatherCardProps {
    card: Card;
    destinationOffset: { x: number; y: number };
  }
  ```

This is a pure presentational component with no wiring into the rest of the app yet — its deliverable for this task is "compiles cleanly and the animation logic is correct by inspection," matching how `TravelCard` itself has no dedicated test file. It becomes visually verifiable once Task 3 wires it in.

- [ ] **Step 1: Create the component**

Create `apps/mobile/src/table/GatherCard.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard } from '@world-cards/ui';
import { useReducedMotion } from '../components/useReducedMotion';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from './travelAnimation';

export interface GatherCardProps {
  card: Card;
  // Where the card visually travels to, relative to its own rest position (0, 0) — e.g.
  // revealOriginOffset(resolveRevealOrigin(winnerId, humanPlayerId, seats)). Mirrors TravelCard's
  // originOffset but in the opposite direction: this is a fly-OUT (rest -> destination), not a
  // fly-IN (origin -> rest), which is why it's a separate component rather than a new TravelCard
  // prop — TravelCard's contract ("the caller controls the destination by where it renders this
  // component") doesn't hold once the destination itself needs to animate away from that spot.
  destinationOffset: { x: number; y: number };
}

// Matches PlayingCard's 'small' size (packages/ui/src/PlayingCard.tsx's CARD_DIMS.small), which
// isn't exported from packages/ui — hardcoded here the same way BatakTable.tsx already hardcodes
// its own HUMAN_CARD_WIDTH/HEIGHT for the 'normal' size.
const GATHER_CARD_WIDTH = 64;
const GATHER_CARD_HEIGHT = 86;

// Flips a played card face-down and flies it toward destinationOffset in one animation pass —
// used only for Batak's trick-gathering sweep (BatakTable's TrickCenter, when gatheringTrick is
// set). One instance per gathered card; each runs once on mount and is unmounted along with its
// parent once BatakScreen's gather timer commits the move, so there's no reset/retrigger case to
// handle (unlike TravelCard, which is reused for multiple plays over one mounted lifetime).
export function GatherCard({ card, destinationOffset }: GatherCardProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Reduced-motion users jump straight to progress=1, i.e. fully faded out (see groupOpacity
    // below) — matching the pre-existing (pre-this-feature) behavior of the trick just vanishing
    // instantly on commit, with no flip/travel flourish. This is intentional, not a bug: the
    // "meaningful end state" of this animation is the card being gone, so skipping straight to it
    // is the correct reduced-motion behavior, not a state that needs to look presentable.
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [reducedMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, destinationOffset.x],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, destinationOffset.y],
  });
  // Fades out over the animation's last third so the card visually dissolves as it nears the
  // winner's side instead of appearing to stop abruptly — there's no literal pile graphic to land
  // on (Batak's 2026-07-18 turn-indicator-simplification pass removed opponent card stacks
  // entirely).
  const groupOpacity = progress.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [1, 1, 0],
  });

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
  const frontOpacity = progress.interpolate({
    inputRange: [0, 0.5, 0.5001, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = progress.interpolate({
    inputRange: [0, 0.4999, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <Animated.View
      style={{
        width: GATHER_CARD_WIDTH,
        height: GATHER_CARD_HEIGHT,
        transform: [{ translateX }, { translateY }],
        opacity: groupOpacity,
      }}>
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
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/table/GatherCard.tsx
git commit -m "Add GatherCard: flip + travel-out animation for Batak's trick sweep"
```

---

### Task 3: Wire the gather animation into `BatakScreen` and `BatakTable`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`

**Interfaces:**
- Consumes: `trickWinnerIndex` (Task 1), `GatherCard`/`GatherCardProps` (Task 2), existing `revealOriginOffset`/`resolveRevealOrigin` from `apps/mobile/src/table/seating.ts` (already imported in `BatakTable.tsx`).
- Produces: `GatheringTrick` type (exported from `BatakTable.tsx`, alongside the existing `PendingBatakPlay`), consumed by `BatakScreen.tsx`.

  ```ts
  export interface GatheringTrick {
    entries: { playerId: string; card: Card }[]; // all 4 plays, in play order
    winnerId: string;
  }
  ```

This is the task that makes the animation visible end-to-end — split further would leave an intermediate state with no observable behavior change, so it stays one task.

- [ ] **Step 1: Add `GatheringTrick` type and thread the prop through `BatakTable`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, add the import and type near the existing `PendingBatakPlay`:

```ts
import { TravelCard } from "../../table/TravelCard";
import { GatherCard } from "../../table/GatherCard";
```

```ts
export interface PendingBatakPlay {
  playerId: string;
  card: Card;
  originOffset?: { x: number; y: number };
}

// All 4 plays of a just-completed trick, captured before performMove commits (which resolves
// the trick atomically — winner computed and cards swept to won-<winner> within one call), so
// TrickCenter has a stable snapshot to animate away from while engine state is still mid-trick.
export interface GatheringTrick {
  entries: { playerId: string; card: Card }[];
  winnerId: string;
}
```

Add `gatheringTrick?: GatheringTrick | null;` to `BatakTableProps`, next to `pendingPlay?: PendingBatakPlay | null;`, and destructure it in the `BatakTable` function signature next to `pendingPlay`.

- [ ] **Step 2: Fix the interactivity gate for the new gather window**

`BatakTable`'s `isHumanInteractive` currently only guards on `pendingPlay`:

```ts
const isHumanInteractive = isHumanTurn && pendingPlay == null;
```

Once gathering starts, `pendingPlay` becomes `null` again (Step 4 below clears it) but engine state still hasn't advanced — `state.currentPlayerIndex` still points at whoever played the trick-completing 4th card. If that was the human, `isHumanInteractive` would wrongly go back to `true` during the ~500ms gather window, risking a stray extra play. Change to:

```ts
const isHumanInteractive = isHumanTurn && pendingPlay == null && gatheringTrick == null;
```

- [ ] **Step 3: Render `GatherCard` in `TrickCenter` when gathering**

In `TrickCenter`, add `gatheringTrick?: GatheringTrick | null;` to its props type and destructure it. Add a small helper (mirrors `slotFor`'s reverse lookup) above `cardFor`:

```ts
function trickPositionFor(playerId: string): TrickPosition {
  if (playerId === humanPlayerId) return "bottom";
  return seats.find((s) => s.playerId === playerId)?.position ?? "top";
}
```

Replace the `<View style={styles.trickCross}>` block's children with a branch on `gatheringTrick`:

```tsx
const gatherDestinationOffset = gatheringTrick
  ? revealOriginOffset(resolveRevealOrigin(gatheringTrick.winnerId, humanPlayerId, seats))
  : null;

return (
  <View style={styles.centerPanel}>
    <View style={styles.trumpRow}>
      <Text style={styles.centerLine}>Trump:</Text>
      <SuitIcon
        suit={state.trumpSuit!}
        size={16}
        color={suitColor(state.trumpSuit!)}
      />
      <Text style={styles.centerLine}>
        {`  Contract: ${state.contract} (${playerNames[state.bidWinner ?? ""] ?? state.bidWinner})`}
      </Text>
    </View>
    <View style={styles.trickCross}>
      {gatheringTrick
        ? gatheringTrick.entries.map(({ playerId, card }) => {
            const position = trickPositionFor(playerId);
            const offset = TRICK_SLOT_OFFSETS[position];
            return (
              <View
                key={playerId}
                style={[
                  styles.trickSlot,
                  { transform: [{ translateX: offset.x }, { translateY: offset.y }] },
                ]}>
                <GatherCard card={card} destinationOffset={gatherDestinationOffset!} />
              </View>
            );
          })
        : (["top", "left", "bottom", "right"] as TrickPosition[]).map(slotFor)}
    </View>
  </View>
);
```

(Leave `cardFor`, `playOrder`, and `slotFor` exactly as they are — they're still used for the normal, non-gathering render path.)

- [ ] **Step 4: Pass `gatheringTrick` down from `BatakTable`'s root render**

In `BatakTable`'s own render, where `TrickCenter` is invoked, add the prop:

```tsx
{state.phase === "playing" && (
  <TrickCenter
    state={state}
    seats={seats}
    humanPlayerId={humanPlayerId}
    playerNames={playerNames}
    pendingPlay={pendingPlay}
    gatheringTrick={gatheringTrick}
    destRef={destRef}
    onDestLayout={handleDestLayout}
  />
)}
```

- [ ] **Step 5: Typecheck as a checkpoint**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors. `gatheringTrick` is optional (`gatheringTrick?: GatheringTrick | null`), so
`BatakScreen.tsx` not yet passing it (Steps 6-9 below add that) is valid TypeScript — this step is
just a checkpoint confirming Steps 1-4's changes compile cleanly on their own before moving on,
not a hard gate.

- [ ] **Step 6: Compute the trick winner and add gathering state in `BatakScreen`**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, update imports:

```ts
import { batakDescriptor, BatakState, BatakMove, trickWinnerIndex } from '@world-cards/engine/games/batak';
```

```ts
import { BatakTable, PendingBatakPlay, GatheringTrick } from './BatakTable';
```

Add the shared duration import (replacing the need for a separate gather-specific constant, per the Global Constraints DRY rule):

```ts
import { CARD_TRAVEL_DURATION_MS } from '../../table/travelAnimation';
```

- [ ] **Step 7: Add `gatheringTrick` state and a second timeout ref**

In `ActiveGame`, alongside the existing `pendingPlay` state and `pendingTimeoutRef`:

```ts
const [gatheringTrick, setGatheringTrick] = useState<GatheringTrick | null>(null);
const gatherTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Update the cleanup effect to also clear it:

```ts
useEffect(() => {
  return () => {
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    if (gatherTimeoutRef.current) clearTimeout(gatherTimeoutRef.current);
  };
}, []);
```

- [ ] **Step 8: Replace the trick-completing commit with the gather sequence**

In `commitMove`, the full `move.type === 'play'` branch currently reads (this is the complete
existing block, from `BatakScreen.tsx` as of Task 2):

```ts
if (move.type === 'play') {
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const card = hand.find((c) => c.id === move.cardId);
  if (!card) {
    performMove(move);
    return;
  }
  const delay = state.currentTrick.length === 3 ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
  if (playerId === HUMAN_ID && !reducedMotion) {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        HAND_REFLOW_DURATION_MS,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
  }
  setPendingPlay({ playerId, card, originOffset });
  pendingTimeoutRef.current = setTimeout(() => {
    performMove(move);
    setPendingPlay(null);
  }, delay);
  return;
}
```

Replace it with (the `if (!card)` guard, `LayoutAnimation` block, and `setPendingPlay` call are
unchanged — only the `delay` declaration and the `setTimeout` callback body change):

```ts
if (move.type === 'play') {
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const card = hand.find((c) => c.id === move.cardId);
  if (!card) {
    performMove(move);
    return;
  }
  const isTrickCompleting = state.currentTrick.length === 3;
  const delay = isTrickCompleting ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
  if (playerId === HUMAN_ID && !reducedMotion) {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        HAND_REFLOW_DURATION_MS,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
  }
  setPendingPlay({ playerId, card, originOffset });
  pendingTimeoutRef.current = setTimeout(() => {
    setPendingPlay(null);
    if (!isTrickCompleting) {
      performMove(move);
      return;
    }
    // The trick just completed: snapshot all 4 plays + the winner (computed with the exact same
    // pure function the engine itself uses internally) before committing, so GatherCard has a
    // stable 4-card view to animate away from while engine state is still mid-trick —
    // performMove resolves a completed trick atomically and would otherwise leave nothing to
    // animate.
    const priorEntries = state.currentTrick;
    const priorCards = priorEntries.map(
      (e) => state.table.zones['trick'].cards.find((c) => c.id === e.cardId)!,
    );
    const fullTrickCards = [...priorCards, card];
    const fullTrickPlayerIds = [...priorEntries.map((e) => e.playerId), playerId];
    const winnerPos = trickWinnerIndex(fullTrickCards, state.trumpSuit!);
    const winnerId = fullTrickPlayerIds[winnerPos];
    const entries = fullTrickPlayerIds.map((pid, i) => ({ playerId: pid, card: fullTrickCards[i] }));
    setGatheringTrick({ entries, winnerId });
    gatherTimeoutRef.current = setTimeout(() => {
      performMove(move);
      setGatheringTrick(null);
    }, CARD_TRAVEL_DURATION_MS);
  }, delay);
  return;
}
```

- [ ] **Step 9: Keep `legalMoves` and `<BatakTable>` in sync with the new gathering window**

Update the `legalMoves` computation to also exclude the gather window (defensive consistency with `isHumanInteractive`'s fix in Task 3 Step 2, even though today's downstream usage doesn't strictly require it):

```ts
const legalMoves =
  state.players[state.currentPlayerIndex] === HUMAN_ID && pendingPlay == null && gatheringTrick == null
    ? batakDescriptor.ruleEngine.getLegalMoves(state, HUMAN_ID)
    : [];
```

Pass the new prop to `BatakTable`:

```tsx
<BatakTable
  state={state}
  humanPlayerId={HUMAN_ID}
  opponentPlayerIds={AI_IDS}
  playerNames={PLAYER_NAMES}
  legalMoves={legalMoves}
  onMove={handleHumanMove}
  onPlayCard={handleHumanPlayCard}
  pendingPlay={pendingPlay}
  gatheringTrick={gatheringTrick}
  dealPhase={dealPhase}
/>
```

- [ ] **Step 10: Typecheck both packages**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json`
Expected: no errors (unaffected by this task, confirms no accidental cross-package breakage).

- [ ] **Step 11: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including `engineImport.smoke.test.ts` from Task 1 and the full existing Batak/Pişti suite (no behavior change to non-Batak files, no new test failures).

- [ ] **Step 12: Manual verification (live, in your own running session — not scripted)**

Start the app (`npm run mobile` or your usual dev flow) and play a Batak hand through to a completed trick. Confirm:
- The trick still shows the existing fly-in + ~1.1s hold as before.
- After the hold, all 4 cards flip face-down and travel toward the winning seat's side, fading out.
- The winner's "N tricks" badge count increments right as the cards finish arriving, not before.
- No stray double-play is possible by tapping during the gather window (Step 2/9's interactivity fix).
- Reduced-motion (OS accessibility setting) skips straight to the cards being gone, no animation.

- [ ] **Step 13: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "Animate Batak's trick-gathering: flip + travel to the winning seat"
```

---

## Self-Review Notes

- **Spec coverage:** winner-before-commit (Task 1, Task 3 Step 8) ✓; new `GatherCard` flip+travel component (Task 2) ✓; hold→gather→commit sequencing (Task 3 Steps 6-8) ✓; rendering integration in `TrickCenter` (Task 3 Steps 1-4) ✓; interactivity-gate correctness during the new window (Task 3 Steps 2, 9) ✓; reduced-motion handling (Task 2 Step 1) ✓; explicitly-out-of-scope items (Pişti, measured positions, sequential flip, new tests, proactive screenshots) — none of this plan's tasks touch those ✓.
- **Placeholder scan:** none — every step has literal code or exact commands.
- **Type consistency:** `GatheringTrick.entries[].card` is `Card` (from `@world-cards/engine`) throughout Task 2/3; `GatherCardProps.destinationOffset` and `PendingBatakPlay.originOffset` both use the same `{ x: number; y: number }` shape as the rest of this codebase's travel offsets (`revealOriginOffset`'s return type). `trickWinnerIndex`'s signature (`Card[], Suit`) matches both its Task 1 test call and its Task 3 usage.
