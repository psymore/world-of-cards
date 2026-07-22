# Batak play-travel local-departure leg — design

## Context

Two related bugs were reported live, back to back, in the human-hand play-travel animation
(`docs/superpowers/specs/2026-07-18-human-hand-real-position-card-travel-design.md`,
`docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md`):

1. The travel's *origin* was measured off a ref on a plain wrapper `View` sitting outside
   `SelectableCard`'s own lift/scale `Animated.View` — a child's transform never moves its
   parent's own layout box, so the measured position was always the card's unselected resting
   spot, never its actual lifted one. Fixed same session: `SelectableCard.tsx` exports
   `DEFAULT_LIFT_DISTANCE`; `HumanHandFan.tsx` exports `SELECTED_LIFT_DISTANCE`; both
   `PistiTable.tsx`/`BatakTable.tsx`'s `playWithMeasuredOrigin` subtract the relevant constant from
   the measured Y (the lift snaps instantly on selection, so the offset at the moment of the
   confirming tap is always exactly that constant — no native transform-aware measurement needed,
   which is fortunate since Android's location APIs are documented to ignore view transforms
   anyway).

2. This document: once a played card (Batak only — Pişti's hand never overlaps) starts its
   travel, it can visibly "pop" in front of same-row neighbor cards it was previously partly
   behind. Root cause: `apps/mobile/src/table/OpponentSeatGroup.ts`'s `middleRow` style carries an
   explicit `zIndex: 10` so Batak's `TrickCenter`/`TravelCard` can paint above the human hand for
   the *later* part of its flight (added when travel started departing from the card's real
   measured position instead of a fixed offset — see the `middleRow` doc comment). That zIndex
   applies to the whole subtree for the whole flight, including frame one. Meanwhile, per
   `docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-polish-design.md`
   section C, a selected card is only ever promoted via a bigger lift (40px), never a same-row
   zIndex reorder — a middle-of-fan card's lower ~90px can still sit behind a same-row neighbor
   while merely selected. The instant the second tap swaps rendering from the fan-local
   `AnimatedFanCard` to the globally-elevated `TravelCard`, at the same screen position with zero
   elapsed motion, the card jumps from "partly behind a neighbor" to "in front of the whole hand"
   in a single frame.

## Options considered

Presented to the user as a real trade-off (`AskUserQuestion`), since this touches an area with
several prior explicit user decisions:
- Elevate selected cards too (same-row, not just cross-row) — rejected by the user: reintroducing
  "selected always renders in front" reads as unnatural for the resting hand.
- Delay the elevation switch by a flat ~100-150ms — reduces but doesn't eliminate the jump (motion
  masks it partially, but the switch is still instantaneous at whatever moment it fires).
- **Chosen**: keep the card's stacking relative to its neighbors completely unchanged through
  selection and the very start of travel, and only elevate once it's genuinely clear of the row —
  so the jump has nothing left to be visible against.

## Approach

A short, local "departure leg" runs *before* the existing `pendingPlay` staging, entirely within
`HumanHandFan`'s own rendering:

- The played card stays mounted in its normal hand slot (not yet filtered out of `humanHand` —
  that still only happens once real `pendingPlay` is set, unchanged) and gets an extra vertical
  animation layered onto its existing slot-position `y` Animated.Value: translate up by
  `LOCAL_DEPARTURE_DISTANCE` (one full card height — `HUMAN_CARD_HEIGHT`, i.e. `CARD_DIMS.normal.height`)
  over `LOCAL_DEPARTURE_DURATION_MS` (150ms), via `Easing.out(Easing.cubic)`.
- One card height is enough to *fully* clear the row's own vertical band — same-row overlap is
  purely about paint order (later-index cards paint over earlier ones, regardless of vertical
  position), so once the departing card's whole body has moved past that band, there's no overlap
  left to resolve either way, by construction rather than by tuning.
- Rotation/curve are untouched during this leg (only `y` moves), so the card's angle at handoff
  still matches what `TravelCard`'s `originRotateDeg` expects (unchanged from before this change).
- After the leg completes, `BatakScreen.tsx` arms the *real* `pendingPlay` exactly as before, but
  with `originOffset.y` reduced by `LOCAL_DEPARTURE_DISTANCE` (the flight now starts from where the
  local leg left off, not the original resting slot) and `travelDurationMs` reduced by
  `LOCAL_DEPARTURE_DURATION_MS` (so the *total* hand-to-trick-center time, and therefore every
  existing commit-timing constant derived from it — `PLAY_TRAVEL_DELAY_MS`,
  `TRICK_COMPLETION_PAUSE_MS`'s interaction with the flight — stays unchanged from before this
  pass).

