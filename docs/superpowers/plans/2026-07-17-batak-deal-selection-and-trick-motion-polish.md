# Batak Deal, Selection & Trick-Motion Polish (Round 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 7-item polish pass from `docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-polish-design.md` — shared card aspect-ratio/corner-inset/back-image changes, Batak's hand-row split and selection behavior, and a new shared deal-flight + play-travel animation system for both Batak and Pişti.

**Architecture:** Shared visual constants live in `packages/ui/src/PlayingCard.tsx` (used by Pişti, Batak, and `apps/playground`). Shared, game-agnostic table geometry and animation timing live in `apps/mobile/src/table/` (`seating.ts`, new `DealFlightOverlay.tsx`, new `travelAnimation.ts`) and `apps/mobile/src/hooks/` (new `useDealSequence.ts`), following this codebase's existing "second real use gets extracted to shared code" convention. Batak-only behavior (hand split, selection lift, trick-cross layout) stays local to `apps/mobile/src/games/batak/`.

**Tech Stack:** React Native (Expo), TypeScript, React Native `Animated` (native driver), `react-native-svg` (unrelated to this pass), Jest + React Native Testing Library.

## Global Constraints

- **No new automated tests.** Per the project's 2026-07-07 testing policy, mobile UI work does not get new tests by default. Every task must still keep the *existing* suite green — run `npm test` from the repo root after each task.
- **Typecheck every touched package** after each task: `npx tsc --noEmit -p packages/ui/tsconfig.json` and/or `npx tsc --noEmit -p apps/mobile/tsconfig.json`, whichever package(s) the task touched.
- **No manual visual verification per task** (no Playwright/browser runs mid-plan) — that is batched into the final task (Task 11) once all code changes have landed, matching this codebase's established pattern of doing one comprehensive visual pass at the end rather than one per task.
- **Pixel/timing constants are first-pass values**, called out inline as such in each task, same as this codebase's existing precedent for similar constants (e.g. `CORNER_INDEX_WIDTH`'s "tuned by eye ... confirmed via screenshot" comment) — Task 11 is where any of them get nudged after an actual look.
- **Never use the deprecated `pointerEvents` prop form** — use `style.pointerEvents` if a component ever needs to explicitly opt out of touch capture (none of the new components in this plan need to; noted here because this codebase has hit and fixed this exact deprecation before).
- Every commit in this plan should be a single `git add` of only the files that task touched — do not `git add -A`.

---

## Task 1: Shared `PlayingCard` aspect ratio + corner inset

**Files:**
- Modify: `packages/ui/src/PlayingCard.tsx`

**Interfaces:**
- Produces: `CARD_DIMS.normal` = `{ width: 84, height: 132 }`, `CARD_DIMS.small` = `{ width: 54, height: 86 }` (previously 120/78) — later tasks in this plan (9, and any task computing trick-slot or fan geometry from card size) must use these new heights, not the old 120/78.

- [ ] **Step 1: Update `CARD_DIMS` and consolidate the duplicated `styles.normal`/`styles.small` literals**

Find:
```ts
const CARD_DIMS = {
  normal: { width: 84, height: 120 },
  small: { width: 54, height: 78 },
};
```
Replace with:
```ts
// +10% height vs. the original 120/78, width unchanged — makes the cards read as slightly
// taller/more elegant per the 2026-07-17 deal/selection/trick-motion polish spec.
const CARD_DIMS = {
  normal: { width: 84, height: 132 },
  small: { width: 54, height: 86 },
};
```

Then find (near the bottom of the file, inside `const styles = StyleSheet.create({...})`):
```ts
  normal: { width: 84, height: 120 },
  small: { width: 54, height: 78 },
```
Replace with (deriving from `CARD_DIMS` instead of duplicating the literals a second time, closing the pre-existing drift risk between the two):
```ts
  normal: { width: CARD_DIMS.normal.width, height: CARD_DIMS.normal.height },
  small: { width: CARD_DIMS.small.width, height: CARD_DIMS.small.height },
```

- [ ] **Step 2: Push the corner rank/suit index closer to the card edge**

Find:
```ts
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
Replace with (insets roughly halved — first-pass values, confirm via screenshot in Task 11; keep the mirrored pair's `bottom`/`right` matched to the unmirrored `top`/`left`, same rule as before):
```ts
  cornerNormal: {
    position: "absolute",
    top: 1,
    left: 2,
    width: CORNER_INDEX_WIDTH.normal,
    alignItems: "center",
    gap: 2,
    zIndex: 1,
  },
  cornerSmall: {
    position: "absolute",
    top: 1,
    left: 1,
    width: CORNER_INDEX_WIDTH.small,
    alignItems: "center",
    gap: 1,
    zIndex: 1,
  },
  cornerNormalMirrored: {
    position: "absolute",
    bottom: 1,
    right: 2,
    width: CORNER_INDEX_WIDTH.normal,
    alignItems: "center",
    gap: 2,
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
  cornerSmallMirrored: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: CORNER_INDEX_WIDTH.small,
    alignItems: "center",
    gap: 1,
    transform: [{ rotate: "180deg" }],
    zIndex: 1,
  },
```

Also update the doc comment directly above `cornerNormal` (currently says corner offsets are "inset from the card edge ... rather than hugging it ... deliberately placed, not jammed into the corner"). Find:
```ts
  // Corner offsets are inset from the card edge (rather than hugging it) so the rank/suit index
  // reads as deliberately placed, not jammed into the corner — keep the mirrored pair's
  // bottom/right values matched to the unmirrored top/left, since it's a 180°-rotated duplicate.
```
Replace with:
```ts
  // Corner offsets sit close to the card edge (a 2026-07-17 change from the previous, more
  // generously-inset look) to read closer to a real playing card's printed index — keep the
  // mirrored pair's bottom/right values matched to the unmirrored top/left, since it's a
  // 180°-rotated duplicate.
```

- [ ] **Step 3: Run the existing test suite to confirm no regressions**

Run: `npm test -- packages/ui`
Expected: All existing `PlayingCard.test.tsx` tests still PASS (they assert on rank/suit testIDs and text, not pixel positions or dimensions, so this change shouldn't break any of them).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/PlayingCard.tsx
git commit -m "feat(ui): taller cards and tighter corner index on PlayingCard"
```

---

## Task 2: Shared `PlayingCard` card-back image swap

