# Batak trick-card play animation — plain-language guide

**Owned by:** this domain (`docs/domains/games/batak/`) — indexed from `overview.md`. The
animation-specific rules referenced below (coordinated timelines, velocity continuity) are owned by
`docs/animation/animation-architecture-constitution.md` §V–VI; this guide illustrates them for
Batak's trick-play pipeline, it doesn't restate or override them.

This is a living reference, not a historical spec — edit it whenever the animation changes. It
explains the whole "human plays a card" pipeline in Batak, where every knob lives, and the traps
that have already bitten us once (so you don't have to hit them again).

## The mental model: 4 stages, in order

When you tap a card twice (select, then confirm), it goes through four stages before it's done:

```
1. SELECT          card lifts up in your hand, nothing else happens yet
2. LOCAL DEPARTURE  (~150ms) card lifts off further, still inside your hand's own row/fan
3. TRAVEL           (~380ms) card flies from your hand to the trick center
4. REST             card sits in the trick center until the trick completes
5. GATHER-SWEEP     (~530ms, only once all 4 players have played) all 4 cards flip and fly to the winner
```

Stages 2 and 3 together always add up to `CARD_TRAVEL_DURATION_MS` (530ms) — stage 2 is carved out
of the front of that budget, not added on top. This matters when you tune timings: if you make
stage 2 longer, stage 3 automatically gets shorter, so the total stays the same unless you also
change `CARD_TRAVEL_DURATION_MS` itself.

AI plays skip stage 2 entirely (there's no visible AI hand to depart from) and go straight from
"nothing" to stage 3, using a fixed direction instead of a real measured position.

## Where everything lives

| Stage | File | What it owns |
|---|---|---|
| Timing shared by every game | `apps/mobile/src/table/travelAnimation.ts` | Durations + easing curves, all in one place |
| Stage 2 (local departure) | `apps/mobile/src/games/batak/table/HumanHandFan.tsx` | The card's own hand-fan lift-off animation |
| Staging/sequencing logic | `apps/mobile/src/games/batak/BatakScreen.tsx` | `commitMove`/`armPendingPlay` — decides when each stage starts/ends |
| Stage 3 (travel) | `apps/mobile/src/table/TravelCard.tsx` | The shared "fly from A to B" component (also used by Pişti) |
| Stage 4 (rest) + wiring | `apps/mobile/src/games/batak/table/TrickCenter.tsx` | Renders whichever stage is currently active for each seat |
| Stage 5 (gather-sweep) | `apps/mobile/src/table/GatherCard.tsx` | The flip-and-fly-to-winner animation |

## The dials you can actually turn

All in `travelAnimation.ts` unless noted:

| Constant | What it controls | Turning it up... | Turning it down... |
|---|---|---|---|
| `CARD_TRAVEL_DURATION_MS` (530) | Total stage-2 + stage-3 time | ...makes the whole flight feel slower/floatier | ...makes it snappier |
| `CARD_TRAVEL_EASING` (ease-out cubic) | Shape of the *position* travel (stage 3) | N/A — this is a curve, not a number. Ease-out = fast start, gentle landing (current). Ease-in-out = gentle both ends. | |
| `CARD_SCALE_HOLD_FRACTION` (0.7) | What fraction of stage 3 the card stays full-size before shrinking | ...shrink happens later/faster (shorter shrink window) | ...shrink starts earlier/happens more gradually |
| `CARD_SCALE_SHRINK_EASING` (ease-out quad) | Shape of *just the shrink itself* (the last `1 - hold` fraction) | | |
| `LOCAL_DEPARTURE_DISTANCE` (`HumanHandFan.tsx`, = one card height) | How far the card lifts during stage 2 before handing off to stage 3 | Needs to stay at least one card height, or same-row neighbor cards may still show through | |
| `LOCAL_DEPARTURE_DURATION_MS` (`HumanHandFan.tsx`, 150) | How long stage 2 takes | Longer stage 2 = shorter stage 3 (see above) | |
| `TRICK_COMPLETION_PAUSE_MS` (`BatakScreen.tsx`, 1100) | How long the completed 4-card trick sits fully visible before sweeping | | |
| `PLAY_TRAVEL_DELAY_MS` (`BatakScreen.tsx`, = `CARD_TRAVEL_DURATION_MS + 40`) | For a non-trick-completing play, how long until the engine move actually commits | Should always be a little *more* than the total flight time, or the card will snap to its resting spot before the animation finishes | |

## The two traps that already caused real bugs — read this before touching position math

### Trap 1: `measureInWindow` and transforms

Several places in this codebase (`playWithMeasuredOrigin` in both `BatakTable.tsx` and
`PistiTable.tsx`) measure a card's real on-screen position so the travel animation can start from
exactly where the card was, instead of a generic fixed direction.

The rule that matters: **a transform on a *descendant* of the measured node is never included in
the measurement (true on every platform, no exceptions) — but a transform on an *ancestor* of the
measured node might or might not be included, and this is platform-dependent.**

- Descendant example: `SelectableCard`'s own lift-up-when-selected animation. Safe to just subtract
  the known lift distance from whatever you measure — see `DEFAULT_LIFT_DISTANCE`'s doc comment.
- Ancestor example: the hand-fan's own "where in the row does this card sit" position. **Don't**
  measure a card that's nested inside that transform and add the offset back in — if the platform
  already includes the ancestor transform in the measurement, you'll double-count it and the card
  will visually launch from the wrong spot (this literally happened in Pişti — see the
  `handRowCenter` comment in `PistiTable.tsx`).
- The fix, every time: measure something that has **no transform on it at all** (the row container
  itself, not an individual card), and add the known, hand-computed offset yourself. Never trust
  `measureInWindow` to see through an ancestor's transform.

Batak's own `playWithMeasuredOrigin` (`BatakTable.tsx`) still measures the per-card node directly
rather than the row container — it hasn't caused a *reported* bug, but it's the same shape of risk
as the Pişti one. If a future report says "the card launches from the wrong spot" in Batak, this is
the first place to look.

### Trap 2: velocity discontinuities at stage boundaries (Constitution §V)

This is the "stops, then speeds up again" bug from earlier this session — a concrete instance of
`animation-architecture-constitution.md` §V (Visual State Continuity). Two animations bolted
end-to-end can each be individually smooth and *still* produce a visible hitch where they meet, if
their velocities don't match at that instant.

The concrete rule: **`Easing.out(...)` always ends at zero velocity (that's what "ease out" means —
it decelerates to a stop). `Easing.in(...)` always *starts* at zero velocity and ends at maximum.**
So:
- Two `Easing.out` animations back-to-back = stop, then a fresh burst of speed. Bad.
- An `Easing.in` leg handing off into an `Easing.out` leg = both meet at maximum velocity in the
  middle. Smooth. This is exactly why stage 2 uses `Easing.in(cubic)` — it hands off into stage 3's
  `Easing.out(cubic)` with no dip in between.

If you ever add a new stage boundary (e.g., splitting stage 3 into two legs for some reason), check
the easing pairing at that seam the same way, not just each leg in isolation.

## Why scale gets special treatment (two separate Animated values) (Constitution §VI)

This is Batak's concrete case of `animation-architecture-constitution.md` §VI (Coordinated
Property Timelines). Position/rotation and scale intentionally use **different, independent** driving values inside
`TravelCard.tsx` (`progress` vs. `scaleProgress`), not the same one. Reasons, in order of when we
learned them:

1. A shared curve (`Easing.out(cubic)`) applied to a *size* change front-loads almost the whole
   shrink into the first third of the flight — looked like "shrinks in a blip, then coasts."
2. Fixed by holding the size flat and only shrinking near the end — but the value gating "when does
   the shrink start" needs to track **real elapsed time**, not the already-eased position curve, or
   "starts shrinking at 70% of the flight" would actually kick in way earlier than 70% of real time.
   That's why `scaleProgress` runs on `Easing.linear`.
3. The shrink itself still needs its *own* shape (not a flat/linear resize) — that's what
   `CARD_SCALE_SHRINK_EASING` does, applied via the `easing` option inside the `scale` interpolate
   call. (Handy fact confirmed straight from React Native's source: a multi-point `interpolate`
   applies `easing` *within whichever segment is currently active*, not across the whole `[0,1]`
   range — so the flat "hold" segment is completely unaffected by it.)

If you want scale to track position more closely again (a different aesthetic), you'd need to
either accept the "blip" tradeoff from point 1, or keep the current split-value approach and just
change *which* curves are used.

## How to actually test a change (don't just read the code)

Screenshots taken one at a time with waits in between are **not** trustworthy for judging
animation smoothness — cumulative screenshot/IPC overhead drifts the "elapsed time" you think
you're looking at by tens of milliseconds per shot, easily enough to hide or fake a discontinuity.

What actually works (and is how the fixes in this session were verified): drive the app with
Playwright against a local `expo start --web` build, and inject a script that samples the *real*
on-screen position/size of the animating element on every `requestAnimationFrame`, all inside the
browser (no round-trip per sample). Then look at frame-to-frame deltas — a real discontinuity shows
up as a sudden jump in the delta, not just in the raw value.

A few concrete lessons from doing this:
- Use the card's **center point** (`x + width/2`, `y + height/2`), not its raw top-left corner — a
  rotated card's axis-aligned bounding box corner drifts as the card shrinks even when its center
  isn't moving at all. Tracking the corner will make you chase a phantom bug.
- Batak reshuffles/deals randomly every run and bidding is AI-driven, so a fixed sequence of
  `waitForTimeout`s to get through setup is inherently flaky — always verify you actually reached
  the state you think you're in (e.g., check the card's rect actually changed after a "select" tap)
  before trusting the data from what follows.
- If you start your own test server, use a different port than whatever the user already has
  running — check `netstat`/process list first rather than assuming the port is free.
