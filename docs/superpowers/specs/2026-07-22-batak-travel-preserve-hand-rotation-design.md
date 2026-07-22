# Batak play-travel: preserve hand rotation instead of straightening — design

## Context

`docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md` gave
`TravelCard` an `originRotateDeg` prop so the human's played card departs from its real in-hand
fan angle instead of snapping flat the instant it starts moving — but that version interpolated
the angle *down to 0deg* over the course of the flight, so the card visibly straightens itself out
while traveling.

User feedback: skip the straightening motion entirely. A card pulled out of a fanned hand doesn't
twist itself upright mid-air in real life — it keeps whatever angle it had. Requested approach:
hold the card's hand-fan rotation fixed for the whole flight, animate position only, and evaluate
whether that reads as smoother/more natural than easing the angle to flat.

## Change

`TravelCard.tsx`: the `rotate` transform is no longer driven by the shared `progress`
interpolation. It's now a plain, static `${originRotateDeg}deg` value — set once, held for the
entire flight. `restScale`'s size interpolation is untouched (a hand-size-to-trick-size shrink is
a real, intentional change, unlike rotation); only rotation stops animating.

This also simplifies the component slightly: one fewer interpolation driven off `progress`, and
`originRotateDeg`'s only remaining job is "what fixed angle to render at," not "what angle to ease
from."

## Investigated trade-off: the landing snap

Asked to evaluate whether this is actually smoother overall — it fixes one discontinuity but
surfaces a different one, worth flagging explicitly rather than silently accepting:

- **During the flight**: strictly smoother. There's no competing rotation motion fighting the
  translate/scale animations, and the card visually behaves the way the request describes — pulled
  from the hand at its natural angle, carried straight to the table.
- **At the landing instant**: `TrickCenter.tsx`'s resting trick-card render
  (`isPending` false) is always flat — `<PlayingCard card={card} size="small" />`, no rotation
  applied, matching every other seat's already-resting cards. Previously, easing rotation to 0deg
  meant the TravelCard *arrived* flat, so the swap to the resting element was rotation-continuous
  (only position/size could ever mismatch, already covered by the existing measured-origin/scale
  work). Now, the TravelCard arrives still at its original hand angle, and the resting element is
  flat — so the swap introduces a new, instantaneous rotation snap at exactly the landing moment.

In effect, the discontinuity moved from "mid-flight straightening" to "an instant unrotate at
touchdown" rather than being eliminated.

**Resolved, same session**: the user chose the first follow-up direction — resting (and gathering)
trick cards now keep their play-time rotation permanently, closing the gap entirely rather than
just relocating it. See "Resting/gathering rotation" below for the implementation.

## Resting/gathering rotation

`BatakScreen.tsx` gained `restingRotations: Record<PlayerId, number>` — the angle each
currently-in-trick card is holding, captured from the exact `originRotateDeg` its `TravelCard` was
frozen at, at the precise moment `pendingPlay` clears (the same tick the card stops being a
`TravelCard`, whether it's about to render as a plain resting card or immediately jump into
`gatheringTrick`'s sweep-away view — both read the identical captured value, so neither transition
ever un-rotates the card). Cleared back to `{}` once the trick actually sweeps (`performMove`
alongside `setGatheringTrick(null)`); a stale entry between tricks is harmless either way, since
`cardFor`/`gatheringTrick.entries` never look it up for a player not currently in the trick, but
clearing avoids letting dead data pile up across a full hand.

Threaded through `BatakTable` → `TrickCenter` (new `restingRotations` prop on both) and applied in
two places:
- The resting-card branch (`!isPending`): `<PlayingCard>` gets a `style={{ transform: [{ rotate:
  ... }] }}` using the captured angle instead of rendering flat.
- `GatherCard` (the sweep-away flip animation): new `restRotateDeg` prop, applied as a plain static
  `rotate` (rotateZ) alongside `translateX`/`translateY` on the outer wrapper — composes cleanly
  with the flip's own `rotateX`/`rotateY` on the inner front/back layers, since they're different
  axes.

AI plays are unaffected in practice (they never carry a nonzero angle to begin with, so `?? 0`
resolves the same as before), but the mechanism itself isn't human-specific — if a future pass ever
gives AI seats a per-card hand visual, resting rotation would already work for them too.

## Scope

Batak's human-played-card travel only, same as the rotation feature itself. AI plays never supply
`originRotateDeg` (always 0 either way — no visible change). Pişti is unaffected (separate
`RevealCard` implementation, no rotation concept).

## Testing

No new automated tests, per the standing 2026-07-07 mobile-UI testing policy. Full repo suite (39
suites / 248 tests) and typecheck re-verified clean after the change. No visual verification this
pass, per the user's 2026-07-17 direction against unsolicited screenshots.
