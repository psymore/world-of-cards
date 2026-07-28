# Architecture Audit: Rail-Fan Reflow Rewrite (Demo 06/07)

**Used per:** `AnimationReviewWorkflow.md` §2 and §4. **Note on sequencing:** this audit is retroactive — the implementation (branch `feature/playground-demo06-rail-fan`, commit `1a69387`) predates the Constitution/Workflow/Audit Template's existence. It is being run now, before any merge decision, specifically to bring pre-existing work under the new process rather than grandfather it in unaudited. "Approval" below means approval to merge, not approval to begin implementing.

**Scope of this audit:** the entire `feature/playground-demo06-rail-fan` branch (18 files, +1334/−319) — not a single demo, per `AuditTemplate.md`'s own guidance to use a standalone copy when work spans multiple demos and touches `apps/mobile`.

---

**Feature Name:** Rail-fan touch-target fix, `useCardMotion`-based reflow rewrite, and Demo 07 (renamed/evolved from Demo 06 Complete Sequence).

**Objective:** Close the standing animation-quality backlog (`animation-architecture-constitution.md`'s own development history, and the pre-Constitution `CLAUDE.md` entries dated 2026-07-28) — a broken touch target on Demo 6's rail-fan cards, a JS-thread stutter in the reflow motion, a reparenting bug that silently dropped animation state, and a coordinate-math bug that made the played card visibly pop sideways.

**Constitution References:** §5.I (Layered Ownership), §5.II (SSOT, scope clause), §5.III (Explicit Contracts), §5.IV (Pure Layout — new geometry), §5.V (Visual State Continuity), §5.VI (Coordinated Property Timelines), §5.VII (Interactive Target Fidelity), §5.VIII (Testable Core, still conditional), §8 gap 1 (`seating.ts`/`fanLayout.ts` divergence), §8 gap 2 (`TrickCenter` resize mismatch).

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Cartesian fan geometry (Demo 01–05, 07) | Layout Engine — `apps/playground/src/animation/components/fanLayout.ts` |
| Rail (angle-on-a-circle) fan geometry (Demo 06) | Layout Engine — new: `apps/playground/src/animation/components/railFanLayout.ts` |
| Per-property interpolated motion | Animation Execution/Runtime — `apps/playground/src/animation/engine/useCardMotion.ts` |
| Touch-target hit region for a hand card | Interaction — previously a shared static box across all cards (the bug); now each card's own `Pressable` |
| Production Batak's human-hand local-departure travel | Rendering/Animation Planning — `apps/mobile/src/games/batak/table/HumanHandFan.tsx` (untouched by this branch, referenced only) |

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Rail fan geometry (`railAngleStepDeg`, `railAngles`, `railPosition`, `railFanWidth`) | Layer 2, Layout Engine — confirmed pure: no React, no `Animated`, no timing dependency (verified by reading the file) |
| `useCardMotion.jumpTo` (new) | Layer 4, Animation Execution/Runtime — an additive capability on the existing primitive, not a new one |
| `HandCard`'s per-card static `Pressable` box at its own `railPosition(slot.angleDeg, 0)` | Layer 6, Interaction — now correctly tracks Layer 5's rendered position instead of a shared fixed box |
| Demo 07's `splitEaseOutCubic`-driven local-departure leg | Layer 3, Animation Planning — decides the split point and derives both legs' easing from one continuous curve; execution still delegated to `useCardMotion` |

Every row maps to exactly one layer — no Boundary Violation surfaced at the ownership-modeling level.

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched. `useDealLoop.ts` (Demo 07's turn/deal source) is pre-existing on `master`, unmodified by this branch. |
| 2. Layout Engine | New geometry in two places: `railFanLayout.ts` (entirely new file) and `fanLayout.ts`'s new `AsymmetryOptions`/`leftWeight` param. Both verified pure — no side effects, no framework imports. |
| 3. Animation Planning | Demo 07's `play()` decides *whether* a local-departure leg happens (`progressFraction >= 1` check) and computes both legs' split via `splitEaseOutCubic`. |
| 4. Animation Execution/Runtime | `useCardMotion` gains `jumpTo`; no change to its existing `retarget`/`transform`/`glyphScale` contract. Confirmed `useRailCardMotion` (the JS-thread rAF hook blamed for the stutter) is fully gone — not present anywhere in this diff or on `master`, consistent with it having been created and deleted entirely within this same uncommitted period. |
| 5. Rendering | `HandCardComponent`/`PlayedCard`/`TrickCardComponent` paint `useCardMotion`'s interpolated output. `SimpleCard.tsx`'s palette/shadow change and the new `FeltBackground`/`FanConfigControls` components are pure presentation, no logic. |
| 6. Interaction | The touch-target fix: each `HandCard`'s `Pressable` box now sits at its own resting `railPosition`, with `motion.transform` rendering as a delta from that origin — verified directly in the code, not just asserted in `CLAUDE.md`. |

## Boundary Violations

**None found in the current code.** Specifically checked and cleared:

- **Rendering performing business logic** — not found. `HandCardComponent`/`PlayedCard` consume `railPosition()`'s output; they don't compute their own geometry.
- **Animation Runner requiring game knowledge** — not found. `useCardMotion` remains fully generic (`x`/`y`/`rotateDeg`/`scale`/`glyphScale`); nothing card- or game-specific leaked into it.
- **Stable component identity** — this was the one *actual*, confirmed violation in the branch's own history (the two-JSX-parent stacking trick silently unmounting/remounting cards on reflow, per `CLAUDE.md`'s 2026-07-28 entry and §5.I's own Constitution evidence). Verified fixed: `Demo06HandReposition.tsx`'s render now keeps every remaining card as a direct sibling under one shared parent with a stable `key={card.id}`, controlling stacking purely via a `zIndex` style (`i` for hand cards, `originalIndex + 0.5` for the departing card). Read the actual render code to confirm this, not just the changelog's claim.
- **Coordinate ownership ambiguous** — this was also a real, confirmed bug (`PlayedCard`'s mount/landing X math missing the same `SIMPLE_CARD_WIDTH / 2` conversion `HandCard` already applied). Verified fixed at both the mount (`absoluteX`) and landing (`x: centerXAtPlay - SIMPLE_CARD_WIDTH / 2 - absoluteX`) sites, with inline comments explicitly naming the convention (`railPosition`'s `x` is center-relative) at each conversion point — this is Explicit Contracts (§5.III) done correctly, not just fixed by accident.

## Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| New Layout Engine geometry (`railFanLayout.ts`, `fanLayout.ts`'s `AsymmetryOptions`) has zero automated tests | Requires an explicit decision (§5.VIII, Workflow §7.4) | **Not resolved — open, blocks Definition of Done until decided.** Per Workflow §7.4, this cannot be silently skipped; requires either a test (if §7 item 3's carve-out is granted) or an explicit sign-off to ship untested (matching current standing practice). |
| No live/on-device or Playwright verification has happened for any of this branch's fixes | Blocks Definition of Done (Workflow §9) | **Not resolved — this is the primary blocker.** `CLAUDE.md`'s own entries for this work end with "pending the user's own live confirmation" and "still pending the user's own live confirmation" twice in a row. Static code review (this audit) confirms the fixes are correctly *implemented*; it cannot confirm they *feel right on a device*, which is the actual bar this backlog was opened against. |
| `railFanLayout.ts` and `fanLayout.ts` are two independent Layout Engine implementations coexisting inside the same ownership boundary (the Playground itself) | Minor / Open Question | Not a Boundary Violation — they model genuinely different geometries (Cartesian tangent-walk vs. angle-on-one-circle) for different demos, and the rail model exists specifically because the Cartesian model can't support smooth single-arc reflow (per `railFanLayout.ts`'s own comment). But whether this is a permanent two-model system or a transitional state pending consolidation is undecided — see Open Questions. |
| Demo 07's local-departure mechanism explicitly mirrors **production** Batak's `HumanHandFan.tsx`, not the reverse | Minor / Acceptable Technical Debt, needs to be named explicitly | The established flow (`CLAUDE_ANIMATION_RULES.md`'s "Final Objective": Playground perfects, Batak consumes) runs Playground → Production. Here a Playground demo is explicitly built to mirror an already-shipped production pattern. Not a violation of anything in the Constitution — SSOT's scope clause (§5.II) sanctions independent implementations across this exact boundary — but it's a direction reversal nobody has written down before now. See Open Questions. |

No Critical or Major findings. Every bug this branch's own commit message and `CLAUDE.md` claimed to fix was independently re-derivable from the code itself, not taken on faith.

## Risks

- **Rapid replay / stress conditions**: `Demo06HandReposition.tsx` and `Demo07CompleteSequence.tsx` both ship a "Play all" stress-test button that fires every card's real press handler on a stagger — this is a positive sign (the same class of risk flagged in the pre-Constitution Animation Playground history is being actively tested for), but its *results* haven't been reported anywhere in this branch's commit or `CLAUDE.md` — worth confirming during live verification, not assuming clean.
- **Reduced-motion accessibility**: neither `useCardMotion` nor the rail-fan demos reference `useReducedMotion` (unlike `apps/mobile/src/table/TravelCard.tsx`, which does, and is otherwise untouched by this branch). This may be an intentional Playground-scope decision (per `ANIMATION_ARCHITECTURE.md`'s "Playground Scope" — production-fidelity concerns like this are sometimes deferred to the port), but it's not stated anywhere in this branch — worth an explicit note before this pattern reaches `apps/mobile`.
- **Interruption mid-animation**: `Demo06HandReposition.tsx`'s reflow effect uses `jumpTo` specifically to handle a card being retargeted mid-flight when its rail angle shifts — this is the correct mechanism per Visual State Continuity (§5.V), but the *only* verification so far is `tsc --noEmit` plus the code's own reasoning; no live confirmation this reads correctly under rapid successive plays.

## Open Questions

1. **Is `railFanLayout.ts` meant to eventually replace `fanLayout.ts`, or do both permanently coexist for different demo purposes?** Not blocking, but should be answered before a third rail-adjacent demo is built on top of either assumption silently.
2. **Should Demo 07's mirroring of production `HumanHandFan.tsx` be recorded somewhere durable** (an ADR, or a note in the eventual `Demo07.md`) **so the production→playground reference direction is a documented, deliberate choice rather than an undocumented one-off?**
3. **Does the new Layout Engine geometry in this branch get the Testable Core carve-out (Constitution §7 item 3), or explicit sign-off to ship untested?** This needs to be answered, not defaulted.
4. **Has the live/on-device verification this backlog has been waiting on actually happened?** This audit cannot answer this question — only the Regression Review below, and ultimately you, can.

## Approval

**Approved to merge:** **No — Pending.**
**Conditions:** (1) live/on-device or Playwright verification of the reflow, touch-target, and Demo 07 local-departure behavior, matching what `CLAUDE.md`'s own "pending the user's own live confirmation" note already called for; (2) an explicit answer on the Testable Core question for the new geometry (Open Question 3), even if the answer is "ship untested, as usual." The code itself is architecturally clean against every principle checked above — the blockers are process gates (Workflow §9), not Constitution violations.

## Review Date

2026-07-28

## Reviewer

Claude (subagent-free, direct code review against `master..feature/playground-demo06-rail-fan`)

---

## Regression Review (`AnimationReviewWorkflow.md` §7)

1. **Re-run against the actual diff, not a plan** — this entire audit above was produced by reading the real diff (`git diff master..feature/playground-demo06-rail-fan`) and the full text of every new file, not by trusting `CLAUDE.md`'s narration. Where the code and the changelog were cross-checked, they matched.
2. **Critical/Major findings from a prior Approval step** — none exist; this is the first audit this branch has ever gone through (see the sequencing note at the top).
3. **Constitution §8 impact**:
   - **Gap 1** (`seating.ts`/`fanLayout.ts` divergence) — not touched by this branch, but a structurally similar situation now exists *within* the Playground itself (`fanLayout.ts` vs. `railFanLayout.ts` — see Open Question 1). Not the same gap, not automatically added to §8, but related enough to flag for whoever next reviews §8.
   - **Gap 2** (`TrickCenter` resize mismatch, still only worked around in production) — not fixed by this branch, but Demo 07's `TrickCardComponent`/`splitEaseOutCubic` machinery is squarely the kind of mechanism gap 2's own text says is needed. Worth revisiting gap 2 once Demo 07 is itself verified — this branch may turn out to be a real step toward closing it, not just adjacent work.
4. **Live verification status** — **not satisfied.** Per Constitution §5.VIII/§7 item 3, this repository's standing practice requires real on-device or Playwright confirmation, and per Workflow §7.4 that requirement is not waivable for new Layout Engine geometry without an explicit decision. Neither has happened for this branch.
5. **New dependency on observing live animation progress** — none found. `jumpTo` and `retarget` are both synchronous, direct calls; nothing in this branch reintroduces the listener/`stopAnimation`-based observation pattern Constitution §6 rejected.
6. **Stop Conditions worked around instead of resolved** — checked against all seven (Workflow §6): none were merely worked around. Every one of the real bugs this branch addresses (identity loss, coordinate ambiguity, layer purity) was root-caused and fixed at the source, per the code itself, not patched around. The one deliberate, *disclosed* tradeoff (reflow eases x/y independently rather than literally curving along the rail arc) is explicitly named in the code's own comments as an accepted approximation with a stated reason — that is the correct way to handle a tradeoff under this Workflow, not a violation of it.

### Regression Review verdict

**Do not merge yet.** The architecture is sound — this is a genuinely clean pass, and notably, it's clean *because* real, previously-diagnosed bugs were fixed at their root cause, not because nothing was found to look at. What's missing is procedural, not architectural: live confirmation, and an explicit (not default-by-silence) answer on testing the new geometry. Once those two items are resolved, this comes back for a final sign-off, not a re-audit from scratch — nothing found here requires touching the code again.
