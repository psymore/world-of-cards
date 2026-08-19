# ADR-004: Revert `GatherCard` from Reanimated back to plain `Animated`

**Status:** Accepted
**Date:** 2026-08-19
**Related Constitution sections:** `§5.I`, `§5.V`, `§7` item 1 (as amended by `ADR-002`)
**Supersedes / Superseded by:** Supersedes `ADR-003`'s Decision and Final State Reference table entries for `table/GatherCard.tsx` only — every other file's disposition in that table (`HumanHandFan.tsx` on Reanimated; `KittyRevealCard.tsx`/`CenteredDecisionModal.tsx`/`TravelCard.tsx`/`SelectableCard.tsx`/`DealFlightOverlay.tsx`/`PistiTable.tsx` on plain `Animated`) is unchanged and still governed by `ADR-003`.

## Context

`ADR-003` (2026-07-29) kept `GatherCard.tsx` on Reanimated specifically because it was "already migrated, typechecked, and passing all tests... it works, and reverting tested/working code back to `Animated` purely for vocabulary uniformity would be pure churn with no benefit." That was true of the evidence available at the time — no stutter had been reported against it.

New evidence surfaced during a 2026-08-19 investigation into a user-reported "Batak doesn't feel as smooth as Pişti/Playground" complaint, specifically a stutter that worsened over the course of a hand. Temporary `__DEV__`-gated instrumentation (`useFrameDropMonitor.ts`, tracking rAF frame gaps, plus a live `GatherCard` mount-count log) showed frame-gap stalls tightly coupled to every `GatherCard` mount/unmount cycle — up to several *seconds* of stutter by trick 10+ within one hand — while the component's own live-instance count always cleanly returned to 0 (i.e. not a leaked React component). `TravelCard.tsx`, which mounts/unmounts at the same rough frequency (once per play, not just once per trick) using plain `Animated`, has never shown this symptom. The animation engine, not the mount/unmount pattern itself, is the actual differentiator: Reanimated's UI-thread bookkeeping for a shared value plus its style mappers — recreated fresh on every mount, up to 13 times a hand for `GatherCard`'s four simultaneous instances per trick — is not being reclaimed as fast as new instances are created.

This is exactly the kind of evidence `ADR-003`'s own reasoning was conditioned on: it explicitly kept `GatherCard` on Reanimated only because nothing was wrong with it, not because Reanimated was judged necessary for its (single-card, single-`progress`-value) animation shape. That precondition no longer holds.

## Decision

Revert `table/GatherCard.tsx` from Reanimated (`useSharedValue`/`useAnimatedStyle`/`withTiming`) back to plain `Animated` (`Animated.Value`/`Animated.timing`/`.interpolate()`), matching `TravelCard.tsx`'s already-proven-safe implementation as the template — same easing curve (`Easing.out(Easing.cubic)`, aliased via the shared `CARD_TRAVEL_EASING` export from `travelAnimation.ts` rather than a locally-duplicated constant), same `useNativeDriver: true`, same two-layer flip/opacity-swap mechanism translated from Reanimated's `interpolate()` to `Animated.Value.interpolate()`. Behavior-identical: no visual or timing change, only the underlying primitive.

`table/GatherCard.tsx`'s final disposition, updating `ADR-003`'s Final State Reference table:

| File | Engine | Why |
|---|---|---|
| `table/GatherCard.tsx` | **`Animated`** (reverted from Reanimated under this ADR) | Reanimated's per-mount UI-thread bookkeeping cost, evidenced against a Batak-specific usage pattern (four simultaneous instances, up to 13 mount/unmount cycles a hand) that no other Reanimated-migrated component shares. |

## Alternatives Considered

- **Keep `GatherCard` on Reanimated and try to fix the bookkeeping cost directly** (e.g. reusing a fixed pool of shared values across mounts instead of creating fresh ones per instance). Rejected for this change: a pooling redesign is a bigger, riskier structural change than reverting to an already-proven-safe primitive, and `TravelCard`'s existing plain-`Animated` implementation already demonstrates the simpler fix works for this exact mount/unmount frequency. Not ruled out permanently — see Revisit Trigger.
- **Revert `HumanHandFan.tsx` too, back to a single engine for all of Batak.** Rejected: `HumanHandFan`'s reflow problem is the one `ADR-003` evidenced Reanimated *against* plain `Animated`'s known stutter (the original Demo06/Demo08 problem class) — nothing in this investigation touches that evidence. Reverting it would be undoing a fix for an unrelated, still-valid reason.
- **Leave `GatherCard` on Reanimated and just accept the stutter as a known gap.** Rejected: the stutter is exactly the complaint that triggered this investigation, growing to multiple seconds within a single hand — not a marginal cosmetic issue.

## Consequences

**Costs:** `apps/mobile` now has one fewer Reanimated consumer than `ADR-003` left it with — `HumanHandFan.tsx` is the sole remaining production Reanimated user in Batak (`GatherCard`'s own earlier migration is fully undone). The Reanimated/Gesture-Handler/Worklets dependency and Jest mock stay paid regardless (still justified by `HumanHandFan.tsx` alone, per `ADR-003`'s own Consequences section).

**Benefits:** Removes a confirmed, worsening-per-trick stutter from Batak's trick-gather animation — the single largest evidenced gap between Batak's and Pişti/Playground's perceived smoothness found in this investigation. Restores `GatherCard.tsx` and `TravelCard.tsx` to using the identical primitive for structurally near-identical single-card flight animations, which was the pre-`ADR-002` state and remains simpler to reason about than a mixed engine per file without a standing reason.

## Revisit Trigger

If `GatherCard`'s plain-`Animated` implementation is ever found to have a genuine reflow-stutter or gesture-arbitration bug of the class `ADR-001`/`ADR-002` evidenced Reanimated *for* (it isn't tappable and has no reflow, so this is not expected), revisit re-migrating it then — evidenced, not speculative, the same standard `ADR-003` and this ADR both applied. Separately: if a future Batak feature needs *more* simultaneous Reanimated-driven trick-gather instances than today's four-per-trick (e.g. a larger-hand variant), the bookkeeping-cost evidence behind this revert should be re-measured against that new shape rather than assumed to generalize.
