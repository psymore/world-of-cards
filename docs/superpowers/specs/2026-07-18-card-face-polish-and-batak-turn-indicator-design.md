# Card face polish + Batak turn indicator simplification

**Date:** 2026-07-18
**Status:** Approved, ready for implementation plan

## Overview

Three small, independent polish items, requested together but with no shared code:

1. Align the Q/K/J decorative court-card frame to the corner index's suit-glyph vertical center (it currently sits off that mark, at a fixed edge-inset instead).
2. Redesign the spade and club `SuitIcon` glyphs to match two user-supplied reference photos (classic/convex pip shapes), keeping hearts and diamonds untouched.
3. Simplify Batak's turn indicator: drop the gold `activeArea` background wash and the face-down opponent hand-card stacks, relying solely on the existing glowing `PlayerBadge` for whose-turn-it-is. Pişti is explicitly out of scope for this item (its face-down cards don't have the same clutter problem, per the user).

None of these touch shared game logic — all are presentation-layer only (`packages/ui` for items 1–2, `apps/mobile/src/games/batak` for item 3).

## 1. Court-card frame vertical alignment

**Current state:** `packages/ui/src/CourtCardFrame.tsx`'s `GEOMETRY` table hardcodes two bracket paths per `PlayingCardSize`, with the horizontal segments positioned at a fixed edge-inset (17px from top/bottom at `normal`, 11px at `small`) — a value derived independently of where the corner index's rank/suit actually render.

**Fix:** move each bracket's horizontal segment to the y-coordinate of the corner index's suit-glyph vertical center, computed from `PlayingCard.tsx`'s actual layout constants (`CornerIndex`'s container `top`/`gap`, the rank `Text`'s `lineHeight`, and `SuitIcon`'s `size`):

