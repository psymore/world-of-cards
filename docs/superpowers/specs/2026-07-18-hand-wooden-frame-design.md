# Wooden hand-frame & felt background — design

## Context

Two new visual assets for the table: a wooden panel that sits behind the human player's hand, and a photo-textured green felt that replaces the procedurally-drawn `TableFelt` texture. Both are shared, cross-game changes (`packages/ui`) — `TableFelt` applies to Batak and Pişti automatically (both already render it unconditionally); the wooden hand-frame is wired into **Batak only** for now, since Pişti's single flat row and Batak's overlapping two-row fan need different positioning math and only Batak's was worked out.

This spec was written after the fact, reconstructed from a live implementation-and-iteration session rather than an upfront plan — the asset itself, and the positioning technique, changed several times as real problems surfaced that no amount of mockup-based brainstorming caught. That history is preserved below because it explains *why* the final approach looks the way it does.

## Asset history (why we ended up here)

Four real, sequential problems, each only found by measuring or testing against real numbers instead of eyeballing a mockup:

1. **The first candidate asset (`wooden-frame.jpeg`) was a flat JPEG with a checkerboard baked into its pixels as opaque color**, not real transparency — JPEG can't hold an alpha channel. An automated chroma-key cutout (checkerboard pixels are near-gray and light; wood/gold pixels aren't) produced a clean fallback, verified by sampling alpha values and inspecting the wood grain/scrollwork for holes. Superseded before shipping by the user's own Photoroom-cut version, then again by later asset rounds — none of the intermediate variants (`wooden-frame-Photoroom.png`, `wooden-frame-short.png`, `wooden-frame-short-new.png`, `wooden-frame-long.png`) shipped; all were deleted once superseded.
2. **The first brainstorming mockup used illustrative proportions** (a 300px-wide phone mockup, 34×48 placeholder cards) that didn't match Batak's real numbers (94×132 cards, a fixed ~231dp hand-span, phone widths in the 360–430dp range). Rebuilding the check at true scale showed the then-current asset (`wooden-frame-short.png`, aspect ratio 0.506) was **not tall enough** to reach from the top row's peak down to the bottom row's bottom edge at any single vertical anchor — flush-to-bottom left the top row floating uncovered; peak-aligned left ~67dp of the bottom row hanging off the wood.
3. This led to a **taller replacement asset** (`wooden-frame-short-new.png`, then finally `wooden-frame-long-Photoroom.png`, aspect ratio 0.642) with a taller natural aspect ratio, closing most — but not all — of the gap.
4. Getting it fully correct still needed **explicit non-uniform stretching**, not just a taller source image: see "Positioning technique" below.

## Final asset

`packages/ui/assets/table/wooden-frame-long-Photoroom.png` — 1566×1005px, real alpha channel (verified by sampling, not assumed from the filename). Has two distinct arch features, measured directly from pixel/alpha data:
- A **main arch** (the wide central span), peaking at the horizontal center, **8.4%** down from the image's own top edge.
- Taller **corner hook flourishes** that peak higher still, at **~4.5%** down — not used as the alignment reference; the main arch is (matching the same "main arch vs. corner hooks" distinction the very first candidate asset had).

The artwork also doesn't bleed all the way to the image's own left/right edges — measured via alpha-channel column scan: the first opaque column is **2.3%** in from the left, the last is **2.4%** in from the right. This matters for the width-compensation step below.

