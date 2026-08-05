# Batak Trick-Center Resize — Design Spec

**Status:** Approved (2026-08-05)

## Context

`docs/domains/games/batak/known-issues.md`'s "Trick-center resize workaround" entry: `TrickCenter.tsx` renders every trick card — traveling and resting — at a constant `size="normal"`, sidestepping rather than solving the "card shrinks smoothly as it lands" motion the trick center was originally meant to have. The workaround exists because an earlier attempt tried interpolating between `PlayingCard`'s `"normal"` and `"small"` size variants, and their internal proportions aren't a uniform scale of each other (confirmed against real numbers: `CARD_DIMS` shrinks the card body to ~75% width/~76% height, but `CORNER_INDEX_WIDTH` shrinks to ~68% and `WATERMARK_ICON_SIZE` to ~62%) — so even a perfectly smooth interpolation between the two real components still landed on a visibly different shape right at the end, per the Animation Constitution's own §5.III/§5.VI evidence.

The Animation Playground's `Demo05Transform.tsx` already proved the real fix, against the playground's simplified `SimpleCard`: never swap size variants at all — render one component the whole time, shrunk via a continuous outer CSS `scale`, with an *additional* relative `glyphScale` on just the corner/watermark content so those don't shrink at the same rate as the card body. This spec ports that proven mechanism to production, tuned first against the real `PlayingCard` component (mirroring how `Demo09` preceded the hand-fan's own production port).

This spec builds directly on the just-completed hand-fan migration (`docs/superpowers/specs/2026-07-30-batak-hand-fan-demo08-migration-design.md`), which explicitly deferred this exact work to "once the hand-fan work is proven solid on-device" (now confirmed by the user).

## 1. `PlayingCard` gains an additive `contentScale` prop

`packages/ui/src/PlayingCard.tsx` gets a new optional prop, `contentScale?: number`, defaulting to `1` — every existing caller (Pişti included) is byte-identical when it's omitted. It applies an extra relative `transform: [{ scale: contentScale }]` to just the two `CornerIndex` instances and `CenterArt`'s suit-watermark icon, layered on top of whatever outer scale the caller already applies via its own wrapping transform. This is the production analog of Demo05's `glyphScale` — same principle (compensate the content's disproportionate shrink), different name (matching this component's own "watermark/corner index" vocabulary rather than the playground's generic "glyph").

Court-card art (`CourtCardFrame`/`courtArtImage`) is **not** touched by `contentScale` — it already sizes itself as a percentage of the card frame, so it scales correctly with the outer transform alone; scoping `contentScale` to only the corner index + watermark (the two things Demo05 also scoped `glyphScale` to) keeps this change minimal and matches the one real precedent this repo has for the problem.

## 2. New playground demo — tune against real card art

