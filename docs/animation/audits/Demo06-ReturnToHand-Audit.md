# Architecture Audit: Demo 06 Return-to-Hand Cycling + Play-Lock

**Used per:** `../AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process). Using this Full template rather than `QuickAuditTemplate.md`: the user picked Quick when asked, but this change fails Quick's own eligibility checklist (it's a new mechanism, and it changes which cards are tappable — §5.VII) — per that template's own instruction ("if it doesn't clearly pass, that's not a reason to fill it out anyway"), escalating to this template instead. The companion bug fix (departing-card missing `key`) genuinely does pass Quick's checklist and has its own audit: `Demo06-TrickCenterKeyFix-QuickAudit.md`.

---

**Feature Name:** Return-to-hand cycling for a departed card, gated by a play-lock while any card is mid-cycle.

**Objective:** After a played card completes its travel + hold, have it fly back and rejoin the hand — mirroring Demo03/04/05's cyclical "a card always ends up playable again" model, so this demo can be replayed indefinitely without hitting Reset — while avoiding the reflow-collision risk the user themselves flagged, by disabling new plays whenever a card is currently mid-cycle.

**Constitution References:** §5.II (SSOT — the returning card must resolve its destination through the same `originalIndexById`/rail geometry every other card uses, not a second parallel scheme). §5.V (Visual State Continuity — the return leg begins from wherever the card actually is). §5.VI (Coordinated Property Timelines — the return leg's x/y/scale/glyphScale transition together, same as the departure leg already does). §5.VII (Interactive Target Fidelity — the play-lock is a real interaction-layer change: which cards are tappable now depends on whether another card is mid-cycle).

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Card leaves `cards` permanently once played | `Demo06HandReposition`'s `handlePlay` (filters it out) / `handleCompletedPlay` (clears `playedCard`, never re-adds) |
| Whether a new card can be played | `HandCardComponent.handlePress` — gated only on `playMode`/`selected`; nothing gates on another card currently departing |
| A departing card's motion | `PlayedCard`, one single one-way leg (hand position → rest position), fired once in a mount-effect |

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Card re-joins `cards` after its hold completes | Layer 5, Rendering — `Demo06HandReposition`'s `handleCompletedPlay`, re-adding the card to `cards` at its original deal index instead of only clearing `playedCard` |
| Whether a new card can be played | Layer 6, Interaction — a derived `isPlayLocked = playedCard !== null` in `Demo06HandReposition`, passed down and checked in `HandCardComponent.handlePress` before any select/play branch runs |
| Departing/returning card's motion (two legs) | Layer 3/4, Animation Planning/Execution — `PlayedCard` retargets a second time when its hold ends (toward the card's current rail position) instead of only calling `onComplete` |

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched. |
| 2. Layout Engine | Not touched — the return leg's destination is `railPosition(currentAngle, 0)`, the exact geometry every `HandCard` already resolves to; no new coordinate math. |
| 3. Animation Planning | `PlayedCard` gains a second decision point: when the hold timer fires, retarget toward the hand instead of immediately calling `onComplete`; `onComplete` now fires after THAT leg finishes. |
| 4. Animation Execution/Runtime | No change to `useCardMotion` itself — the return leg is just another `retarget()` call. |
| 5. Rendering | `handleCompletedPlay` re-adds the card to `cards` (at its original index, so it sorts back into its natural position) instead of only nulling `playedCard`. Existing `originalIndexById`/pool-slot/zIndex machinery needs no new cases — a card re-entering the array is keyed identically to one that never left. |
| 6. Interaction | `HandCardComponent.handlePress` gated on the new play-lock; only one card can ever be mid-cycle (departing → holding → returning) at a time. |

## Boundary Violations

**None found.** The play-lock is a plain Interaction-layer boolean gate, not a Rendering special case. The return leg reuses the exact same Layout Engine geometry every other card already resolves through — there is no second, independently-derived "where does a returning card go" computation for it to disagree with.

## Severity Classification

Not applicable — this is a new-feature design audit, not a findings review. No Boundary Violation or Critical/Major issue surfaced during design.

## Risks

- **The core risk the user flagged, directly addressed**: re-adding a card to `cards` mid-session triggers the same reflow effect a departure triggers. If two cards could be mid-cycle simultaneously, two overlapping reflow-triggering events could compete for the same per-card `jumpTo`/`retarget` calls. The play-lock closes this at the root: `cards` can only change once per full cycle, never with two cycles overlapping.
- **Stress Test button's behavior visibly changes**: it currently fires every card's press on a tight stagger, assuming each play is independent. With the lock active, only the first tap plays a card — every subsequent staggered tap arrives while `playedCard !== null` and becomes a no-op until that cycle completes. This is a real, visible change to existing behavior, not a bug — surfacing it here rather than silently changing it. Recommend leaving Stress Test's own logic untouched (it will just demonstrate the lock working) rather than adding queuing logic, which would reintroduce the exact overlap risk this feature removes.
- **No visual affordance for the lock yet** — cards simply stop responding to taps while locked, with no dimming or label. Worth a minimal visual cue if it reads as unresponsive on-device (matching the existing dim-unplayable-cards precedent elsewhere in this codebase), but not deciding this ahead of an actual look — see Open Questions.
- **Reduced-motion / navigating away mid-cycle**: unaffected — the whole component still unmounts on tab switch regardless of cycle state, same as today.

## Open Questions

1. **Re-entry position: original index, or appended at the end?** Recommend original index — reuses the existing stable-slot machinery (`originalIndexById`, zIndex, motion pool) with zero new cases, since that map is already keyed by original deal position, not live array position.
2. **Visual affordance for the lock (dimming, etc.) — now or as a follow-up?** Recommend implementing the lock's logic first, taking a real look on-device, and deciding from what it actually looks like rather than guessing ahead of time.

## Approval

**Approved to implement:** Yes — per the user's explicit direction to implement both Demo 6 items now; this document satisfies the process requirement the Quick template's own gate pointed to.
**Conditions:** Open Question 1 resolved as recommended (original index) during implementation, not left pending.

## Review Date

2026-07-29

## Reviewer

Claude (design derived directly from the user's own two-part description, cross-checked against `Demo06HandReposition.tsx`'s actual current code, not assumed)
