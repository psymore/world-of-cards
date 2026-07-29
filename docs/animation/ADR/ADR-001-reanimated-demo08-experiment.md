# ADR-001: Prototype react-native-reanimated for a new Demo08, without touching Demo06

**Status:** Accepted — Demo08 built and live-verified; see Revisit Trigger for the outcome and the open follow-up decision it creates
**Date:** 2026-07-29
**Related Constitution sections:** `§7` item 1 (engine Project Decision + its Revisit Trigger), `§5.VI`, `§5.VII`, `§6` (Rejected Proposals — Event-Driven Coordination)
**Supersedes / Superseded by:** none yet — this does not change `§7` item 1 itself. `§7` item 1 stays in force for `apps/mobile` and for Demo06 unless/until this experiment produces evidence strong enough to revisit it there too.

## Context

Demo 06 (`apps/playground/src/animation/demos/Demo06HandReposition.tsx`) has been under active investigation for roughly two weeks: the remaining cards' reflow, when a card is played, stutters on-device (Expo Go, physical phone and the project's Android emulator), even though the equivalent motion in Demo 05 (a single card, no reflow) is smooth on the same device. Fix attempts tried, in order, all under the standing `§7` item 1 decision to stay on plain `Animated`:

1. `stopAnimation()` on unmount — no measured effect (nothing was actually in-flight to stop by the time a revisit happens).
2. Pooling `HandCard`'s and `PlayedCard`'s `Animated.Value`s in module-scope pools (`HAND_MOTION_POOL`, `PLAYED_CARD_MOTION_POOL`), removing GC-timing dependency for value allocation.
3. Skipping no-op native calls in `useCardMotion`'s `retarget`/`jumpTo` for properties already at their target (`docs/animation/audits/Demo06-ReflowStutter-Audit.md`) — a confirmed, real reduction in redundant native calls, but explicitly disclosed as a partial fix, since the audit's own root-cause analysis named a second, untouched hypothesis.
4. Delaying the remaining-hand reflow until the departure lands, instead of starting it mid-flight.
5. Removing/lightening card elevation/shadow — toggle-tested, reduced but did not eliminate the stutter.

The user's own repeated on-device retests after (1)–(4) still show the reflow stutter. The still-open hypothesis from `Demo06-ReflowStutter-Audit.md`'s own "Risks"/"Open Questions" sections is the more structural one: `HandCardComponent`'s touch-target box is positioned via plain `left`/`top` style values (not `transform`), specifically to satisfy Constitution `§5.VII` (Interactive Target Fidelity) after the 2026-07-28 rail-fan touch-target bug. Every remaining card's `left`/`top` changes simultaneously on a reflow, which is a real Yoga layout pass across up to N views in one React commit — a cost that is orthogonal to which animation engine drives the `transform`-based motion layered on top of it, since none of fixes (1)-(5) touch layout at all.

`§7` item 1's own Revisit Trigger is narrower than this ("per-frame native↔JS communication that plain `Animated` cannot provide") and does not, on its own, cover a Yoga-layout-pass cost. This ADR is not claiming that trigger has fired. It records a different, narrower rationale: react-native-gesture-handler's gesture recognizers can hit-test against a view's actual current (transformed) position without requiring the view's static layout box to move at all — which would let `§5.VII` be satisfied without ever touching `left`/`top` during a reflow, sidestepping the Yoga-layout-pass hypothesis entirely rather than optimizing around it. Reanimated is the natural pairing for that approach (worklet-driven shared values that a gesture-handler recognizer can read on the UI thread), not a general re-litigation of `§7` item 1's existing verdict.

The user, having spent close to two weeks on this specific problem and having built the Animation Architecture Constitution partly in response to it, directed trying Reanimated for this specific problem now, on an isolated branch, without touching the already-working (if imperfect) Demo06.

## Decision

Build a new, standalone `Demo08ReanimatedHandReposition` in `apps/playground` that reproduces Demo06's objective (rail-fan hand, tap-to-play, remaining-hand reflow) using `react-native-reanimated` (v4, shared values + worklets) and `react-native-gesture-handler` (`Gesture.Tap()` per card) instead of `Animated` + `Pressable`. Demo06 itself is not modified. This is scoped as a Playground experiment per the Constitution's own "Architecture-first development" goal (§3) and `CLAUDE_ANIMATION_RULES.md`'s "Demo First" rule — evaluated in isolation before any decision is made about porting it to Demo06, `apps/mobile`, or amending `§7` item 1.

Critically, this is not a transform-only swap of the animation *engine* underneath the same `left`/`top`-based static box design — per the Context above, that would not test the actual suspected root cause. Demo08's cards must be positioned purely via `transform` (Reanimated shared values), with the static box fixed and never re-laid-out on reflow; touch-tracking must be re-derived from the gesture recognizer's own view, not from a moving layout frame, to keep `§5.VII` satisfied under that design.