**Files:**
- Modify: `packages/ui/src/PlayingCard.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `apps/mobile/src/components/PlayerAvatar.tsx` (one stale comment reference)
- Delete: `packages/ui/src/CardBackPattern.tsx`
- Add (git): `packages/ui/assets/card-art/processed/ai-generated/cards-backround/middle-lighted.png` (already present on disk, currently untracked)

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: no new exports; removes the `CardBackPattern` export from `@world-of-cards/ui`.

- [ ] **Step 1: Confirm `CardBackPattern` has no other real importers**

Run: `grep -rn "CardBackPattern" --include=*.ts --include=*.tsx .` from the repo root (or use your editor's find-in-files).
Expected: matches only in `packages/ui/src/PlayingCard.tsx` (the import + usage being replaced below), `packages/ui/src/index.ts` (the export being removed below), `packages/ui/src/CardBackPattern.tsx` itself (being deleted), and two doc-comment mentions in `apps/mobile/src/games/batak/DealAnimationOverlay.tsx` and `apps/mobile/src/components/PlayerAvatar.tsx`. `DealAnimationOverlay.tsx` is deleted outright in Task 7, so its comment doesn't need touching here.

- [ ] **Step 2: Swap the face-down branch to render the new back image**

In `packages/ui/src/PlayingCard.tsx`, find:
```ts
import { SvgXml } from "react-native-svg";
import type { Card, Suit } from "@world-of-cards/engine";
import { SuitIcon } from "./SuitIcon";
import { CardBackPattern } from "./CardBackPattern";
import { glowShadow } from "./glowShadow";
```
Replace with:
```ts
import { SvgXml } from "react-native-svg";
import type { Card, Suit } from "@world-of-cards/engine";
import { SuitIcon } from "./SuitIcon";
import { glowShadow } from "./glowShadow";
```

Find:
```ts
const OVERLAY_BASE_SIZE = { normal: 60, small: 38 };
```
Add directly below it:
```ts
// Default face-down back art for every card in the app (Pişti, Batak, and apps/playground all
// consume PlayingCard directly, so this applies everywhere at once — see the 2026-07-17
// deal/selection/trick-motion polish spec for why this is a deliberate "apply everywhere" call,
// not a per-game override). Replaces the earlier hand-drawn SVG lattice (CardBackPattern).
const CARD_BACK_IMAGE = require("../assets/card-art/processed/ai-generated/cards-backround/middle-lighted.png");
```

Find:
```ts
  if (faceDown || !card) {
    const pixelDims = isSmall ? CARD_DIMS.small : CARD_DIMS.normal;
    return (
      <CardFrame
        testID="playing-card-back"
        dims={dims}
        backgroundColor="#1c2451"
        highlighted={highlighted}
        style={style}
        cardRadius={cardRadius}
        borders={borders}>
        <CardBackPattern width={pixelDims.width} height={pixelDims.height} />
      </CardFrame>
    );
  }
```
Replace with:
```ts
  if (faceDown || !card) {
    return (
      <CardFrame
        testID="playing-card-back"
        dims={dims}
        backgroundColor="#1c2451"
        highlighted={highlighted}
        style={style}
        cardRadius={cardRadius}
        borders={borders}>
        <Image
          testID="playing-card-back-art"
          source={CARD_BACK_IMAGE}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      </CardFrame>
    );
  }
```

(`Image` and `StyleSheet` are already imported at the top of this file from `react-native` — no new import needed for those two.)

- [ ] **Step 3: Delete `CardBackPattern.tsx` and its export**

Delete the file `packages/ui/src/CardBackPattern.tsx`.

In `packages/ui/src/index.ts`, find:
```ts
export { CardBackPattern } from './CardBackPattern';
```
Delete that line entirely.

- [ ] **Step 4: Update the stale doc-comment reference in `PlayerAvatar.tsx`**

In `apps/mobile/src/components/PlayerAvatar.tsx`, find:
```ts
// as SuitIcon/CardBackPattern. `accent` is generic, not "isHuman": this component has no concept
```
Replace with:
```ts
// as SuitIcon. `accent` is generic, not "isHuman": this component has no concept
```

- [ ] **Step 5: Stage the new asset**

```bash
git add packages/ui/assets/card-art/processed/ai-generated/cards-backround/middle-lighted.png
```

- [ ] **Step 6: Run the existing test suite**

Run: `npm test -- packages/ui`
Expected: All `PlayingCard.test.tsx` tests still PASS — none of them assert on `CardBackPattern`-specific internals, only the outer `playing-card-back` testID, which is unchanged.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json` and `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/PlayingCard.tsx packages/ui/src/index.ts apps/mobile/src/components/PlayerAvatar.tsx packages/ui/assets/card-art/processed/ai-generated/cards-backround/middle-lighted.png
git rm packages/ui/src/CardBackPattern.tsx
git commit -m "feat(ui): replace CardBackPattern SVG with the middle-lighted card-back image"
```

---

## Task 3: Batak hand-row split fix (bottom row gets the extra card)

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `splitTwoRows(count: number): [number, number]` from `apps/mobile/src/table/seating.ts` (unchanged signature).

- [ ] **Step 1: Swap which row gets the larger half of the sorted hand**

Find:
```ts
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const sortedHand = sortHandForDisplay(humanHand);
  const [topRowCount] = splitTwoRows(sortedHand.length);
  const topRow = sortedHand.slice(0, topRowCount);
  const bottomRow = sortedHand.slice(topRowCount);
```
Replace with:
```ts
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const sortedHand = sortHandForDisplay(humanHand);
  // splitTwoRows returns the larger half first; the bottom row (closer to the viewer) should get
  // the extra card on an odd-sized hand, not the top row — e.g. 13 cards is 6 top / 7 bottom.
  const [largerRowCount] = splitTwoRows(sortedHand.length);
  const topRowCount = sortedHand.length - largerRowCount;
  const topRow = sortedHand.slice(0, topRowCount);
  const bottomRow = sortedHand.slice(topRowCount);
```

- [ ] **Step 2: Verify the arithmetic by inspection**

For a fresh 13-card hand: `splitTwoRows(13)` returns `[7, 6]`, so `largerRowCount = 7`, `topRowCount = 13 - 7 = 6`, `topRow.length === 6`, `bottomRow.length === 7`. No test file exists for `BatakTable` today (per the standing UI-testing policy), so this is confirmed by reading the code, and again visually in Task 11.

- [ ] **Step 3: Run the existing test suite**

