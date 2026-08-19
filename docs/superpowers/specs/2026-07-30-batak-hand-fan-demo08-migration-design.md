# Batak Hand-Fan Demo08 Migration — Design Spec

**Status:** Approved (2026-07-30)
**Supersedes:** the earlier `feature/batak-full-reanimated-migration` branch attempt (VSCode Copilot-implemented `HumanHandFan.tsx`/`BatakHandCard.tsx`/`useBatakCardMotion.ts`), which broke card-playing on-device (root cause: `DeselectableSurface`'s plain `Pressable` racing against the new cards' `GestureDetector` — an unsupported ancestor/descendant combination — plus several other quality issues found on review: dead `AnimatedFanCard` code left in place, triple-layered/conflicting animation ownership around each card, lost doc comments, `as any` casts). All of that work has been stashed (`git stash`, message "buggy batak reanimated migration attempt, superseded by clean rewrite"), not deleted, and the branch is reset to `master`. This spec starts over, implemented directly in this session via `subagent-driven-development` rather than handed to an external tool.

## Context

`apps/playground/src/animation/demos/Demo08ReanimatedHandReposition.tsx` is a proven, on-device-verified design (see `docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md`) for a tap-to-play card hand that avoids two specific, previously-diagnosed problems: a Yoga-layout-pass reflow stutter (from cards moving via `left`/`top` instead of `transform`) and a touch-target-drift bug (RN `Pressable` hit-tests a view's static layout box, which `transform` never moves). Its solution: every card's box has permanently fixed `left`/`top`, all motion is `transform`-only via Reanimated shared values, and touch uses `react-native-gesture-handler`'s `Gesture.Tap()`/`GestureDetector` (whose native recognizers hit-test the actual rendered position, not the static box).

Batak's real `HumanHandFan.tsx` has never actually carried this pattern (see `docs/animation/ADR/ADR-003-scope-reanimated-migration-to-evidenced-need.md`'s claim vs. reality, corrected in this session): it uses Reanimated shared values for x/y position only, but rotation/selection-lift/scale and all touch handling still run through the shared, Pişti-used `SelectableCard.tsx` (plain `Animated` + `Pressable` + a manually-computed `hitSlop` workaround), and card layout uses `seating.ts`'s discrete `fanRotationDeg`/`fanCurveY` droop math, not a rail/angle model. This spec finishes that migration for real, this time end-to-end and verified.

**Explicitly out of scope for this spec** (deferred to a follow-up): `TrickCenter.tsx`/`TravelCard.tsx`/`GatherCard.tsx`'s smooth-resize fix, `KittyRevealCard.tsx`, `CenteredDecisionModal.tsx`. This spec is the hand-fan only.

## 1. Playground tuning tool

New file: `apps/playground/src/animation/demos/Demo09BatakHandTuning.tsx`, registered alongside the existing demos in `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`'s demo switcher. `Demo08ReanimatedHandReposition.tsx` and `railFanLayout.ts` are not modified — Demo08 stays the validated reference; Demo09 imports from `railFanLayout.ts` (`RAIL_RADIUS`, `railAngleStepDeg`, `railAngles`, `railPosition`) rather than duplicating that math.

Differences from Demo08:
- Renders `@world-of-cards/ui`'s real `PlayingCard` (a real, seeded, sorted 13-card Batak-style hand — reuse `@world-of-cards/engine`'s `createDeck`/`shuffle`/`createRng` the way Demo06's deal loop already does) instead of the playground's `SimpleCard`.
- Sized to `CARD_DIMS.normal` (94×132), not the playground's smaller stand-in dimensions.
- Preview frame is phone-width (reuse whatever width constant the other demos already use for their phone-frame mockups), not desktop-arbitrary.
- Reuses `FanConfigControls.tsx`'s sliders as-is (radius, spacing, overlap, arc degrees, max rotation) — if it needs a prop that doesn't exist yet, extend it additively (new optional prop, existing demos byte-identical), don't fork it.
- Adds a toggle for hand size (e.g. 13 / 8 / 4 cards) and a toggle for "compact" mode (gömmeli's tighter two-row layout — see §3), so both real Batak scenarios can be checked, not just one card count.
- No tap-to-play interaction needed here — this tool is for eyeballing static/reflowing layout, not proving the gesture mechanism (Demo08 already proved that part). A basic "remove a random card" button to see reflow is enough; skip select/lift/travel.

**Process:** tune this live (you, on-device or in the web preview) until the geometry looks right at both hand sizes and both layout modes, then hand the final constants (radius, angle step formula inputs, overlap, max rotation, per-mode differences) back for Stage 2 to hardcode into production. This tuning session's output (the final numbers) gets recorded in the implementation plan, not guessed at now.

## 2. Production: `HumanHandFan.tsx` rewrite

Delete the current hybrid `AnimatedFanCard`/`SelectableCard`-based implementation entirely (including the currently-dead-once-migrated `AnimatedFanCard` component — no old code left behind this time, unlike the reverted attempt). New shape:

- **New file** `apps/mobile/src/games/batak/table/useBatakCardMotion.ts`: per-card Reanimated shared values (`translateX`, `translateY`, `rotate`, `scale`), a `retarget`/`setTarget`-style API mirroring Demo08's `HandCardComponent` internals, and a way for `BatakTable.tsx` to read a card's current values synchronously (see §4) — e.g. an imperative handle or a returned `getValues()`, whichever reads cleanest once written; decide in the plan, not here.
- **New file** `apps/mobile/src/games/batak/table/BatakHandCard.tsx`: one card. Fixed-`left`/`top` outer box, `useAnimatedStyle` transform-only positioning, `Gesture.Tap()`/`GestureDetector` for touch (mirroring Demo08's `.onEnd((_e, success) => { if (success) runOnJS(handlePress)(); })` shape exactly, including checking `success` — the reverted attempt's version dropped that check).
- `HumanHandFan.tsx` itself becomes the layout/orchestration layer: computes each slot's target `(x, y, angleDeg)` from the tuned rail math (§1's output) and the row/compact logic below, passes them into `BatakHandCard` instances, and owns nothing about individual-card motion itself.
- Reuse `apps/mobile/src/components/useCardSelection.ts` unchanged (pure state, no RN/Animated dependency, already shared with Pişti).
- Respect `useReducedMotion()` — instant positioning, no animated transitions, when enabled.

