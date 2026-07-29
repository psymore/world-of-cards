# ADR-003: Scope the `apps/mobile` Reanimated migration down to evidenced need, not full replacement

**Status:** Accepted
**Date:** 2026-07-29
**Related Constitution sections:** same as `ADR-002` (`§7` item 1, `§5.VI`, `§5.VII`, `§6`, `§8` gap 3)
**Supersedes / Superseded by:** Supersedes `ADR-002`'s **Decision**, **Phased order**, and **Alternatives Considered** sections (the "migrate every `Animated` usage" scope). Does **not** supersede `ADR-002`'s Constitution `§7` item 1 amendment — `apps/mobile` still permits Reanimated going forward, this ADR just narrows *where* it's actually used.

## Context

`ADR-002` committed to migrating every `Animated`-API consumer in `apps/mobile`, in a 5-file Phase A (`GatherCard.tsx` → `KittyRevealCard.tsx` → `CenteredDecisionModal.tsx` → `TravelCard.tsx` → `HumanHandFan.tsx`) followed by a 2-file Phase B. Immediately after `GatherCard.tsx` was migrated (typechecked, all 36 mobile tests passing) and before `KittyRevealCard.tsx` was started, the user paused to ask whether a full transition is actually necessary, or whether a mixed `Animated`/Reanimated codebase is an acceptable end state.

On reflection, the only *evidenced* defect in this codebase is the reflow-stutter/gesture-hit-testing problem class `ADR-001`'s Demo08 was built to test: many views changing `left`/`top` simultaneously (a Yoga layout pass) and a gesture recognizer needing a fixed static box to hit-test against, rather than a moving transformed one. That problem class maps to exactly one file in Batak: `games/batak/table/HumanHandFan.tsx`, which has a real multi-card reflow (`AnimatedFanCard`) and is the direct structural analog of Demo06/Demo08's own reflow component.

The four other Phase-A files (`GatherCard.tsx`, `KittyRevealCard.tsx`, `CenteredDecisionModal.tsx`, `TravelCard.tsx`) are all single-card, single-`progress`-value animations. None has ever had a reported stutter or gesture-arbitration bug — `TravelCard`/`GatherCard`/`KittyRevealCard`/`KittyCollectCard` aren't even tappable (display-only), and `CenteredDecisionModal`'s only animated property is its own entrance, not a reflow. Migrating them was pursuing animation-vocabulary *consistency*, not fixing anything, and it isn't free: Reanimated 4's native TurboModule genuinely does not run under Jest (`react-native-worklets`' `NativeWorklets.native.ts` throws even through Reanimated's own official `mock.js`, since that mock still transitively imports the real native-initializing `./index`), which required hand-rolling `apps/mobile/__mocks__/react-native-reanimated.js` — a maintenance surface that scales with how many files actually use Reanimated, not a one-time fixed cost.

## Decision

Scope the migration down to exactly the files with evidenced need:

