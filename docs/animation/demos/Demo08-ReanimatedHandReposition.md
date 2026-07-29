# Demo 08: Reanimated Hand Reposition

**Status:** Complete — Reanimated approach confirmed live on-device
**Playground location:** `apps/playground/src/animation/demos/Demo08ReanimatedHandReposition.tsx`
**Authority:** subordinate to `animation-architecture-constitution.md`, `ADR/ADR-001-reanimated-demo08-experiment.md`, and `AnimationReviewWorkflow.md` (see `00-DocumentationMap.md` for the full chain). This document records this demo's own reasoning and results; it does not define process or principles.

---

## Objective

Reproduce Demo06's exact problem — a rail-fan hand whose remaining cards reflow smoothly when one is played — under `react-native-reanimated` + `react-native-gesture-handler` instead of `Animated` + `Pressable`, to test whether the still-reported reflow stutter (five prior mitigation attempts under the current engine, all documented in `ADR-001`) is actually a Yoga-layout-pass cost, structurally avoidable only by never moving a card's static touch-target box via `left`/`top`.

## Scope

**In scope:** rail-fan layout (reused, unchanged, from `apps/playground/src/components/railFanLayout.ts`), tap-to-select/tap-to-play (two-tap and one-tap, mirroring Demo06), the departing card's fly-out/hold/return cycle, and the remaining hand's reflow — all driven by Reanimated shared values, with every card positioned purely via `transform` (never `left`/`top`) and touch-tracking via `react-native-gesture-handler`'s `Gesture.Tap()` bound to each card's own animated view.

**Out of scope, deferred to a future decision once this demo's result is known:** porting this design into Demo06 itself (ADR-001 explicitly defers this); any change to `apps/mobile` (Batak/Pişti); a shared abstraction between `useCardMotion` (Animated) and whatever Reanimated equivalent this demo builds — until a second real Reanimated consumer exists, per this repo's own established "don't extract until a third occurrence" convention (Constitution §8, gap 3).

## Constitution References

- **§5.VI (Coordinated Property Timelines)** — the departing card's position/scale/rotation must still start, retarget, and complete as one unit; Reanimated's `withTiming`/worklets must preserve this outcome, not just port the old mechanism.
- **§5.VII (Interactive Target Fidelity)** — the principle this demo's whole redesign exists to satisfy differently: touch-tracking via `Gesture.Tap()` against the actual rendered (transformed) view, instead of a moving `left`/`top` static box.
- **§5.IV (Deterministic, Pure Layout)** — rail geometry (`railPosition`/`railAngles`/etc.) is reused unchanged; this demo must not fork or duplicate that geometry (§5.II).
- **§7 item 1 / ADR-001** — this demo is the experiment feeding a possible future revisit of the engine Project Decision; it does not itself change that decision.
- **§6 (Rejected Proposals — Event-Driven Coordination)** — Reanimated's `useAnimatedReaction`/shared-value listeners must not be used to reintroduce live-progress-observation-driven coordination without a fresh justification; see Boundary Violations below.

## Architecture Ownership

| Behavior | Owner Layer (§4) | Why This Layer Owns It | Alternatives Considered | Why Rejected |
|---|---|---|---|---|
| Rail angle/position geometry (`railPosition`, `railAngles`, `railAngleStepDeg`, `railFanWidth`) | 2. Layout Engine | Pure functions of hand size/config, already Constitution-compliant (§5.IV) and already the SSOT `Demo06HandReposition.tsx` consumes | Fork a Reanimated-specific copy | Would violate §5.II (SSOT) with zero benefit — these functions return plain numbers, not `Animated.Value`s, so there is no engine-coupling reason to duplicate them |
| Deciding *that* select/deselect/play/reflow transitions happen, and their start/end keyframes | 3. Animation Planning | Mirrors `Demo06HandReposition.tsx`'s own `HandCardComponent`/`PlayedCard` role — event handlers decide the transition, the runtime executes it | Bake transition decisions into worklets directly | Would blur Planning into Execution (§5.I) — worklets should interpolate a given target, not decide whether a play/reflow is happening |
| Interpolating position/rotation/scale over time | 4. Animation Execution/Runtime | This is the layer under test — Reanimated shared values (`useSharedValue`) + `withTiming` inside worklets, replacing `useCardMotion`'s `Animated.timing` calls | Keep `useCardMotion` (Animated) and only add Gesture Handler for touch | Would not test the actual hypothesis (ADR-001's Context) — the suspected cost is in `left`/`top` layout, not in which library drives `transform` |
| Card stacking order during a reflow (departing card interleaved with its former neighbors) | 5. Rendering | Direct port of Demo06's `zIndex`-from-stable-original-index fix (Constitution §5.I evidence) — a proven pattern for this exact problem | Re-derive from scratch | No reason to — Demo06's fix is already the correct, Constitution-compliant answer to this specific problem and this demo reuses it unchanged |
| Touch/tap recognition for each card, tracking its true current (possibly mid-flight) position | 6. Interaction | `react-native-gesture-handler`'s `Gesture.Tap()`, bound per-card, is the mechanism this whole demo exists to validate for §5.VII | Reuse `Pressable` with a per-card static box (Demo06's existing fix) | That fix requires the static box to move with the card (`left`/`top` change) — exactly the cost this demo is trying to eliminate, not reproduce |