## 3. Mapping production requirements onto Demo08's shape

Demo08 is a flat, single-row, always-13-cards-max demo with no entrance/exit beyond select↔play. Batak's real hand needs more, and each of these needs its own explicit sub-design (written out fully in the implementation plan, not left implicit):

- **Entrance stagger on deal:** existing `HumanHandFan.tsx` already has this (`EntranceCard`-equivalent logic, or whatever the pre-migration version called it — check `git show master:apps/mobile/src/games/batak/table/HumanHandFan.tsx` for the exact prior behavior/timing to preserve) — port the same visual behavior onto the new per-card shared values instead of a separate wrapper component layered on top (the reverted attempt's bug was exactly this: entrance animation and position animation fighting as two separate layers around one card — this time, entrance is just another `setTarget` call on the same shared values the rail-position logic already owns, never a second `Animated.View`/opacity wrapper around `BatakHandCard`).
- **Local-departure lift-off:** when a card is played, it lifts/moves before `TrickCenter`'s `TravelCard` takes over (see `BatakScreen.tsx`'s `departingCard` state, still relevant, unchanged by this spec) — express this as a `setTarget` call on the same card's shared values, same principle as above.
- **Two-row / compact layout (gömmeli):** existing row-splitting decision logic (which row, how many per row) stays as pure logic in `HumanHandFan.tsx`; only the per-slot angle/position computation changes from the old droop math to the tuned rail math per row. Confirm during planning whether "compact" needs its own rail-tuning profile (likely yes — gömmeli's hand is bigger) — Demo09 should have already answered this in §1.
- **Bury-slot entrance (kitty exchange):** `slot.enterFromOffset`-style entrance (a card returning from a bury slot starts offset and animates in) — same `setTarget`-from-an-offset principle, not a separate mechanism.
- **Legal-move dimming:** purely a style/opacity concern on `interactive`, independent of the position/gesture mechanism — carries over essentially unchanged.

## 4. `BatakTable.tsx`'s `playWithMeasuredOrigin` — replace, don't preserve

Current mechanism (~line 421, unchanged since the reverted attempt never touched it): X is re-derived analytically via a duplicated copy of `AnimatedFanCard`'s own `slotTargetX` pure function (fragile — two places must agree); Y is read via `measureInWindow` plus a hardcoded `SELECTED_LIFT_DISTANCE` compensation (worked around because `measureInWindow` on a transform-affected node is documented as async/stale-prone). Once `BatakHandCard` exposes its own real shared values (§2), replace this whole function with a direct read of the tapped card's current `translateX`/`translateY`/`rotate` — no DOM measurement, no duplicated math, no staleness risk. This should make the function substantially shorter, not just different.

## 5. Cross-game safety

`SelectableCard.tsx` stays completely untouched — Pişti's `PistiTable.tsx` still depends on it. `HumanHandFan.tsx` simply stops importing it. `seating.ts`'s `fanRotationDeg`/`fanCurveY` may become dead for Batak specifically; grep for Pişti usage before removing them (leave them if Pişti still calls them, per the last attempt's own correct instruction on this point — it just never got a chance to reach cleanup before the touch bug blocked everything).

`DeselectableSurface.tsx`'s `Pressable`→`GestureDetector` conversion (found necessary last time, root-caused correctly) is back in scope here, since `BatakHandCard`'s `GestureDetector`-based cards need it — this is a real, correct, small fix, not part of the reverted work's problems. Re-apply it as part of this spec's implementation (it was a genuinely good fix, just built on top of a broken foundation last time).

The Jest `useEvent` mock addition to `apps/mobile/__mocks__/react-native-reanimated.js` (needed because `GestureDetector` had never been exercised under this app's Jest config before) is also back in scope — same reasoning.

## 6. Process

This introduces a new animation mechanism to production Batak, not a tuning change to something already shipped — per this repo's `docs/animation/` Constitution, a full Architecture Audit (`docs/animation/audits/AuditTemplate.md`) is expected, not the Quick path. Confirm this explicitly (not self-selected) at the start of the implementation plan's relevant task, per standing project convention.

**Testing:** no new automated tests, per the standing 2026-07-07 mobile-UI policy. Existing tests (`PistiTable.test.tsx` in particular, since it's the one test suite that already proved sensitive to `DeselectableSurface`'s gesture-handler conversion) must stay green throughout. On-device verification is yours to do — I have no way to test real gesture feel myself; this is exactly the kind of change that broke silently through code review alone last time.

## 7. Explicitly deferred

- `TrickCenter`/`TravelCard`/`GatherCard`'s smooth-resize fix, `KittyRevealCard`, `CenteredDecisionModal` — separate follow-up spec once this hand-fan work is proven solid on-device.
- `docs/animation/ADR/ADR-004-*` recording the reversal of ADR-003's "stays on Animated indefinitely" call for whichever files this and the deferred follow-up actually touch — write this once both are done and the real final state is known, not speculatively now.