Run: `npm test -- apps/mobile`
Expected: All existing tests PASS (no test exercises `BatakTable`'s hand split directly).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "fix(batak): give the bottom hand row the extra card on an odd split"
```

---

## Task 4: Batak selection lift + remove z-index front-stacking

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `SelectableCard`'s existing `liftDistance?: number` prop (`apps/mobile/src/components/SelectableCard.tsx`, default `16`) — unchanged signature, just now passed explicitly.

- [ ] **Step 1: Replace the z-index constants with a lift-distance constant**

Find:
```ts
// Front-stacking for the selected card (Section 5 of the design spec): must beat every other
// card's zIndex, both in its own row and the other row (see handFanRow's zIndex removal below).
const SELECTED_CARD_Z_INDEX = 10;
const UNSELECTED_CARD_Z_INDEX = 1;
```
Replace with:
```ts
// 2.5x SelectableCard's own default (16px) lift — Batak-only override, see
// docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-polish-design.md
// section C. Selection no longer forces the card to the front via zIndex (below); this larger
// lift is what makes a selected card read as prominent instead.
const SELECTED_LIFT_DISTANCE = 40;
```

- [ ] **Step 2: Remove the zIndex prop from `EntranceCard`'s usage and add the lift override**

Find:
```ts
        return (
          <EntranceCard
            key={card.id}
            index={i}
            playEntrance={playEntrance}
            // The selected card renders in front of every other card (both its own row and the
            // other row — see handFanRow's zIndex removal below), matching a real lifted card.
            // This is safe from the old "stray tap plays the wrong card" bug because
            // SelectableCard's hitSlop (passed below) shrinks the SELECTED card's touchable
            // bounds specifically — it's the lifted+rotated card whose axis-aligned hit
            // rectangle can otherwise extend past its rotated visual silhouette into a
            // neighbor's clearly-exposed face (confirmed empirically via elementFromPoint
            // hit-mapping in the prior, now-superseded zIndex-inversion fix).
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
          </EntranceCard>
        );
```
Replace with:
```ts
        return (
          <EntranceCard key={card.id} index={i} playEntrance={playEntrance}>
            <SelectableCard
              card={card}
              size="normal"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length, HUMAN_HAND_DEGREES_PER_STEP)}
              curveOffsetY={fanCurveY(i, cards.length, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
              marginLeft={i > 0 ? cardMarginLeft : undefined}
              liftDistance={SELECTED_LIFT_DISTANCE}
              // Kept even without the front-stacking zIndex below: it independently shrinks the
              // selected card's own touch bounds, which is what actually prevents a stray tap
              // from landing on it instead of an exposed neighbor — orthogonal to stacking order.
              hitSlop={selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined}
            />
          </EntranceCard>
        );
```

- [ ] **Step 3: Drop the now-unused `zIndex` prop and `collapsable={false}` from `EntranceCard`**

Find:
```ts
function EntranceCard({
  index,
  playEntrance,
  zIndex,
  children,
}: {
  index: number;
  playEntrance: boolean;
  // Stacking order among the row's cards (see HandRow's selected-card comment). Applied here
  // because this Animated.View is the row's direct flex child — anything deeper sits inside
  // this card's own stacking context and can't reorder against sibling cards.
  zIndex?: number;
  children: React.ReactNode;
}) {
```
Replace with:
```ts
function EntranceCard({
  index,
  playEntrance,
  children,
}: {
  index: number;
  playEntrance: boolean;
  children: React.ReactNode;
}) {
```

Find:
```ts
  return (
    <Animated.View
      // Android silently drops zIndex-based sibling reordering when it flattens a plain view
      // into its parent's draw commands — collapsable={false} opts this view out of that
      // optimization so the zIndex above (which resolves overlapping-fan hit-test priority
      // between the selected card and its neighbors) actually takes effect on-device, not just
      // in the web/Playwright verification, which has no such flattening to begin with.
      collapsable={false}
      style={{
        zIndex,
        opacity: progress,
```
Replace with:
```ts
  return (
    <Animated.View
      style={{
        opacity: progress,
```

- [ ] **Step 4: Update the stale `handFanRow` comment**

Find:
```ts
  // No zIndex here (each row used to be its own stacking context) — removed so a selected
  // bottom-row card's SELECTED_CARD_Z_INDEX also wins against the top row's cards, satisfying
  // "in front of every other card," not just its own row.
  handFanRow: { flexDirection: "row", justifyContent: "center" },
```
Replace with:
```ts
  // No zIndex here — natural render order (top row's Views come before bottom row's in the
  // JSX) already makes a lifted bottom-row card paint over the top row on its own, with no
  // per-card override needed.
  handFanRow: { flexDirection: "row", justifyContent: "center" },
```

- [ ] **Step 5: Run the existing test suite**

Run: `npm test -- apps/mobile`
Expected: All existing tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "feat(batak): bigger selection lift, drop z-index front-stacking"
```

---

## Task 5: Extract reveal-origin geometry into shared `table/seating.ts`

**Files:**
- Modify: `apps/mobile/src/table/seating.ts`
- Modify: `apps/mobile/src/games/pisti/pistiSeating.ts`

**Interfaces:**
- Produces: `RevealOrigin` type, `revealOriginOffset(origin: RevealOrigin): { x: number; y: number }`, `resolveRevealOrigin(playerId: string, humanPlayerId: string, seats: Seat[]): RevealOrigin`, all now exported from `apps/mobile/src/table/seating.ts` (previously only from `apps/mobile/src/games/pisti/pistiSeating.ts`). Tasks 6, 7, 8, 9, 10 all import these from `../../table/seating` (or `./seating` from within `table/`).

- [ ] **Step 1: Add the reveal-origin geometry to `table/seating.ts`**

Append to the end of `apps/mobile/src/table/seating.ts`:
```ts

// The direction a played/dealt card visually travels from or to: an opponent seat's position, or
// 'bottom' for the human (who isn't part of the Seat[] array — always rendered separately).
// Shared by every game's deal-flight and play-travel animations (first use: Pişti's trick-reveal
// motion; second: the deal-flight overlay and Batak's own play-travel animation).
export type RevealOrigin = SeatPosition | "bottom";

// Fixed direction-based travel offsets (see
// docs/superpowers/specs/2026-07-10-pisti-trick-reveal-motion-design.md for the original
// rationale). Deliberately not measured from real seat layout (no onLayout) — a fixed offset per
// direction reads clearly as "came from/goes to that side" without new layout-measurement
// plumbing. Reused as a travel *destination* by the deal-flight overlay (Task 6), the mirror
// image of its original use as a travel *origin*.
const REVEAL_ORIGIN_OFFSETS: Record<RevealOrigin, { x: number; y: number }> = {
  top: { x: 0, y: -195 },
  bottom: { x: 0, y: 195 },
  left: { x: -165, y: 0 },
  right: { x: 165, y: 0 },
};

export function revealOriginOffset(origin: RevealOrigin): { x: number; y: number } {
  return REVEAL_ORIGIN_OFFSETS[origin];
}

// Resolves which direction a given seat travels from/to: the human is always 'bottom' (not part
// of `seats`); an AI seat not found in `seats` (shouldn't happen — every opponentPlayerId gets a
// seat) falls back to 'top', matching assignSeats' own single-opponent fallback.
export function resolveRevealOrigin(playerId: string, humanPlayerId: string, seats: Seat[]): RevealOrigin {
  if (playerId === humanPlayerId) return "bottom";
  const seat = seats.find((s) => s.playerId === playerId);
  return seat ? seat.position : "top";
}
```

- [ ] **Step 2: Replace `pistiSeating.ts`'s local definitions with re-exports**

Replace the entire contents of `apps/mobile/src/games/pisti/pistiSeating.ts` with:
```ts
// Pişti-specific seating additions: the generic "3 opponents at left/top/right, human at
// bottom" layout, fan/stack math, and directional travel-offset geometry now live in
// ../../table/seating (shared with Batak) and are re-exported here so existing imports of
// './pistiSeating' keep working unchanged. Only the genuinely Pişti-specific piece (team partner
// seat) stays local.

export {
  assignSeats,
  fillWidthMarginPx,
  revealOriginOffset,
  resolveRevealOrigin,
} from '../../table/seating';
export type { Seat, SeatPosition, RevealOrigin } from '../../table/seating';

// Index into the AI id list (aiIds[0..2], see PistiScreen.buildAiIds) that sits directly across
// the table from the human in the 3-opponent (4-player) layout — i.e. the "top" seat. In "with a
// partner" mode this is therefore always the human's partner, since there's only one human and
// partner geometry is unambiguous. assignSeats (above) and PistiScreen's buildTeams must agree
// on this index; exporting it as a constant keeps that invariant in one place instead of two.
export const PARTNER_SEAT_INDEX = 1;
```

- [ ] **Step 3: Run the existing test suite**

Run: `npm test -- apps/mobile`
Expected: All existing tests PASS, including `PistiTable.test.tsx` and anything importing `pistiSeating` — this is a pure refactor with identical runtime values (`resolveRevealOrigin`/`revealOriginOffset`'s behavior and `REVEAL_ORIGIN_OFFSETS`'s values are unchanged, just relocated).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/table/seating.ts apps/mobile/src/games/pisti/pistiSeating.ts
git commit -m "refactor: move reveal-origin travel geometry into shared table/seating"
```

---

## Task 6: Shared `DealFlightOverlay` + `useDealSequence` hook

**Files:**
- Create: `apps/mobile/src/hooks/useDealSequence.ts`
- Create: `apps/mobile/src/table/DealFlightOverlay.tsx`

**Interfaces:**
- Consumes: `RevealOrigin`, `revealOriginOffset` from `apps/mobile/src/table/seating.ts` (Task 5). `useReducedMotion` from `apps/mobile/src/components/useReducedMotion.ts`.
- Produces: `DealPhase = 'dealing' | 'revealing'` and `useDealSequence(): DealPhase` from `apps/mobile/src/hooks/useDealSequence.ts`. `DealFlightSeat = { origin: RevealOrigin; cardCount: number }` and `DealFlightOverlay({ seats: DealFlightSeat[] })` from `apps/mobile/src/table/DealFlightOverlay.tsx`. Tasks 7 and 8 both consume these.

- [ ] **Step 1: Write the shared `useDealSequence` hook**

Create `apps/mobile/src/hooks/useDealSequence.ts`:
```ts
import { useEffect, useState } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';

export type DealPhase = 'dealing' | 'revealing';

// Total time DealFlightOverlay's own per-seat/per-card timing needs to finish before the real
// hands appear — see DealFlightOverlay.tsx. Shared by every game using this hook, so the flight
// animation's internal constants are what's tuned for hand-size differences, not this duration.
const DEAL_FLIGHT_MS = 1700;

// Runs once per mount (i.e. once per hand — a fresh mount happens on every new deal, since each
// game's screen remounts its active-game subtree via key={sessionKey} on every "Play Again" /
// initial start), so no extra reset logic is needed: a new hand always gets a fresh deal sequence
// for free. Originally written for Batak only; now shared so Pişti doesn't reimplement the same
// reduced-motion-aware phase timing a second time.
export function useDealSequence(): DealPhase {
  const reducedMotion = useReducedMotion();
  const [dealPhase, setDealPhase] = useState<DealPhase>(reducedMotion ? 'revealing' : 'dealing');

  useEffect(() => {
    if (reducedMotion) {
      setDealPhase('revealing');
      return;
    }
    setDealPhase('dealing');
    const toRevealing = setTimeout(() => setDealPhase('revealing'), DEAL_FLIGHT_MS);
    return () => clearTimeout(toRevealing);
  }, [reducedMotion]);

  return dealPhase;
}
```

- [ ] **Step 2: Write the shared `DealFlightOverlay` component**

Create `apps/mobile/src/table/DealFlightOverlay.tsx`:
```tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { PlayingCard } from '@world-of-cards/ui';
import { revealOriginOffset } from './seating';
import type { RevealOrigin } from './seating';

export interface DealFlightSeat {
  // Direction this seat's cards fly toward (the same directional vectors play-travel animations
  // fly *from* — see ../table/seating's revealOriginOffset).
  origin: RevealOrigin;
  cardCount: number;
}

export interface DealFlightOverlayProps {
  // Seats in deal order (human first, then opponents in turn order) — see useDealSequence for
  // the total duration this is tuned to fit inside.
  seats: DealFlightSeat[];
}

const BLOCK_MS = 340;
const BLOCK_GAP_MS = 60;
const CARD_FLIGHT_MS = 220;
const MIN_CARD_STAGGER_MS = 15;

interface FlightCard {
  key: string;
  origin: RevealOrigin;
  delay: number;
}

function buildFlightCards(seats: DealFlightSeat[]): FlightCard[] {
  const cards: FlightCard[] = [];
  seats.forEach((seat, seatIndex) => {
    const blockStart = seatIndex * (BLOCK_MS + BLOCK_GAP_MS);
    const stagger = seat.cardCount > 1 ? Math.max(BLOCK_MS / seat.cardCount, MIN_CARD_STAGGER_MS) : 0;
    for (let i = 0; i < seat.cardCount; i += 1) {
      cards.push({
        key: `${seatIndex}-${i}`,
        origin: seat.origin,
        delay: blockStart + i * stagger,
      });
    }
  });
  return cards;
}

function FlyingCard({ origin, delay }: { origin: RevealOrigin; delay: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_FLIGHT_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, []);

  const target = revealOriginOffset(origin);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, target.x] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, target.y] }) },
          ],
        },
      ]}>
      <PlayingCard faceDown size="small" />
    </Animated.View>
  );
}