## Architecture Audit

**Feature Name:** Reanimated + Gesture Handler rail-fan hand reposition (Demo08)

**Objective:** validate, in isolation, whether eliminating `left`/`top` static-box repositioning (replaced by pure `transform` + gesture-handler touch-tracking) resolves Demo06's reflow stutter, per `ADR-001`.

**Constitution References:** §5.I, §5.II, §5.IV, §5.VI, §5.VII, §6 — see Constitution References above; not restated here.

### Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Rail geometry | Layer 2, `apps/playground/src/components/railFanLayout.ts` (pre-existing, shared with Demo06) |
| Card motion (position/rotation/scale over time) | N/A — new for this demo; Demo06's equivalent (`useCardMotion`, Layer 4) is a separate, unmodified implementation |
| Touch hit-testing | N/A — new for this demo; Demo06's equivalent (`Pressable` + per-card static box, Layer 6) is a separate, unmodified implementation |

### Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Rail geometry | Layer 2, same file, consumed not recomputed |
| Card motion | Layer 4, Reanimated shared values (`useSharedValue<{x,y,rotate,scale,glyphScale}>` per card slot) + worklet-driven `withTiming` |
| Touch hit-testing | Layer 6, `react-native-gesture-handler`'s `Gesture.Tap()` composed via `GestureDetector`, wrapping each card's own `Animated.View` (the actual transformed view, not a separately-positioned box) |

### Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched — a flat in-memory `Card[]` slice, same as Demo06. |
| 2. Layout Engine | Not touched — reuses `railFanLayout.ts` unchanged. |
| 3. Animation Planning | New per-demo logic (select/play/reflow keyframe decisions), structurally mirroring Demo06's own component-level decisions, not reused code. |
| 4. Animation Execution/Runtime | The layer under test. Reanimated shared values/worklets replace `useCardMotion`. |
| 5. Rendering | Reuses the zIndex-from-stable-index stacking pattern; `SimpleCard` reused unchanged. |
| 6. Interaction | New: `react-native-gesture-handler` `Gesture.Tap()` per card, replacing `Pressable` + moving static box. |

### Boundary Violations

