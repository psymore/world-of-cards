# Wooden hand-frame & felt background — design

## Context

Two new visual assets for the table: a wooden panel that sits behind the human player's hand, and a photo-textured green felt that replaces the procedurally-drawn `TableFelt` texture. Both are shared, cross-game changes (`packages/ui`), landing in Batak and Pişti at once — confirmed directly with the user rather than assumed, per the standing rule that any change to how cards/table look is a discussion trigger, not an auto-mirror.

Worked out interactively via the brainstorming visual companion (mockups under `.superpowers/brainstorm/`, not committed): three rounds of asset iteration (a raw JPEG with a baked-in checkerboard "background" → an automated chroma-key cutout → the user's own `-Photoroom.png` cutout → the final `-short.png` solid panel + `green.png` felt) and three rounds of positioning iteration (naive vertical anchor → hook-tip alignment → main-arch-peak alignment, each measured from real pixel data, not eyeballed).

## Assets

Final assets, in `packages/ui/assets/table/`:
- **`wooden-frame-short.png`** — a solid wood panel (1763×892, ratio ≈1.977), gold trim, carved scrollwork corners, arched top edge. Real alpha channel (transparent outside the panel shape). This is a filled plaque, not a thin arc strip like the earlier candidates — everything below its top-edge curve is opaque.
- **`green.png`** — a photo-textured green felt (1086×1448 portrait, opaque), diagonal weave + vignette darkening at the edges. Replaces `TableFelt`'s hand-drawn SVG equivalent.

**To remove during implementation** (both currently sit on disk, untracked — delete the files outright rather than just leaving them unreferenced): `wooden-frame.jpeg` (raw source, baked-in checkerboard, no real transparency) and `wooden-frame-Photoroom.png` (an earlier, now-superseded cutout candidate). Neither has ever been committed, so this is a plain deletion, not a git-history concern.

Kept but unused for now: `wooden-frame-long.png` — provided alongside the others but never referenced in this pass; not wired into any component. Revisit if a future change calls for it.

### Why the earlier JPEG couldn't be used directly

The original `wooden-frame.jpeg` was a flat JPEG — no alpha channel is possible in that format. What looked like a transparent checkerboard background was actually opaque checkerboard-colored pixels baked into the image data; rendered as-is it would have painted a visible checkerboard patch over the felt instead of showing felt through it. An automated chroma-key pass (checkerboard pixels are near-gray and light; wood/gold pixels aren't) produced a clean cutout as a fallback, verified by sampling alpha values directly and visually inspecting the wood grain and scrollwork corners for holes — but the user's own `-Photoroom.png` (and now `-short.png`) superseded it before it shipped.

## Measured positioning constants

Both new assets' geometry was measured from real pixel/alpha data (via a small `System.Drawing`-based sampling script), not eyeballed, since the panel's top edge is a curve, not a straight line:

- **`wooden-frame-short.png`**: aspect ratio `892/1763 ≈ 0.506` (height/width). Its top-edge arch peaks at **16.8%** down from the image's own top edge, at the horizontal center; it's a single dome (unlike the earlier thin-arc asset, which had a separate, much taller corner-hook flourish measured separately at a different fraction — not applicable to this asset).
- The human hand's top row is itself curved (`fanCurveY` in `apps/mobile/src/table/seating.ts`, already in use) — center card highest, tapering down toward the edges. The frame's arch peak is positioned to align with that row's peak (center card's top edge), not a flat reference line.

These constants (aspect ratio, peak fraction) are exported from the new shared component (below) so both games' offset math reads from one source of truth instead of duplicating magic numbers.

## New shared component: `HandFrame` (`packages/ui/src/HandFrame.tsx`)

```ts
export const HAND_FRAME_ASPECT_RATIO = 892 / 1763; // height / width
export const HAND_FRAME_PEAK_FRACTION = 0.168; // top-edge peak, as a fraction of the image's own height

export interface HandFrameProps {
  // Distance in dp from the overlay's containing box's bottom edge to the image's own bottom
  // edge. Each game computes this from its own hand-row geometry so the frame's measured
  // arch-peak lands at that row's peak — see BatakTable/PistiTable for the actual math.
  bottomOffset: number;
}
```

- Renders `wooden-frame-short.png` via `require(...)`, matching the existing `CARD_BACK_IMAGE` convention in `PlayingCard.tsx`.
- Full **window** width (`useWindowDimensions()`, not just container width) so the panel truly reaches the phone edges even if a future container ever adds horizontal padding — image height derived from `HAND_FRAME_ASPECT_RATIO`.
- `pointerEvents: 'none'`, absolutely positioned (`left: 0`, `bottom: bottomOffset`), `React.memo`'d — same shape as `TableFelt`/`TableWoodCorners`/`TableEdgeRails`. Not built on `AbsoluteOverlay` (that helper hardcodes a full parent fill; this component is bottom-anchored with a computed height instead).
- Exported from `packages/ui/src/index.ts` alongside its two constants.

## `TableFelt` — swap SVG for `green.png`

Same component, same zero-prop/memoized API (no caller changes needed — both `PistiTable` and `BatakTable` already render `<TableFelt />` unconditionally). Internals swap the hand-drawn `Svg` weave+vignette for an `Image` rendering `green.png` with `resizeMode="cover"`, filling the same `AbsoluteOverlay`. Mirrors the precedent already set by `CARD_BACK_IMAGE` replacing the old hand-drawn `CardBackPattern` SVG.

## `TableEdgeRails` — new optional `edges` prop

```ts
export interface TableEdgeRailsProps {
  woodColor?: string;
  // Which edges to render. Defaults to all 4 (today's behavior, unchanged for every existing
  // caller). Batak passes ['top', 'left', 'right'] once the wooden hand-frame takes over the
  // bottom edge.
  edges?: Edge[];
}
```

Backward compatible — Pişti doesn't use `TableEdgeRails` at all today, so no migration needed there.

## Batak wiring (`BatakTable.tsx`)

- `<TableEdgeRails edges={['top', 'left', 'right']} />` — the wooden hand-frame visually takes over the bottom edge instead of the plain straight rail.
- `<HandFrame bottomOffset={...} />` rendered after the felt/corners/rails, before the hand area, so it paints behind the hand cards but in front of the table decoration.
- Two-row hand layout changes: the bottom row now overlaps the top row by **25% of card height** (a negative `marginTop` on the bottom `HandRow`, replacing the current fixed `gap: 6`), so the fan reads as a single imbricated hand rather than two stacked rows with a gap.
- `bottomOffset` is a first-pass constant computed from the existing known layout numbers (container `paddingVertical`, card height, the new row-overlap fraction) — same "first-pass values, confirm during implementation" spirit as `TRICK_SLOT_OFFSETS` and friends elsewhere in this file. It's calibrated for the steady-state playing phase (full two-row fan); during bidding, when `BidControls` adds extra height above the hand, the frame may sit slightly off from ideal — acceptable, not pixel-perfect across every phase, consistent with how the rest of this table's constants are treated.

## Pişti wiring (`PistiTable.tsx`)

- Same `HandFrame` component, different `bottomOffset` math: Pişti's hand is a single flat row (no split, no curve), so the frame's peak aligns to that row's top edge directly. No `TableEdgeRails` interaction (Pişti doesn't render edge rails). No change to the hand row layout itself.

## Testing

No new automated tests — this is decorative table/hand UI, covered by the standing 2026-07-07 testing policy (mobile UI components/screens default to no new tests). Existing suites re-run for regression only. No proactive screenshot/visual verification pass either, per the user's 2026-07-17 direction — the visual companion mockups during this brainstorming session already validated the look interactively.

## Out of scope / deferred

- `wooden-frame-long.png` — not wired anywhere in this pass.
- Reconciling `TableWoodCorners`/`TableEdgeRails`' hardcoded SVG-gradient mahogany color against the new photo-textured `green.png` felt and `wooden-frame-short.png` panel (they may now look visually inconsistent side by side — a real possibility, not confirmed either way since no on-device/screenshot check was run proactively). Worth a deliberate look in a future pass, not assumed here.
- Native on-device visual verification — same standing gap as every prior UI pass in this project (browser/Playwright only, and only when requested).