// No backdrop — the felt/table stays fully visible throughout, unlike the shuffle/cut overlay
// this replaces for Batak. Cards fly individually, straight-line, from the table center to each
// seat's directional offset, grouped into per-seat blocks in deal order with a fast per-card
// stagger inside each block (the "individual rapid-fire" style approved via the brainstorming
// visual companion, over a single-clustered-burst-per-player alternative). Renders its own
// absolute-fill View (not AbsoluteOverlay) because — like the overlay it replaces — it's meant to
// block interaction with the table underneath while a deal is in progress; it just no longer
// paints a dark backdrop while doing so.
export function DealFlightOverlay({ seats }: DealFlightOverlayProps) {
  const flightCards = useMemo(() => buildFlightCards(seats), [seats]);

  return (
    <View style={styles.overlay}>
      {flightCards.map((card) => (
        <FlyingCard key={card.key} origin={card.origin} delay={card.delay} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  card: { position: 'absolute' },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors. (No consumer exists yet — Tasks 7/8 wire this in — so there's nothing to exercise at runtime yet; typecheck is the only available verification for this task.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useDealSequence.ts apps/mobile/src/table/DealFlightOverlay.tsx
git commit -m "feat: add shared DealFlightOverlay + useDealSequence hook"
```

---

## Task 7: Wire the deal-flight animation into Batak

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`
- Delete: `apps/mobile/src/games/batak/DealAnimationOverlay.tsx`

**Interfaces:**
- Consumes: `useDealSequence`/`DealPhase` from `apps/mobile/src/hooks/useDealSequence.ts` (Task 6), `DealFlightOverlay`/`DealFlightSeat` from `apps/mobile/src/table/DealFlightOverlay.tsx` (Task 6), `resolveRevealOrigin` from `apps/mobile/src/table/seating.ts` (Task 5).
- Produces: `BatakTable`'s exported `BatakDealPhase` type becomes an alias for the shared `DealPhase` (`'dealing' | 'revealing'`, was `'shuffling' | 'cutting' | 'revealing'`) — `BatakScreen.tsx` is the only consumer and is updated in this same task.

- [ ] **Step 1: Replace Batak's local `useDealSequence` with the shared hook**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, find:
```ts
import React, { useEffect, useRef, useState } from 'react';
import type { Difficulty, PlayerId, RNG } from '@world-of-cards/engine';
import { createRng } from '@world-of-cards/engine';
import { batakDescriptor, BatakState, BatakMove } from '@world-of-cards/engine/games/batak';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { useAITurn } from '../../hooks/useAITurn';
import { useReducedMotion } from '../../components/useReducedMotion';
import { BatakSetupView } from './BatakSetupView';
import { BatakTable, BatakDealPhase, PendingBatakPlay } from './BatakTable';
import { BatakSettingsModal } from './BatakSettingsModal';
```
Replace with:
```ts
import React, { useEffect, useRef, useState } from 'react';
import type { Difficulty, PlayerId, RNG } from '@world-of-cards/engine';
import { createRng } from '@world-of-cards/engine';
import { batakDescriptor, BatakState, BatakMove } from '@world-of-cards/engine/games/batak';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { useAITurn } from '../../hooks/useAITurn';
import { useDealSequence } from '../../hooks/useDealSequence';
import { BatakSetupView } from './BatakSetupView';
import { BatakTable, PendingBatakPlay } from './BatakTable';
import { BatakSettingsModal } from './BatakSettingsModal';
```

(`useReducedMotion` is dropped from this file's imports entirely — it was only ever used inside the local `useDealSequence` hook being deleted below, and nothing else in `BatakScreen.tsx` references it.)

Find:
```ts
const SHUFFLE_MS = 1000;
const CUT_MS = 700;
const DEAL_PAUSE_MS = 1200;

// Runs once per ActiveGame mount (i.e. once per hand — a fresh mount happens on every
// startGame call, both the initial game and every "Play Again", via BatakScreen's
// key={sessionKey}), so no extra reset logic is needed here: a new hand always gets a fresh
// deal sequence for free.
function useDealSequence(): BatakDealPhase {
  const reducedMotion = useReducedMotion();
  const [dealPhase, setDealPhase] = useState<BatakDealPhase>(reducedMotion ? 'revealing' : 'shuffling');

  useEffect(() => {
    if (reducedMotion) {
      setDealPhase('revealing');
      return;
    }
    setDealPhase('shuffling');
    const toCutting = setTimeout(() => setDealPhase('cutting'), SHUFFLE_MS);
    const toRevealing = setTimeout(() => setDealPhase('revealing'), SHUFFLE_MS + CUT_MS + DEAL_PAUSE_MS);
    return () => {
      clearTimeout(toCutting);
      clearTimeout(toRevealing);
    };
  }, [reducedMotion]);

  return dealPhase;
}
```
Delete this whole block (the constants and the local hook) — `useDealSequence` is now imported from `../../hooks/useDealSequence` instead. The call site further down, `const dealPhase = useDealSequence();` inside `ActiveGame`, needs no changes — same name, same zero-argument call, same return usage.

- [ ] **Step 2: Swap Batak's deal overlay for the shared `DealFlightOverlay`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, find:
```ts
import { SelectableCard } from "../../components/SelectableCard";
import { useCardSelection } from "../../components/useCardSelection";
import { PlayerAvatar } from "../../components/PlayerAvatar";
import { useReducedMotion } from "../../components/useReducedMotion";
import { DealAnimationOverlay } from "./DealAnimationOverlay";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
} from "../../table/seating";
import type { Seat, SeatPosition } from "../../table/seating";
```
Replace with:
```ts
import { SelectableCard } from "../../components/SelectableCard";
import { useCardSelection } from "../../components/useCardSelection";
import { PlayerAvatar } from "../../components/PlayerAvatar";
import { useReducedMotion } from "../../components/useReducedMotion";
import { DealFlightOverlay } from "../../table/DealFlightOverlay";
import type { DealFlightSeat } from "../../table/DealFlightOverlay";
import type { DealPhase } from "../../hooks/useDealSequence";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
  resolveRevealOrigin,
} from "../../table/seating";
import type { Seat, SeatPosition } from "../../table/seating";
```

Find:
```ts
export type BatakDealPhase = "shuffling" | "cutting" | "revealing";
```
Replace with:
```ts
export type BatakDealPhase = DealPhase;
```

Find (inside the `BatakTable` component, right after `const seats = assignSeats(opponentPlayerIds);`):
```ts
  const seats = assignSeats(opponentPlayerIds);
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
```
Replace with:
```ts
  const seats = assignSeats(opponentPlayerIds);
  // Deal order: human first, then opponents in existing turn order (right, top, left for the
  // fixed 4-player table) — see docs/superpowers/specs/2026-07-17-batak-deal-selection-and-
  // trick-motion-polish-design.md section D2. Card counts come from the real dealt hand size,
  // not a hardcoded 13, so this stays correct if hand size ever varies (e.g. the gömmeli variant).
  const dealSeats: DealFlightSeat[] = [
    { origin: "bottom", cardCount: state.table.zones[`hand-${humanPlayerId}`].cards.length },
    ...opponentPlayerIds.map((playerId) => ({
      origin: resolveRevealOrigin(playerId, humanPlayerId, seats),
      cardCount: state.table.zones[`hand-${playerId}`].cards.length,
    })),
  ];
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
```

Find:
```ts
      {dealPhase !== "revealing" && <DealAnimationOverlay phase={dealPhase} />}
```
Replace with:
```ts
      {dealPhase !== "revealing" && <DealFlightOverlay seats={dealSeats} />}
```

- [ ] **Step 3: Delete the old overlay file**

Delete `apps/mobile/src/games/batak/DealAnimationOverlay.tsx`.

- [ ] **Step 4: Run the existing test suite**

Run: `npm test -- apps/mobile`
Expected: All existing tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/batak/BatakScreen.tsx apps/mobile/src/games/batak/BatakTable.tsx
git rm apps/mobile/src/games/batak/DealAnimationOverlay.tsx
git commit -m "feat(batak): swap the shuffle/cut deal overlay for the shared deal-flight animation"
```

---

## Task 8: Wire the deal-flight animation into Pişti

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiScreen.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiTable.test.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiScreen.test.tsx`

**Interfaces:**
- Consumes: `useDealSequence`/`DealPhase` (Task 6), `DealFlightOverlay`/`DealFlightSeat` (Task 6), `resolveRevealOrigin` (Task 5, already re-exported from `./pistiSeating`).
- Produces: `PistiTableProps` gains a required `dealPhase: DealPhase` field.

- [ ] **Step 1: Wire `useDealSequence` into `PistiScreen.tsx`**

Find:
```ts
import { PistiSetupView, PistiPlayerCount, PistiFourPlayerMode } from './PistiSetupView';
import { PistiTable } from './PistiTable';
import { useAITurn } from '../../hooks/useAITurn';
import { PARTNER_SEAT_INDEX } from './pistiSeating';
```
Replace with:
```ts
import { PistiSetupView, PistiPlayerCount, PistiFourPlayerMode } from './PistiSetupView';
import { PistiTable } from './PistiTable';
import { useAITurn } from '../../hooks/useAITurn';
import { useDealSequence } from '../../hooks/useDealSequence';
import { PARTNER_SEAT_INDEX } from './pistiSeating';
```

Find (inside `ActiveGame`):
```ts
function ActiveGame({ difficulty, aiIds, teams, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [revealedMove, setRevealedMove] = useState<RevealedMove | null>(null);
```
Replace with:
```ts
function ActiveGame({ difficulty, aiIds, teams, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [revealedMove, setRevealedMove] = useState<RevealedMove | null>(null);
  const dealPhase = useDealSequence();
```

Find:
```ts
      <PistiTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
        onPlayCard={handlePlayCard}
        bannerText={bannerText}
        revealCard={revealedMove ? { card: revealedMove.card, playerId: revealedMove.playerId } : null}
      />
```
Replace with:
```ts
      <PistiTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
        onPlayCard={handlePlayCard}
        bannerText={bannerText}
        revealCard={revealedMove ? { card: revealedMove.card, playerId: revealedMove.playerId } : null}
        dealPhase={dealPhase}
      />
```

- [ ] **Step 2: Add `dealPhase` to `PistiTableProps` and thread it through opponent seats**

In `apps/mobile/src/games/pisti/PistiTable.tsx`, find:
```ts
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
```
Replace with:
```ts
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
import { DealFlightOverlay } from '../../table/DealFlightOverlay';
import type { DealFlightSeat } from '../../table/DealFlightOverlay';
import type { DealPhase } from '../../hooks/useDealSequence';
```

Find:
```ts
export interface PistiTableProps {
  state: PistiState;
  humanPlayerId: string;
  // Ordered opponent seats: 1 entry seats them at the top (2-player table), 3 entries seat
  // them left/top/right around the human (4-player table).
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  onPlayCard: (cardId: string) => void;
  bannerText?: string | null;
  revealCard?: PistiRevealCard | null;
}
```
Replace with:
```ts
export interface PistiTableProps {
  state: PistiState;
  humanPlayerId: string;
  // Ordered opponent seats: 1 entry seats them at the top (2-player table), 3 entries seat
  // them left/top/right around the human (4-player table).
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  onPlayCard: (cardId: string) => void;
  bannerText?: string | null;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
}
```

Find:
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
```
Replace with:
```ts
interface OpponentSeatProps {
  seat: Seat;
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  // Measured height of the middle row (see PistiTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentSeat({ seat, state, playerNames, revealCard, dealPhase, sideStackHeight }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  // No face-down cards render until the deal-flight animation finishes, so the opponent's hand
  // doesn't pop in ahead of the cards that are still visually traveling toward them.
  const count = dealPhase !== 'revealing' ? 0 : Math.max(isRevealing ? hand.length - 1 : hand.length, 0);
```

Find:
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
Replace with:
```ts
function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  revealCard,
  dealPhase,
  sideStackHeight,
}: {
  position: Seat['position'];
  seats: Seat[];
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
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
            dealPhase={dealPhase}
            sideStackHeight={sideStackHeight}
          />
        ))}
    </>
  );
}
```

- [ ] **Step 3: Gate the human hand row on `dealPhase`, thread `dealPhase` into every `OpponentSeatGroup` call, and render the overlay**

Find:
```ts
export function PistiTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  onPlayCard,
  bannerText,
  revealCard,
}: PistiTableProps) {
```
Replace with:
```ts
export function PistiTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  onPlayCard,
  bannerText,
  revealCard,
  dealPhase,
}: PistiTableProps) {
```

Find (three call sites — top, left, right — each currently missing `dealPhase`):
```ts
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        revealCard={revealCard}
        sideStackHeight={middleRowHeight}
      />
```
Replace with:
```ts
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        revealCard={revealCard}
        dealPhase={dealPhase}
        sideStackHeight={middleRowHeight}
      />
```

Find:
```ts
        <OpponentSeatGroup
          position="left"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          sideStackHeight={middleRowHeight}
        />
```
Replace with:
```ts
        <OpponentSeatGroup
          position="left"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          dealPhase={dealPhase}
          sideStackHeight={middleRowHeight}
        />
```

Find:
```ts
        <OpponentSeatGroup
          position="right"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          sideStackHeight={middleRowHeight}
        />
```
Replace with:
```ts
        <OpponentSeatGroup
          position="right"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          dealPhase={dealPhase}
          sideStackHeight={middleRowHeight}
        />
```

Find (right where `middleRowHeight` is set up, just before the `return`):
```ts
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }

  return (
```
Replace with:
```ts
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }

  // Deal order: human first, then opponents in existing turn order. Card counts come from the
  // real dealt hand size, not a hardcoded 4, so this stays correct for both the 2-player and
  // 4-player table.
  const dealSeats: DealFlightSeat[] = [
    { origin: 'bottom', cardCount: state.table.zones[`hand-${humanPlayerId}`].cards.length },
    ...opponentPlayerIds.map((playerId) => ({
      origin: resolveRevealOrigin(playerId, humanPlayerId, seats),
      cardCount: state.table.zones[`hand-${playerId}`].cards.length,
    })),
  ];

  return (
```

Find:
```ts
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handRow} testID="human-hand">
          {humanHand.map((card) => (
            // Off-turn "not tappable" styling comes from SelectableCard's own disabled scrim now
            // (a dark overlay keeping the card art fully visible), replacing the old 0.5-opacity
            // wrapper — keeping both would double-dim the hand.
            <View key={card.id}>
              <SelectableCard
                card={card}
                selected={selectedCardId === card.id}
                disabled={!isHumanInteractive}
                onPress={() => selectCard(card.id)}
              />
            </View>
          ))}
        </View>
        <PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} capturedCount={capturedHuman} active={isHumanTurn} isHuman />
      </View>
    </View>
  );
}
```
Replace with:
```ts
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handRow} testID="human-hand">
          {dealPhase === 'revealing' &&
            humanHand.map((card) => (
              // Off-turn "not tappable" styling comes from SelectableCard's own disabled scrim
              // now (a dark overlay keeping the card art fully visible), replacing the old
              // 0.5-opacity wrapper — keeping both would double-dim the hand.
              <View key={card.id}>
                <SelectableCard
                  card={card}
                  selected={selectedCardId === card.id}
                  disabled={!isHumanInteractive}
                  onPress={() => selectCard(card.id)}
                />
              </View>
            ))}
        </View>
        <PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} capturedCount={capturedHuman} active={isHumanTurn} isHuman />
      </View>
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
    </View>
  );
}
```

- [ ] **Step 4: Update `PistiTable.test.tsx` to pass the new required prop**

In `apps/mobile/src/games/pisti/PistiTable.test.tsx`, every `<PistiTable .../>` render needs `dealPhase="revealing"` (the tests exercise interactive/rendered hand state, which only exists once dealing has finished).

Find each of these six single-line occurrences and add ` dealPhase="revealing"` right before the closing `/>`:
```ts
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={() => {}} />);
```
(appears twice, lines 47 and 53) — replace both with:
```ts
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={() => {}} dealPhase="revealing" />);
```

Find (appears three times, lines 60, 67, 75 — identical text):
```ts
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} />);
```
Replace all three with:
```ts
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} dealPhase="revealing" />);
```

Find:
```ts
    await render(<PistiTable state={makeState(1)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} />);
