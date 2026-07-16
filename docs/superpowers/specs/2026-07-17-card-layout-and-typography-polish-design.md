# Card corner-index & AI hand-layout polish — design

Date: 2026-07-17
Status: approved, pending implementation plan

## Motivation

User-provided references (`docs/references/batak-and-card-references/`: `alper-games-batak.jpeg`,
`current-batak.jpeg`, `10-text-and-glyph-alignment.jpeg`) surfaced three concrete gaps against a
professional playing-card look:

1. The corner rank/suit index doesn't read as optically centered — "10" (the only two-character
   rank) visually drifts from the suit glyph beneath it, and single-character ranks (J, etc.) feel
   off-balance too.
2. The AI opponent hand fan (top seat) looks messy — rotated, curved, unevenly spaced — compared
   to a clean professional table.
3. On phones, the human hand uses only ~70% of available width (15% margin each side), reading as
   too conservative/cramped compared to the reference, which spreads close to the screen edges.

## Scope

- `packages/ui/src/PlayingCard.tsx` — shared corner-index layout. Fixes apply to **both** Pişti
  and Batak automatically, and to `apps/playground` too, since it's the same shared component (no
  separate playground work needed — this is the standing exception in CLAUDE.md for genuinely
  shared code, not a "should the other side match" discussion trigger).
- `apps/mobile/src/table/seating.ts` — shared fan/stack geometry helpers, used by both games'
  tables.
- `apps/mobile/src/games/pisti/PistiTable.tsx` and `apps/mobile/src/games/batak/BatakTable.tsx` —
  call-site changes to use the new geometry for opponent hands.

Explicitly out of scope: the human ("You") hand's own fan in Batak (kept exactly as-is, per user
direction — "the player's hand can keep its fan layout"). Pişti's human hand row is also
untouched — it's a plain centered row that already fits its max-4-card hand comfortably on any
phone width, so it never had the "conservative margin" problem being fixed here.

## 1. Corner index optical centering

**Current behavior** (`packages/ui/src/PlayingCard.tsx`, `CornerIndex` + `styles.cornerNormal` /
`styles.cornerSmall`): the index container uses `alignItems: 'flex-start'` and shrink-wraps to its
widest child. This was a deliberate prior fix for a *cross-card* consistency problem (with
`alignItems: 'center'`, a card's own container width depends on that card's own rank text width, so
different ranks' suit icons end up centered at different absolute x-offsets when compared side by
side in a hand). But it reintroduces the complementary *same-card* problem the user is now
flagging: for "10" specifically (the widest rank text), left-anchoring means the narrower suit
icon renders to the left of "10"'s own center, reading as shifted.

**New design:** give the index container a **fixed width** (one constant per card size — normal
and small), instead of shrink-wrapping. With a fixed width and `alignItems: 'center'`:
- Every child (rank text, suit icon) centers within that same fixed box, for every rank — so a
  card's own rank and its suit glyph always share a common center axis (fixes same-card
  alignment).
- The box width is now constant across every card of the same size, so the suit icon's absolute
  x-offset from the card's corner is identical across every rank (fixes cross-card consistency) —
  getting both properties this time, not one traded for the other.

Concretely:
- Add `CORNER_INDEX_WIDTH = { normal: <tuned>, small: <tuned> }`, sized to comfortably fit "10" at
  `cornerRankNormal`/`cornerRankSmall`'s font size plus a little breathing room.
- `cornerNormal`/`cornerSmall` (and their mirrored variants) get `width: CORNER_INDEX_WIDTH.normal`
  (or `.small`) and `alignItems: 'center'` in place of `'flex-start'`.
- Add a small explicit gap (e.g. `marginTop` on the suit icon, or a `gap` on the container) between
  rank text and suit icon, tuned to match the reference's vertical spacing — today there is no
  explicit spacing between them.
- Update the stale comment block explaining the old `flex-start` reasoning to describe the new
  fixed-width approach instead.

No font-metrics API or per-rank offset lookup table — the fixed-width-plus-center approach is
self-consistent across all 13 ranks with a single pair of constants. Exact pixel values are tuned
by eye during implementation and confirmed via screenshot across a representative sample of ranks
(A, 10, K, Q, J, and a plain numeral like 7) at both card sizes, not computed from font metrics.

## 2. AI hand fan — flat, auto-fit spacing

