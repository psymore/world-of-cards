# Batak (4-Player): Deal Sequence, Hand Visibility, Sorting & Two-Row Fan — Design

**Status:** Approved
**Date:** 2026-07-15
**Scope:** UI-only changes to the existing, already-playable 4-player Batak mobile screen (`apps/mobile/src/games/batak/`). No engine (`packages/engine`) changes. Does not touch the 3-player gömmeli variant, which has no mobile UI yet.

## Context

The user requested a set of related gameplay-feel changes to the 4-player Batak table, described in one pass: a shuffle/deal animation, auto-sorted hands, a two-row curved fan hand layout, and delaying the trump-suit reveal until after hands are shown. Scoping research (done before design) surfaced a real, pre-existing gap directly relevant to the last point: the human's hand is currently only rendered while `state.phase === 'playing'` (`BatakTable.tsx`, the `handArea`'s `ScrollView` is gated on that exact condition) — during `'bidding'` and `'trump-selection'`, only the bid buttons/trump-picker are shown, with no view of the player's own cards at all. This spec folds that fix in, since it's what makes "trump revealed after hands are shown" true in the first place, per the user's explicit confirmation during brainstorming.

**Decisions made during brainstorming (not re-litigated here):**
- Shuffle animation style: a stylized, non-literal "scatter" shuffle (card-backs wiggle and resettle), not a literal riffle or overhand simulation — cheapest to build, reads cleanly at small size, chosen over two more literal alternatives shown as animated mockups via the visual-companion browser tool.
- A "cut" step is included (stack splits, top packet moves under the bottom), chosen over a deal-only (no cut) alternative.
- The "1 to 1.5 second delay" the user described is an **additional deliberate pause after** the shuffle+cut animations finish playing (not a total time budget the animations must fit inside).
- Trump reveal needs **no new mechanism or flourish**. Since the hand-visibility gap above is being fixed (hand shown from right after dealing, not just once play starts), "hands before trump" falls out for free — trump display stays exactly as gated today (`phase === 'playing'`).
- The two-row fan's row split **always rebalances** as the hand shrinks (10 cards → 5/5, 7 → 4/3, etc.), rather than keeping one row fixed-size or collapsing to a single row at some threshold.
- The two-row fan and sorting apply to the **human's hand only**. Opponents keep their existing face-down single-row fan (top seat) / vertical stack (side seats), unchanged.
- Overlap is set to **16%** (the middle of the user's stated "approximately 15–17%" range) as one concrete constant.

## 1. Deal Sequence & Animation

**Trigger:** every time a new hand begins — the initial game start and every subsequent "Play Again" (i.e., every fresh `batakGame.setup(...)` call surfaced to the screen), not just once per app session.

**Sequence and timing:**
1. Scatter shuffle animation (~1s, per the approved mockup: four card-back rectangles independently wiggle/rotate in place and resettle).
2. Cut animation (~0.7s: top packet lifts and translates to below the bottom packet).
3. An additional pause of 1,000–1,500ms (a `DEAL_PAUSE_MS` constant; exact value non-critical, pick 1200ms) — a deliberate beat, not further animation.
4. Reveal: the real game screen (felt, seats, hands, bidding UI) appears. Only the human's own hand gets a per-card "fly from center out to its two-row fan position" entrance; every other element (opponent hands, badges, felt/wood-corner decorations) simply appears, no per-element animation.

**Visual treatment:** the shuffle/cut animation is a **decorative overlay**, not a literal simulation of the real 52 cards — generic navy/gold card-back rectangles (reusing the existing `CardBackPattern` visual language), absolutely positioned over the center of the table, `pointerEvents: 'none'`, matching the `TableFelt`/`CardBackPattern` convention of cheap, non-game-state-driven decoration. This keeps it independent of `BatakState` (no risk of the overlay needing to "know" real card identities) and cheap regardless of future table sizes (3-player gömmeli, whenever its UI is built, gets this for free with no per-seat-count scaling concern).

**Technical approach:** a small local state machine, e.g. `dealPhase: 'shuffling' | 'cutting' | 'revealing'`, owned by `BatakScreen.tsx` (mirrors where other cross-cutting screen-level sequencing already lives, e.g. the existing trick-completion pause) and reset every time a new `setup()` result is received. Driven by chained `setTimeout`s advancing `dealPhase` through the three states — the same pattern already used for Pişti's/Batak's existing reveal-pause logic, not a new scheduling abstraction. Motion itself uses plain RN `Animated` (not Reanimated — consistent with every other animation in this codebase, e.g. Pişti's `RevealCard`), and must respect `useReducedMotion()`: when reduced motion is on, skip straight to the final `'revealing'` state's static end-position with no animated overlay, but the `DEAL_PAUSE_MS` beat before revealing can still apply (or be shortened) since it's a pause, not motion — implementer's judgment on whether to keep or zero it under reduced motion.

## 2. Hand Visibility During Bidding/Trump-Selection

The human's hand (sorted, two-row fan per Sections 3–4) becomes visible as soon as `dealPhase` reaches `'revealing'`, and stays visible continuously through `'bidding'`, `'trump-selection'`, and `'playing'` — not gated to `phase === 'playing'` as today.

During `'bidding'` and `'trump-selection'`, the hand is **non-interactive**: every card renders `disabled` via the exact mechanism already used for "not your turn" (`legalCardIds` is naturally empty in those phases, since legal moves are `bid`/`pass`/`selectTrump`, not `play` — no new gating logic needed, just removing the `phase === 'playing'` condition that currently hides the row entirely). `handArea` needs to render the hand row **and** the phase-specific controls (`BidControls` during bidding, nothing extra during trump-selection since that's a center-panel picker) together, rather than the current either/or.

## 3. Hand Sorting

Applies to the human's hand only, recomputed as a pure display-order derivation from `state.table.zones['hand-<humanId>'].cards` on every render (not stored in state, not a one-time sort at deal time) — so it automatically stays correct as cards are played without any extra bookkeeping.

```ts
const SUIT_DISPLAY_ORDER: Suit[] = ['hearts', 'spades', 'diamonds', 'clubs'];

function sortHandForDisplay(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_DISPLAY_ORDER.indexOf(a.suit) - SUIT_DISPLAY_ORDER.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return compareRanks(b.rank, a.rank); // descending: A high ... 2 low
  });
}
```

`compareRanks` is the existing ace-high comparator from `packages/engine/src/games/batak/ranking.ts` (already used by the rule engine itself — same rank order, no new comparator needed). "No gap for a missing suit" requires no special logic: a plain grouped sort with no per-suit visual divider naturally produces a flat, gapless sequence — if a player has zero Diamonds, no Diamond-shaped space appears, the Clubs cards simply follow the last Spade directly. This is the default behavior of the comparator above, not an extra case to implement.

## 4. Two-Row Fan Layout

New geometry added to `apps/mobile/src/table/seating.ts`, alongside the existing single-row `fanRotationDeg`/`fanCurveY`/`OPPONENT_CARD_OVERLAP`:

- `splitTwoRows(count: number): [number, number]` — always-rebalancing row split. `top = Math.ceil(count / 2)`, `bottom = count - top` (13 → 7/6, matching the user's stated example exactly; 10 → 5/5; 7 → 4/3; 1 → 1/0).
- A new overlap constant for this layout, `HUMAN_HAND_OVERLAP_PERCENT = 16`, expressed as a percentage of card width (not a fixed px value like the opponent fan's `OPPONENT_CARD_OVERLAP`, since the user specified it as a percentage) — convert to a per-card-width px margin at render time using the existing `PlayingCard` size the hand row already renders at.
- Per-row curve/rotation: reuse the existing `fanRotationDeg(index, count)` / `fanCurveY(index, count)` math, called once per row with that row's own `count` (each row is its own independent little fan, not one continuous 13-card arc split visually in half) — no new curve formula, just applying the existing one twice.

Rendering order within `BatakTable.tsx`'s hand area: top row first (7 cards, or fewer as hand shrinks), bottom row second (6 cards or fewer), both center-aligned, both using `sortHandForDisplay`'s output sliced by `splitTwoRows`'s counts (first `top` cards in the top row, remaining in the bottom row — preserving the sorted suit/rank order reading left-to-right, top-row-then-bottom-row).

## 5. Trump Reveal

No code change beyond what Section 2 already produces as a side effect. `TrickCenter`'s trump display stays gated on `state.phase === 'playing'`, exactly as it is today. Documented here explicitly (rather than silently omitted) so a future reader doesn't wonder whether this requirement was missed — it wasn't; it was resolved as "already true once Section 2 ships," confirmed with the user during brainstorming.

## Files Touched

- `apps/mobile/src/table/seating.ts` — add `splitTwoRows`, `HUMAN_HAND_OVERLAP_PERCENT`. No changes to existing exports (Pişti and Batak's opponent-seat usage of this file is unaffected).
- `apps/mobile/src/games/batak/BatakTable.tsx` — `sortHandForDisplay` (or import from a shared location if it turns out Pişti could use similar sorting later — implementer's call, not required now), two-row hand rendering, `handArea` restructuring to show the hand during bidding/trump-selection.
- `apps/mobile/src/games/batak/BatakScreen.tsx` — new `dealPhase` state machine and the deal/shuffle/cut overlay component (new, e.g. `DealAnimationOverlay.tsx`, following the existing convention of small dedicated decorative components like `TableWoodCorners`).

## Testing

Per this project's standing testing policy (2026-07-07, documented in `CLAUDE.md`): no new tests are written for mobile UI/screens by default. This entire sub-project is UI/animation/layout — no engine changes, no new tests planned, consistent with every prior Batak/Pişti UI polish pass.

## Out of Scope

- The 3-player gömmeli variant's UI (doesn't exist yet — this spec's `DealAnimationOverlay` and two-row fan geometry are written to be reusable when that UI is eventually built, but wiring them in is a future sub-project).
- Opponent hands adopting a two-row layout (explicitly declined — stays single-row/stack, face-down).
- Sound effects for the shuffle/cut/deal.
- Any change to bidding/trump-selection/trick-play *rules* — this is presentation-only.
- Redeal/multi-hand match-level animation sequencing (Batak is still single-hand scope per the original rules spec).

## Next Step

Write the implementation plan for this design.
