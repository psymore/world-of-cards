# Architecture Audit: Batak Local-Departure → TravelCard Handoff Continuity

**Used per:** `../AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process).

*`QuickAuditTemplate.md` was checked first, per `[[feedback_ask_audit_template_choice]]` — its Eligibility checklist failed on 3 of 5 boxes (see "Quick Audit Eligibility" below). The user was given that reasoning plus three options (full audit / split per-layer quick audits / accept a looser reading) and chose the full template.*

---

**Feature Name:** Make the human-play handoff from `BatakHandCard`'s local-departure leg to `TrickCenter`'s `TravelCard` continuous, instead of timed by a guessed duration.

**Objective:** `BatakTrickResize-Audit.md` (2026-08-05) left this exact handoff as an open, unverified §5.V risk, conditional on an on-device pass. That pass has now happened (user report, 2026-08-19): the handoff reads as visibly less smooth than the Playground's `HumanHandFan` reflow demo. Fix the handoff so the next phase starts from the local-departure animation's true completion, not a duration guess running on a different thread.

*Scope note: an earlier draft of this audit also proposed fixing the `contentScale` "glyph size" discontinuity (`BatakTrickResize-Audit.md`'s own deferred Open Question) in the same change, reasoning that threading one more field through `useCardMotion` was cheap since the file was already being touched. On reflection that undersold the actual cost: making `contentScale` genuinely continuous requires `PlayingCard`'s `CornerIndex`/`CenterArt` internals to become Reanimated-aware (they currently apply it as a plain, non-animated number prop) — a Rendering-layer change to shared `packages/ui` code consumed by both games, not a same-file addition. That is its own quick-audit-ineligible feature, not a two-line extra. Descoped back out, staying deferred exactly as `BatakTrickResize-Audit.md` left it — this audit covers the timing/completion-callback fix only.

**Constitution References:** §5.I (Layered Ownership — Planning vs. Execution), §5.II (SSOT — the duplicated duration constant), §5.V (Visual State Continuity — the handoff itself), §5.VI (Coordinated Property Timelines — `contentScale`'s existing discontinuity), §6 (Rejected Proposals — this fix must not reintroduce per-frame progress observation), §8 gap 2 (related but distinct — that gap is about non-linear size variants, not timing).

---

## Quick Audit Eligibility — why this escalated

| Box | Result | Why |
|---|---|---|
| Touches exactly one Constitution §4 layer | **Fails** | Spans Layer 4/Execution (`useCardMotion.ts`'s `setTarget`, `BatakHandCard.tsx`'s departure effect) and Layer 3/Planning (`BatakScreen.tsx`'s phase-transition orchestration, which currently *is* the thing being fixed). |
| Adds no new Layout Engine geometry/coordinate math (§5.IV) | Passes | No geometry touched. |
| Does not change how multiple properties are coordinated on one transition (§5.VI) | **Fails** | The actual fix changes *how* the departure→flight transition is triggered — from a fixed-duration JS timer to an animation-completion callback. That is a mechanism change to the coordination itself, not a tuning of an existing coordinated call. |
| Adds/changes no interactive element's hit behavior (§5.VII) | Passes | No gesture/hit-testing code touched. |
| Is tuning of already-shipped/audited behavior, not a new mechanism | **Fails** | Replacing a duration-guess handoff with a completion-callback handoff is a new mechanism, not a parameter tweak. |

Three of five boxes fail — full template required.

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Local-departure leg's duration | Two independent readers of one constant: `HumanHandFan.tsx:45` exports `LOCAL_DEPARTURE_DURATION_MS`; `BatakHandCard.tsx:215` uses it as the `withTiming` duration (Layer 4, real); `BatakScreen.tsx:357,365` uses the *same* constant as a `setTimeout` delay to decide when the departure leg is "done" (Layer 3, a guess, not a read of Layer 4's actual state). |
| "Has the local-departure animation actually finished" | **No owner exists.** Nothing today asks Layer 4 whether the animation is done; Layer 3 assumes it from elapsed time. |
| Local-departure leg's `scale`/`x`/`y` target | `BatakHandCard.tsx`'s departure effect (`useCardMotion`'s `setTarget`), Layer 4 — correct owner, unchanged. |
| `contentScale` (corner-index/watermark compensation) during departure | Not animated at all — `BatakHandCard.tsx`'s `PlayingCard` render has no `contentScale` prop, so it's implicitly `1` for the entire local-departure leg, then jumps to `TRICK_CARD_CONTENT_SCALE` the instant `TravelCard` mounts. Flagged as an Open Question in `BatakTrickResize-Audit.md`, never resolved. |
| Phase transition (departure → armed pending play → possible trick completion) | `BatakScreen.tsx`'s `commitMove`/`armPendingPlay` closures, Layer 3 — correct owner, unchanged in kind, changed in *trigger source* (see Proposed Ownership). |

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| "Has the local-departure animation actually finished" | Layer 4, Execution — `useCardMotion.ts`'s `setTarget` gains an optional `onComplete` callback, wired through Reanimated's own `withTiming(value, config, (finished) => { if (finished) runOnJS(onComplete)(); })` third argument. This is a one-shot completion signal, not live progress observation — see Risks below for why this does not reopen §6's rejected proposal. |
| Local-departure leg's duration | Unchanged owner (`HumanHandFan.tsx`'s `LOCAL_DEPARTURE_DURATION_MS`), but `BatakScreen.tsx` stops reading it as a second, independent timer — it becomes purely a Layer-4 input (the `withTiming` duration), consumed nowhere else. |
| Phase-transition trigger (when does "departed" become "armed pending play") | Layer 3, Planning — `BatakScreen.tsx`, unchanged owner, but now driven by the `onDepartureComplete` callback threaded up from Layer 4 instead of its own `setTimeout`. Data now flows the correct direction: Execution reports completion up to Planning, Planning does not predict Execution's timing down. |
| `contentScale` during departure | **Unchanged — stays deferred.** Not in scope for this change (see Objective's Scope note); recorded again here so it isn't lost. |

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched. |
| 2. Layout Engine | Not touched. |
| 3. Animation Planning | `BatakScreen.tsx`'s `commitMove`/`armPendingPlay`: the trigger source for the departure→pending-play transition changes from a `setTimeout` duration-guess to a callback invoked by Layer 4 on actual completion. The *decision* of what happens at that transition (arm the pending play, compute trick-completion state) is unchanged — only *when it's told to fire* changes. |
| 4. Animation Execution/Runtime | `useCardMotion.ts`: `setTarget` gains an `onComplete` param, following the exact per-field pattern already used for `x`/`y`/`angleDeg`/`scale`. No new primitive class introduced. |
| 5. Rendering | Not touched. |
| 6. Interaction | Not touched. |

## Boundary Violations

**None found.** The completion callback flows from Layer 4 (which owns "is this animation done") up to Layer 3 (which owns "what happens next") — that is the correct direction per §4's layer model ("a layer may only consume the explicit output of the layers before it"), not a reach-around. Layer 3 no longer independently recomputes Layer 4's timing (fixes the §5.II duplication named in Current Ownership above).

No `AnimationReviewWorkflow.md` §6 Stop Condition applies. Checked specifically against "Stable component identity cannot be preserved": this fix does not change *when* `BatakHandCard` unmounts/`TravelCard` mounts relative to each other, only *what decides the timing* — so no new identity-loss risk is introduced.

## Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| `BatakScreen.tsx`'s `setTimeout(LOCAL_DEPARTURE_DURATION_MS)` assumes, rather than confirms, that Layer 4's `withTiming` animation of the same nominal duration has visually completed by the time it fires — a JS-thread timer racing a UI-thread animation across threads that this codebase's own Reanimated adoption (`ADR-002`) put on separate execution contexts | **Major** — confirmed reproduction (user's on-device report), not just a theoretical risk | Fixed by this change: replace the timer with `useCardMotion`'s new `onComplete` callback, so the handoff fires on Layer 4's actual completion signal, not a Layer 3 guess. |
| `contentScale` discontinuity at the same handoff (Open Question in `BatakTrickResize-Audit.md`, never resolved) | Minor — cosmetic, narrower than the timing issue, not confirmed independently perceptible from the user's report (which described general smoothness, not specifically a glyph-size pop) | Still deferred, per Objective's Scope note — a genuinely continuous fix requires `PlayingCard`'s `CornerIndex`/`CenterArt` to become Reanimated-aware (Rendering-layer change to shared `packages/ui` code), which is out of scope for this change. Left as Acceptable Technical Debt, already recorded in `BatakTrickResize-Audit.md`; not newly introduced here. |

## Risks

- **§6 (Rejected Proposals) — does `onComplete` reintroduce the rejected "Event-Driven Coordination" mechanism?** No. The rejected proposal was specifically about *observing live, in-flight progress* (`Animated.Value.addListener`, `stopAnimation(callback)`) to coordinate frame-by-frame, which required a per-frame native↔JS bridge round-trip under this codebase's animation engine at the time. A `withTiming(..., (finished) => {...})` completion callback is a single, one-shot signal fired once when the animation ends — a different primitive in kind, already the standard idiomatic way to sequence Reanimated animations, and not the mechanism §6's evidence was built against. This distinction is load-bearing for this audit's approval and is being stated explicitly, not assumed.
- **`runOnJS` reliability at unmount:** `BatakHandCard` unmounts shortly after its departure animation completes (the whole point of this fix). If the component is already unmounting when the UI-thread `withTiming` completion fires, `runOnJS(onComplete)` must still reach the still-mounted `BatakScreen`/`BatakTable` closures above it — verified by inspection: `onComplete` is a stable closure captured at effect-setup time referencing `BatakScreen`'s own state setters, not a ref into `BatakHandCard`'s own instance, so it remains valid regardless of `BatakHandCard`'s own mount state. Flagged for on-device confirmation rather than assumed safe by reasoning alone, consistent with this Constitution's own evidence that this class of bug is only ever caught live (§5.V's Bug-category-prevented note).
- **Reduced motion:** `BatakHandCard`'s departure effect already returns early under `reducedMotion` before this change (no departure leg runs at all in that case — `BatakScreen.tsx`'s `canLocalDepart` gate excludes `reducedMotion`). This fix only changes the *timed* path; the reduced-motion path (`armPendingPlay` called directly, no local-departure leg) is untouched and needs no completion callback since nothing async is happening on that path.
- **`onComplete`'s addition to `useCardMotion` is shared, not Batak-only:** `useCardMotion.ts` is also used by `PistiHandCard.tsx`. Adding an optional callback parameter that no-ops when omitted must not change Pişti's behavior — verified by design (additive, opt-in, same pattern every other `CardMotionTarget` field already uses for callers that don't need it).

## Open Questions

- None blocking. `contentScale`'s discontinuity (carried over from `BatakTrickResize-Audit.md`) remains open and deferred, unchanged by this audit — not a new gap, not resolved here.

## Approval

**Approved to implement:** Yes.

**Conditions:** On-device verification after implementation (per `AnimationReviewWorkflow.md` §7.4 — this repo's standing practice, no automated test substitutes for it):
- Does the human-play departure→flight motion now read as one continuous transition, comparable to the Playground `HumanHandFan` reflow demo's smoothness?
- Confirm no regression to Pişti's hand (shares `useCardMotion`).
- Confirm reduced-motion play still works (untouched code path, but worth a direct check since this file is being edited).

## Review Date

2026-08-19

## Reviewer

Claude Sonnet 5, in collaboration with the user (Ege Özel) — `QuickAuditTemplate.md` checked first per `[[feedback_ask_audit_template_choice]]`, found ineligible, user given the reasoning and chose the full template.