## Alternatives Considered

- **Transform-only swap, keep `left`/`top` static-box design.** Rejected as the first experiment: per the root-cause reasoning above, the Yoga layout pass is caused by `left`/`top` changing, not by which library drives the `transform` sitting on top of it — this variant would very likely reproduce the same stutter and not actually test anything new. (Offered to the user as an option; explicitly declined in favor of the full redesign, see the question this ADR's Context answers.)
- **Port the redesign straight into Demo06.** Rejected per direct user instruction — Demo06 stays as today's working reference/baseline until Demo08 is proven out independently.
- **Keep iterating on plain `Animated` (e.g., batching/staggering the reflow's native calls across frames, per the not-yet-tried candidates from this session's own investigation list).** Not rejected outright — still a live, cheaper option if Demo08 doesn't pan out — but after 3+ attempted mitigations under the current engine with the stutter still reported, Constitution-adjacent judgment (`systematic-debugging`'s "3+ fixes failed, question architecture" guidance) favors testing the architectural alternative now rather than a fourth incremental patch.

## Consequences

**Costs:** two new native-module dependencies in `apps/playground` only (`react-native-reanimated`, `react-native-gesture-handler`, plus their `react-native-worklets` peer) — playground-only per `CLAUDE.md`'s existing playground-isolation convention, so `apps/mobile`/`packages/ui` are unaffected. Requires a `babel.config.js` (previously absent in this app) and wrapping `App.tsx`'s root in `GestureHandlerRootView`. A second animation-primitive vocabulary now exists in the repo (Reanimated shared values/worklets alongside `useCardMotion`'s `Animated`-based design) until/unless one is chosen and the other is retired — acceptable for an isolated, explicitly-labeled experiment, not acceptable if left unresolved indefinitely.

**Benefits:** a real, on-device, apples-to-apples comparison against Demo06 for the specific bug that has resisted five prior mitigation attempts under the current engine; validates or falsifies the Yoga-layout-pass hypothesis from `Demo06-ReflowStutter-Audit.md` under a design that structurally cannot trigger it, rather than continuing to optimize around it.

## Revisit Trigger

This ADR should be revisited (updated with results, or superseded) once Demo08 has been live-verified on-device against the same reflow-stutter repro Demo06 has been tested against:
- **If Demo08 is confirmably smoother** (via the same EGL `app_time_stats` frame-timing method used elsewhere in this investigation, or unambiguous live feel on-device): open a follow-up ADR proposing whether/how to port this design to Demo06, and separately, whether `§7` item 1 itself should be amended for `apps/mobile`'s future games — do not silently start porting without that follow-up decision.
- **If Demo08 shows the same or a new stutter:** record that finding here (this ADR's Status moves to a closed/rejected-with-evidence state, not silently abandoned), and the next step reverts to the cheaper, not-yet-tried Demo06-side mitigations from this session's own candidate list (staggering the reflow batch across frames; decoupling the return-to-hand moment's compounded cost).

### Outcome (2026-07-29)

**The first branch fired: Demo08 is confirmably smoother.** The project's own Android emulator gave an inconclusive coarse EGL reading (comparable avg/max frame times to Demo06 on an identical 3-tap protocol — likely too coarse an instrument for this bug class, consistent with this repo's standing finding that it's only ever reliably reproduced on a real device). The decisive result is the user's own live test on their physical Android Studio setup: Reanimated loads and runs correctly, and "all flow is robust on Demo 08" — the reflow stutter that resisted five prior `Animated`-based mitigation attempts does not reproduce.

**This confirms the narrower hypothesis this ADR actually tested** (gesture-handler-based touch-tracking on a fixed static box, eliminating the `left`/`top` Yoga-layout-pass entirely) — it does not, on its own, prove Reanimated itself was the necessary ingredient versus the box-never-moves redesign being portable back to plain `Animated` + a from-scratch Gesture Handler integration. That distinction matters for the follow-up decision below and should not be silently collapsed into "just use Reanimated everywhere."

**Per this ADR's own requirement, the follow-up decision is now open, not defaulted:**
1. Whether/how to port this transform-only, gesture-handler-tracked design into Demo06 itself (retiring the `left`/`top` static-box model there).
2. Whether Constitution `§7` item 1 (the `Animated`-not-Reanimated Project Decision) should be amended — narrowly, for hand-reflow-shaped problems specifically, or broadly, for all future `apps/mobile` animation work.

The user gave standing guidance directly from this outcome, applicable beyond this one demo: **when an animation-quality problem persists despite multiple targeted, well-reasoned mitigation attempts under the current engine, a scoped, isolated library-swap experiment — built and evaluated in the Playground first, exactly as this ADR did — is the sanctioned next escalation step**, not an open-ended series of further patches under the incumbent engine. Recorded in memory as `[[feedback_animation_library_swap_escalation]]` for future sessions/games.
