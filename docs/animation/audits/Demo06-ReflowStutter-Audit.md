# Architecture Audit: Demo 06 Reflow Native-Stutter Mitigation (Step 1)

**Used per:** `../AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process). Completed before implementation begins, per direct user instruction — the Full template governs this fix, not `QuickAuditTemplate.md` (its eligibility checklist fails here: this touches more than `useCardMotion`'s own Layer 4 contract in spirit, since the change interacts with `§5.VII`'s touch-target-tracking requirement and with `§5.VI`'s coordinated-timeline guarantee, both explicitly disqualifying on the Quick template's checklist).

**Relationship to `Demo06-07-RailFanAudit.md`:** that document's "New Finding" section (2026-07-29) records the report (Demo 06 clean on web, stuttery on native) and three candidate hypotheses. The user confirmed Demo 05's departure/return motion is smooth on the same device ("very nice") and specifically identified the stutter as occurring on **the cards that remain in the hand** when a play happens (the reflow), not the departing card's own flight. This audit is step 1 of investigating and fixing that — a targeted, low-risk optimization to the shared `useCardMotion` primitive. It does not claim to be the complete fix; see Risks below.

---

**Feature Name:** Skip no-op native calls in `useCardMotion`'s `retarget`/`jumpTo` for properties whose target already equals their current value.

**Objective:** Reduce the amount of synchronous native-bridge work `HandCardComponent`'s reflow correction (`useLayoutEffect` → `jumpTo` + `retarget`, firing for every remaining card simultaneously on every play) performs, by not touching `scale`/`glyphScale` at all when they're already at their target — which, for every resting hand card in this demo, they always are.

**Constitution References:** §5.I (Layered Ownership — confined to Layer 4). §5.VI (Coordinated Property Timelines — the outcome this principle requires is preserved; see Boundary Violations). §5.VII (Interactive Target Fidelity — considered and found not implicated, since this change doesn't touch position/hit-region tracking at all, only which properties get a native call). Not a new Known Gap; this is a mitigation attempt for the finding already recorded in `Demo06-07-RailFanAudit.md`'s "New Finding" section.

---

## Root Cause Analysis (why this specific change)

`HandCardComponent`'s reflow effect (`Demo06HandReposition.tsx`) and its select/deselect effect both call `motion.retarget(idleKeyframe({ rotateDeg, x, y }), ...)`. `idleKeyframe` (`apps/playground/src/animation/types.ts`) defaults any unspecified property to `{ scale: 1, glyphScale: 1 }`. A resting `HandCard` **never** changes its own scale or glyph scale — those constants (`RESTING_SCALE`/`RESTING_GLYPH_SCALE`) are only ever used by the departing `PlayedCard`, a completely different component. This means every single `retarget`/`jumpTo` call `HandCardComponent` makes is **already** carrying `scale: 1, glyphScale: 1` — values that match the card's actual current state exactly, every time. `useCardMotion` doesn't know this and unconditionally fires a native call for all 5 properties regardless:

- `jumpTo` calls `.setValue()` on all 5 `Animated.Value`s (a native/JSI round-trip per call for a value with useNativeDriver active), including 2 that are being set to the exact value they already hold.
- `retarget` calls `Animated.timing(...).start()` on all 5, including 2 that register a brand-new (but functionally identical, zero-motion) native animation.

During a **reflow**, this fires for **every remaining card simultaneously** (up to 5 in this demo's default hand), synchronously, inside a `useLayoutEffect` (deliberately synchronous, to satisfy §5.V's "no stale frame" requirement — see the file's own doc comment). A single play therefore triggers up to `5 cards × 2 wasted properties × 2 calls (jumpTo + retarget) = 20` redundant native operations, concentrated into one blocking JS tick, on top of the genuinely-needed x/y/rotate work. This is a real, confirmed-by-code-read cost specific to the multi-card reflow path — consistent with the user's own report that the *remaining* cards are where the stutter shows up, and with Demo 05 (which only ever touches one card per play, never several at once, and never redundantly touches scale/glyphScale in the same layout-blocking way) being smooth on the same device.

**This is not claimed to be the complete fix.** The still-open, not-yet-tested hypothesis from `Demo06-07-RailFanAudit.md` — that the *real Yoga layout pass* triggered by every remaining card's static `left`/`top` changing simultaneously is a further, possibly larger contributor — is untouched by this change and remains open. This audit scopes only the cheap, safe, clearly-justified reduction; see Risks and Open Questions.

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Whether `retarget`/`jumpTo` fire a native call for a given property | Layer 4, Animation Execution/Runtime — `apps/playground/src/animation/engine/useCardMotion.ts`. Currently: unconditional, for all 5 properties, on every call. |

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Whether `retarget`/`jumpTo` fire a native call for a given property | Layer 4, same location — refined to compare each property's target against `getCurrentKeyframe()`'s corresponding value (already computed synchronously, no native round-trip) and skip the native call when they're exactly equal. |

No new value or geometry is introduced; this only changes *whether* an existing, already-computed comparison gates an existing native call.

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched. |
| 2. Layout Engine | Not touched. |
| 3. Animation Planning | Not touched — callers still decide *that* a transition happens and its start/end keyframe; this only affects the Runtime's execution of it. |
| 4. Animation Execution/Runtime | The only layer touched. `retarget` and `jumpTo` each gain a per-property equality check (`to[prop] === current[prop]`) before issuing that property's native call. Benefits every consumer of `useCardMotion` (Demo02–07), not just Demo06 — any caller passing `idleKeyframe` defaults for properties it isn't intentionally changing gets the same reduction "for free," with no caller-side changes required. |
| 5. Rendering | Not touched. |
| 6. Interaction | Not touched — no hit-region or touch-target logic is involved in this change. |

## Boundary Violations

**None found.** This stays entirely within Layer 4's existing contract — same inputs (`CardMotionKeyframe`), same outputs (the same `Animated.Value`s, the same `transform`/`glyphScale` shape), same call signature for every existing consumer. Checked against Workflow §6's Stop Conditions: none apply (no boundary crossing, no new geometry, no rendering/business-logic blur, no runtime needing game knowledge, no coordinate ambiguity, no forced unmount/remount, and ownership here is unambiguous).

**§5.VI check, explicit:** this principle requires properties describing one physical motion to be "triggered, retargeted, and completed as one coordinated unit... regardless of which primitives implement it." Skipping a property whose target exactly equals its current value does not decouple the timeline — a property that isn't moving was never part of the perceived motion to begin with, and every property that *is* moving is triggered/retargeted/completed exactly as before, in the same call, same tick. This is the same "ratify the outcome, not the mechanism" reasoning §5.VI's own rationale already uses to justify moving away from a single shared `progress` value.

## Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| Redundant native calls for unchanging properties, confirmed by code read, concentrated during multi-card reflow | Major (performance; not a violation of a named Foundational Principle, since no principle currently covers raw native-call volume — see the note in `Demo06-07-RailFanAudit.md` about a possible future Constitution entry for this class of issue) | Addressed by this change. Not yet confirmed to fully resolve the reported stutter — see Risks. |

No Boundary Violations or Critical/Major *architectural* findings block this change itself.

## Risks

- **Partial fix, disclosed up front.** This removes one confirmed, real source of redundant work (2 of 5 properties, always no-ops for `HandCard` specifically) but does not touch the other, still-untested hypothesis (the real native layout pass from every remaining card's static box repositioning simultaneously). If the user retests and the stutter persists, that hypothesis is still the next thing to investigate — a separate, likely bigger, follow-up audit, not a failure of this one.
- **Conservative by design.** Uses exact equality (`!==`), not an epsilon/threshold comparison — will occasionally fail to skip a truly negligible sub-decimal delta (e.g., floating-point residue), but will never incorrectly skip a property that should visibly move. No correctness risk in either direction.
- **No regression risk identified for other demos.** Every other `useCardMotion` consumer (Demo03/04/05/07's travel, Demo02's selection) either (a) genuinely changes every property it retargets (all differ from current, so every native call still fires, unchanged behavior), or (b) redundantly passes already-current defaults the same way `HandCard` does (behavior is visually identical, just cheaper). Confirmed by reading each call site's keyframe construction, not assumed.

## Open Questions

1. **Does this alone resolve the reported stutter?** Cannot be determined without the user's own on-device retest — this is the next required step after implementation.
2. **If not sufficient, is the deeper fix a redesign of how the static touch-target box is repositioned during reflow** (deferring/batching the real layout change, weighed carefully against §5.VII's touch-target-tracking requirement)? Explicitly out of scope for this audit; would need its own Full Audit if this step doesn't resolve the issue.

## Approval

**Approved to implement:** Yes (2026-07-29).
**Conditions (if any):** None beyond the two Open Questions above, both already disclosed as follow-up items rather than blockers to trying this step first.

## Review Date

2026-07-29

## Reviewer

Claude (root-caused via direct code read of `useCardMotion.ts`, `types.ts`'s `idleKeyframe`, and `Demo06HandReposition.tsx`'s reflow effect, cross-checked against the user's own on-device report)

---

## Implementation + Verification (2026-07-29)

**Implemented:** `apps/playground/src/animation/engine/useCardMotion.ts`'s `retarget` and `jumpTo` both now compare each property's target against `getCurrentKeyframe()`'s corresponding value and skip that property's native call (`Animated.timing(...).start()` or `.setValue()`) when they're exactly equal. Only file touched. `npx tsc --noEmit` clean.

**Web verification (Claude):**
- Re-ran `.superpowers/sdd/verify-zindex-fix.js` and `.superpowers/sdd/verify-rail-fan.js` — both still clean (zero console errors, correct interleaved zIndex stacking still confirmed, reflow/reparenting/touch-targets all still correct). Confirms this change didn't regress anything the earlier fixes already established.
- New script `.superpowers/sdd/verify-demo05-motion.js` — specifically targets the **opposite** case from Demo06 (a property that genuinely changes): read Demo 05's card's actual computed CSS transform matrix before, mid-flight, and landed. Confirmed the scale transform **does** change (`matrix(0.997...)` → `matrix(0.698...)`, a real 1 → 0.7 scale-down) and correctly resets back to the original after the hold/reset cycle. This confirms the equality-skip only short-circuits genuine no-ops — it does not accidentally suppress a real transition, which was the main correctness risk this change carried.
- Web verification **cannot** confirm whether this actually resolves the native stutter — that was never in question (see Risks above); it can only confirm no functional regression, which it does.

**Native re-verification: pending — the user's own retest on Expo Go.** If the stutter persists, the next step is the still-open, larger hypothesis (the real Yoga layout pass from every remaining card's static box repositioning simultaneously during reflow) — a separate Full Audit, not a patch on top of this one.
