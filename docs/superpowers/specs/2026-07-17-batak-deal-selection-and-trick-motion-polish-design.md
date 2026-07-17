# Batak deal, selection & trick-motion polish (round 2)

**Date:** 2026-07-17
**Status:** Approved, ready for planning

## Overview

A user-requested, 7-item polish pass touching card visuals, Batak's hand layout, and animation. Distinct from (and a partial walk-back of some choices made in) the immediately preceding "Batak table UI polish pass" (2026-07-16) and "Card corner-index & AI hand-layout polish" (2026-07-17, same day) sessions documented in CLAUDE.md.

Scope was clarified via two rounds of `AskUserQuestion` before design:
- Items that touch `packages/ui/PlayingCard.tsx` (the single shared card component used by Pişti, Batak, *and* `apps/playground`) apply **everywhere** — confirmed explicitly, per the CLAUDE.md standing rule to raise (not silently skip or silently apply) shared card/table visual changes.
- Of the remaining, game-specific items, the user confirmed the deal animation and the play-travel animation should be built for **both** Pişti and Batak (each adapted to that game's own table shape); the two-row hand split and the selection-lift/z-index change are **Batak-only** (Pişti's hand never grows past 4 cards and has no two-row concept).

Two genuinely visual questions were resolved via the brainstorming visual companion (mockups in `.superpowers/brainstorm/`, gitignored):
- Trick-pile overlap: **loose, corner-touching** (~12% overlap), not the tighter ~40% option.
- Deal-flight style: **individual rapid-fire** cards per player block, not a clustered single-packet burst.

## A. Shared `PlayingCard` changes (`packages/ui/src/PlayingCard.tsx`)

Affects Pişti, Batak, and `apps/playground` simultaneously — there is no per-game override today for aspect ratio, corner inset, or card back, and none is being added; this is a direct edit to the shared component.

### A1. Aspect ratio (+10% height, width unchanged)
- `normal`: 84×120 → 84×132
- `small`: 54×78 → 54×86 (78×1.1=85.8, rounded)
- `CARD_DIMS` and `styles.normal`/`styles.small` currently duplicate these numbers in two places (a pre-existing footgun, not introduced by this change) — consolidate to one source while touching these constants, so they can't drift apart.

### A2. Corner index inset (push closer to the card edge)
- Reduce `cornerNormal`/`cornerSmall`/their mirrored counterparts' `top`/`left`/`bottom`/`right` offsets to roughly half their current values (normal: 4/5 → ~1-2px; small: 3/3 → ~1px). Exact pixel values are tuned by eye and confirmed via screenshot during implementation — matching the precedent already documented inline for these same constants (`CORNER_INDEX_WIDTH`'s "tuned by eye ... confirmed via screenshot" comment).
- The fixed-width `CORNER_INDEX_WIDTH` centering logic (added 2026-07-17 earlier today, fixes "10" drifting from its own suit glyph) is unaffected — only the corner's distance from the card edge changes, not the index's internal layout.

### A3. Card back image
- Replace the `<CardBackPattern>` SVG (navy background + gold lattice/frame/lozenge) with the new `middle-lighted.png` asset, added at `packages/ui/assets/card-art/processed/ai-generated/cards-backround/middle-lighted.png` (currently untracked — gets `git add`ed as part of this work; `bottom-lighted.png` in the same folder is not used).
- Rendered as a full-bleed `<Image resizeMode="cover">` inside the existing `CardFrame`, which already clips to the card's rounded corners via `overflow: hidden` — no new clipping logic needed.
- `CardBackPattern.tsx` becomes dead code once nothing imports it — delete it and its export from `packages/ui/src/index.ts` (grep for other importers first; `PlayingCard.tsx` is the only known one).

## B. Batak hand row split (Batak-only)

`splitTwoRows(count)` (`apps/mobile/src/table/seating.ts`) returns `[ceil(count/2), floor(count/2)]` — e.g. `[7, 6]` for a 13-card hand. `BatakTable.tsx` currently assigns the **first** (larger) value to the **top** row. The fix flips which row gets the larger slice at the call site only:

```ts
const [largerRowCount] = splitTwoRows(sortedHand.length); // still 7 for 13
const topRowCount = sortedHand.length - largerRowCount;   // 6
const topRow = sortedHand.slice(0, topRowCount);
const bottomRow = sortedHand.slice(topRowCount);           // 7
```