**Demo 10** (`DemoId` `'batak-trick-resize-tuning'`, the next slot after Demo09's `'batak-hand-tuning'` in `apps/playground/src/animation/types.ts`) renders real `PlayingCard`s at `size="normal"`, wrapped in a tunable outer `scale` and the new `contentScale`, with sliders for both (reusing `LabeledSlider` directly, same as Demo09 did for its two extra non-`FanConfigControls` sliders). No hand/gesture logic needed — this is a static-appearance tuning tool, not a reflow/interaction one. Output: two numbers (`TRICK_CARD_SCALE`, `TRICK_CARD_CONTENT_SCALE`) that Production hardcodes.

## 3. Production wiring

**New shared constants module** `apps/mobile/src/games/batak/table/trickCardScale.ts` (mirrors `batakRailFan.ts`'s role as this feature's single source of truth, consumed by both `TrickCenter.tsx` and `GatherCard.tsx`):

```ts
export const TRICK_CARD_SCALE = <tuned via the new playground demo>;
export const TRICK_CARD_CONTENT_SCALE = <tuned via the new playground demo>;
// First pass: the entire shrink happens during BatakHandCard's local-departure leg (below); by
// the time TravelCard takes over, a human-played card is already at TRICK_CARD_SCALE, and
// TravelCard holds it constant for the rest of the flight — no scale interpolation needed there
// for a human play. Retune this toward 1 (spreading more of the shrink into TravelCard's own
// flight instead) if the ~200ms local-departure window reads as too abrupt once checked live —
// this exact split was flagged as unconfirmed during design, not settled.
export const LOCAL_DEPARTURE_SCALE = TRICK_CARD_SCALE;
```

**`BatakHandCard.tsx`'s local-departure effect** gains a `scale: LOCAL_DEPARTURE_SCALE` target alongside its existing `x`/`y` in the same `setTarget` call — one coordinated motion (position + scale together), not a second animation. `useBatakCardMotion` already has a `scale` shared value (currently only used for the selection lift), so this needs no new plumbing.

**`TrickCenter.tsx`, human's pending play:** `TravelCard` gets `originScale={TRICK_CARD_SCALE}` and `restScale={TRICK_CARD_SCALE}` — a held constant, exactly the same pattern `originRotateDeg` already uses (a static value, not interpolated, since local departure already did the interpolating). Its `PlayingCard` child gets `contentScale={TRICK_CARD_CONTENT_SCALE}`.

**`TrickCenter.tsx`, AI's pending play:** no local-departure leg exists for AI plays (no rendered opponent-hand visual to depart from), so `TravelCard` does the full interpolation itself: `originScale={1}` → `restScale={TRICK_CARD_SCALE}` over the whole flight, `contentScale` on its `PlayingCard` child interpolated the same way *or* held at `TRICK_CARD_CONTENT_SCALE` throughout if a separately-interpolated content scale turns out not to matter visually at this distance (decide during implementation, verify by eye).

**`TrickCenter.tsx`, resting (already-landed) cards:** currently a bare `<PlayingCard size="normal">` with no scale wrapper at all — needs one added, holding `TRICK_CARD_SCALE`/`TRICK_CARD_CONTENT_SCALE` permanently.

**`TrickCenter.tsx` layout:** `TRICK_SLOT_OFFSETS` and `styles.trickCross`/`styles.trickSlot` are currently sized around `CARD_DIMS.normal` — will need retuning once cards render visibly smaller (a visual pass, not a formula change).

**`GatherCard.tsx`:** its own existing doc comment already states it renders at `size="normal"` *specifically* "to match TrickCenter's trick cards" — once resting cards shrink, both its front and back `PlayingCard` layers need the same `scale`/`contentScale` treatment (a static wrapping transform, consistent with how it already handles the constant `GATHER_CARD_WIDTH`/`HEIGHT`), or a completed trick will visibly snap back to normal size the instant it starts gathering. This wasn't part of the original ask but is a direct, unavoidable consequence of shrinking resting cards.

## 4. Cross-game safety

`PlayingCard.tsx` is the only genuinely shared file touched, and only additively (new optional prop, default preserves current behavior for every existing caller). `TravelCard.tsx`, `GatherCard.tsx`, and `TrickCenter.tsx` are all Batak-only — confirmed via a repo-wide grep against `apps/mobile/src/games/pisti` finding zero references to either component. Zero Pişti blast radius beyond the `PlayingCard` prop addition itself.

## 5. Process

No new automated tests (motion/visual-only code, standing 2026-07-07 mobile-UI policy) — `tsc --noEmit` + the full suite after each step. On-device verification (yours, not mine) should specifically check: whether the local-departure window's full shrink (§3's `LOCAL_DEPARTURE_SCALE` choice) reads as smooth or abrupt, both human and AI plays landing at a visually matching size, and `GatherCard`'s sweep no longer popping back to normal size.

## 6. Explicitly deferred

- `KittyRevealCard.tsx`/`KittyCollectCard`/`CenteredDecisionModal.tsx` — unrelated to the trick center, not touched.
- Extracting a shared resize primitive between this and Demo05/the hand-fan's own motion pattern — not proposed here; revisit only if a third consumer of this exact "content-compensated scale" idea appears, per this repo's own established extract-on-third-occurrence convention (Constitution §8 gap 3).
