# Batak trick-gather directional flip — design

## Context

Batak's trick-gathering animation (shipped 2026-07-19, see
`docs/superpowers/specs/2026-07-19-batak-trick-gathering-animation-design.md`) currently flips
each of the 4 gathered cards using a generic left-right coin-flip (`rotateY`, pivoting at the
card's own center) regardless of which seat is winning the trick. This refines that flip so its
rotation direction physically matches the direction the card is traveling — the card should read
as tumbling toward the winner, not just spinning in place while it happens to move that way.

Brainstormed with the visual companion: two candidate hinge/swing motions were mocked up and
animated live for the bottom (human) and top (AI) directions, then the chosen rule was re-checked
against left/right before locking in, since the sign of a 3D CSS rotation isn't reliably guessable
from description alone.

## Rule

The card rotates around the edge nearest the destination (the "hinge"), and the opposite edge
swings over toward the destination. This holds for all 4 directions, derived automatically from
the existing `destinationOffset` prop `GatherCard` already receives — no new prop needed, since
the offset already encodes which direction the card is headed.

| Destination | Axis | Pivot (`transformOrigin`) | Sign |
|---|---|---|---|
| bottom (human) | `rotateX` | `50% 100%` (bottom edge) | + |
| top (AI) | `rotateX` | `50% 0%` (top edge) | − |
| left (AI) | `rotateY` | `0% 50%` (left edge) | + |
| right (AI) | `rotateY` | `100% 50%` (right edge) | − |

Derivation from `destinationOffset: { x, y }` (Batak's offsets are always purely axis-aligned —
either `{x: 0, y: ±195}` or `{x: ±165, y: 0}`, per `REVEAL_ORIGIN_OFFSETS` in
`apps/mobile/src/table/seating.ts`):

- If `offset.y !== 0` (vertical): axis = X, sign = `Math.sign(offset.y)`, origin = bottom edge if
  `offset.y > 0` else top edge.
- Else if `offset.x !== 0` (horizontal): axis = Y, sign = `-Math.sign(offset.x)`, origin = right
  edge if `offset.x > 0` else left edge.
- Fallback (`{x: 0, y: 0}`, not expected in practice): axis = Y, sign = +1, no origin override
  (today's center-pivot behavior) — a safe default rather than a special-cased crash.

## What changes, what doesn't

Scoped entirely to `apps/mobile/src/table/GatherCard.tsx`. The rotation axis, sign, and
`transformOrigin` become derived values instead of hardcoded `rotateY`/center-pivot; everything
else is untouched:

- The opacity crossfade timing (hard cutover at progress 0.5) — depends only on the *relative*
  0°→180° sweep amount, not which axis or pivot it happens around.
- `backfaceVisibility: 'hidden'` — same reasoning, axis-independent.
- The travel (`translateX`/`translateY` to `destinationOffset`) and fade-out logic — unaffected,
  this change is purely about the flip's rotation geometry.
- `useNativeDriver: true`, `CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING` reuse — unchanged.
- No prop signature change (`GatherCardProps` stays `{ card, destinationOffset }`) — no changes
  needed in `BatakTable.tsx`'s call site.

This keeps the change small and low-risk: a validated geometry substitution into an
already-shipped, already-reviewed animation, not a rewrite.

## Out of scope

- Pişti — untouched, per the standing per-game visual-change rule (not raised this session).
- Any change to `TravelCard.tsx` (the play-travel-in animation) — this only touches the
  trick-gather flip.
- Measured/real seat positions — still fixed direction offsets only, matching the rest of this
  animation family.