- `normal`: suit-glyph center = `top(1) + rankLineHeight(25) + gap(2) + suitIconSize(18)/2` = **37px** from the top edge (and, by the mirrored corner's 180° symmetry, 37px from the bottom edge, i.e. y=95 out of a 132-tall card).
- `small`: suit-glyph center = `top(1) + rankLineHeight(18) + gap(1) + suitIconSize(12)/2` = **26px** from the top edge (y=60 out of an 86-tall card).

This only changes the y-value of each bracket's horizontal segment (and the y at both endpoints where it meets the vertical segment) — the vertical segments' far endpoints, and all x-coordinates, are unchanged, since they already have the correct ~2.5px clearance from the corner-index boxes and moving only the horizontal segment's y doesn't affect that clearance:

| size | path | old | new |
|---|---|---|---|
| normal | `topRightBracket` | `M32.5,17 L82,17 L82,83.5` | `M32.5,37 L82,37 L82,83.5` |
| normal | `bottomLeftBracket` | `M12,48.5 L12,115 L61.5,115` | `M12,48.5 L12,95 L61.5,95` |
| small | `topRightBracket` | `M22,11 L56,11 L56,52` | `M22,26 L56,26 L56,52` |
| small | `bottomLeftBracket` | `M8,34 L8,75 L42,75` | `M8,34 L8,60 L42,60` |

Not a pixel-perfect fit to the rank glyph itself (the K/Q/J letterforms differ slightly) — deliberately scoped to the suit glyph only, per the user's explicit call, since that position is identical across all three ranks.

## 2. Spade & club redesign

Both current glyphs (`packages/ui/src/SuitIcon.tsx`) get replaced; hearts and diamonds are untouched. Approved final shapes (both in the existing `viewBox="0 0 24 24"`, same as today):

**Spade** — one convex leaf path + one separate flared-foot stem path (no concave "waist," unlike the current design):

```
Leaf: M12,1.5 C7.5,7 2,10.8 2,15 C2,18.6 4.9,21.2 8.2,21.2 C10,21.2 11.4,20.3 12,18.8 C12.6,20.3 14,21.2 15.8,21.2 C19.1,21.2 22,18.6 22,15 C22,10.8 16.5,7 12,1.5 Z
Stem: M9.3,22.7 C10.7,21.5 11.6,20 12,18.3 C12.4,20 13.3,21.5 14.7,22.7 C15,23 14.8,23.4 14.3,23.4 L9.7,23.4 C9.2,23.4 9,23 9.3,22.7 Z
```

**Club** — three overlapping circles (same centers as today, radius increased from 4.6 to 5.3 for fuller overlap) + a stem path, with the white center-hole `Circle` removed entirely (no longer needed — the larger radius closes the gap on its own):

```
Circles: (12,6.3,r=5.3) (7.4,14,r=5.3) (16.6,14,r=5.3)
Stem: M11,15.5 C11,17.5 10.2,19.9 8.6,21.2 C8.2,21.5 8.4,21.9 8.9,21.9 L15.1,21.9 C15.6,21.9 15.8,21.5 15.4,21.2 C13.8,19.9 13,17.5 13,15.5 Z
```

This was the first candidate shown during brainstorming and the one the user confirmed after two rounds of alternatives (wider base, then a longer thin "wing-flare" stem, then a shape traced pixel-for-pixel from a user-supplied sketch) were all rejected in favor of it — recorded here so a future session doesn't rediscover the same dead ends.

Applies everywhere `SuitIcon` is used: `PlayingCard`'s corner index and center watermark, Batak's trump-selection suit buttons and trick-center trump indicator, and `apps/playground` (shared package, no game-specific override exists or is needed).

## 3. Batak turn indicator simplification

**Remove**, both in `apps/mobile/src/games/batak/BatakTable.tsx`:
- The `activeArea` style (`rgba(244, 197, 66, 0.14)` gold wash) and its two usages — on `OpponentSeat`'s container (keyed off `isCurrentTurn`) and on the human `handArea` (keyed off `isHumanInteractive`).
- The face-down opponent hand-card rendering inside `OpponentSeat` (the `PlayingCard faceDown size="small"` row/column) — opponents now render as a badge only, no card stack.

**Keep unchanged:** the existing `PlayerBadge`/`badgeActive` glow (`glowShadow('#4ade80', 8)` + green border) — already computed from the same `isCurrentTurn`/`isHumanTurn` booleans, so it continues to be the sole turn indicator with no new logic needed.

**Cleanup implied by the removal** (dead code once the face-down stack is gone): `OpponentSeat`'s `hand`/`count`/`cardMargin`/`cardStyles`/`windowWidth` locals and its `sideStackHeight` prop; `OpponentSeatGroup`'s `sideStackHeight` prop and its three call-site pass-throughs; `BatakTable`'s `middleRowHeight` state + `handleMiddleRowLayout` (only existed to measure space for the now-removed side card stacks) and the `onLayout` wired to `middleRow`; the `SMALL_CARD_HEIGHT`/`SMALL_CARD_WIDTH`/`TOP_FAN_WIDTH_FRACTION`/`TOP_FAN_MAX_GAP`/`SIDE_STACK_HEIGHT_FRACTION`/`SIDE_FAN_MAX_GAP` constants; the `opponentRow`/`opponentColumn` styles. `pendingPlay` stays on `OpponentSeat` — still needed for the `isCurrentTurn` computation (glow turns off during the reveal-pause window, same as before). `opponentArea`'s fixed `minHeight: 135` is reduced since it now only needs to fit a badge, not a card stack — exact value decided during implementation, not fixed here.

**Explicitly not touched:** the trick-center cards (`TrickCenter`/`TravelCard`), the human's own hand, the deal-flight animation, and anything in Pişti.

## Testing

No new automated tests — this is decorative/presentational UI, per the standing 2026-07-07 testing policy. Re-run the existing suite for regressions (Batak's UI has no dedicated component tests today, so this is really about the engine/shared-package suites not breaking). No proactive screenshot/visual verification — per the user's explicit 2026-07-17 direction, only do that if asked.

## Out of scope

- Any change to hearts/diamonds glyphs.
- Any change to Pişti's opponent face-down cards or turn-indicator treatment (explicitly deferred by the user to a separate future discussion).
- Native on-device visual verification (standing gap across the whole project).