No change to `splitTwoRows` itself or its other call sites.

## C. Batak selection behavior (Batak-only)

In `BatakTable.tsx`'s `HandRow`/`EntranceCard`:
- `SelectableCard`'s `liftDistance` (default 16px, shared with Pişti) gets an explicit **40px** (2.5×) override on Batak's hand cards only. Pişti's calls stay on the 16px default — item 5 doesn't apply there.
- Remove `SELECTED_CARD_Z_INDEX`/`UNSELECTED_CARD_Z_INDEX` and the conditional `zIndex` prop passed to `EntranceCard` entirely. With no per-card zIndex override, default render-order stacking applies: since `HandRow` renders the top row before the bottom row, a selected bottom-row card already paints over the top row where the two overlap (which only happens once the 40px lift pushes it upward) — no explicit "front" logic needed to satisfy "bottom row renders in front of top row."
- `collapsable={false}` on `EntranceCard` (added solely to make the old zIndex-based reordering work on Android) is removed alongside the zIndex logic it existed to support.
- `SELECTED_CARD_HIT_SLOP` (shrinks the selected card's touchable bounds) is **kept** as a defensive measure against the stray-tap bug that motivated the original front-stacking fix — it's orthogonal to z-index and doesn't reintroduce "always on top" behavior, just reduces one card's own hit-test footprint.

## D. Shared deal-flight animation (Pişti + Batak)

### D1. Shared geometry
`REVEAL_ORIGIN_OFFSETS` / `RevealOrigin` / `resolveRevealOrigin` (currently Pişti-only, defined in `apps/mobile/src/games/pisti/pistiSeating.ts`, re-exporting from the already-shared `apps/mobile/src/table/seating.ts`) move up into `table/seating.ts` proper, since both the new deal animation and the reworked play-travel animation (section E) need the same directional vectors for both games. `pistiSeating.ts` keeps re-exporting them for existing call sites, unchanged from callers' perspective.

### D2. `DealFlightOverlay` (new, `apps/mobile/src/table/`)
- No backdrop — the felt/table stays fully visible throughout (this is the literal "remove the dark overlay" ask).
- Cards fly individually, straight-line, center → each seat's `REVEAL_ORIGIN_OFFSETS` position (reused as a *destination* here, the mirror image of its existing use as a travel *origin*).
- Grouped into per-player blocks in seat order (human first, then opponents in the existing `assignSeats` turn order — bottom→right→top→left for 4 seats, bottom→top for Pişti's 2-player table), matching the approved "individual rapid-fire" mockup: ~340ms per block with a short inter-block gap, per-card stagger inside a block computed as `blockMs / cardsInThatSeat` (naturally faster for Batak's 13-card blocks, more visible for Pişti's 4-card blocks), ~220ms per-card flight. Total lands around 1.6-1.8s for both games without needing to hand-tune per game.
- Card counts per seat come from the real dealt hand size in initial state (`state.table.zones['hand-<id>'].cards.length`), not a hardcoded constant — works for both Batak's 13 and Pişti's 4 without a game-specific branch.

### D3. Batak wiring
- Replaces `DealAnimationOverlay.tsx` and the `'shuffling'|'cutting'|'revealing'` phase machine in `BatakScreen.tsx`'s local `useDealSequence` outright. New phase model: `'dealing' | 'revealing'`, total duration matching D2's ~1.7s (down from the current 2900ms).
- `BatakDealPhase`'s type and every consumer (`BatakTable.tsx`'s `playEntrance={dealPhase === 'revealing'}` checks) update to the two-phase model; the human hand's existing entrance animation (fade/scale/rise on first reveal) is unaffected structurally, just retriggered at the new timing.

### D4. Pişti wiring (new — Pişti has no deal animation today)
- New `useDealSequence`-equivalent hook (extracted to `apps/mobile/src/hooks/useDealSequence.ts` so both games' screens import the same one, rather than copy-pasting Batak's local version a second time) drives the same two-phase model.
- `PistiScreen.tsx` wires it in the same shape as Batak: hand rendering in `PistiTable` gated on `dealPhase === 'revealing'`, `DealFlightOverlay` rendered while `dealPhase === 'dealing'`.
- Reduced-motion handling mirrors Batak's existing fix (the 2026-07-15 dependency-array bug where reduce-motion wasn't picked up until a later render) — build it correctly from the start rather than needing a follow-up fix.