`packages/ui/assets/table/green.png` — 1086×1448px, opaque (no alpha needed — it's a full-bleed background, not an overlay), photo-textured green felt with a diagonal weave and vignette darkening at the edges.

## `TableFelt` (`packages/ui/src/TableFelt.tsx`)

Same zero-prop, memoized API as before (no caller changes — both `PistiTable` and `BatakTable` already render `<TableFelt />` unconditionally). Internals swap the hand-drawn SVG weave+vignette for `green.png` via `<Image resizeMode="cover" />`, filling the same `AbsoluteOverlay`. Mirrors the precedent already set by `CARD_BACK_IMAGE` replacing the old hand-drawn `CardBackPattern` SVG.

## `HandFrame` (`packages/ui/src/HandFrame.tsx`)

```ts
export const HAND_FRAME_ASPECT_RATIO = 1005 / 1566; // height / width, full image including margins
export const HAND_FRAME_PEAK_FRACTION = 0.084; // main-arch peak, fraction of image height from the top

export interface HandFrameProps {
  bottomOffset: number; // dp from the containing box's true bottom edge to the image's own bottom edge
  height?: number; // optional override of the natural aspect-ratio height, for non-uniform stretch
}
```

### Width: content-margin compensation

Rendering the raw image at exactly `window width` would leave the measured 2.3%/2.4% transparent margins as a visible felt gap at the screen edges — the artwork itself would fall short, even though the image element technically spanned full width. `HandFrame` compensates internally so callers don't need to know about this asset-specific quirk: it renders the full image (margins included) wide enough that its **content** — not its raw bounding box — spans exactly the requested width, then shifts left so the margin falls off-screen:

```ts
const CONTENT_WIDTH_FRACTION = 1 - LEFT_CONTENT_MARGIN_FRACTION - RIGHT_CONTENT_MARGIN_FRACTION;
const renderedWidth = width / CONTENT_WIDTH_FRACTION;
const leftOffset = -LEFT_CONTENT_MARGIN_FRACTION * renderedWidth;
```

### Height: non-uniform stretch via `resizeMode="stretch"`

A real bug surfaced here: giving `Image` an explicit `height` different from its natural aspect ratio, without also setting `resizeMode`, silently does nothing like what's intended — RN's default `resizeMode` is `"cover"`, which scales *uniformly* to fill the box and *crops* the overflow, rather than stretching non-uniformly. In this case that meant cropping the width and clipping the ornamental corner hooks, not stretching the height as intended. Fixed by explicitly setting `resizeMode="stretch"`, which maps the source to the exact width/height independently per axis.

`height` is optional — omitted, the component falls back to the natural `renderedWidth * HAND_FRAME_ASPECT_RATIO`. Batak always passes an explicit stretched value (see below); a future caller with a taller natural hand-span-to-image-height ratio might not need to.

## Positioning technique (Batak-specific math, in `BatakTable.tsx`)

Two constraints have to hold at once, and the asset's natural aspect ratio alone can't satisfy both:
1. The main arch's peak must land above the top row's peak (its center card's top edge, where `curveOffsetY` is 0) — with a **14dp reveal margin** on top of that, because peak-aligning exactly *to* the top row hides the gold trim behind the cards (they render in front, at the same height).
2. The frame's bottom edge must fully cover the bottom of the hand, with a **16dp overshoot** below the screen's true bottom edge (the overshoot itself is off-screen, invisible — it exists purely so small per-device rounding/safe-area differences can never leave a gap).

Solving for both simultaneously means the image's height is **not** `windowWidth * HAND_FRAME_ASPECT_RATIO` — it's derived directly from the two target distances:

```ts
const handFramePeakTarget = TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM + HAND_FRAME_REVEAL_MARGIN;
const handFrameBottomOffset = -HAND_FRAME_BOTTOM_OVERSHOOT;
const handFrameHeight = (handFramePeakTarget + HAND_FRAME_BOTTOM_OVERSHOOT) / (1 - HAND_FRAME_PEAK_FRACTION);
```

`TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM` itself is a first-pass constant derived from `BatakTable`'s own known layout numbers (container `paddingVertical`, `handArea`'s fixed `minHeight`, an estimated badge height, the inter-row gap, card height, and the row-overlap fraction below) — not measured on a real device. It was tuned live against the actual running app across several iterations in this session (not just derived once and left alone), which is why it should be treated as accurate for the current layout rather than a rough guess.

Width stays exactly `windowWidth` throughout — only height is ever stretched, per the user's explicit direction mid-session ("keep the width unchanged, stretch only the height").

## Batak hand-row layout changes

- The bottom row now overlaps the top row by **25% of card height** (`HAND_ROW_OVERLAP_PX = round(132 * 0.25) = 33`), via a negative `marginTop` on a wrapper around the bottom `HandRow` — replacing the previous fixed 6px gap. Card rotation/curve (`fanRotationDeg`, `fanCurveY`) is unchanged — explicitly out of scope per the user's direction.
- `TableEdgeRails` gained an optional `edges` prop (`Edge[]`, defaults to all 4 — no behavior change for any other caller); Batak passes `edges={['top', 'left', 'right']}` since the wooden frame now visually takes over the bottom edge.
- `TableWoodCorners` gained an analogous optional `corners` prop (`Corner[]`, defaults to all 4); Batak passes `corners={['topLeft', 'topRight']}` — the frame's own bottom corners replace the old quarter-circle wood wedges at bottom-left/bottom-right, which would otherwise visually conflict with the frame now spanning the full bottom edge.

## Testing

No new automated tests — decorative table/hand UI, covered by the standing 2026-07-07 testing policy. Existing suites re-run for regression after every change in this session (39 suites / 229 tests, consistently passing throughout). Verification here was live, in the user's own running Expo session via Fast Refresh — not the browser/Playwright screenshot workflow, and not proactive on my part, per the user's 2026-07-17 direction to only do visual verification when asked.

## Out of scope / deferred

- Wiring `HandFrame` into Pişti — its single flat row needs its own positioning derivation (no two-row overlap, no `TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM`-style math worked out yet), and its content-margin/aspect-ratio constants would need re-measuring if a different asset is used there instead of reusing this exact one as-is.
- Reconciling `TableWoodCorners`' (top two, still active) and `TableEdgeRails`' hardcoded SVG-gradient mahogany color against the new photo-textured `green.png` felt and photo-realistic wooden frame — not confirmed either way whether they now look inconsistent side by side.
- Native on-device visual verification — same standing gap as every prior UI pass in this project.
