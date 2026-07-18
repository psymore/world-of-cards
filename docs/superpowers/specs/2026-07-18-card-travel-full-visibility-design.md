# Card-travel full visibility — design

## Context

After the human-hand real-position card-travel change (see
`docs/superpowers/specs/2026-07-18-human-hand-real-position-card-travel-design.md`), the user
found a follow-up visual issue: the traveling card fades in from transparent and scales up from
0.6× to full size over the course of its flight (Pişti's `RevealCard`) or fades in from
transparent (Batak's shared `TravelCard`). Combined with the now-real measured origin, this read
as the card materializing partway through its path rather than physically flying along it — it
looked "ghostly" rather than solid the whole way.

Brainstormed with the visual companion: four looping CSS mockups (straight line / subtle arc / arc
+ rotation / dramatic toss) were shown to compare path shapes once opacity/scale were fixed. The
user picked the straight-line option — no arc, no rotation — confirming the fix is scoped to
visibility only, not the path shape.

## Scope

Remove the fade-in and scale-up from both existing travel animations. The translate path itself
(straight line, from the measured or fixed origin offset down to rest) is unchanged. Duration,
easing, and reduced-motion handling are unchanged in both.

## Changes

- **Pişti** (`apps/mobile/src/games/pisti/PistiTable.tsx`, `RevealCard`): drop the `opacity: anim`
  style and the `scale` transform interpolation (`0.6 → 1`). Keep only the `translateX`/
  `translateY` interpolations.
- **Batak** (`apps/mobile/src/table/TravelCard.tsx`, shared component): drop the `opacity:
  progress` style (it had no scale to begin with). Keep only the `translateX`/`translateY`
  interpolations.

Since `TravelCard` is shared, this also applies to any future game that reuses it — full
visibility during travel is the intended default going forward, not a Batak-specific choice.

## Testing

No new automated tests — decorative animation/timing UI, per the standing 2026-07-07 mobile-UI
testing policy. Existing suite re-run for regression.

## Out of scope

- Arc/curved path or rotation during flight — explicitly declined by the user after seeing the
  animated comparison; the path stays a straight line.