```
Replace with:
```ts
    await render(<PistiTable state={makeState(1)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} dealPhase="revealing" />);
```

Find:
```ts
    await render(
      <PistiTable
        state={makeState(0)}
        humanPlayerId="human"
        opponentPlayerIds={['ai']}
        playerNames={PLAYER_NAMES}
        onPlayCard={() => {}}
        bannerText="Pişti! +10"
      />
    );
```
Replace with:
```ts
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
```

- [ ] **Step 5: Advance fake timers past the deal-flight window in `PistiScreen.test.tsx`**

`PistiScreen.test.tsx` uses `jest.useFakeTimers()` and both existing tests assert the human hand has 4 cards immediately after the difficulty picker is dismissed — before this task, hands rendered immediately, so no timer advance was needed for that assertion. With `dealPhase` now starting at `'dealing'` and only flipping to `'revealing'` after `DEAL_FLIGHT_MS` (1700ms, from Task 6's `useDealSequence`), these assertions would see an empty hand under fake timers unless time is explicitly advanced first.

Find (first test):
```ts
  it('shows a difficulty picker, then the table with 4 cards in each hand after a difficulty is chosen', async () => {
    await render(<PistiScreen onExitToHome={() => {}} />);
    expect(screen.getByText('Choose a difficulty')).toBeTruthy();

    await fireEvent.press(screen.getByText('Medium'));

    expect(await screen.findByText('Pişti')).toBeTruthy();
    const humanHand = within(screen.getByTestId('human-hand')).getAllByTestId('playing-card-face');
    expect(humanHand).toHaveLength(4);
  });
