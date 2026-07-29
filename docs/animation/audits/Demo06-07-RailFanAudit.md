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
| No live/on-device or Playwright verification has happened for any of this branch's fixes | Blocks Definition of Done (Workflow §9) | **Partially resolved.** Playwright/web verification done (see "Live Verification — Web" below): clean. Native/Expo Go touch verification still pending — split explicitly between web (this session) and Expo Go (the user), per direct agreement. |
| A hand card's exact geometric center is frequently covered by a higher-`zIndex` neighbor at default overlap, in **both** the new rail model (Demo 06) and the pre-existing Cartesian model (Demo 07's human hand) | Minor / pre-existing, not a regression — but worth a real-touch check | Measured precisely via web verification (see below): only the frontmost card's center is reliably its own hit target; every other card's exclusive clickable region is a ~16px sliver near its edge, not its visual center. Confirmed present in Demo 07 too (older, already-shipped fan model), so this predates this branch and isn't something the per-card-static-box fix was meant to solve. Flagged for the user's Expo Go pass specifically, since a fingertip is less precise than a mouse pointer and this could matter more on-device than it does here. |
| `railFanLayout.ts` and `fanLayout.ts` are two independent Layout Engine implementations coexisting inside the same ownership boundary (the Playground itself) | Minor / Open Question | Not a Boundary Violation — they model genuinely different geometries (Cartesian tangent-walk vs. angle-on-one-circle) for different demos, and the rail model exists specifically because the Cartesian model can't support smooth single-arc reflow (per `railFanLayout.ts`'s own comment). But whether this is a permanent two-model system or a transitional state pending consolidation is undecided — see Open Questions. |
| Demo 07's local-departure mechanism explicitly mirrors **production** Batak's `HumanHandFan.tsx`, not the reverse | Minor / Acceptable Technical Debt, needs to be named explicitly | The established flow (`CLAUDE_ANIMATION_RULES.md`'s "Final Objective": Playground perfects, Batak consumes) runs Playground → Production. Here a Playground demo is explicitly built to mirror an already-shipped production pattern. Not a violation of anything in the Constitution — SSOT's scope clause (§5.II) sanctions independent implementations across this exact boundary — but it's a direction reversal nobody has written down before now. See Open Questions. |

| **`PlayedCard`'s zIndex (frozen at `originalIndex + 0.5`, captured pre-filter) and the remaining `HandCard`s' zIndex (`i`, live-recomputed post-filter each render) are two independent, diverging computations of "this card's stacking slot"** | **Critical** | **Found via the user's Expo Go pass (2026-07-28), not caught by this audit's original code read or the web verification pass.** Playing any non-rightmost card makes every remaining card originally *after* it get a zIndex one lower than before (reindexed), while the played card's zIndex stays anchored to its old position — inverting the code's own stated "stays below every card originally after it" intent the moment the array reindexes. Manifests specifically once `playedCard` state exists (second tap in two-tap mode, single tap in one-tap mode), never during mere selection — matches the report exactly. Root cause is Constitution §5.II (SSOT): two schemes computing one logical value instead of one staying authoritative — the same shape of bug as this file's already-fixed mount-position bug, a different value. **Not fixed yet** — recommended direction: give the departing card an unconditionally-highest zIndex (matching what Demo 07 independently arrived at for its own departing card) rather than patching the `+0.5` arithmetic to survive reindexing, since patching would keep two sources of truth instead of removing the duplication. Blocks Definition of Done until fixed and re-verified. |

The Critical finding above means the branch's status changes from "clean architecture, blocked only by process gates" to "one real architectural bug found via native testing that neither code review nor web verification caught." Every *other* bug this branch's own commit message and `CLAUDE.md` claimed to fix was independently re-derivable from the code and confirmed live — this table entry is the one exception, and it's exactly the kind of thing the live-verification gate (Workflow §7.4) exists to catch that static review can miss.

## Risks

- **Rapid replay / stress conditions**: `Demo06HandReposition.tsx` and `Demo07CompleteSequence.tsx` both ship a "Play all" stress-test button that fires every card's real press handler on a stagger. **Checked via web verification**: in Demo 06's default two-tap mode, `runStressTest` fires exactly one simulated press per card — per `handlePress`'s own branch (`if (playMode === "twoTap" && !selected) { onSelect(card.id); return; }`), a single press only *selects*, it doesn't play. So the button cycles selection through all cards and ends with the last one lifted, not fully played — confirmed both in the console-clean run log and visually (screenshot shows the last card lifted, none played). This is correct, mode-consistent behavior, not a bug; worth noting only because the button's own label ("Play all") reads as if it should fully play every card regardless of mode, which could be a minor UX-clarity nit for whoever writes the eventual `Demo06.md`.
- **Reduced-motion accessibility**: neither `useCardMotion` nor the rail-fan demos reference `useReducedMotion` (unlike `apps/mobile/src/table/TravelCard.tsx`, which does, and is otherwise untouched by this branch). This may be an intentional Playground-scope decision (per `ANIMATION_ARCHITECTURE.md`'s "Playground Scope" — production-fidelity concerns like this are sometimes deferred to the port), but it's not stated anywhere in this branch — worth an explicit note before this pattern reaches `apps/mobile`. Not testable via the web pass (no `prefers-reduced-motion` emulation attempted); still open.
- **Interruption mid-animation**: `Demo06HandReposition.tsx`'s reflow effect uses `jumpTo` specifically to handle a card being retargeted mid-flight when its rail angle shifts — this is the correct mechanism per Visual State Continuity (§5.V). **Partially checked**: web verification re-clicked every post-reflow card individually and all responded correctly, but that's sequential interruption, not truly rapid/overlapping interruption — the stress test would be the real test of that, and it didn't fully play cards in two-tap mode (see above), so this specific risk is still not conclusively exercised.

## Open Questions

1. **Is `railFanLayout.ts` meant to eventually replace `fanLayout.ts`, or do both permanently coexist for different demo purposes?** Not blocking, but should be answered before a third rail-adjacent demo is built on top of either assumption silently.
2. **Should Demo 07's mirroring of production `HumanHandFan.tsx` be recorded somewhere durable** (an ADR, or a note in the eventual `Demo07.md`) **so the production→playground reference direction is a documented, deliberate choice rather than an undocumented one-off?**
3. **Does the new Layout Engine geometry in this branch get the Testable Core carve-out (Constitution §7 item 3), or explicit sign-off to ship untested?** This needs to be answered, not defaulted.
4. **Has the live/on-device verification this backlog has been waiting on actually happened?** Web half: yes, see below. Expo Go / native touch half: pending the user's own pass — genuinely needed, not a formality, given the center-hit-target finding above is exactly the kind of thing that could read differently under a real fingertip than a precise mouse click.
5. **Does the overlap/center-hit-target property (found during web verification, present in both Demo 06 and Demo 07) need an actual fix, or is it an accepted characteristic of a tightly-overlapping fan** (the same way a real physical fanned hand of cards can't be tapped dead-center either)? Not evaluated here — this audit surfaces it, it doesn't resolve it.

## Approval

**Approved to merge:** **No — Pending.**
**Conditions, updated after the Expo Go pass (2026-07-28):** (1) **fix the Critical zIndex/SSOT finding above at the root, per Workflow §6 — return to Architecture Audit for that specific fix before re-attempting approval**; (2) re-verify the fix, both web and native; (3) an explicit answer on the Testable Core question for the new geometry (Open Question 3), even if the answer is "ship untested, as usual." This supersedes the audit's original conclusion that the code was architecturally clean — it was clean against everything checked at the time, but native testing surfaced a real Constitution §5.II violation that neither the code read nor the web pass caught.

## Review Date

2026-07-28

## Reviewer

Claude (subagent-free, direct code review against `master..feature/playground-demo06-rail-fan`)

---

## Live Verification — Web (2026-07-28)

Split explicitly with the user: web/Playwright verification here, Expo Go/native verification separately by the user. This section covers the web half only — see the Approval/verdict sections for how the two combine.

**Method:** `apps/playground` run via `expo start --web`, driven headlessly with `playwright-core` against the sandbox's real Chrome (`.superpowers/sdd/verify-rail-fan.js`, plus a diagnostic pass `diag-rail-fan-hittest.js` once the finding below surfaced). Not a substitute for a native device pass — this repo's own standing note (`[[dev_sandbox_no_device_access]]`) is exactly that browser verification is a real step up from zero but doesn't replace one.

**What was exercised:** Demo 06 — initial 6-card hand, select+play a middle (non-rightmost) card in two-tap mode, verify all 5 remaining cards individually clickable post-reflow, run the stress-test button. Demo 07 — switch tabs, select+play a human card, observe the local-departure leg and trick-center handoff, cross-check AI seat turn progression.

**Results:**
- **Console: 0 errors, 0 page errors**, across the entire run, both demos.
- **Touch-target fix (the literal reported bug — all cards sharing one static box): confirmed fixed.** All 6 initial cards have distinct x-positions; re-verified individually clickable.
- **Reflow/reparenting fix: confirmed fixed.** Playing card index 2 of 6 (deliberately not the rightmost, since that was the case that always worked even under the old bug) correctly shrank the hand to 5, evenly respaced (measured x-positions: 146.1, 162.0, 178.0, 194.0, 209.9 — clean, monotonic, consistent spacing), and every one of the 5 remaining cards — including ones on both sides of the played card — was individually re-clicked and responded correctly. This is the exact scenario the old two-JSX-parent bug broke.
- **Coordinate/position fix (missing `SIMPLE_CARD_WIDTH / 2` conversion): confirmed fixed, visually.** Mid-flight screenshots of both Demo 06's played card and Demo 07's local-departure leg show clean trajectories — no sideways pop, no mount-position jump.
- **Demo 07 local-departure → trick-center handoff: works end-to-end**, no errors, correct AI turn-timer progression visible across seats (`12 cards`, `12 cards`, `13 cards (thinking...)` mid-sequence).
- **New finding, not a regression**: `elementFromPoint` measurement at every card's exact geometric center shows only the frontmost (highest-`zIndex`) card reliably resolves to itself — every other card's *exclusive* clickable region is a narrow (~16px, at default 64px card width / 0.6 overlap) sliver near its own edge, not its center. Confirmed present identically in Demo 07's human hand, which uses the older, already-shipped `fanLayout.ts` Cartesian model — so this is a pre-existing property of any tightly-overlapping fan in this Playground, not something introduced by or specific to the rail-model rewrite. See Severity Classification and Open Question 5.
- Screenshots and full console log retained in `.superpowers/sdd/` (gitignored — not part of this commit).

**What this does not cover:** perceived smoothness/stutter (exactly why the Expo Go half exists), reduced-motion behavior, and real-fingertip touch precision on the center-hit-target finding above.

---

## Regression Review (`AnimationReviewWorkflow.md` §7)

1. **Re-run against the actual diff, not a plan** — this entire audit above was produced by reading the real diff (`git diff master..feature/playground-demo06-rail-fan`) and the full text of every new file, not by trusting `CLAUDE.md`'s narration. Where the code and the changelog were cross-checked, they matched.
2. **Critical/Major findings from a prior Approval step** — none exist; this is the first audit this branch has ever gone through (see the sequencing note at the top).
3. **Constitution §8 impact**:
   - **Gap 1** (`seating.ts`/`fanLayout.ts` divergence) — not touched by this branch, but a structurally similar situation now exists *within* the Playground itself (`fanLayout.ts` vs. `railFanLayout.ts` — see Open Question 1). Not the same gap, not automatically added to §8, but related enough to flag for whoever next reviews §8.
   - **Gap 2** (`TrickCenter` resize mismatch, still only worked around in production) — not fixed by this branch, but Demo 07's `TrickCardComponent`/`splitEaseOutCubic` machinery is squarely the kind of mechanism gap 2's own text says is needed. Worth revisiting gap 2 once Demo 07 is itself verified — this branch may turn out to be a real step toward closing it, not just adjacent work.
4. **Live verification status** — **partially satisfied.** Playwright/web verification is done and clean (see above). Per Constitution §5.VIII/§7 item 3 and Workflow §7.4, new Layout Engine geometry still needs either a real on-device pass or an explicit sign-off — the web pass alone, while genuinely useful, was not agreed as sufficient on its own; the Expo Go half is still outstanding.
5. **New dependency on observing live animation progress** — none found. `jumpTo` and `retarget` are both synchronous, direct calls; nothing in this branch reintroduces the listener/`stopAnimation`-based observation pattern Constitution §6 rejected.
6. **Stop Conditions worked around instead of resolved** — checked against all seven (Workflow §6): none were merely worked around. Every one of the real bugs this branch addresses (identity loss, coordinate ambiguity, layer purity) was root-caused and fixed at the source, per the code itself, not patched around. The one deliberate, *disclosed* tradeoff (reflow eases x/y independently rather than literally curving along the rail arc) is explicitly named in the code's own comments as an accepted approximation with a stated reason — that is the correct way to handle a tradeoff under this Workflow, not a violation of it.

### Regression Review verdict

**Do not merge — a Critical finding surfaced during native verification.** Web verification (this session) was clean, but the Expo Go pass (the user, 2026-07-28) caught a real bug neither the original code audit nor the web pass did: the zIndex/SSOT finding above. This is exactly the scenario Workflow §7.4's "not waivable for new geometry without live confirmation" rule exists for — a bug that only manifests through the exact interaction path (second tap / one-tap play) a headless click-by-testID script and a static code read both happened to route around. **This is now a re-audit trigger for the specific fix, not a "narrowed by half" status.** Once the fix lands, both halves of live verification need to re-run against it — the fix itself needs the same audit-before-implementation treatment as everything else in this branch, not a quiet patch.

---

## Critical Finding Fix + Re-Verification (2026-07-28)

**Process followed:** a full standalone Architecture Audit was written and approved before any code changed — `docs/animation/audits/Demo06-ZIndexFix-Audit.md` — per this document's own Regression Review verdict above and per direct user instruction that this specific fix required the full template, not `QuickAuditTemplate.md`. That document holds the full Current/Proposed Ownership, Layer Responsibilities, Boundary Violation check (none found), Severity Classification, Risks, and Open Questions for this fix specifically; it is not restated here.

**The fix went through two iterations, both recorded in `Demo06-ZIndexFix-Audit.md`:**

1. **First iteration (superseded same day):** `PlayedCard`'s zIndex changed from the derived, per-play value (`originalIndex + 0.5`, frozen at play-time) to a fixed literal constant (`DEPARTING_CARD_Z_INDEX = 1000`, unconditionally higher than any remaining `HandCard`'s live `zIndex={i}`). This fixed the SSOT drift but, on the user's own review, was found to discard a real visual requirement: a departing card in a fanned hand should stay interleaved with its original neighbors (below the one to its right, above the one to its left), not pop unconditionally in front of the whole hand — the user pointed to `Demo05Transform.tsx` as the reference precedent, which never removes a played card from its array at all and so never faces this problem.
2. **Corrected fix (shipped):** both `HandCard` and `PlayedCard` now read their zIndex from one shared `originalIndexById` map — a `Map<cardId, originalDealPosition>` computed once per deal (`useMemo` keyed only on `handSize`, never on the live, shrinking `cards` array). Because a remaining card's entry never changes when a sibling leaves, and the departing card is looked up the exact same way, the departing card stays correctly interleaved with its original neighbors for its entire flight — reproducing the user's stated requirement as a natural consequence, not a special case. No `+0.5` disambiguation needed (original positions are already unique). The now-dead `originalIndex` per-instance field was removed from `playedCard` state alongside the first iteration's own cleanup. `apps/playground/src/animation/demos/Demo06HandReposition.tsx` is the only file touched, across both iterations.

**Web re-verification (Claude, this session):** driver script `.superpowers/sdd/verify-zindex-fix.js` (gitignored) — played a middle (non-rightmost) card in Demo 06's default 6-card hand (the exact reproduction case that originally surfaced the bug), recorded its original left/right neighbors' zIndex values before playing, then sampled the departing card's actual computed zIndex at five points across the flight (10/80/200/350/500ms after the second tap). Result: **departing zIndex (2) stayed strictly between its original left (1) and right (3) neighbors at every sampled point — PASS**, confirming the corrected interleaved-stacking behavior, not just "no crash." Also confirmed remaining cards' zIndex values are stable/unchanged before vs. after the play (proving they're no longer reindexed). Hand correctly reduced to 5 cards; every remaining card individually clickable post-reflow (the earlier reparenting fix still holds). Re-ran the branch's original `verify-rail-fan.js` as a broader regression sweep across Demo 06 and Demo 07 — same clean result as before (the one pre-existing, unrelated, already-documented center-hit-target overlap finding reproduced identically). Zero console errors across both scripts, both iterations.

**Native/Expo Go re-verification:** **still pending — the user's own pass, not yet done**, and now specifically against the corrected (second-iteration) fix rather than the superseded constant. Per Workflow §7.4, the merge decision stays **pending** until that happens.

**Updated Approval status:** the corrected fix is approved, implemented, and web-verified clean against the actual stated requirement (interleaved stacking, not "always on top"). **The branch's overall merge decision remains Pending** until the user's native pass confirms this specific fix on-device — this section does not supersede the "Do not merge" verdict above on its own; it satisfies the first of that verdict's three re-approval conditions (fix the Critical finding at the root) and completes the web half of the second (re-verify both web and native). The Testable Core question (the verdict's third condition, and Open Question 3 above) remains open and unresolved — carried forward, not addressed by this fix.

---

## New Finding: Demo 06 reads clean on web but is stuttery on native (2026-07-29)

**Report (the user, live Expo Go test):** Demo 06 (rail-fan reflow) looks smooth in the web/Playwright verification above, but stutters when run in Expo Go on the user's actual device. Not yet further characterized (which specific motion — selection lift, the departure flight, the remaining-hand reflow, or all three; one card or many; every play or only some) — see Open Questions below.

**Why this is being recorded as its own point, not folded into the zIndex fix above:** this is a distinct defect category from the zIndex/SSOT bug — that one was a stacking-order correctness bug, reproducible and fully explainable from a static code read. This one is a **motion-quality** regression that, per the pattern below, is a recurring blind spot for this exact codebase, not a one-off.

**This is the same category of gap the Constitution already names, recurring again.** Constitution §5.V's own evidence section records the `useCardMotion` jump artifact as "reproducible only on a physical device, not in the browser/Playwright workflow" — that bug was invisible to every static/web check and was only ever found by the user's own on-device test. `Demo06-ZIndexFix-Audit.md`'s original branch audit (`Demo06-07-RailFanAudit.md`'s own Critical finding, above) is a second instance of the identical shape: web verification clean, native verification catches a real defect neither the code read nor the web pass could. This is now a **third** occurrence of "web-clean does not mean native-clean" inside this one branch's history alone, and it's the specific pattern `[[dev_sandbox_no_device_access]]` (project memory) already warns about generally. Per Constitution §1's own philosophy ("why the same lesson had to be learned twice") and §8 gap 3 (Interactive Target Fidelity fixed twice with no shared abstraction yet), this suggests the *pattern itself* — not just this one instance — deserves a durable, named place to live, so a fourth occurrence doesn't have to be rediscovered from scratch. Recommending (not unilaterally deciding, since the Constitution may only be amended via its own §10 process with explicit user sign-off) that this be considered for a future Constitution entry: something like "web/Playwright verification confirms logic, positioning, and touch-target correctness, but must never be treated as confirming native animation *smoothness* — react-native-web's Animated execution path is not the same code path as native's compositor-thread native driver, so a clean web pass carries no evidence either way about on-device frame timing."

**Root cause not yet established — this needs investigation, not a guess.** Per `systematic-debugging`, recording plausible hypotheses rather than jumping to a fix:
1. **Static layout repositioning during reflow.** `HandCardComponent`'s outer `Pressable` box (`left`/`top`, from `railPosition(slot.angleDeg, 0)`) is an ordinary React Native style, not an `Animated.Value` — when the hand reflows, every remaining card's resting box genuinely moves via a real native layout pass (Yoga), not a compositor-only transform update, even though the animated *correction* (`jumpTo`/`retarget`) that follows it is fully native-driven. A real device's UI thread doing a synchronous layout recalculation for several views at once, at the same moment several native-driven `Animated.timing` calls also start, is a materially different cost profile than a desktop Chrome tab compositing the same visual result — this could plausibly read as smooth on one and stuttery on the other for a reason that has nothing to do with the JS-thread rAF stutter already fixed once in this same file's history (see this file's own doc comment at the top of `Demo06HandReposition.tsx`).
2. **Expo Go's own overhead, unrelated to this code.** Expo Go runs a dev-mode JS bundle with real, generic overhead (no production Hermes optimizations, extra dev instrumentation) that a from-scratch stutter report can't yet distinguish from an actual architectural defect. Worth ruling out by comparing against a different demo (e.g. Demo 05, which never removes/reflows cards at all) on the *same* device, and — longer-term — a release/production build rather than Expo Go specifically.
3. **Concurrent Animated.timing volume.** A full reflow starts up to 5 properties × up to N remaining cards' worth of `Animated.timing` calls near-simultaneously (`retarget`/`jumpTo` in the `useLayoutEffect`). Individually cheap, but worth ruling out as a volume effect specific to weaker mobile hardware.

None of these is confirmed — they are the candidates worth checking first, not a diagnosis.

**Severity Classification:** **Major, pending root-cause confirmation** (not yet classified Critical, since which — if any — ratified Foundational Principle this actually violates isn't established yet; escalate to Critical if hypothesis 1 above is confirmed, since a real per-play native layout thrash would be a new instance of Constitution §5.IV/§5.VI's underlying concern — motion and layout bleeding into one operation with a real performance cost). **Blocks the branch's Definition of Done** alongside the still-pending native re-verification of the zIndex fix above — this is not waivable by the web pass, per Workflow §7.4, for the same reason the zIndex bug wasn't.

**Open Questions (need the user's own characterization, since there's no on-device access on this side — see `[[dev_sandbox_no_device_access]]`):**
1. Which specific motion stutters — the select/deselect lift, the departure flight, the remaining-hand reflow, or all three?
2. Does it happen on every play, or does it get worse as hand size grows (consistent with hypothesis 1's "layout cost scales with card count")?
3. ~~Does Demo 05 (no reflow, no removal from the array at all) feel smooth on the same device?~~ **Answered (the user, 2026-07-29): yes, Demo 05's departure/return motion is "very nice" on the same device.** This is real, confirming evidence for hypothesis 1: Demo 05 shares the exact same `useCardMotion` primitive, runs in the same Expo Go environment (so generic Expo Go/dev-mode overhead, hypothesis 2, cannot be the differentiator — it would equally affect both demos), and its stress test already exercises multiple concurrent `Animated.timing` calls (weakening hypothesis 3 as the primary cause too). The one thing Demo 05 never does, and Demo 06 does on every play, is move a remaining card's *static* (non-Animated) `left`/`top` Pressable position via a real native layout pass. **Hypothesis 1 is now the leading, evidence-backed candidate** — not yet proven, but no longer just one of three untested guesses.
4. Is this Expo Go specifically, or does it also reproduce in a standalone/release build (ruling in or out hypothesis 2)? Lower priority now given the answer to (3) above already weakens hypothesis 2 substantially.

**Severity Classification updated:** given (3)'s answer narrows this to a specific, credible architectural mechanism (a real per-play native layout pass competing with native-driver animation registration on the UI thread) rather than an unexplained report, this is upgraded from "Major, pending root-cause confirmation" to **Major, root cause identified with strong circumstantial evidence, fix not yet designed or approved.** Not escalated to Critical yet — hypothesis 1 is still a hypothesis, not a confirmed mechanism (no fix has been tried and tested live to prove it), and no ratified Foundational Principle has been definitively shown violated (touching layout state is not itself a violation of anything in §5 — the concern is a real, undocumented performance cost, which the Constitution doesn't yet have a named principle for; see the note above about a possible future Constitution entry).