None identified at audit time. One item flagged for explicit attention during implementation and Regression Review, not a violation on its own: Reanimated worklets execute on the UI thread and can read shared-value state synchronously in ways plain `Animated` cannot — this must not be used to reintroduce the kind of live-progress-observation coordination Constitution §6 rejects (e.g., a worklet reaching into another card's in-flight shared value to decide timing). Each card's motion must remain triggered/retargeted from the same kind of explicit, event-driven calls Demo06 already uses (tap handlers, `useEffect`/`useLayoutEffect`-equivalent triggers), not from observing another element's live animated value.

### Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| (none — see Boundary Violations note above, tracked as an implementation constraint, not a finding) | — | — |

### Risks

- **Gesture Handler + Reanimated is a genuinely different interaction model** (native gesture recognizers vs. RN's bridge-based responder system) — first real use of either in this repository; unknown-unknowns are more likely here than in a change reusing established patterns.
- **Rapid replay / stress conditions** (mirroring Demo06's own "Play all" stress test): must confirm a card mid-departure can't be re-triggered, and that gesture recognizers correctly release/reset between rapid taps.
- **New Architecture requirement:** Reanimated 4 requires React Native's New Architecture; if this Expo/RN version ever has New Architecture disabled for any reason, this demo (and its dependencies) would break — worth confirming as part of verification, not assumed.
- **Reduced-motion accessibility:** not yet addressed in this first pass, matching Demo06's own current state (no `AccessibilityInfo.isReduceMotionEnabled` handling in Demo06HandReposition either, per its own history — see the deal-sequence work's earlier reduced-motion fix elsewhere in this repo, which this demo does not yet replicate).

### Open Questions

None blocking implementation start — the one open question this whole demo exists to answer ("does this eliminate the reflow stutter?") is the acceptance criterion itself, not a pre-implementation blocker.

### Approval

**Approved to implement:** Yes (2026-07-29, per direct user instruction to proceed with the full redesign as a new, separate demo).
**Conditions (if any):** Live on-device verification (Android emulator, per this session's established EGL frame-timing method) required before this demo's result can be cited in `ADR-001`.

### Review Date

2026-07-29

### Reviewer

Claude (audited against `animation-architecture-constitution.md` directly, cross-referenced against `ADR-001` and `docs/animation/audits/Demo06-ReflowStutter-Audit.md`'s own root-cause analysis).

---

## Current Behavior

N/A at audit time — this is new code, not a fix to existing behavior. (Demo06's current behavior, the baseline this demo is compared against, is documented in `Demo06-ReflowStutter-Audit.md` and `Demo06-07-RailFanAudit.md`.)

## Expected Behavior

Tapping a card plays it: it lifts (two-tap mode) or departs immediately (one-tap mode), flies out along the rail's own converging geometry, holds, and returns — with no visible discontinuity, matching Demo06's own already-accepted motion shape. The remaining cards close the gap smoothly, with no visible stutter/hitch during the reflow — specifically confirmed via the same on-device EGL `app_time_stats` method already used in this investigation, not just a subjective "feels fine" impression, since that subjective impression is exactly what has been ambiguous across Demo06's prior fix attempts.

## Acceptance Criteria

- [x] Tapping any card in a 6+ card hand selects/plays it correctly in both one-tap and two-tap modes, mirroring Demo06's interaction model. Verified: 3 consecutive plays via the Android emulator, all cards departed/held/returned correctly with no lost/duplicated cards.
- [x] The played card's touch target tracks its true rendered position throughout flight (no dead zones, no stray hits on neighboring cards) — verified live, not just by code reading (§5.VII's own evidence note: this class of bug is only ever found through live interaction). `uiautomator`'s reported bounds per card matched the visual fan spread exactly (confirming the OS's own touch/accessibility layer sees the transformed position, not the fixed static box), and taps landed on the correct card.
- [x] The remaining hand's reflow shows no stutter across at least 3 consecutive plays from a cold app process — **confirmed by the user directly on their own Android Studio device/emulator: "reanimated working properly, all flow is robust on Demo 08."** This is the decisive verification for this criterion (see Notes).
- [x] EGL `app_time_stats` frame timing during a reflow is measured and compared directly against a same-repro Demo06 baseline captured in the same session. Result: **inconclusive on the project's own headless/sandbox Android emulator** — both Demo06 and Demo08 showed comparable avg (~17-24ms) and max (~290-400ms) frame times across an identical 3-tap protocol; this coarse, ~1s-aggregated metric did not show a clear differentiation either way on this emulator. Consistent with this repo's own prior finding that this bug class has historically only been reproducible on a physical device, never in emulator/browser proxies (§5.VII's own evidence note, and `[[dev_sandbox_no_device_access]]`).
- [x] `npx tsc --noEmit` clean on `apps/playground`.

## Risks

See Architecture Audit's Risks subsection above — not duplicated here.

## Regression Checklist

- [x] Constitution §9 checklist re-run against the diff (`AnimationReviewWorkflow.md` §7) — see Architecture Audit above; no Critical/Major findings.
- [x] No Stop Condition (`AnimationReviewWorkflow.md` §6) was worked around instead of resolved.
- [x] Confirm Demo06 itself is byte-for-byte unmodified by this branch (per direct user instruction) — only `Demo08ReanimatedHandReposition.tsx` (new), `types.ts`, and `AnimationPlaygroundScreen.tsx` (plumbing only) touched in `apps/playground/src/animation/`.
- [x] Confirm no other Playground demo (01–07) regressed from the new `babel.config.js` / `GestureHandlerRootView` wrapper added to `App.tsx` — both are additive (a passthrough root view; a babel plugin that only transforms code marked `"worklet"`), and `npx tsc --noEmit` is clean across the whole app. Not re-screenshotted per the user's standing 2026-07-17 no-unsolicited-screenshots preference; flagged as a light residual risk worth a glance next time any other demo is touched.

## Notes

Built directly in response to `ADR-001` — see that record for the full two-week investigation history and the reasoning for why this experiment is scoped as a *new, separate* demo rather than a Demo06 rewrite.

**A real bug was found and fixed during this demo's own live verification, not just Demo06's:** the first implementation read `handlePressRef.current` (a plain React ref) directly inside `Gesture.Tap()`'s `.onEnd` callback — since that callback is itself a worklet (runs on the UI thread), this triggered a real runtime warning (`[Worklets] Tried to modify key 'current' of an object which has been already passed to a worklet`) on every tap. Fixed by capturing `handlePress` directly by closure instead of through the ref indirection — the ref is still used for the "Play all" stress-test's `registerPress` plumbing, which is plain JS-thread-only code and was never the problem.

**Verification split across two environments, with different conclusiveness:**
- The project's own Android emulator (used throughout this session) confirmed functional correctness (3 consecutive plays, correct touch-tracking per `uiautomator`'s own transform-aware bounds reporting, no crashes after the worklet fix) but its coarse EGL `app_time_stats` frame-timing metric did not show a clear win over Demo06 on this specific repro — likely too coarse (≈1s aggregation) to catch the kind of brief hitch this whole investigation has been chasing, and/or the emulator's own software rendering pipeline swamps the smaller relative cost this experiment targets.
- **The user's own test on their physical Android Studio setup is the decisive result**: Reanimated works correctly, and "all flow is robust on Demo 08" — i.e., the reflow stutter that resisted five prior mitigation attempts under `Animated` (see `ADR-001`) does not reproduce here. This is consistent with this repository's own standing pattern (documented repeatedly in `CLAUDE.md` and Constitution §5.VII's evidence) that this class of bug has only ever been reliably observable on a real device.

**Standing guidance the user gave directly from this outcome, recorded for future sessions:** when an animation-quality problem persists despite multiple targeted mitigation attempts under the current engine, a scoped, isolated library-swap experiment (Reanimated, or whatever is next) — exactly the shape of this demo — is the sanctioned next escalation step, not an indefinite series of further patches. See `[[feedback_animation_library_swap_escalation]]` memory.

**Open follow-up, not yet decided:** per `ADR-001`'s own Revisit Trigger, this result should prompt an explicit decision (not a silent default) on whether/how to port this design into Demo06 itself, and separately, whether Constitution §7 item 1 (the `Animated`-not-Reanimated Project Decision) should be amended for future `apps/mobile` work. Raised with the user; not yet resolved as of this writing.

**Two-tap play mode regression, found and fixed (2026-07-29, same day as the above).** After the initial "Complete" pass, Two-tap play mode (tap to select/lift, tap again to play) stopped registering a card's first tap (select) at all — the card never lifted. Root cause: the "tap empty area to deselect" background gesture (`backgroundTap`, a `Gesture.Tap()` wrapping the whole screen including the hand) and each card's own `Gesture.Tap()` were both attached to the same touch stream, and — unlike RN's classic `Pressable`-in-`Pressable` nesting, which gives a nested child priority for free (how Demo06 gets this same "tap background to deselect" feature without any extra work) — Gesture Handler does not infer parent/child priority from view nesting alone. The background gesture was winning outright, so the card's own select never fired. `.blocksExternalGesture()` and `.maxDuration()` tuning were both tried and did not fix it (confirmed via temporary diagnostic logging — Metro's own terminal output, not `adb logcat`, is where this session's `console.log` calls actually landed, a real mid-investigation confusion worth flagging for future sessions). The actual fix is structural: `backgroundTap`'s `GestureDetector` now wraps only the mode-row/spacer region, never the hand — the two gestures no longer share any touch point, so there's no ambiguity left to arbitrate. Cost: tapping empty space *inside* the hand's own bounds (between/around cards) no longer deselects, a narrower scope than Demo06's equivalent feature; not expected to matter in practice since that region is mostly covered by cards anyway.

**A real testing-method limitation surfaced during this fix, worth recording for future sessions:** `adb shell input tap`'s synthetic touch events were not reliably recognized by `react-native-gesture-handler`'s native `TapGestureHandler` on the project's sandbox emulator — confirmed via both screenshots (the tapped card's visual state never changed) and diagnostic logging (the card's own `Gesture.Tap()` `.onEnd` never fired, not even with `success: false`), across a genuinely fresh emulator boot and Metro restart, ruling out stale state as the explanation. This made the emulator unusable for verifying this specific fix. The user's own live test on a physical Android Studio setup confirmed the fix works correctly (select-then-play in Two-tap mode). Recorded in memory as `[[feedback_adb_synthetic_tap_unreliable_gesture_handler]]`.