```
Replace with:
```ts
  it('shows a difficulty picker, then the table with 4 cards in each hand after a difficulty is chosen', async () => {
    await render(<PistiScreen onExitToHome={() => {}} />);
    expect(screen.getByText('Choose a difficulty')).toBeTruthy();

    await fireEvent.press(screen.getByText('Medium'));

    expect(await screen.findByText('Pişti')).toBeTruthy();
    // Hands stay hidden until the deal-flight animation finishes (see useDealSequence's
    // DEAL_FLIGHT_MS) — advance past it before asserting on hand contents.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1700);
    });
    const humanHand = within(screen.getByTestId('human-hand')).getAllByTestId('playing-card-face');
    expect(humanHand).toHaveLength(4);
  });
```

Find (second test):
```ts
  it('plays a human card, then automatically lets the AI take its turn', async () => {
    await render(<PistiScreen onExitToHome={() => {}} />);
    await fireEvent.press(screen.getByText('Easy'));
    await screen.findByText('Pişti');

    const humanHand = () => within(screen.getByTestId('human-hand')).getAllByTestId('playing-card-face');
    expect(humanHand()).toHaveLength(4);
```
Replace with:
```ts
  it('plays a human card, then automatically lets the AI take its turn', async () => {
    await render(<PistiScreen onExitToHome={() => {}} />);
    await fireEvent.press(screen.getByText('Easy'));
    await screen.findByText('Pişti');
    // Hands stay hidden until the deal-flight animation finishes (see useDealSequence's
    // DEAL_FLIGHT_MS) — advance past it before asserting on hand contents.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1700);
    });

    const humanHand = () => within(screen.getByTestId('human-hand')).getAllByTestId('playing-card-face');
    expect(humanHand()).toHaveLength(4);
```

- [ ] **Step 6: Run the existing test suite**

Run: `npm test -- apps/mobile`
Expected: All existing tests PASS, including every updated `PistiTable.test.tsx` case (they now render with `dealPhase="revealing"`, so hand/opponent rendering behaves exactly as it did before this task) and both updated `PistiScreen.test.tsx` cases.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiScreen.tsx apps/mobile/src/games/pisti/PistiTable.tsx apps/mobile/src/games/pisti/PistiTable.test.tsx apps/mobile/src/games/pisti/PistiScreen.test.tsx
git commit -m "feat(pisti): add the deal-flight animation (Pişti had no deal animation before)"
```

---

## Task 9: Batak play-travel animation (every play, cross-overlap slots, play-order stacking)

**Files:**
- Create: `apps/mobile/src/table/travelAnimation.ts`
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `revealOriginOffset`, `resolveRevealOrigin`, `RevealOrigin`, `SeatPosition` from `apps/mobile/src/table/seating.ts` (Task 5).
- Produces: `CARD_TRAVEL_DURATION_MS`, `CARD_TRAVEL_EASING` from `apps/mobile/src/table/travelAnimation.ts` — Task 10 (Pişti) also consumes these.

- [ ] **Step 1: Create the shared travel-animation timing constants**

Create `apps/mobile/src/table/travelAnimation.ts`:
```ts
import { Easing } from 'react-native';

// Shared timing for every "played card travels from its origin seat to its resting spot"
// animation across every game (Pişti's pile RevealCard, Batak's trick TravelCard) — kept
// separate from DealFlightOverlay's own faster per-card timing, which is a deliberately
// different, much quicker "rapid-fire dealt cards" motion, not a single deliberate play. One
// shared constant here means tuning the play-travel feel once updates every consumer instead of
// the two games drifting apart from each other.
export const CARD_TRAVEL_DURATION_MS = 530;
export const CARD_TRAVEL_EASING = Easing.out(Easing.cubic);
```

- [ ] **Step 2: Extend staging to every play, not just the trick-completing 4th card**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, find:
```ts
// Pause before a trick-completing 4th play actually commits, so the full 4-card trick is
// readable before it sweeps to the winner's pile. batakGame.performMove resolves a completed
// trick atomically (computes the winner and sweeps to won-<winner> within one call), so without
// this pause the UI would show the 4th card appear and the whole trick vanish in the same
// instant, with no way to see what everyone played.
const TRICK_COMPLETION_PAUSE_MS = 1100;
```
Replace with:
```ts
// Pause before a trick-completing 4th play actually commits, so the full 4-card trick is
// readable before it sweeps to the winner's pile. batakGame.performMove resolves a completed
// trick atomically (computes the winner and sweeps to won-<winner> within one call), so without
// this pause the UI would show the 4th card appear and the whole trick vanish in the same
// instant, with no way to see what everyone played.
const TRICK_COMPLETION_PAUSE_MS = 1100;
// Pause before a non-trick-completing play (1st-3rd card of a trick) commits, giving the new
// play-travel animation (BatakTable's TrickCenter) time to finish before the card's resting state
// takes over — roughly matches CARD_TRAVEL_DURATION_MS (apps/mobile/src/table/travelAnimation.ts).
const PLAY_TRAVEL_DELAY_MS = 300;
```

Find:
```ts
  function commitMove(move: BatakMove, playerId: PlayerId) {
    // Only a card play can be the trick-completing 4th card; bid/pass/selectTrump never need
    // staging since engine state already reflects them visibly with nothing to bridge.
    if (move.type === 'play' && state.currentTrick.length === 3) {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      setPendingPlay({ playerId, card });
      pendingTimeoutRef.current = setTimeout(() => {
        performMove(move);
        setPendingPlay(null);
      }, TRICK_COMPLETION_PAUSE_MS);
      return;
    }
    performMove(move);
  }
```
Replace with:
```ts
  function commitMove(move: BatakMove, playerId: PlayerId) {
    // Every card play now gets staged (not just the trick-completing 4th) so the new play-travel
    // animation has something to animate from for every play; bid/pass/selectTrump still commit
    // instantly since engine state already reflects them visibly with nothing to bridge.
    if (move.type === 'play') {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      const delay = state.currentTrick.length === 3 ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
      setPendingPlay({ playerId, card });
      pendingTimeoutRef.current = setTimeout(() => {
        performMove(move);
        setPendingPlay(null);
      }, delay);
      return;
    }
    performMove(move);
  }
```

- [ ] **Step 3: Filter the pending card out of the human's rendered hand**

Every play is now staged, so a human play would otherwise show the same card twice for up to `PLAY_TRAVEL_DELAY_MS` — once still sitting in the (now non-interactive) hand, once traveling to the trick center. Pişti already solves this for its own hand (`humanHand = ...filter(...)`); Batak needs the same fix.

In `apps/mobile/src/games/batak/BatakTable.tsx`, find:
```ts
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const sortedHand = sortHandForDisplay(humanHand);
```
Replace with:
```ts
  const isPendingHuman = pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) => !(isPendingHuman && card.id === pendingPlay!.card.id)
  );
  const sortedHand = sortHandForDisplay(humanHand);
```

- [ ] **Step 4: Rewrite `TrickCenter` — cross-overlap slot positions, travel animation, play-order stacking**

In `apps/mobile/src/games/batak/BatakTable.tsx`, find the imports block from Task 7 and extend it:
```ts
import { DealFlightOverlay } from "../../table/DealFlightOverlay";
import type { DealFlightSeat } from "../../table/DealFlightOverlay";
import type { DealPhase } from "../../hooks/useDealSequence";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
  resolveRevealOrigin,
} from "../../table/seating";
import type { Seat, SeatPosition } from "../../table/seating";
```
Replace with:
```ts
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

(No change needed to the `react-native` import at the top of the file — `TravelCard` below uses the shared `CARD_TRAVEL_EASING` constant from `travelAnimation.ts`, not `Easing` directly, so `Easing` itself doesn't need to be imported into this file.)

Find the entire `TrickCenter` function:
```ts
function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}) {
  function cardFor(playerId: string): Card | null {
    if (pendingPlay != null && pendingPlay.playerId === playerId)
      return pendingPlay.card;
    const entry = state.currentTrick.find(t => t.playerId === playerId);
    if (!entry) return null;
    return (
      state.table.zones["trick"].cards.find(c => c.id === entry.cardId) ?? null
    );
  }

  function slotFor(position: "bottom" | SeatPosition) {
    const playerId =
      position === "bottom"
        ? humanPlayerId
        : seats.find(s => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    return (
      <View style={styles.trickSlot} testID={`trick-slot-${position}`}>
        {card ? <PlayingCard card={card} size="small" /> : null}
      </View>
    );
  }

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
        <View style={styles.trickTopRow}>{slotFor("top")}</View>
        <View style={styles.trickMiddleRow}>
          {slotFor("left")}
          {slotFor("bottom")}
          {slotFor("right")}
        </View>
      </View>
    </View>
  );
}
```
Replace with:
```ts
type TrickPosition = "bottom" | SeatPosition;