**Current behavior:** opponent seats (top single-seat row, left/right side stacks) apply rotation
(`fanRotationDeg`) and a vertical curve (`fanCurveY`) to the top-seat row, and a fixed-percentage
overlap to side stacks (`SIDE_CARD_STYLES`/`OPPONENT_CARD_OVERLAP` in shared `seating.ts`; Batak
additionally overrides with its own local `BATAK_TOP_OVERLAP_PERCENT` /
`BATAK_SIDE_CARD_STYLES`/`BATAK_SIDE_OVERLAP_PERCENT` constants). These are static, per-game-tuned
magic numbers that don't adapt to actual available space, and the rotation+curve combination on
the top seat is what reads as "messy" in the `current-batak.jpeg` reference.

**New design:** remove rotation/curve from opponent hands entirely (flat cards only), and replace
every static overlap constant with one dynamic rule, reusing the existing `fillWidthMarginPx`
helper (already generic: given a card dimension, a count, a target span, and a max gap, it returns
the per-card margin needed to spread `count` cards across close to `targetSpan`, capping the gap so
a small hand doesn't scatter unnaturally sparse). This single formula already implements the user's
stated preference order as a continuous rule rather than two separate modes:
- Few cards (e.g. Pişti's max-4 opponent hand) → the natural per-card gap is below the cap, so
  cards spread evenly with a clean, non-overlapping gap.
- Many cards (e.g. Batak's 13-card starting hand) → the natural per-card step goes negative
  (overlap), tightening automatically as the hand grows.

Wiring:
- **Top single-opponent row (horizontal):** measure the row's available width via `onLayout` on
  its container (matching the existing pattern already used for the human hand's width-fill in
  `BatakTable.tsx`), then call `fillWidthMarginPx(SMALL_CARD_WIDTH, count, measuredWidth, maxGap)`
  for `marginLeft` on each card after the first.
- **Left/right side stacks (vertical):** same idea, measuring available height via `onLayout` and
  applying the result as `marginTop`, reusing `fillWidthMarginPx` for the vertical dimension (its
  parameters are already dimension-agnostic despite the `cardWidth` name — see the existing comment
  in `BatakTable.tsx` making the same point for `overlapMarginPx`).
- New `maxGap` constants (one for the horizontal top fan, one for the vertical side stack) sized
  for face-down `'small'` cards — tuned during implementation and confirmed via screenshot, not
  precomputed.

Cleanup that falls out of this: `OPPONENT_CARD_OVERLAP`, `SIDE_CARD_STYLES`, and
`overlapMarginPx`'s Batak-local counterparts (`BATAK_TOP_OVERLAP_PERCENT`,
`BATAK_SIDE_OVERLAP_PERCENT`, `BATAK_SIDE_CARD_STYLES`, `SIDE_CARD_OVERLAP`,
`MAX_SIDE_STACK_CARDS`/`BATAK_MAX_SIDE_STACK_CARDS` precomputed-array constants) all become dead
code once opponent seats compute margins dynamically, and should be removed rather than left
unused. `fanRotationDeg`/`fanCurveY` themselves stay in `seating.ts` — Batak's human ("You") hand
still uses them for its own fan, which is explicitly kept as-is.

## 3. Mobile hand margin (Batak only)

Bump `HUMAN_HAND_SPREAD_FRACTION` in `BatakTable.tsx` from `0.7` to `~0.92` (a small ~4% gutter on
each side instead of 15%), so the human hand spreads much closer to the Alper Games reference while
keeping a small safety margin against clipping on narrow phones. `HUMAN_HAND_MAX_GAP` (currently 24)
is left as-is unless screenshots show it needs retuning alongside the wider span.

## Testing / verification plan

No new automated tests, per the standing 2026-07-07 testing policy (mobile UI). Existing tests
(typecheck + full Jest suite) must still pass unchanged, since none of this touches engine logic or
component props consumed by existing tests in a breaking way — confirm no test asserts on the
removed static-overlap style values or the old `flex-start` corner alignment.

Manual visual verification via the existing browser/Playwright workflow
(`dev_sandbox_no_device_access` — no on-device access in this environment):
- Corner index: close-up screenshots of several ranks (A, 10, K, Q, J, 7) at both card sizes,
  confirming the rank and suit glyph share a visual center and line up consistently card-to-card.
- Pişti: 2-player and 4-player tables, at a full opponent hand and a nearly-empty one, confirming
  the top fan and side stacks look clean at both extremes.
- Batak: 4-player table at full 13-card hands and partway through a hand (fewer cards), same check,
  plus confirming the human hand now spans noticeably more of the screen width.
- Zero new console errors/warnings beyond the already-documented `react-native-web`-only noise.

Still not verified on a native device — same standing gap as every prior UI pass in this project.
