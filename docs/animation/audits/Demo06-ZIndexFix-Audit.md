# Architecture Audit: Demo 06 Departing-Card zIndex Fix

**Used per:** `../AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process). Completed before implementation begins, per direct user instruction — this specific fix was called out as requiring the full template, not `QuickAuditTemplate.md`, regardless of how small the diff turns out to be.

**Relationship to `Demo06-07-RailFanAudit.md`:** that audit's Regression Review verdict (2026-07-28) found one Critical finding via the user's own Expo Go pass — the `PlayedCard`/`HandCard` zIndex SSOT violation — and explicitly required "return to Architecture Audit for that specific fix before re-attempting approval." This document is that audit. It does not re-litigate anything else in that audit (touch-target fix, reflow/reparenting fix, coordinate fix, etc.) — those are unaffected by this change and remain as already verified there.

---

**Feature Name:** Fix `PlayedCard`'s departing-card zIndex so it no longer independently recomputes a value `HandCard` already owns.

**Objective:** Remove the two independent, diverging computations of "this card's stacking position" — `HandCard`'s live-recomputed array index vs. `PlayedCard`'s frozen `originalIndex + 0.5` — by giving the departing card a fixed, unconditionally-highest zIndex that depends on no other card's state, so there is nothing left that can drift out of sync.

**Constitution References:** §5.II (Single Source of Truth) — the violation itself, and the principle this fix satisfies. §5.I (Layered Ownership) — stacking order is a Rendering-layer (§4, layer 5) *style* concern; this fix keeps it there, same as the already-verified zIndex-instead-of-reparenting fix earlier in this branch. §8 — this closes a Critical finding recorded in `Demo06-07-RailFanAudit.md`; it does not open a new Known Gap.

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Remaining `HandCard`s' stacking order (`zIndex`) | Rendering — `Demo06HandReposition.tsx`'s `cards.map` render, `zIndex={i}`, recomputed every render from the live, post-filter `cards` array. |
| Departing `PlayedCard`'s stacking order (`zIndex`) | Rendering — `Demo06HandReposition.tsx`, `zIndex={playedCard.originalIndex + 0.5}`, computed once inside `handlePlay` from the pre-filter array index, then frozen in `playedCard` state for the component's entire lifetime. |

These are two independent formulas standing in for one logical fact ("paint order among the hand's cards"). The moment `cards` reindexes after the array filter in `handlePlay`, `HandCard`'s live value and `PlayedCard`'s frozen value stop agreeing — this is the confirmed bug.

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Remaining `HandCard`s' stacking order (`zIndex`) | Layer 5, Rendering — unchanged, `zIndex={i}`. |
| Departing `PlayedCard`'s stacking order (`zIndex`) | Layer 5, Rendering — a fixed constant (e.g. `DEPARTING_CARD_Z_INDEX`), guaranteed to exceed any value `i` can take, and computed from nothing but itself. |

After this change, exactly one value (`PlayedCard`'s zIndex) is still specific to the departing card, and it no longer depends on any fact about any other card — there is no second computation left to drift, because there is nothing shared left to disagree about.

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched. |
| 2. Layout Engine | Not touched — `railPosition`/`railAngles`/`railAngleStepDeg` are unaffected; zIndex is paint order, not geometry. |
| 3. Animation Planning | Not touched — this doesn't change *that* a transition happens or its start/end states, only which layer paints on top during it. |
| 4. Animation Execution/Runtime | Not touched — `useCardMotion`/`jumpTo`/`retarget` are unaffected. |
| 5. Rendering | The only layer touched. `PlayedCard`'s `zIndex` prop source changes from a per-play-derived value to a fixed constant. `Demo06HandReposition`'s `handlePlay` no longer needs to capture `index`, and `playedCard` state's `originalIndex` field is removed as dead state (confirmed via grep: its only consumer was this zIndex computation). |
| 6. Interaction | Not touched, and specifically checked: `PlayedCard` renders a plain `Animated.View` with no `Pressable`/touch handler, so raising its zIndex cannot intercept a tap intended for an underlying `HandCard` — there is no responder for RN's touch system to route to on that element. No Interactive Target Fidelity (§5.VII) risk. |

## Boundary Violations

**None found.** This fix stays entirely within Rendering (layer 5) — it does not touch Layout Engine, Animation Planning, Animation Execution, or Interaction. If anything, it *removes* an existing entanglement: the frozen `originalIndex + 0.5` arithmetic implicitly depended on facts about the rest of the hand array (how many cards were originally before/after it) that Rendering had no business needing once the card started departing. Checked against all seven Stop Conditions (`AnimationReviewWorkflow.md` §6): none apply — no boundary crossing, no new geometry duplication, no rendering-does-business-logic, no runtime-needs-game-knowledge, no coordinate ambiguity, no forced unmount/remount, and Constitution ownership is unambiguous (§5.II, squarely).

## Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| Pre-fix state: `PlayedCard`'s frozen `originalIndex + 0.5` vs. `HandCard`'s live `i` — confirmed SSOT violation, already recorded as Critical in `Demo06-07-RailFanAudit.md` | Critical (pre-existing, being fixed by this change) | Resolved by replacing the derived, other-card-dependent arithmetic with a self-contained constant. Verify via re-running the exact reproduction steps that surfaced it (play a non-rightmost card in a hand of 6+) after the fix. |
| Removing the now-dead `originalIndex` field/computation | Not a Constitution finding — ordinary cleanup | Confirmed via grep that `originalIndex` has exactly one consumer (the zIndex line being replaced); safe to remove both the state field and the `index = cards.findIndex(...)` capture in `handlePlay` alongside it. |

No Major or Critical findings remain open in the proposed change itself.

## Risks

- **Visual stacking during the first instant of departure.** Previously (buggy), a played card was interleaved — above cards originally before it, below cards originally after it — for its whole flight, which was *correct* for one instant (the moment of play, before any motion) but wrong from the very next render once the array reindexed. After this fix, the departing card is unconditionally topmost for its **entire** flight, including that first instant. Concretely: a card played from the middle of the hand will now render in front of its right-side neighbors from frame one, rather than staying tucked behind them for an instant before the bug kicked in. Given the card is already animating away (converging toward center, translating upward) for the whole `TRAVEL_DURATION_MS` window, this is expected to read as correct or unnoticeable — a departing card visually "lifting above" the rest of the hand as it leaves is the same intuition Demo 07's fully-departed `TrickCard` container already relies on (elevated above the whole hand via its own `zIndex: 10`). This is a genuine, disclosed behavior change from the (buggy) prior intent, not a no-op — confirm via live verification rather than assuming it's unnoticeable.
- **No new concurrency/rapid-replay risk.** `playedCard` is single-valued (`{...} | null`) — only one card can be mid-departure at a time in this demo, so there's no scenario where two departing cards' zIndex values need to be ordered against each other.
- **No interaction regression** (see Layer Responsibilities, layer 6, above) — checked directly against the component code, not assumed.

## Open Questions

1. **Literal constant vs. derived value?** Recommend a plain literal (e.g. `DEPARTING_CARD_Z_INDEX = 1000`) rather than deriving it from `handSize`/`cards.length` — deriving it from hand-array facts would reintroduce exactly the kind of "depends on the rest of the hand" coupling this fix exists to remove. A literal has zero inputs, so nothing about it can ever drift. Resolved as part of implementation, not left open.
2. **Does this same frozen-vs-live zIndex shape exist anywhere else in this branch?** Checked: Demo 07's departing-card path doesn't share this pattern — its local-departure leg keeps the card's natural, un-elevated stacking position among siblings (per its own doc comment, "no elevated zIndex"), and its later handoff to `TrickCard` uses a separate, statically-elevated container (`zIndex: 10` on the container, not per-card arithmetic tied to sibling indices). No equivalent bug shape found there; no further scope needed.

## Approval

**Approved to implement:** Yes (2026-07-28) — implemented as the fixed `DEPARTING_CARD_Z_INDEX` constant described above, web-verified clean. **Superseded the same review cycle — see Correction below.**

## Review Date

2026-07-28

## Reviewer

Claude (direct code review of `apps/playground/src/animation/demos/Demo06HandReposition.tsx` and `Demo07CompleteSequence.tsx` against `Demo06-07-RailFanAudit.md`'s recorded Critical finding)

---

## Correction (2026-07-29): the constant-zIndex fix was itself incomplete

**What was missed.** The fixed-constant approach (`DEPARTING_CARD_Z_INDEX = 1000`) resolved the SSOT drift — nothing about it could disagree with `HandCard`'s live zIndex — but it discarded a real visual requirement this audit's own Risks section flagged and then under-weighted: a departing card in a real fanned hand should render **beneath the neighbor originally to its right and above the neighbor originally to its left**, not unconditionally on top of the entire hand for its whole flight. The Risks section called this "expected to read as correct or unnoticeable" and deferred to live verification to confirm it — live verification (the user, 2026-07-29) found the opposite: the departing card visibly popped in front of *every* card regardless of original position, which reads wrong for a fanned hand.

**The comparison that resolves it: `Demo05Transform.tsx` genuinely never has this problem, and reading why matters.** `Demo05Transform.tsx`'s `cards` array is a fixed `useMemo` over `handSize` — a "played" card is never removed from it; `TransformDemoCard` just animates via its own `playStage` state while staying in its original JSX/array position for the entire "traveling"/"holding"/"atRest" cycle. Because nothing is ever removed, every card's index — and therefore its natural (unset, implicit) stacking order — is the *original* deal position for the entire demo's lifetime. Demo05 doesn't solve this problem; it never creates it, because it never reindexes anything. Demo06 is different in kind — a played card actually leaves the array so the rest of the hand can reflow around the gap — so it has to solve, explicitly, the problem Demo05 gets for free.

**The actual fix: a single, stable, assigned-once-per-deal zIndex, read identically by both `HandCard` and `PlayedCard`.** The original bug's true root cause was never "frozen vs. live" per se — it was that the two consumers computed the same logical fact (a card's stacking slot) from **two different reference frames**: `HandCard` from the live, post-filter array position (which reflows/shrinks every play — correct for *geometry*, wrong for *stacking*), `PlayedCard` from a snapshot of that same live frame taken once at play-time. The fix: stop deriving stacking order from the live array position at all. Instead, derive a `Map<cardId, originalIndex>` once per deal (`useMemo` keyed on `handSize`, mirroring the same `FULL_DECK.slice(0, handSize)` the redeal effect already uses) and have **both** `HandCard` and `PlayedCard` read their zIndex from that one map, keyed by the card's own id. Neither consumer computes anything independently anymore; both consume the same value. Because every dealt card's original index is already unique, no `+0.5` disambiguation is needed either — a strict improvement over both the original buggy arithmetic and the constant that replaced it.

This directly reproduces the user's stated requirement (beneath-right-neighbor, above-left-neighbor) as a natural consequence of the fix, not a special case: a remaining card's zIndex never changes when a sibling leaves, so a departing card's own (equally stable) original index is still correctly positioned relative to every neighbor it started next to, for the entire flight.

### Revised Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Every card's stable original-deal-position zIndex (`originalIndexById`) | Layer 5, Rendering — one `useMemo` in `Demo06HandReposition`, keyed only on `handSize` (never on the live `cards` array), consumed identically by `HandCard` and `PlayedCard`. |
| Remaining `HandCard`'s rail geometry (angle/position) | Layer 2, Layout Engine — unchanged, still derived from the live `cards.length` (this is the actual reflow, and is correct to be live). |

### Revised Layer Responsibilities (row 5 only; rows 1–4, 6 unchanged from above)

| Layer (§4) | This Change's Role |
|---|---|
| 5. Rendering | `Demo06HandReposition` gains one `useMemo`-derived `Map<string, number>` (`originalIndexById`), replacing both the old `originalIndex + 0.5` arithmetic and the `DEPARTING_CARD_Z_INDEX` constant. `HandCard`'s zIndex source changes from `i` (live index) to `originalIndexById.get(card.id)`. `PlayedCard` regains a `zIndex` prop, now sourced from the same map (`originalIndexById.get(playedCard.card.id)`) instead of a per-instance frozen value or a constant. |

### Revised Risks

- **Transitional one-render gap on a `handSize` slider change.** `originalIndexById` (`useMemo`, keyed on `handSize`) recomputes in the same render a `handSize` change is processed; the redeal effect that resets `cards`/`selectedCardId`/`playedCard` to match runs one tick later (a `useEffect`, not synchronous with the memo). For that one transitional render, `cards` can still hold the *old* hand while `originalIndexById` already reflects the *new* one, so a lookup could miss. Guarded with a `?? i` (HandCard) / `?? 0` (PlayedCard) fallback — justified specifically by this real, if narrow, timing gap, not general defensiveness. Never reachable during ordinary card-play (no play happens concurrently with a slider drag in this demo's own interaction model).
- **No new concurrency risk** — same reasoning as the constant-based fix: `playedCard` is single-valued, only one card departs at a time.
- **No interaction regression** — same reasoning as before: `PlayedCard` still has no `Pressable`/touch handler, so its zIndex value (whatever it is) cannot intercept a tap meant for a `HandCard`.

### Approval (corrected fix)

**Approved to implement:** Yes — direction confirmed by the user (2026-07-29), citing `Demo05Transform.tsx` as the reference precedent for correct original-position stacking. Supersedes the constant-based fix above.

## Review Date (correction)

2026-07-29

## Reviewer (correction)

Claude (code comparison against `Demo05Transform.tsx`, confirming why that demo never encounters this problem, then re-deriving the fix from the same root cause already recorded above)