// Resting offset from dead-center for each seat's slot — small enough (vs. the ~165-195px
// travel-origin offsets below) that adjacent slots' card rectangles overlap slightly at their
// inner corners ("loose, corner-touching" per the brainstorming visual companion mockup, chosen
// over a tighter ~40%-overlap alternative). First-pass values sized against the 'small' card's
// 54x86 dimensions (see PlayingCard's CARD_DIMS) — confirm via screenshot in the final
// verification pass.
const TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = {
  top: { x: 0, y: -38 },
  bottom: { x: 0, y: 38 },
  left: { x: -30, y: 0 },
  right: { x: 30, y: 0 },
};

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

function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}) {
  function cardFor(playerId: string): Card | null {
    if (pendingPlay != null && pendingPlay.playerId === playerId)
      return pendingPlay.card;
    const entry = state.currentTrick.find(t => t.playerId === playerId);
    if (!entry) return null;
    return (
      state.table.zones["trick"].cards.find(c => c.id === entry.cardId) ?? null
    );
  }

  // Play order across both already-committed cards and the still-animating pendingPlay (always
  // the newest) — drives each slot's zIndex so the most recently played card renders on top of
  // earlier ones regardless of which seat played it. Trick slots are seat-fixed (TRICK_SLOT_OFFSETS
  // above), so without this the overlap stacking would silently depend on seat position instead
  // of when each card actually arrived.
  const playOrder: string[] = [
    ...state.currentTrick.map(t => t.playerId),
    ...(pendingPlay ? [pendingPlay.playerId] : []),
  ];

  function slotFor(position: TrickPosition) {
    const playerId =
      position === "bottom"
        ? humanPlayerId
        : seats.find(s => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    const isPending = playerId != null && pendingPlay != null && pendingPlay.playerId === playerId;
    const zIndex = playerId ? Math.max(playOrder.indexOf(playerId) + 1, 1) : 1;
    const offset = TRICK_SLOT_OFFSETS[position];

    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        style={[
          styles.trickSlot,
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            <TravelCard card={card} origin={resolveRevealOrigin(playerId!, humanPlayerId, seats)} />
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
      </View>
    );
  }

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
        {(["top", "left", "bottom", "right"] as TrickPosition[]).map(slotFor)}
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Update the trick-cross styles for absolute positioning**

Find:
```ts
  trickCross: { alignItems: "center", gap: 8 },
  trickTopRow: { flexDirection: "row", justifyContent: "center" },
  trickMiddleRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  trickSlot: {
    minWidth: 54,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
  },
```
Replace with:
```ts
  // Fixed-size relative box (RN Views are relatively-positioned by default) so the 4 absolutely-
  // positioned trickSlot children can be offset from a shared center point — see
  // TRICK_SLOT_OFFSETS. Sized generously around the small card's 54x86 footprint plus the loose
  // cross-overlap offsets; confirm via screenshot in the final verification pass.
  trickCross: { width: 150, height: 180, alignSelf: "center" },
  trickSlot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -27,
    marginTop: -43,
    width: 54,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
  },
```

- [ ] **Step 6: Run the existing test suite**

Run: `npm test -- apps/mobile`
Expected: All existing tests PASS (no test exercises `BatakTable`'s `TrickCenter` directly).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/table/travelAnimation.ts apps/mobile/src/games/batak/BatakScreen.tsx apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "feat(batak): add play-travel animation with cross-overlap slots and play-order stacking"
```

---

## Task 10: Align Pişti's play-travel animation to the shared timing constants

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`

**Interfaces:**
- Consumes: `CARD_TRAVEL_DURATION_MS`, `CARD_TRAVEL_EASING` from `apps/mobile/src/table/travelAnimation.ts` (Task 9).

- [ ] **Step 1: Point `RevealCard`'s animation at the shared constants instead of its local literal**

Find:
```ts
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
```
Replace with:
```ts
import {
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
```
(`Easing` is dropped from this import — after Step 2 below, nothing in this file references it directly anymore, only the shared constant does.)

Find:
```ts
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
```
Replace with:
```ts
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from '../../table/travelAnimation';
```

Find:
```ts
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 530,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
```
Replace with:
```ts
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
    }).start();
```

This is a no-op behavior change (`CARD_TRAVEL_DURATION_MS` is `530`, matching the literal it replaces) — it only moves the source of truth so Pişti and Batak can't silently drift apart on this constant in the future.

- [ ] **Step 2: Run the existing test suite**

Run: `npm test -- apps/mobile`
Expected: All existing tests PASS.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "refactor(pisti): share play-travel timing constants with Batak"
```

---

## Task 11: Full regression check + manual visual verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: Every existing suite across `packages/engine`, `packages/ui`, and `apps/mobile` PASSES — no game-logic files were touched in this plan, so this should be a clean no-op check.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: No errors in any package.

- [ ] **Step 3: Manual browser/Playwright visual verification**

Done directly (not via subagent — requires visual judgment), using the existing `react-native-web` + `playwright-core` workflow this project already relies on for visual checks (no native device access in this environment). Start the web build (`apps/mobile`: `expo start --web`), screenshot and interact through:

1. **Card back** (both games): confirm the `middle-lighted.png` art renders on every face-down card, no console errors.
2. **Corner index tightness**: several ranks including "10", at both `normal` and `small` size — confirm rank/suit sit close to the edge without clipping into the card's border ring.
3. **Card aspect ratio**: confirm cards read visibly taller without looking stretched or breaking any existing layout (hand rows, trick slots, opponent stacks) at both sizes.
4. **Batak two-row hand**: a full 13-card hand (6 top / 7 bottom) and a shrunk mid-game hand, confirming the split and re-balancing.
5. **Batak deal sequence**: confirm no dark backdrop, the you→right→top→left order, and a total duration in the ~1.5-2s range.
6. **Batak card selection**: select a card in each row — confirm the larger lift, and that a selected bottom-row card visually overlaps in front of the top row with no other z-index weirdness; confirm no stray-tap misfires near row boundaries.
7. **Batak trick play**: play a few tricks (human and AI) — confirm each card travels in a straight line from its seat's direction, lands in the loose corner-touching cross layout, and that the most-recently-played card visibly renders on top regardless of seat.
8. **Pişti deal sequence**: confirm the new animation plays for both 2-player and 4-player setups.
9. **Pişti play-travel**: play a card — confirm the existing pile-travel motion still looks correct and now uses the shared timing.

- [ ] **Step 4: Fix anything found**

If any of the first-pass constants (corner inset, `TRICK_SLOT_OFFSETS`, `trickCross` dimensions, deal-flight timing) look wrong on screen, adjust them directly in the relevant file from Tasks 1/9/6 and re-screenshot to confirm, following this codebase's established "tuned by eye, confirmed via screenshot" practice for exactly these kinds of constants.

- [ ] **Step 5: Final commit (only if Step 4 required changes)**

```bash
git add -u
git commit -m "polish: tune deal/selection/trick-motion constants after visual verification"
```

If Step 4 required no changes, skip this step — there's nothing to commit.
