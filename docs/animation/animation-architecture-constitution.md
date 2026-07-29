# Animation Architecture Constitution

**Status:** Release Candidate — structurally complete, believed ready to serve as the permanent Animation Architecture Constitution. Reflects technical/architectural maturity only; see Repository Adoption below for whether it is actually in force.
**Repository Adoption:** Pending — not yet formally adopted. Individual principles carry their own ratified/conditional/rejected status regardless of this field (§5, §6).
**Version:** 1.0
**Last Updated:** 2026-07-28
**Supersedes:** The verbal "Foundational Principles" draft discussed in chat prior to this document. That draft was never committed to the repo, so this is a from-scratch rewrite, not a patch.
**Relationship to existing docs:** `apps/playground/ANIMATION_ARCHITECTURE.md` and `CLAUDE_ANIMATION_RULES.md` remain the playground's concrete, day-to-day working guide (demo structure, methodology, engine-specific rules). This Constitution sits one layer above them: it states *why* certain rules must hold regardless of implementation, and it takes precedence where the two disagree. One disagreement exists today and is resolved explicitly in Project Decisions §1.
**Relationship to future ADRs:** This Constitution holds permanent, implementation-agnostic architectural rules (§5) — the parts of "why" that must survive any single implementation or project phase. Larger, project-specific architectural decisions (e.g., which animation engine to run today, how to sequence a multi-game rollout) belong in dedicated Architecture Decision Records once this repository adopts that practice, not in this document. Project Decisions (§7) is this Constitution's placeholder for that content in the meantime; when ADRs exist, §7's entries should migrate there and §7 should link out to them rather than hold decisions directly.

---

## 1. Philosophy

This Constitution exists because this codebase has already paid, more than once, for the same category of mistake in different disguises.

**Why regressions have historically occurred here.** Read across every animation bug cataloged in this repository's history — the `useCardMotion` jump artifact, `PlayedCard`'s mispositioned mount, the rail-fan touch-target bug, the Demo 01 fan-arc seam, the `TrickCenter` landing mismatch — and a single shape repeats: none of them were arithmetic errors. Each was a **boundary-crossing assumption** that was never written down: one layer assumed it knew what another layer's value meant, or assumed a component's current visual state without asking it, or assumed a static layout position still matched a moving visual one. The code on each side of the seam was individually correct. The bug lived entirely in the unstated agreement between them. This Constitution exists to make those agreements explicit ahead of time, instead of rediscovering them, one incident at a time, after they ship.

**Why the same lesson had to be learned twice.** Interactive Target Fidelity (§5.VII) is the clearest evidence for why a *document* is necessary and not just accumulated developer experience: the exact same bug — a Pressable's hit-test region silently drifting from its animated visual position — was found and fixed once in `SelectableCard.tsx`, and then independently rediscovered and independently re-fixed in the Demo 6 rail-fan work, in a different component, with no shared reference connecting the two occurrences. The first fix taught a real lesson; without a place for that lesson to live, the second occurrence had to relearn it from scratch.

**Why architectural consistency matters more than any one implementation.** This repository's roadmap does not stop at Batak. Klondike, Spider, FreeCell, Hearts, Spades, Gin Rummy, Crazy Eights, Blackjack, and Texas Hold'em are all still ahead of it, and `CLAUDE_ANIMATION_RULES.md` already states the animation engine is meant to be reusable across "Batak, Poker, Hearts, Spades, Bridge, other trick-taking card games" — not rebuilt per game. A locally excellent, principle-violating animation for one game is a cost that compounds with every future game that either copies its violations or has to diverge from its patterns. A principle-compliant implementation costs slightly more up front and pays that cost down across every game built after it.

**Why every future animation feature must be evaluated against this document.** The bug categories this Constitution names are not specific to Batak's trick-taking table or Pişti's shared pile — they are properties of *any* animated, interactive, multi-layer, multi-property UI. The next game is exactly as likely to reintroduce a stale-frame handoff, an ambiguous coordinate contract, or a drifted hit-target as this one was, unless it is checked against a standing reference before the fact rather than found live, on a device, after the fact — which is how every instance of these bugs was actually found in this repository so far.