No shared progress value or live-listener handoff was needed: the two legs are sequential, not
simultaneously rendered, and both use plain, independently-tunable fixed timings rather than a
continuous progress handoff — simpler, and the seam is invisible by construction (nothing occupies
that screen position once the local leg finishes) rather than by matching two animation curves
precisely.

### New/changed surface

- `apps/mobile/src/table/TravelCard.tsx`: new optional `durationMs` prop (defaults to
  `CARD_TRAVEL_DURATION_MS`), threaded into `useTravelProgress`. Every pre-existing consumer
  (Pişti's `RevealCard` is unrelated/untouched; Batak AI plays; Batak's own bury/kitty
  animations) is byte-identical, since they never pass it.
- `apps/mobile/src/games/batak/table/types.ts`: `PendingBatakPlay` gains optional
  `travelDurationMs?: number`.
- `apps/mobile/src/games/batak/table/TrickCenter.tsx`: the human-pending `TravelCard` branch
  passes `durationMs={pendingPlay?.travelDurationMs}`; the AI branch is untouched.
- `apps/mobile/src/games/batak/table/HumanHandFan.tsx`: exports `LOCAL_DEPARTURE_DISTANCE` /
  `LOCAL_DEPARTURE_DURATION_MS`; `AnimatedFanCard` gains an `isDeparting` prop (added to the
  memo comparator) driving the extra `y` animation described above; `HumanHandFan` itself gains
  an optional `departingCardId` prop.
- `apps/mobile/src/games/batak/BatakTable.tsx`: new optional `localDeparture?: { cardId: string } | null`
  prop, threaded to `HumanHandFan`'s `departingCardId`. A new `canInteractWithHand` (separate from
  `isHumanInteractive`) blocks new taps during the local leg without clearing selection — clearing
  selection while the card is still mounted mid-animation would trigger `SelectableCard`'s animated
  "drop back to rest", the exact shake `useCardSelection`'s own doc comment already warns about.
  `isHumanInteractive` itself (and the `clearSelection` effect keyed on it) is untouched, so
  selection still only clears once `pendingPlay` actually resolves, same as before this pass.
- `apps/mobile/src/games/batak/BatakScreen.tsx`: `commitMove`'s `'play'` branch factors the
  existing pendingPlay-staging logic into a local `armPendingPlay` closure, then — only for the
  human's own play, only when a measured `originOffset` exists, only without reduced motion, and
  only when the measured origin is comfortably farther than the local-departure distance itself
  (guards against a fixed-distance local leg overshooting a short flight) — stages
  `localDeparture` first and calls `armPendingPlay` with the adjusted origin/duration once the
  local leg's timer fires. AI plays (never supplying an `originOffset`) and the reduced-motion path
  fall straight through to the original single-stage behavior, unchanged.

## Follow-up fix, same day: velocity discontinuity at the leg handoff

User feedback after seeing it live: the card visibly stopped/slowed right at the second tap, then
lurched forward again toward the trick center. Root cause, confirmed by the math rather than
guessed: both legs used `Easing.out(cubic)` independently. That curve's velocity is zero at t=1 by
definition (it's *how* ease-out decelerates into place) — so the local leg decelerated to a
complete stop right as it handed off, and `TravelCard`'s own leg (also ease-out) immediately burst
back up to its own max starting velocity. Two independently-eased legs, each individually smooth,
still produced a visible seam where they met.

Fixed by switching `LOCAL_DEPARTURE_EASING` to `Easing.in(Easing.cubic)`: this curve ends at max
velocity instead of zero, matching `CARD_TRAVEL_EASING`'s own max-velocity start, so the two legs
now read as one continuous accelerate-then-decelerate motion rather than two animations bolted
together. Bonus: it also replaced the previous instant-full-speed jerk at the moment of the tap
(ease-out's own fast start) with a gentler liftoff (ease-in's slow start).

## Out of scope / deferred

- Pişti: not affected. Its human hand never overlaps (`flex-row, gap: 8`, no fan), so there's
  nothing to depart "in front of" in the first place.
- A live/continuous progress-value handoff between the two legs: considered, rejected as
  unnecessary complexity — see "Approach" above.
- Tuning `LOCAL_DEPARTURE_DISTANCE`/`_DURATION_MS` further after a real device/visual pass — these
  are first-pass values (one full card height, 150ms), not measured against a live render.

## Testing

No new automated tests, per the standing 2026-07-07 mobile-UI testing policy — this is
presentational/animation timing work with no game-logic changes. Existing suite (13 suites / 36
tests in `apps/mobile`) re-run for regression; typecheck clean on both packages.

## Verification

Per the user's 2026-07-17 direction, no unsolicited screenshot/browser verification pass this
session — logic was traced by hand against the actual constants/timing instead. Native on-device
verification remains the standing, longstanding gap for every Batak/Pişti UI pass.
