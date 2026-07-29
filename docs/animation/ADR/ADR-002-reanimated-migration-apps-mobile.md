# ADR-002: Migrate `apps/mobile` from `Animated` to Reanimated + Gesture Handler, starting with Batak

**Status:** Accepted, but its Decision/Phased-order/Alternatives sections are **superseded by `ADR-003`** (narrowed from "migrate every `Animated` usage" to only files with evidenced need). Its `§7` item 1 Constitution amendment below still stands.
**Date:** 2026-07-29
**Related Constitution sections:** `§7` item 1 (superseded by this ADR for `apps/mobile`), `§5.VI`, `§5.VII`, `§6`, `§8` gap 3
**Supersedes / Superseded by:** Supersedes Constitution `§7` item 1 for `apps/mobile` only. Superseded in part by `ADR-003` — see its Status line. `apps/playground`'s Demo06 (plain `Animated`) and Demo08 (Reanimated) both continue to exist as playground experiments — this ADR does not retire either.

## Context

`ADR-001` built an isolated `Demo08` in `apps/playground` using Reanimated + Gesture Handler to test a specific hypothesis (a fixed static box, hit-tested via the gesture recognizer's own view instead of `left`/`top`, sidesteps a suspected Yoga-layout-pass cost). The user live-verified Demo08 on a physical device: "all flow is robust on Demo 08." ADR-001's own Outcome section was explicit that this result does not, on its own, prove Reanimated was the *necessary* ingredient versus the box-never-moves redesign being portable back to plain `Animated` — and left two follow-up decisions open rather than defaulting either one.

The user has now directly resolved both: proceed with a full migration of `apps/mobile` from `Animated` to Reanimated, starting with Batak, given as an explicit instruction rather than derived from further on-device measurement. This ADR records that as a deliberate Project Decision amendment, not as a claim that `§7` item 1's original, narrower Revisit Trigger ("per-frame native↔JS communication that plain `Animated` cannot provide") has been empirically satisfied — it hasn't been, strictly. The basis for this decision is the user's own judgment following the Demo08 result and `[[feedback_animation_library_swap_escalation]]`'s standing guidance, not a re-litigated technical proof.

**Current architecture inventory** (every direct `Animated` API consumer in `apps/mobile/src`, confirmed via `Animated\.` grep against all 31 files that import anything from `react-native`; `packages/ui` has zero `Animated` usage):

| File | Scope | Role |
|---|---|---|
| `table/GatherCard.tsx` | Batak-only | Trick-sweep flip + fly-out |
| `table/KittyRevealCard.tsx` | Batak-only (gömmeli) | Kitty flip-reveal (`KittyRevealCard`) + fly-to-hand (`KittyCollectCard`) |
| `table/DealFlightOverlay.tsx` | **Shared** (Pişti + Batak) | Deal-sequence card-flight overlay |
| `components/CenteredDecisionModal.tsx` | Batak-only today | Bid/trump decision modal entrance |
| `table/TravelCard.tsx` | Batak-only | Played-card fly-in to trick center |
| `components/SelectableCard.tsx` | **Shared** (Pişti + Batak) | Hand-card lift/select/rotate, used by both `PistiTable.tsx` and `HumanHandFan.tsx` |
| `games/batak/table/HumanHandFan.tsx` | Batak-only | Hand reflow, entrance stagger, local-departure lift-off — structurally the closest analog to Demo06/Demo08's own reflow problem |
| `games/pisti/PistiTable.tsx` | Pişti-only | `AnimatedHandCard` reflow + `RevealCard` pile-reveal (a separate, independent implementation of the same idea — not shared code) |

`games/batak/table/TrickCenter.tsx` composes `TravelCard`/`GatherCard` but holds no `Animated.Value` of its own — not a separate migration unit.

## Decision

Migrate every `Animated`-API usage in `apps/mobile` to `react-native-reanimated` (shared values + worklets) and, wherever a component currently uses `Pressable` for a card that moves via transform, `react-native-gesture-handler`'s `Gesture.Tap()` — mirroring Demo08's proven pattern (fixed static box, gesture-recognizer-driven hit-testing, per `§5.VII`). The migration is **incremental, file by file, starting with Batak's Batak-only files**, each one behavior-preserving (identical visuals/timing/easing) before moving to the next. Pişti is touched only when a genuinely shared file (`SelectableCard.tsx`, `DealFlightOverlay.tsx`) is migrated — see the phased order below — and that phase requires Pişti regression verification, not just Batak's.

**Phased order** (lowest blast radius first):

- **Phase A — Batak-only, zero Pişti blast radius:** `GatherCard.tsx` → `KittyRevealCard.tsx` → `CenteredDecisionModal.tsx` → `TravelCard.tsx` → `HumanHandFan.tsx` (last: most complex, and the component most structurally similar to the Demo06/Demo08 reflow problem this whole investigation started from).
- **Phase B — Shared, Pişti-affecting:** `DealFlightOverlay.tsx` → `SelectableCard.tsx`. Each requires re-verifying both games, not just Batak.
- **Out of scope for this ADR:** `PistiTable.tsx`'s own `AnimatedHandCard`/`RevealCard` — a separate implementation, not touched by Phase A/B, and not requested by the user's "start with Batak" instruction. A decision on whether/when to migrate it follows once Phase A/B lands, not bundled in now.

Each phase-A file keeps its existing external contract (props, exported constants) unchanged wherever possible, so consuming files (`TrickCenter.tsx`, `BatakTable.tsx`, `KittyExchangeCenter.tsx`, `BurySlots.tsx`) need no changes beyond what a genuinely required prop-shape change forces.

## Alternatives Considered

- **Keep `Animated`, port only Demo08's fixed-static-box/gesture-recognizer-hit-testing *pattern* using plain `Animated` + a fresh Gesture Handler integration**, without switching the animation engine itself. Cheaper (no new animation-primitive vocabulary), and ADR-001 itself flagged this as the untested alternative. Not chosen: the user's explicit instruction was specifically to adopt Reanimated, not just the structural pattern — recorded here so a future reader doesn't mistake this ADR for having re-derived "Reanimated is necessary" from evidence it doesn't actually have.
- **Migrate all 8 files in one pass.** Rejected per the user's own explicit instruction ("migrate feature by feature, not all at once") and this repo's standing incremental-verification convention.
- **Start with Pişti instead of Batak.** Rejected per the user's explicit instruction to start with Batak.
- **Migrate the two shared files (`SelectableCard`, `DealFlightOverlay`) first, since they're used by both games and thus highest-value.** Rejected: they're also the highest-blast-radius files (any regression shows up in both games at once). Saved for Phase B, after the Batak-only files have proven the migration pattern works end-to-end.

## Consequences

**Costs:**
- `apps/mobile` gains `react-native-reanimated`, `react-native-gesture-handler`, and `react-native-worklets` as real dependencies (previously playground-only) — requires `apps/mobile/babel.config.js` to add the worklets plugin and `App.tsx`'s root wrapped in `GestureHandlerRootView`, mirroring what `apps/playground` already has.
- For the duration of the migration, `apps/mobile` runs **two animation primitive vocabularies at once** (plain `Animated` in not-yet-migrated files, Reanimated in migrated ones) — acceptable as a transient state precisely because the migration is incremental and each phase is independently verified, not acceptable if left unfinished indefinitely.
- `Pressable`-based cards being replaced with `Gesture.Tap()` reintroduces the same class of gesture-arbitration questions ADR-001's Demo08 experience surfaced (nested-gesture priority is not automatic the way `Pressable`-in-`Pressable` responder negotiation is) — each phase-A file needs to be checked for this, not assumed safe by analogy alone.
- Two of the eight files (`SelectableCard.tsx`, `DealFlightOverlay.tsx`) are shared with Pişti — migrating them is deferred to Phase B specifically so Phase A can validate the pattern on lower-stakes, Batak-only files first, per this repo's own "isolate the suspected variable" debugging convention.

**Benefits:**
- Every card-motion component ends up using the same primitive Demo08 already proved robust on-device for the hardest case (rail-fan reflow + tap-to-play).
- `HumanHandFan.tsx` — Batak's own reflow component, structurally the same shape as Demo06/Demo08's problem — gets migrated using a pattern already validated for exactly this problem class, rather than inventing a new one from scratch.
- Retires `§8` gap 3's "fixed twice, locally, with no shared abstraction" `§5.VII` workaround pattern in favor of Demo08's single, gesture-recognizer-based solution, once Phase A/B both land.

## Revisit Trigger

- If any phase-A file cannot be migrated behavior-identically without a structural change bigger than "swap the primitive" (e.g., forces a `TravelCard`/`GatherCard` prop-contract break that ripples into `TrickCenter.tsx`/`BatakTable.tsx`), stop and raise it explicitly before continuing — do not silently widen the blast radius beyond what this ADR scoped.
- If Phase A surfaces a regression that plain `Animated` did not have (e.g., a gesture-arbitration bug like the one ADR-001's Demo08 build hit and fixed), record it in this ADR's own follow-up notes before proceeding to the next file — don't let the same class of bug get rediscovered fresh in each new file.
- Phase B (`SelectableCard.tsx`, `DealFlightOverlay.tsx`) should not begin until Phase A is fully migrated, typechecked, and confirmed behavior-identical on Batak — these two files are the ones that put Pişti at risk, so they deliberately come last.