## E. Shared play-travel animation

### E1. Batak (new — no travel animation exists today)
- Every play (human or AI) gets a travel-in animation, hooked onto the existing `pendingPlay` staging in `BatakScreen.tsx` (already delays committing a trick-completing 4th card by `TRICK_COMPLETION_PAUSE_MS`; non-trick-completing plays currently commit instantly and need the same staging treatment extended to them so *every* play — not just the 4th of a trick — has something to animate from). Non-trick-completing plays (1st-3rd of a trick) get a new, shorter `PLAY_TRAVEL_DELAY_MS` (roughly matching the travel animation's own duration, e.g. ~300ms) before committing — distinct from and much shorter than `TRICK_COMPLETION_PAUSE_MS` (1100ms), which stays as-is for the 4th card so the full trick is still readable before it sweeps. The 4th card's travel animation plays out within the front portion of that existing 1100ms window, not as extra added time.
- Origin: the same directional offsets as D1/D2 — for AI, the seat's fixed direction (reads as "from their name/hand area" without new `onLayout` measurement plumbing, consistent with Pişti's existing "deliberately not measured" precedent); for the human, `'bottom'`.
- Destination: `TrickCenter`'s existing seat-fixed cross slots (bottom/top/left/right around center) — structurally unchanged, but pulled inward to the **loose, corner-touching** spacing confirmed via the mockup (~12% overlap, all 4 cards stay fully legible).
- Stacking order changes from seat-identity-based to **play-order-based**: the most recently played card renders on top regardless of which seat played it (derived from `state.currentTrick`'s array order, which already records play sequence) — this is what makes "the order of played cards remains visible through the stacking" actually true, since fixed seat positions alone don't encode when each card arrived.
- Implementation reuses the same shared travel-card primitive as Pişti's existing `RevealCard` (straight-line translateX/Y interpolation from an origin offset to a resting offset, opacity/scale fade-in) — likely worth promoting to a shared component in `apps/mobile/src/table/` given both games now use the identical mechanic, rather than maintaining two near-identical implementations. Left as an implementation-time call whether to extract now or once a third game needs it, consistent with this codebase's established "extract on second real use" convention (this would be the second use).

### E2. Pişti (refinement, not a rebuild)
- Pişti keeps its existing single shared-pile mechanic as-is — a literal 4-slot cross layout doesn't apply to a one-pile game, mirroring how the original 2026-07-10 trick-reveal work was explicitly scoped down the same way for the same reason.
- What carries over from item 7: confirming the existing travel is already a straight line (it is — `RevealCard`'s `translateX`/`translateY` interpolate linearly from `origin` to the resting pile offset) and reusing the same shared timing/easing constants as Batak's new E1 animation, so the two games' card-travel motion feels consistent even though the destination geometry differs.
- Pişti's existing stacked-pile offset (`PILE_CARD_OFFSETS`, capped at `MAX_STACKED_PILE_CARDS`) is unrelated to the new cross-layout concept and is left untouched — a Pişti pile can grow far larger over a hand than Batak's max-4-per-trick, so the same "12% overlap, 4 fixed slots" geometry wouldn't transfer meaningfully.

## Out of scope / deferred

- No native on-device verification (standing gap, browser/Playwright only, per `[[dev_sandbox_no_device_access]]`).
- No new automated tests, per the standing 2026-07-07 mobile-UI testing policy — this is presentational/animation work with no game-logic changes.
- `bottom-lighted.png` (the second card-back asset already sitting in the same folder) is not wired up anywhere in this pass.
- Whether to extract Batak's new travel-card primitive into a shared component immediately (E1) vs. leaving two near-identical implementations is left to implementation time, not decided here.

## Testing / verification plan

Per the standing testing policy, no new automated tests. Verification is via the existing browser/Playwright visual-verification workflow:
- Full existing test suite re-run for regressions (no game-logic files touched, so this should be a no-op check).
- Typecheck both packages.
- Screenshot/interact through: card back rendering (both games), corner-index tightness across several ranks including "10", Batak's two-row hand at a full 13-card and a shrunk hand, a full Batak deal sequence (order + no backdrop + ~1.7s duration), a Batak card selection in both rows (confirming lift height and bottom-over-top layering with no stray-tap regressions), a Batak trick play showing the new travel + loose cross-overlap + play-order stacking, and a Pişti deal sequence + a Pişti play-travel replay for parity.