**Operationally:** every future animation-touching change should be checked against the Architecture Review Checklist (§9) before code review, not instead of it. A principle violation found there is an architecture finding, not a style nitpick — treat it with the same weight as a correctness bug.

---

## 2. Scope

**In scope.** All animation implementation work in this repository that moves, transforms, or transitions visual card/table elements over time — currently `apps/playground` (the animation laboratory) and `apps/mobile` (Pişti, Batak, and every future game), plus any shared animation-relevant code that lands in `packages/ui`. This Constitution applies regardless of which underlying animation engine executes the work; see Project Decisions §1 for the engine currently in use, which is explicitly not part of this document's authority.

**Out of scope.**
- Game rules and state correctness — owned by `packages/engine`'s `RuleEngine`/`AIStrategy` contracts, governed by the architecture design documented separately in `CLAUDE.md`.
- Visual/art style decisions — card-back patterns, color palettes, iconography, table felt/wood treatments. Governed by `CLAUDE.md`'s existing "raise it, don't auto-mirror it" convention for per-game visual changes, not by this document.
- General React Native/Expo engineering practice unrelated to animation (navigation, state management, persistence).

Where a change touches both animation and one of these adjacent areas — for example, a new game's table layout — this Constitution governs the motion; the adjacent area's own conventions govern the rest.

---

## 3. Architectural Goals

**Deterministic behavior.** Given the same inputs, layout and motion calculations must produce the same outputs every time, independent of render timing or animation state. *Evidence this matters:* the Demo 01 fan-arc seam only appeared under certain Spacing values — a system that had been deterministic by construction from the start would have made that seam structurally impossible rather than merely untested. See §5.IV.

**Regression resistance.** The architecture should make it structurally harder for a previously-fixed bug class to recur in a new component, not merely document that it happened once. *Evidence this matters:* Interactive Target Fidelity had to be fixed twice, independently, because no standing rule connected the two occurrences. See §5.VII and §8, gap 3.

