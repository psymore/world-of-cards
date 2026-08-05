# Architecture Audit: Batak `HumanHandFan` Demo08 Migration

**Used per:** `../AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process). Filled in retroactively against the actual landed diff (Tasks 5–6 of `docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md`) rather than before implementation began, since this session continued a plan whose spec/audit-template choice had already been approved in an earlier session — see `docs/superpowers/specs/2026-07-30-batak-hand-fan-demo08-migration-design.md` §6. Doubles as the Regression Review artifact (`AnimationReviewWorkflow.md` §7) for this same diff.

*Template used: full `AuditTemplate.md`, per direct user confirmation (not self-selected) — this migration introduces a new production animation mechanism (Reanimated + Gesture Handler driving Batak's hand), not a tuning change to already-shipped behavior, so it doesn't qualify for `QuickAuditTemplate.md`'s eligibility checklist.*

---

**Feature Name:** Batak `HumanHandFan` — Demo08 rail-fan/Reanimated/Gesture-Handler migration

**Objective:** Replace `HumanHandFan.tsx`'s hybrid `AnimatedFanCard` (Reanimated x/y only) + `SelectableCard` (plain `Animated` + `Pressable` + manual `hitSlop`) + `seating.ts` droop-curve stack with Demo08's proven fixed-box/transform-only/`Gesture.Tap()` pattern, fixing the two-tap responsiveness problem and the play-travel origin's measurement fragility in one coherent mechanism instead of layering a third animation owner on top of the existing two.

**Constitution References:** §5.I (Layered Ownership), §5.II (SSOT), §5.III (Explicit Contracts), §5.V (Visual State Continuity), §5.VI (Coordinated Property Timelines), §5.VII (Interactive Target Fidelity), §8 gap 3 (§5.VII "fixed twice, locally, no shared abstraction").

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Hand-slot row/index/rowCount assignment | Layer 1/2 boundary — `BatakTable.tsx` (`handLayerRef`, `splitTwoRows`) |
| Per-card resting x/y (row position) | Layer 4 — `AnimatedFanCard`'s own `useSharedValue` x/y, driven by `slotTargetX`/`slotTargetY` (Layer 2 pure functions in `HumanHandFan.tsx`) |
| Per-card rotation | Layer 4 — `SelectableCard`'s own `Animated.Value`, fed `fanRotationDeg` (Layer 2, `seating.ts`) as a target |
| Selection lift + scale | Layer 4 — `SelectableCard`'s own `lift` `Animated.Value` (scale derived via `.interpolate`) |
| Deal-entrance fade/rise/scale | Layer 4 — `EntranceCard`'s own `progress` shared value, a third independent animation owner wrapping the other two |
| Local-departure lift-off | Layer 4 — `AnimatedFanCard`'s x/y shared values, a second `useEffect` on the same values used for reflow |
| Hit-testing | Layer 6 — RN `Pressable` inside `SelectableCard`, compensated by a manually-computed `hitSlop` (the §8 gap 3 workaround) |
| Play-travel origin (`playWithMeasuredOrigin`) | Layer 3 — `BatakTable.tsx`, via `measureInWindow` (Y) + a duplicated copy of `slotTargetX` (X) + a hardcoded `SELECTED_LIFT_DISTANCE` compensation |

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Hand-slot row/index/rowCount assignment | Layer 1/2 boundary — unchanged, `BatakTable.tsx` |
| Per-card resting/lifted x/y, rotation, scale | Layer 4 — one `useBatakCardMotion` instance per card (`BatakHandCard.tsx`), fed by `batakRailFan.ts`'s pure Layer 2 functions (`slotPosition` in `HumanHandFan.tsx`, wrapping `railAngleStepDeg`/`railAngles`/`railPosition`) |
| Selection lift + scale | Layer 4 — same `useBatakCardMotion` instance, `setTarget` call from a `[selected]`-keyed effect (no longer a separate owner in `SelectableCard`) |
| Deal-entrance fade/rise/scale | Layer 4 — rise/scale on the same `useBatakCardMotion` instance; opacity on one small local `useSharedValue` in `BatakHandCard`, folded into the same `useAnimatedStyle` call (not a second component/owner) |
| Local-departure lift-off | Layer 4 — same `useBatakCardMotion` instance, reading its own `getValues()` as the departure base |
| Hit-testing | Layer 6 — `react-native-gesture-handler`'s `Gesture.Tap()`/`GestureDetector`, hit-testing the card's real composited (transformed) position natively — no `hitSlop` compensation needed |
| Play-travel origin (`playWithMeasuredOrigin`) | Layer 3 — `BatakTable.tsx`, reading the tapped card's `useBatakCardMotion.getValues()` directly via a motion registry (`registerHandMotion`) — no DOM measurement, no duplicated geometry |

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched — `packages/engine`'s Batak rules/state are untouched. |
| 2. Layout Engine | New: `batakRailFan.ts` (pure `RailAngleConfig`/`railAngleStepDeg`/`railAngles`/`railPosition`), replacing `seating.ts`'s `fanRotationDeg`/`fanCurveY` for Batak's hand specifically. Pure functions of `(slot, compact, extraRadius)` only — no animation-phase or gesture-state input, per §5.IV. |
| 3. Animation Planning | `HumanHandFan.tsx`'s `slotPosition` decides each card's target `(x, y, angleDeg)` per render; `BatakTable.tsx`'s `playWithMeasuredOrigin` decides the played card's travel-origin target from the motion registry. |
| 4. Animation Execution/Runtime | `useBatakCardMotion` (shared values + `withTiming`/`withDelay`) is now the single owner of position/rotation/scale for a hand card; `BatakHandCard`'s local `entranceOpacity` is the sole exception (opacity has no home on that primitive — see Boundary Violations). |
| 5. Rendering | `BatakHandCard` (`React.memo` with a custom comparator, since `restTarget`/`liftedTarget` are fresh object literals every render) owns component identity — one component per card, keyed by `cardId`, same as before. |
| 6. Interaction | `Gesture.Tap()`/`GestureDetector` per card, plus `DeselectableSurface.tsx`'s matching conversion (already landed under Task 7) for the background-deselect tap — both now RNGH-based, avoiding the classic-`Pressable`-vs-RNGH-`GestureDetector` arbitration bug documented in that file. |

## Boundary Violations

- **None found in the position/rotation/scale/gesture core.** Every value in Proposed Ownership above maps to exactly one layer.
- **Borderline, accepted:** `entranceOpacity` lives directly on `BatakHandCard` (Layer 5's component) rather than on `useBatakCardMotion` (Layer 4's primitive) — a Rendering-layer component holding one small piece of Animation-Execution state. This is a deliberate, narrow exception, not an oversight: folding opacity into `useBatakCardMotion` would give a position/rotation/scale-focused primitive a fifth, unrelated concern for the sake of one caller's one-time entrance flourish. It's still driven by `withTiming`/`withDelay` (the correct Layer 4 mechanism) and read only inside the same `useAnimatedStyle` that reads the "real" motion values — not a second component, not a second render-triggering owner. Recorded here per Workflow §6 rather than silently accepted.

## Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| `entranceOpacity` living on `BatakHandCard` instead of `useBatakCardMotion` | Acceptable Technical Debt | No action — see Boundary Violations above for the reasoning. Revisit only if a second caller needs opacity too. |
| `getValues()` returns the JS-mirrored *last commanded target*, not a frame-accurate live sample (§5.V risk — see Risks) | Minor | No action now; documented in `useBatakCardMotion.ts`'s own doc comment and in this audit's Risks section. Revisit if on-device testing (Task 8 Step 3) surfaces an actual visible jump. |
| Third parallel implementation of the §5.VII fixed-box/gesture pattern (`BatakHandCard`, alongside `SelectableCard`'s `hitSlop` and Demo08's `HandCardComponent`) | Acceptable Technical Debt | Matches this repo's own established convention (§8 gap 3) of extracting a shared primitive on the *third* real consumer, not preemptively. `BatakHandCard` is arguably that third consumer — flagged as an Open Question below, not resolved here. |

## Risks

- **§5.V (Visual State Continuity) edge case:** `useBatakCardMotion.getValues()` returns the last value `setTarget` *committed to*, not the shared value's true live interpolated position (see its own doc comment). Reanimated's `withTiming` itself always continues correctly from the shared value's real current position when retargeted (so mid-flight reflows never visually "jump" — §5.V's core guarantee holds for the animation itself). The narrower risk is specifically `playWithMeasuredOrigin` and the local-departure effect, both of which read `getValues()` as their *base* for a new target: if either fires while this exact card is *also* mid-reflow (its own `withTiming` still in flight toward a target `getValues()` hasn't caught up to yet), the new leg would start from a stale base rather than the true current position. In practice this requires the tapped/departing card to be reflowing at the exact moment of its own confirming tap or local-departure trigger — narrow, since a card must be `selected` (not merely reflowing) to reach either path, and reflow is driven by *sibling* changes, not this card's own selection state. Not reproduced; flagged for the on-device pass (Task 8 Step 3), particularly rapid re-taps.
- **Reduced motion:** every `setTarget` call site branches on `reducedMotion` (instant `duration: 0`) — verified by code read, not yet by toggling the OS setting on-device.
- **Rapid re-selection / interrupted reflow:** `BatakHandCard`'s reflow and selection effects both write to the same shared values but are triggered by disjoint dependency arrays (`[restTarget.*, reducedMotion]` vs. `[selected, reducedMotion]`), mirroring Demo08's own two-effect split rather than one merged effect — chosen specifically to preserve the pre-migration asymmetric timing (reflow always 320ms; select snaps instantly, deselect eases over 150ms). Two effects sharing one target is exactly the shape §5.VI warns about in the abstract, but here both effects compute the *same* formula (`selected ? liftedTarget : restTarget`) rather than divergent ones, so they can't disagree about the destination — only about which trigger fired most recently, which is the intended behavior.
- **`GestureDetector` under Jest:** relies on the `useEvent` mock added in Task 7; confirmed via `PistiTable.test.tsx` (the suite already proven sensitive to this) passing, plus the full 39-suite/248-test run — no `BatakTable.test.tsx`/`HumanHandFan.test.tsx` exists to exercise this file directly (motion-only code, per the standing 2026-07-07 no-new-tests policy).

## Open Questions

- Should `BatakHandCard`'s fixed-box/`Gesture.Tap()` pattern be extracted into a shared primitive with Demo08's `HandCardComponent` (and, longer-term, `SelectableCard`'s `hitSlop` workaround)? Per §8 gap 3's own stated convention, a third occurrence is the recognized trigger — not resolved here, left for a future session if it recurs a fourth time or becomes actively painful to maintain in parallel.
- On-device verification (Task 8 Step 3) has not yet happened — this audit's Approval below is conditional on it, not a substitute for it.

## Approval

**Approved to implement:** Pending — implementation has already landed (Tasks 5–6, committed on `feature/batak-hand-fan-demo08-migration`) and this audit found no Critical/Major findings, but per `AnimationReviewWorkflow.md` §4/§7 this is not "Approved" until the on-device pass below actually happens.

**Conditions:** On-device verification (select→play two-tap reliability, rapid re-taps, a full trick, gömmeli compact mode if reachable, reduced-motion OS setting on) per the plan's Task 8 Step 3 — this is the user's own pass, not something verifiable from the sandbox.

## Review Date

2026-08-05

## Reviewer

Claude Sonnet 5, in collaboration with the user (Ege Özel) — audit-template choice confirmed explicitly per `[[feedback_ask_audit_template_choice]]`.