- **`games/batak/table/HumanHandFan.tsx`** — migrate next (the real target; the only file structurally like Demo08's proven fix).
- **`table/GatherCard.tsx`** — already migrated, typechecked, and passing all tests. Kept as Reanimated rather than reverted: it works, and reverting tested/working code back to `Animated` purely for vocabulary uniformity would be pure churn with no benefit.
- **`table/KittyRevealCard.tsx`, `components/CenteredDecisionModal.tsx`, `table/TravelCard.tsx`** — **no longer planned for migration.** They stay on plain `Animated` indefinitely, not as an interim state pending a later phase.
- **Phase B (`components/SelectableCard.tsx`, `table/DealFlightOverlay.tsx`) and `games/pisti/PistiTable.tsx`** — not scheduled. `SelectableCard.tsx` remains the most plausible future candidate (`HumanHandFan`'s cards render through it), but only if a concrete, evidenced issue surfaces there — not preemptively.

`apps/mobile` permanently running **two animation vocabularies side by side** — plain `Animated` as the default, Reanimated only where a specific problem class justifies it — is accepted as the standing end state, not a transient migration phase to be "finished" later. This directly narrows `ADR-002`'s Consequences section, which had framed the two-vocabulary state as temporary.

## Alternatives Considered

- **Continue ADR-002's full 5-file Phase A + 2-file Phase B as originally planned.** Rejected: no evidence any of the four now-descoped files need to change, and finishing them would be speculative engineering effort against a problem that doesn't exist there.
- **Revert `GatherCard.tsx` back to `Animated` for strict uniformity with "only migrate what's broken."** Rejected per the user's explicit instruction to keep it — it's tested and working, and reverting it would be churn in the opposite direction with no offsetting benefit.
- **Migrate `SelectableCard.tsx` now, since `HumanHandFan` renders through it anyway.** Rejected for this ADR: `SelectableCard` itself has no reported issue (its `hitSlop` workaround for `§5.VII`, per Constitution `§8` gap 3, already works), and it's shared with Pişti — the highest-blast-radius file in the original inventory. Left as a flagged future candidate, not bundled in here.

## Consequences

**Costs:** `apps/mobile` now permanently carries the Reanimated/Gesture-Handler/Worklets dependency, babel plugin, and Jest mock even though only one or two components actually use them — accepted since that infra cost is already paid regardless of how many files consume it, and `HumanHandFan.tsx` alone justifies it.

**Benefits:** minimizes rewrite risk to the three descoped Batak files (`KittyRevealCard`, `CenteredDecisionModal`, `TravelCard`), which keep their exact known-good `Animated` behavior untouched; concentrates all migration risk and review attention on the one file that actually needs it.

## Revisit Trigger

If `KittyRevealCard.tsx`, `CenteredDecisionModal.tsx`, `TravelCard.tsx`, `SelectableCard.tsx`, `DealFlightOverlay.tsx`, or `PistiTable.tsx`'s own hand/reveal code is ever found to have a genuine reflow-stutter or gesture-arbitration bug of the same class as Demo06/Demo08's, revisit migrating that specific file then — evidenced, not speculative, the same standard this ADR applied to descope them now.

## Final State Reference (for future sessions)

Every direct `Animated`/Reanimated API consumer in `apps/mobile/src`, as of this ADR:

| File | Engine | Why |
|---|---|---|
| `games/batak/table/HumanHandFan.tsx` | **Reanimated** (migration in progress under this ADR) | Multi-card hand reflow — the one evidenced reflow-stutter/gesture-hit-testing problem class |
| `table/GatherCard.tsx` | **Reanimated** | Already migrated under `ADR-002` before this scope-down; kept, no issue with it |
| `table/KittyRevealCard.tsx` (`KittyRevealCard`, `KittyCollectCard`) | `Animated` | Single-card flip/fly-out, no reported issue, not tappable |
| `components/CenteredDecisionModal.tsx` | `Animated` | Single-card entrance only, no reflow |
| `table/TravelCard.tsx` | `Animated` | Single-card fly-in, no reported issue, not tappable |
| `components/SelectableCard.tsx` | `Animated` | Shared with Pişti; `§5.VII` already solved via its own `hitSlop` workaround; flagged future candidate only |
| `table/DealFlightOverlay.tsx` | `Animated` | Shared with Pişti; simple per-card fly-in, no reported issue |
| `games/pisti/PistiTable.tsx` (`AnimatedHandCard`, `RevealCard`) | `Animated` | Pişti-only, separate implementation; out of scope entirely |
| `apps/playground` Demo06 (`Demo06HandReposition.tsx`) | `Animated` | Playground baseline/reference, per `ADR-001` |
| `apps/playground` Demo08 (`Demo08ReanimatedHandReposition.tsx`) | Reanimated | Playground experiment that proved the pattern, per `ADR-001` |