**Implementation independence.** Architectural rules describe responsibilities and outcomes, never specific engine APIs — so replacing the underlying animation engine is an implementation change, not an architectural rewrite. *Evidence this matters:* §5.VI had to be corrected specifically because its first draft (borrowed from `CLAUDE_ANIMATION_RULES.md`'s "one shared progress value") was actually a mechanism, not an outcome, and that literal mechanism had already caused a regression. See §5.VI and §7, item 1.

**Reusable architecture across future card games.** The animation system is being built once, for every game on the roadmap, not once per game. *Evidence this matters:* this goal isn't new to this document — `CLAUDE_ANIMATION_RULES.md` already states the engine must be usable for "Batak, Poker, Hearts, Spades, Bridge, other trick-taking card games," and `CLAUDE.md`'s roadmap lists nine more games still to be built after Batak.

**Architecture-first development.** New animation ideas are validated against this Constitution — and, per `apps/playground`'s own working method, against the isolated playground — before they reach production game code. *Evidence this matters:* `CLAUDE_ANIMATION_RULES.md`'s existing "Demo First" rule already establishes this discipline for the playground specifically; this Constitution extends the same discipline to architectural review, repository-wide.

---

## 4. Layer Model

The principles in §5 assume a specific division of responsibility. A layer may only consume the **explicit output** of the layers before it — never reach around it, never infer what it "probably" produced.

1. **Domain/Game State** — the authoritative facts (whose turn it is, which card was played, current score). Owned by `packages/engine`.
2. **Layout Engine** — pure geometry: given N cards and a container, where does each one sit, at what rotation, in what order.
3. **Animation Planning** — decides *that* a transition should happen and what its start/end states are (e.g., "this card moves from hand-slot-3 to the trick center").
4. **Animation Execution/Runtime** — drives interpolation over time for a planned transition. This is the only layer that should know about frames, timing, or the underlying animation primitive.
5. **Rendering** — paints the current interpolated values, and owns component identity (what React treats as "the same card" across renders).
6. **Interaction** — hit-testing and input routing for rendered elements.

Every principle in §5 is, in one way or another, "don't let one of these layers quietly do another layer's job."

---

## 5. Foundational Principles

### I. Layered Ownership

**Statement.** Each layer in §4 owns exactly one responsibility. No layer may perform another layer's job, even opportunistically or "just this once."

**Rationale.** When responsibilities blur, a bug's *symptom* shows up in one layer while its *cause* lives in another — the fix looks unrelated to the report, and reviewers waste time in the wrong file.

**Evidence.** The 2026-07-28 rail-fan reflow bug: stacking order (a Rendering-layer *style* concern) was implemented by splitting remaining cards across two separate JSX parents (a Rendering-layer *structural/identity* concern). React reconciles children by key only within one parent's array, so a card whose group changed was unmounted from one parent and remounted in the other — silently discarding its Animation Execution state (the live `Animated.Value`s) and snapping instead of easing. The fix moved stacking to a `zIndex` style value under one stable parent, restoring "Rendering paints order, Identity persists across it" as two separate facts instead of one entangled mechanism.

**Bug category prevented.** Instance-state loss disguised as an animation bug — it reads as "the timing broke," but the actual cause is "the component was destroyed and recreated."

**Constitution rule.** A layer's implementation must not be reachable for solving a different layer's problem. If a fix for a Rendering concern requires touching Animation Execution state (or vice versa), that is itself a signal the boundary has already been crossed.

---

### II. Single Source of Truth, Scoped to an Ownership Boundary

**Statement.** Within one ownership boundary (defined below), a given piece of information — data, geometry, or visual state — has exactly one authoritative owner. No other system within that boundary may recreate or independently recompute it.

**Scope clause.** An "ownership boundary" is, at minimum, one deployable application. The deliberate isolation between `apps/playground` and `apps/mobile` (documented in `CLAUDE.md`: playground must never import from `apps/mobile`, and vice versa) places each on its own side of a sanctioned exception to this principle — each may hold its own implementation of overlapping geometry primitives. This exception does **not** extend to duplication *within* a single application.

**Rationale.** Two independently-computed copies of the same fact drift the moment either one is fixed, extended, or reused in a new context, without a compiler or reviewer being able to see the other copy exists.

**Evidence (within-boundary violation, already fixed).** `PlayedCard` computed its mount position from `railPosition(departureAngleDeg)` alone — recomputing "where is this card" from scratch instead of asking `HandCard`, which already held the answer, including whether the card was currently lifted. A card played from the selected/lifted state would visibly snap down to its unlifted position before flying. Fixed by threading the actual `wasSelected` flag through instead of re-deriving it.

**Evidence (cross-boundary, sanctioned but currently drifted — see §8, gap 1).** `apps/mobile/src/table/seating.ts` and `apps/playground/src/animation/.../fanLayout.ts` independently implement the same fan-arc geometry. The seam-smoothness bug found and fixed in the playground (x and y computed from unrelated formulas, diverging under wider spacing) still exists in `seating.ts`, unfixed. The *duplication* is sanctioned by the scope clause above; the *unfixed known bug sitting in the un-updated copy* is not what the exception was meant to protect, and is tracked as an open gap rather than closed by this principle alone.

**Bug category prevented.** Divergent state between two independently-computed copies of the same fact, where one silently goes stale.

**Constitution rule.** Before adding a value, ask whether another layer already computed or holds it. If yes, consume it explicitly; do not recompute it, even for convenience.

---

### III. Explicit Contracts

**Statement.** A value crossing a layer boundary must fully specify its meaning — coordinate space, reference origin, units, and whether any offset is already applied. A consumer must never have to guess or assume a convention.

**Rationale.** Most of this codebase's animation regressions are not arithmetic errors — they are two correct pieces of code disagreeing about what a number *means*.

**Evidence.** `PlayedCard`'s landing X position was consistently half a card-width off. `railPosition().x` returns a **center-relative** coordinate; `HandCard` correctly converts it to a left-edge position before using it as a `left` style, but `PlayedCard` used the raw center-relative value directly as if it were already left-edge. Both call sites were individually "correct" against their own assumption — the contract itself was never written down. Separately: `PlayingCard`'s `"small"` and `"normal"` size variants were treated by `TrickCenter` as if scaling one produces the other, when in fact `CORNER_INDEX_WIDTH` and `WATERMARK_ICON_SIZE` are independently tuned per variant — an unstated assumption about the relationship between two values, not a wrong calculation.

**Bug category prevented.** A value that is computed correctly and then misinterpreted by its consumer — invisible to a reviewer who checks the producer and consumer separately but never checks their shared assumption.

**Constitution rule.** Any function or component boundary returning position, size, or timing data must document (in types, naming, or comments) the coordinate space and any pre-applied offsets. "It returns x and y" is not a complete contract.

---

### IV. Deterministic, Pure Layout

**Statement.** The Layout Engine (§4.2) is a pure function of its inputs. It has no knowledge of whether an animation is running, whether a gesture is active, or whether rendering has occurred.

**Rationale.** A layout formula that is allowed to depend on incidental state (render timing, animation phase) stops being reproducible — the same logical hand can lay out differently depending on *when* you ask, which makes bugs impossible to reproduce reliably.

**Evidence.** Demo 01's original fan layout computed `x` as a plain linear step and `y`/rotation as an independent function of rotation magnitude — two outputs that were supposed to describe one arc but were never tied to a shared geometric model. Under default settings they happened to look coincident; widening the Spacing slider (a pure input-space parameter) exposed a real, measurable seam. This is exactly the failure mode purity is meant to rule out: a "hidden" additional degree of freedom (two independent formulas standing in for one) that a handful of manual spot-checks at default settings won't surface. The fix ("tangent walk" — each card steps a fixed distance in the direction its own rotation implies) ties both outputs to one formula by construction, making divergence structurally impossible rather than merely untested.

**Bug category prevented.** Visual seams or misalignments that only appear for certain parameter combinations — the layout equivalent of an edge case, except the "edge" is a continuous slider, not a discrete branch.

**Constitution rule.** Layout functions take geometry/config in, geometry out. No animated or interpolated value of any kind, no reference to animation phase, no dependency on the render cycle, ever, in this layer.

---

### V. Visual State Continuity (bind the start value, not the path)

**Statement.** When one animation phase hands off to the next (Selection → Play, Play → Landing, Landing → Reposition), the next phase must begin from the **actual current interpolated value** of the property it is taking over — never from a recomputed or reset baseline. This binds the **starting value** of the transition. It does not require the interior trajectory of the next phase to reproduce the geometry of the previous phase's path.

**Rationale.** Interpolated animation state (an in-flight interpolated value) is not ordinary readable data — depending on the execution mechanism, reading it "live" can itself require asynchronous work (see §5.VI's evidence). Getting the *handoff* wrong is a distinct, narrower failure mode from ordinary state duplication (§5.II): the bug is not "two owners disagree," it's "the new phase started from a value that was never actually true."

**Evidence — the failure mode.** The `useCardMotion` "jump" bug (2026-07-26), reproducible only on a physical device, not in the browser/Playwright workflow: the original design reset a single shared `progress` value to `0` and swapped its `.interpolate()` mapping on retarget. The reset landed on the native side immediately; the new mapping only took effect once React's re-render committed, a moment later. In that gap, one real frame could paint through the *old* mapping evaluated at input `0` — a value that pointed at the *previous* leg's start position, never a real, intended state. Fixed by switching to per-property `Animated.timing()` calls that always continue from the property's actual current value, with no reset step to create a gap.

**Evidence — why the rule must bind start-value only, not the whole path.** The 2026-07-28 hand-reflow fix deliberately eases a card's x and y **independently** (a straight chord) when its rail position changes, rather than curving along the true arc — a known, accepted deviation from literally reproducing the previous phase's geometry. If this principle bound the entire path, that shipped, already-approved code would be non-compliant. The corrected wording reflects that the actual requirement in force is narrower than an earlier draft's "must begin from the exact state produced by the previous one" implied when read as covering the whole trajectory.

**Bug category prevented.** Single-frame or narrow-window visual "pop"/flash artifacts. Notably, none of this class of bug was catchable by code review or typechecking — every instance found in this repo's history was found live, on an actual device, which is itself evidence for why this principle needs to exist as a named category reviewers deliberately look for, rather than being left to chance discovery.

**Constitution rule.** A transition's initial value must be read from the property's true current state at the moment the transition starts. Do not require, and do not assume, that the interior motion of the new phase reproduces the old phase's path.

---

### VI. Coordinated Property Timelines

**Statement.** When a single physical event (a card being played, selected, or landing) changes more than one visible property — position, scale, rotation, glyph/content scale, opacity — those properties must be started, retargeted, and completed as one coordinated unit. Independently triggered, independently timed animations on properties that are supposed to describe one motion are not acceptable, regardless of how smooth each one is in isolation. **The mechanism used to achieve this coordination is explicitly not part of this principle** — see Rationale.

**Rationale — a mechanism was already tried and already regressed.** `CLAUDE_ANIMATION_RULES.md`'s existing "Single Timeline Principle" prescribes a specific *mechanism*: one literal shared scalar `progress` value driving every property via `.interpolate()`. That literal mechanism is what caused §5.V's `useCardMotion` jump-artifact bug — the reset-and-reinterpolate step is precisely what created the stale-frame gap. The fix that is actually confirmed correct on a physical device abandoned that mechanism in favor of multiple per-property `Animated.timing()` calls, launched and retargeted together — same coordinated *outcome*, deliberately different *mechanism*. This Constitution ratifies the outcome only. Re-adopting "one shared progress scalar" as a hard requirement would re-introduce a mechanism this codebase has direct, on-device evidence against.

**Evidence — the outcome is still genuinely necessary.** Batak's `TrickCenter` landing "settle": position and scale were not run as one coordinated unit against genuinely comparable end-states. Even where the scale interpolation itself was smooth, it was interpolating between `"small"` and `"normal"` — two card-size variants whose internal layout constants are independently tuned, not linear functions of one another (§5.III). The shipped mitigation — freezing the traveling card at a constant `size="normal"` for the entire flight — avoids the mismatch by removing the size transition altogether. It is recorded here as an **open gap** (§8, gap 2), not as a template: it sidesteps this principle rather than satisfying it.

**Bug category prevented.** Motion that looks acceptable property-by-property but reads, as a whole, like two or three unrelated animations stitched together — the "the card moved up, then translated, then resized" perception the playground docs already name as the thing to avoid — or motion that arrives at a shape/position that never coexisted with itself mid-transition.

**Constitution rule.** A transition affecting N properties must be triggered, retargeted, and interrupted as a single logical operation, whatever primitives implement it. A future engine change (e.g., adopting Reanimated) must preserve this outcome; it is not required to preserve "one shared scalar" as the means.

---

### VII. Interactive Target Fidelity

**Statement.** The hit-testable region of an animated element must track its true rendered/composited position, never a static layout position, in any implementation where the two are permitted to diverge (e.g., transform-driven motion that deliberately bypasses layout for performance).

**Rationale.** High-performance animation implementations generally move content via compositing-layer properties (transform) precisely *because* they skip layout/relayout — but hit-testing in most UI stacks, this one included, is layout-frame-based by default. That asymmetry means any animated element's touch target silently drifts out of sync with what the user sees unless someone corrects it explicitly; nothing about "the animation works" implies "the touch target still matches."

**Evidence.** This exact bug occurred twice, independently, from the same root cause: `apps/mobile/src/components/SelectableCard.tsx`'s pre-existing `hitSlop` workaround, and the Demo 6 rail-fan bug where every `HandCard` shared one identical static `Pressable` box (all real positioning lived in `transform`) — RN hit-testing followed the shared static layout frame, so only the last-painted (rightmost) card could ever receive a tap, regardless of where the user actually pressed. Fixed by giving each card a real, per-card static box at its own resting rail position, and expressing the animated transform as a **delta** from that origin rather than an absolute position — the touch target and the visible card move together by construction.

**Bug category prevented.** Input silently routed to the wrong element, or dropped entirely. This class is close to invisible to code review or typechecking — every instance in this repo's history was found only through live interaction testing, never through reading the diff.

**Constitution rule.** Any animated, tappable element's interactive bounds must be re-derived whenever its position changes via a mechanism layout doesn't observe. Do not assume an interactive element's layout frame tracks its rendered position.

---

### VIII. Testable Core — ratified in principle, not yet in force

**Statement.** Geometry and layout logic covered by §5.IV must be verifiable through deterministic automated tests, independent of rendering.

**Rationale.** This is close to a direct consequence of §5.IV: a pure, side-effect-free function is inherently unit-testable. What this principle adds is turning that *possibility* into a *requirement* — purity alone doesn't guarantee anyone writes the test.

**The unresolved conflict — stated explicitly, not glossed over.** Every animation sub-project shipped in this repository to date (Demo 01's fan layout, `seating.ts`'s rail geometry, `useCardMotion`) has **zero automated tests**. Every one was verified via `tsc --noEmit` plus live/on-device or Playwright confirmation only. This is not an oversight — it is the direct, correctly-applied consequence of the repo's standing 2026-07-07 policy of not writing new tests for mobile UI by default. That policy was written before this Constitution and was never scoped to exclude animation geometry.

**Why this matters concretely, not just procedurally.** The Demo 01 seam bug is the textbook case this principle exists to prevent: it shipped, undetected, specifically because verification was visual spot-checks at default parameter values rather than a property-based or multi-value automated test. The same *shape* of gap — "an extreme/edge case tested with only one candidate, so a plausible-but-wrong implementation passes anyway" — was independently caught three separate times during Batak's RuleEngine review (unrelated to animation), suggesting it's a recurring blind spot for this codebase generally, not a one-off.

**Bug category prevented (once actually adopted).** Regressions in geometry formulas that a visual spot-check won't reliably catch, especially for parameter combinations that don't happen to be the ones screenshotted.

**Constitution rule — conditional.** This principle cannot be marked ratified-and-binding until one of the following is explicitly decided and recorded in Project Decisions:
(a) animation-critical geometry (Layout Engine outputs, arc/fan math, position resolution) is a carved-out exception to the 2026-07-07 no-new-tests default, or
(b) this principle is downgraded from a hard rule to "should, where practical."
Until that decision is made, treat this principle as **proposed**, not enforced — see §8, gap 4.

---

## 6. Rejected Proposals

*(Titled "Rejected Proposals," not "Rejected Principles" — nothing catalogued here was ever ratified before being rejected; the distinction matters because §10 sets a different bar for promoting a rejected proposal than for amending a standing principle.)*

### Event-Driven Coordination — rejected for Version 1.0

**What was proposed.** Animation coordination driven by explicit progress/threshold events (`CardClearedHandBoundary`, `CardReachedTarget`) rather than elapsed-time waits or `progress > X` checks.

**Why it is not ratified.** This is the one principle in the original draft with no supporting evidence *from this codebase* — and the one place its underlying mechanism (observing live animation progress from outside the animation itself) was actually tried here, it was the **cause** of a bug, not the fix for one. `useCardMotion`'s original design used `Animated.Value.addListener`, then `stopAnimation(callback)`, specifically to observe live position for coordination purposes. Both were found, during the 2026-07-26 investigation, to require an asynchronous native↔JS bridge round-trip under the currently adopted engine (confirmed by reading `AnimatedValue.js`'s actual source, not assumed) — and the fix that is confirmed correct on a physical device replaced observation with direct, synchronous calls, removing the bridge dependency entirely.

Threshold events of the kind proposed (`CardClearedHandBoundary`) require exactly that same kind of live-progress observation to raise. Ratifying this principle today would be recommending a mechanism this codebase has direct, on-device evidence against, in service of a bug category that hasn't actually occurred here.

**Reopening condition.** This should be reconsidered only after a concrete technical spike demonstrates threshold/progress events can be raised without per-frame cross-thread communication, under whatever animation engine is current at the time (see Project Decisions §1). Until such a spike exists and is recorded, this proposal is **rejected**, not merely deferred — it should not be silently reintroduced on the strength of a future engine swap alone.

---

## 7. Project Decisions

These are **not** architectural principles. They are current, explicitly revisitable implementation choices, recorded here so future readers don't mistake them for constitutional rules — and so the Constitution itself stays implementation-agnostic. See the header's "Relationship to future ADRs" note for how these entries relate to eventual dedicated ADRs.

1. **Animation execution engine: React Native's built-in `Animated` API, not Reanimated.** *(Superseded for `apps/mobile` by `ADR-002` — see below. Still in force for `apps/playground`'s Demo06, which remains the plain-`Animated` baseline/reference alongside Demo08's Reanimated experiment.)* This directly overrides `apps/playground/ANIMATION_ARCHITECTURE.md`'s own "Suggested Technology" section, which recommends Reanimated/worklets/shared values. That recommendation predates the 2026-07-26 investigation; this repo has since reconsidered the Reanimated question twice, and on the second occasion upheld staying on plain `Animated` with concrete, on-device evidence — the actual reported jump-artifact bug was root-caused and fixed using plain `Animated`, once the correct mechanism (direct `Animated.timing` calls, not listeners) was used, not by switching engines. A third reconsideration (`ADR-001`, a scoped Demo08 experiment) led the user to directly instruct a full `apps/mobile` migration to Reanimated + Gesture Handler, starting with Batak — recorded as `ADR-002`, which supersedes this entry for `apps/mobile` specifically. **Revisit trigger (for `apps/playground` only, where this entry still applies):** if a future application of §5.VI, or a future spike reopening §6's rejected proposal, turns out to require per-frame native↔JS communication that plain `Animated` cannot provide without reintroducing the 2026-07-26 bug class.
2. **Cross-application SSOT exception (§5.II scope clause):** `apps/playground` and `apps/mobile` intentionally maintain independent fan/rail geometry implementations, per the `apps/playground` isolation boundary defined in `CLAUDE.md`. Sanctioned. The specific consequence — a known bug fixed in one copy and not the other — is not sanctioned by this exception and is tracked as a gap (§8, gap 1).
3. **Testable Core carve-out (§5.VIII):** undecided. Needs an explicit choice between (a) or (b) as stated in §5.VIII before that principle can be considered in force.

---

## 8. Known Architectural Gaps

1. **`seating.ts` (apps/mobile) has not received the fan-arc seam fix already shipped in `apps/playground/fanLayout.ts`.** Sanctioned as a cross-boundary duplication (Project Decisions §2), but porting the fix — or not — is an open decision, not resolved by this document.
2. **§5.VI has no working reference implementation for property pairs whose end-states are not linearly related** (the `TrickCenter` size-variant landing mismatch). The shipped behavior (freeze size, skip the transform) is a workaround explicitly recorded as non-compliant with the principle's intent, not a pattern to replicate elsewhere.
3. **§5.VII has been fixed twice, locally, with no shared abstraction extracted yet** (`SelectableCard`'s `hitSlop` workaround and `HandCardComponent`'s per-card static box are separate, parallel fixes). Consistent with this repo's own established convention of not extracting a shared primitive until a third real consumer appears (e.g., `TableFelt` was only extracted once Pişti and Batak both needed it) — flagged so the third occurrence is recognized as the extraction trigger rather than re-solved from scratch.
4. **§5.VIII is unresolved between "ratified" and "aspirational."** No decision has been made on the testing-policy carve-out; until one is made, this principle should not be cited as an enforced rule in review.

---

## 9. Architecture Review Checklist

For any change touching animation, before code review:

- [ ] **(§5.II)** Does this introduce a value that another layer already owns or computes? If so, consume it explicitly instead of recomputing it.
- [ ] **(§5.III)** Does every new interface crossing a layer boundary document coordinate space, origin, and units — not just "returns x/y"?
- [ ] **(§5.IV)** Does the Layout Engine code stay free of any dependency on animation phase, gesture state, or the render cycle?
- [ ] **(§5.V)** Does every transition read its starting value from the property's actual current state, with no reset-then-reinterpolate step that could paint a stale frame?
- [ ] **(§5.VI)** Do properties describing one physical motion start, retarget, and complete together as one unit — regardless of which specific primitives implement that?
- [ ] **(§5.VII)** If an element's visible position is driven by a mechanism layout doesn't observe (e.g., `transform`), does its hit-test region track that position explicitly?
- [ ] **(§5.VIII)** If this adds new geometry/layout math, has the testing carve-out question (§7, item 3) been resolved for this change, or does it need explicit sign-off to ship untested?
- [ ] **(§6)** Does this introduce any new dependency on *observing* live animation progress for coordination logic? If so, it needs its own justification against the rejected-proposal reasoning, not a silent reintroduction.

---

## 10. Future Evolution

This Constitution is a living document, not a frozen artifact — but "living" here means "amended deliberately, with evidence," not "reinterpreted casually in the moment a rule is inconvenient."

**Versioning.** This is Version 1.0 (Release Candidate). A change that adds, removes, merges, or materially reweights a Foundational Principle, or changes what's in Scope, is a substantive change and should bump the version. Wording or formatting fixes that don't change what's required don't need a version bump, but should still be noted once this document is out of draft.

**Promoting a rejected or conditional proposal.** A rejected proposal (§6) or a conditional principle (currently §5.VIII) may only be promoted to a ratified, binding Foundational Principle on the strength of the same evidentiary bar every other principle in this document was held to: a real bug this repository actually experienced that the proposed rule would have prevented, or — for Event-Driven Coordination specifically — a concrete technical spike satisfying its stated reopening condition (§6). Arguing that a rejected proposal is "good practice" in the abstract is not sufficient; that same argument was already made for it once and was insufficient then too.

**Demoting or amending a ratified principle.** A Foundational Principle should be revised, not silently reinterpreted, if concrete evidence (the same kind used to justify it originally — an actual bug, an actual on-device finding) shows its prescribed outcome is wrong, or if the Layer Model (§4) itself changes (a new layer is introduced, or two layers merge). A principle whose *mechanism* turns out to conflict with a Project Decision (see next) should be narrowed to its outcome, following the precedent already set by §5.VI.

**The independence check.** Because this Constitution is meant to survive an animation-engine change, any time a Project Decision (§7) changes — most notably the animation engine itself — check every Foundational Principle against the new decision. If satisfying a principle turns out to depend on which engine is in use, that principle was actually a Project Decision mis-filed as architecture, and should be reclassified, not defended in place. This is the same check that produced §5.VI's current wording and should be applied again at the next engine change, not treated as a one-time fix.

**Conditional principles must not calcify.** §5.VIII is explicitly conditional as of Version 1.0. It must be revisited at the next substantive revision of this document and either resolved (ratified, with the testing-policy carve-out question in §7, item 3 answered) or explicitly re-flagged as still open. A conditional principle that sits unresolved for multiple revisions without anyone revisiting it is a failure of this section, not a neutral default.

**Gaps are triaged, not archived.** Each entry in §8 should be closed with evidence (a fix landed, verified against the principle it violates) or explicitly carried forward at each substantive revision. A gap that quietly stops being mentioned without being closed has not been resolved — it has been lost.
