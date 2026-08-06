# Pişti Hand-Fan Gesture Migration — Design Spec

**Status:** Approved (2026-08-06)

## Context

Pişti's human hand (`SelectableCard.tsx`/`AnimatedHandCard` in `PistiTable.tsx`) is tap-to-select-then-tap-to-play, built on RN core `Pressable` and the classic touch responder system. `DeselectableSurface.tsx` (the shared table-root "tap elsewhere to deselect" wrapper for both games) became a `react-native-gesture-handler` `GestureDetector`/`Gesture.Tap()` in an earlier Batak migration (`c20a92b`), so it could correctly arbitrate against Batak's own `Gesture.Tap()`-based hand cards.

That combination broke Pişti: a selected card's confirming second tap relies on RN core `Pressable`'s `hitSlop` to cover the visual lift (the card's real, laid-out touch box never moves — only its `transform` does). RNGH's native recognizer has no visibility into that `hitSlop`, purely-classic-responder concept, so the tap lands in DeselectableSurface's territory instead and silently deselects the card rather than playing it. Two narrower patches were tried and both failed on-device (confirmed on both an Android emulator and a real device):

1. Swapping to RNGH's own `Pressable` — this just made the card a second, sibling RNGH gesture racing the ancestor `Gesture.Tap()` with no declared priority relationship, which RNGH doesn't resolve in the descendant's favor automatically the way it does for a classic RN `Pressable`.
2. Giving the card's classic `Pressable` a real (not virtual-`hitSlop`) touch target permanently sized to cover the lift — still didn't fix it on-device, and RNGH's own arbitration against `DeselectableSurface` remained an unproven combination for a plain classic `Pressable` descendant either way.

Batak's hand (`HumanHandFan.tsx`/`BatakHandCard.tsx`, Reanimated + `Gesture.Tap()` throughout) coexists correctly with `DeselectableSurface`'s `Gesture.Tap()` ancestor today — this is direct, working evidence that same-kind nested RNGH gestures arbitrate fine, and the real fix is to stop mixing gesture systems on this screen rather than patch the mismatch again.

**Explicitly out of scope:** any change to opponent-seat rendering (face-down stacks are never tappable, untouched), Batak's own files beyond a mechanical, behavior-preserving relocation (see §1), and the trick-center resize feature from `2026-08-05-batak-trick-resize-design.md` (Pişti's pile doesn't need a resize).

## 1. File layout

**New shared files** (`apps/mobile/src/table/`):
- `useCardMotion.ts` — moved from `apps/mobile/src/games/batak/table/useBatakCardMotion.ts` verbatim (same `x`/`y`/`angleDeg`/`scale` shared-value API via `setTarget`/`getValues`). Already fully game-agnostic despite its old name/location. `BatakHandCard.tsx` updates its import path only — no behavior change.
- `railFan.ts` — moved from `apps/mobile/src/games/batak/table/batakRailFan.ts`'s pure functions (`RailAngleConfig`, `railAngleStepDeg`, `railAngles`, `RailPosition`, `railPosition`). Batak's `STANDARD_RAIL_CONFIG`/`COMPACT_RAIL_CONFIG` constants (Batak's own tuning, not generic) stay in `batakRailFan.ts`, which now just imports `RailAngleConfig` from the shared module.

**New Pişti-owned files** (`apps/mobile/src/games/pisti/table/`):
- `pistiRailFan.ts` — Pişti's own single `RailAngleConfig` constant (`PISTI_RAIL_CONFIG`, §2), built on the shared `railFan.ts` math. No `compact` variant — Pişti's hand never exceeds 4 cards.
- `PistiHandFan.tsx` — single-row analog of `HumanHandFan.tsx`: no two-row imbrication math, no `compact` prop, no local-departure leg (§4). Exposes a `handFanRef`/`onHandFanLayout` pair for play-travel origin measurement (§3).
- `PistiHandCard.tsx` — single-row analog of `BatakHandCard.tsx`: its own `Gesture.Tap()`/entrance/selection-lift logic (imports the shared `useCardMotion` hook directly rather than through a Pişti-specific wrapper, since the hook needs no wrapping). No `enterFromOffset` prop — Pişti has no gömmeli-bury equivalent.

**Changed existing files:**
- `PistiTable.tsx` — replaces `AnimatedHandCard`/`SelectableCard` usage with `PistiHandFan`; replaces the bespoke `RevealCard` component with the shared `TravelCard` (§4); pile rendering gains persisted per-card rotation (§4).
- `PistiScreen.tsx` — `PistiRevealCard` gains `originRotateDeg?: number`; adds `pileRestingRotations` state (§4).
- `DeselectableSurface.tsx` — keeps the `collapsable={false}` fix already made this session (Android view-flattening safety for `GestureDetector`'s target view — independently correct regardless of this migration).
- `SelectableCard.tsx` — deleted once Pişti's hand no longer uses it (its only remaining consumer). `useCardSelection.ts` (the two-tap state machine) is pure state with no RN/`Pressable` dependency — reused unchanged.

## 2. Hand fan geometry

Same math as Batak (`radius`/`overlap`/`arcDegrees`/`maxRotationDeg`/`spacingPx` → per-card angle → x/y/rotation on a circle) as a **single row** — no imbrication, no compact variant.

Starting `PISTI_RAIL_CONFIG` (a picked starting point, not device-tuned — no dedicated Playground tuning tool this round, per explicit decision):
```ts
export const PISTI_RAIL_CONFIG: RailAngleConfig = {
  radius: 320,
  overlap: 0.5,
  arcDegrees: 36,
  maxRotationDeg: 20,
  spacingPx: 120,
};
```
`radius`/`spacingPx` match Batak's `STANDARD_RAIL_CONFIG` (same physical card size). `arcDegrees`/`maxRotationDeg` are much smaller than Batak's 60°/45° — that arc is tuned for up to 13 fanned cards; Pişti's hand tops out at 4, so the same arc would look absurdly splayed. These values are a starting point, adjustable by eye once running on a real device — no separate tuning tool this round.

Selection lift distance: `24px` (between Pişti's old flat `DEFAULT_LIFT_DISTANCE` of 16 and Batak's `SELECTED_LIFT_DISTANCE` of 40), pushed outward along the card's own rail angle exactly like Batak's lift.

## 3. Touch & selection

- `useCardSelection.ts` is unchanged — `PistiHandFan`/`PistiHandCard` wire into it exactly the way `AnimatedHandCard`/`SelectableCard` do today (first tap selects, tapping the already-selected card plays it).
- `PistiHandCard.tsx` uses `Gesture.Tap()` + `GestureDetector`, mirroring `BatakHandCard.tsx` — this is the actual fix for the playability bug (§ Context), proven by Batak already working this way against the same `DeselectableSurface` ancestor.
- `DeselectableSurface.tsx` needs no change beyond the `collapsable={false}` fix already made this session.
- **Play-travel origin measurement uses the corrected pattern from the start**: `PistiHandFan` exposes its own container via `handFanRef`/`onHandFanLayout`, the same way `HumanHandFan.tsx`'s *current* version does (measuring its own container directly) — not the older pattern Pişti's existing `handRowRef`/`handRowCenter` code uses (which measures a different ancestor). This sidesteps, from day one, the same bug class that was root-caused and fixed for Batak earlier this session (`3939928`, missing absolute-Y conversion term).

## 4. Play-travel & pile landing

- **`RevealCard` is retired in favor of the shared `TravelCard`** (`apps/mobile/src/table/TravelCard.tsx`), which already supports everything needed: `originRotateDeg` (holds a fixed angle for the whole flight, for the human's landing angle) and `originScale`/`restScale` (both left at their default `1` — no resize). `TravelCard` always animates to its own local `(0, 0)`, so the pile-slot destination offset moves from being baked into the origin/destination interpolation (today's `RevealCard` shape) to an outer positioned wrapper (mirroring `TrickCenter.tsx`'s `trickSlot` pattern). The "You played"/"X played" label moves to a sibling `<Text>`, since `TravelCard` only renders `children`.
- **`PistiRevealCard`** gains `originRotateDeg?: number`, computed by `PistiHandFan`'s play handler the same way Batak's `handCardRotationDeg` computes a tapped card's fan angle from its index/row-count. Threaded through `onPlayCard(cardId, originOffset, originRotateDeg)` → `PistiScreen.tsx`'s `handlePlayCard` → `revealThenCommit` → `RevealedMove` → `PistiRevealCard`. AI plays never set it (no rendered AI hand card to derive an angle from), defaulting to `0` — flat, matching today's existing AI-play appearance exactly.
- **Persisting the landing angle ("proper stack")**: new `pileRestingRotations: Record<string, number>` state in `PistiScreen.tsx`, keyed by **card id** (not player id, unlike Batak's `restingRotations` — Pişti's pile accumulates many cards per player across a whole hand, not one live per-player trick slot). Recorded once, in `revealThenCommit`, at the same moment `setRevealedMove` fires. Passed down to `PistiTable`, which adds `{ rotate: `${pileRestingRotations[card.id] ?? 0}deg` }` onto `stackedPile`'s existing `translateX`/`translateY` transform. `PILE_CARD_OFFSETS`' diagonal-cascade positioning is unchanged — cards just also keep whatever angle they landed at.
- No pruning needed for `pileRestingRotations`: it holds at most one entry per card played in the current hand (≤52), and a new hand/session gets a fresh `PistiScreen` mount — unlike Batak's per-trick `restingRotations`, which is actively cleared because trick slots are reused across many tricks.

## 5. Edge cases

- **Reduced motion**: `PistiHandCard` respects `useReducedMotion()` for snap-vs-animate, same as `BatakHandCard`.
- **No `enterFromOffset`**: Pişti has no gömmeli-bury equivalent, so `PistiHandCard` is simpler than `BatakHandCard` here — that prop/branch doesn't exist at all.
- **Measurement-not-ready fallback**: same defensive fallback as today (`onPlayCard(cardId)` with no origin) when `handFanRef`/`destRef` haven't measured yet — covers Jest/RNTL (no real host refs resolve there) and the first real-device frame.
- **Player count / teams**: hand-fan geometry is independent of 2p/4p or team mode (opponent seat count doesn't affect the human's own hand) — no special-casing needed.

## 6. Testing

Per this repo's standing no-new-automated-tests-for-gesture-behavior convention (Batak's `HumanHandFan`/`BatakHandCard` have zero test coverage for the same reason — RNTL's `fireEvent.press` cannot drive a `GestureDetector`/`Gesture.Tap()`, and there's no established pattern in this codebase for RNGH's own gesture-firing test utilities), no new automated tests are planned for `PistiHandFan`/`PistiHandCard`'s tap-to-select-then-play mechanism.

**Known, concrete impact on existing coverage:** `apps/mobile/src/games/pisti/PistiTable.test.tsx` currently drives selection/play via `fireEvent.press` on card text (lines ~59–90: *"does not call onPlayCard on the first tap"*, *"calls onPlayCard when the already-selected card is tapped again"*, *"selecting a different card deselects the previous one"*, *"does not call onPlayCard when tapped during the AI turn"*). `fireEvent.press` dispatches a synthetic React press event, not a real native touch — it cannot trigger a `Gesture.Tap()`-based component's `onEnd` handler. These four tests will very likely need to be removed (not rewritten — there's no working replacement technique available here) once `PistiHandCard` ships, with the gap noted rather than silently dropped. This will be called out explicitly as its own task in the implementation plan, not folded silently into a "wire it up" step.

Per your instruction, I won't run the test suite during implementation — the plan will flag exactly what changed so you can run it yourself when ready.
