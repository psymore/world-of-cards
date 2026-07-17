import React from "react";
import Svg, { Path } from "react-native-svg";
import { AbsoluteOverlay } from "./AbsoluteOverlay";
import type { PlayingCardSize } from "./PlayingCard";

export interface CourtCardFrameProps {
  size: PlayingCardSize;
}

interface FrameGeometry {
  width: number;
  height: number;
  topRightBracket: string;
  bottomLeftBracket: string;
  strokeWidth: number;
}

// Two disconnected straight-line brackets tracing the reference frame in
// docs/references/card-art/frame.png: each is 2 axis-aligned segments meeting at 1 right angle,
// closing at the corner with no rank/suit index (top-right, bottom-left) and stopping just clear
// of the corner that has one (top-left, bottom-right respectively) — no touching/jogging needed,
// which is what keeps the line off the rank text and suit glyph. Coordinates are derived from
// PlayingCard's own CARD_DIMS and CORNER_INDEX_WIDTH per size, not linearly rescaled between
// them — see docs/superpowers/specs/2026-07-17-court-card-decorative-frame-design.md for the
// full derivation (13% inset from the true card edge for the two closed corners, measured
// directly from the user's reference photos with a pixel scanner). Card dimensions here
// (94x132 / 64x86) match the current PlayingCard.tsx CARD_DIMS post-width-bump — do not use
// 84x132 / 54x86, an earlier revision's numbers superseded by an unrelated branch.
//
// IMPORTANT (2026-07-18, verified via real pixel measurement in a browser render — see the
// design spec's follow-up-fix section): this SVG is rendered *inside* PlayingCard's innermost
// bordered content box (frameInnerRing), not directly inside the outer CARD_DIMS-sized box.
// PlayingCard's DEFAULT_BORDERS (two 1px rings) eat 1px off every edge each, so the actual
// content box this SVG paints into is 4px smaller in HEIGHT than CARD_DIMS — 128 (not 132) at
// `normal`, 82 (not 86) at `small`. Measured: the SVG's real rendered box is 94x128 at `normal`,
// not 94x132 — width is unaffected (cross-axis sizing keeps the explicit width), only height
// (the flex main axis) gets shrunk to fit. Any Y value that's *mirrored* from a top-anchored one
// (i.e. computed as `boxHeight - topValue`, used for the bottom-left bracket and for the
// top-right bracket's vertical-segment clearance below) MUST use this actual inner height (128 /
// 82), not CARD_DIMS.height (132 / 86) — using the outer height was the root cause of a ~4px
// misalignment between the bottom bracket and the corner index. Y values that are directly
// top-anchored (not mirrored) are unaffected by this and need no correction.
const GEOMETRY: Record<PlayingCardSize, FrameGeometry> = {
  normal: {
    width: 94,
    height: 132,
    // Horizontal segments sit at the vertical midpoint of the whole corner index block (rank
    // text + gap + suit glyph together), not the suit glyph alone: at this size the block spans
    // y=[1,46] (top:1, rank lineHeight 25, gap 2, suitIcon 18 -> 1+25+2+18=46), midpoint 23.5.
    // Mirrored corner is symmetric at the ACTUAL inner content height (128, not 132) - 23.5 =
    // 104.5. The vertical segment's far endpoint (79.5) is recomputed the same way: it must clear
    // the mirrored block's real top edge (128-46=82) by the same ~2.5px margin the original spec
    // used, not the previously-miscalculated 86.
    topRightBracket: "M32.5,14 L75,14 L75,79.5",
    bottomLeftBracket: "M15,48.5 L15,119 L63.5,119",
    strokeWidth: 1.2,
  },
  small: {
    width: 64,
    height: 86,
    // Vertical midpoint of the whole corner index block at this size: block spans y=[1,32]
    // (top:1, rank lineHeight 18, gap 1, suitIcon 12 -> 1+18+1+12=32), midpoint 16.5. Mirrored
    // corner is symmetric at the actual inner content height (82, not 86) - 16.5 = 65.5. The
    // vertical segment's far endpoint (48) clears the mirrored block's real top edge (82-32=50)
    // by the original ~2px margin.
    topRightBracket: "M22,10 L51,10 L51,48",
    bottomLeftBracket: "M9,34 L9,75 L42,75",
    strokeWidth: 1,
  },
};

function CourtCardFrameComponent({ size }: CourtCardFrameProps) {
  const { width, height, topRightBracket, bottomLeftBracket, strokeWidth } =
    GEOMETRY[size];
  return (
    <AbsoluteOverlay>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={topRightBracket}
          fill="none"
          stroke="#111"
          strokeWidth={strokeWidth}
        />
        <Path
          d={bottomLeftBracket}
          fill="none"
          stroke="#111"
          strokeWidth={strokeWidth}
        />
      </Svg>
    </AbsoluteOverlay>
  );
}

// `size` is the only prop and is a per-render-site constant that never changes across a card's
// lifetime — memoize so this never repaints on unrelated table re-renders, same rule already
// applied to TableFelt/TableWoodCorners/CardBackPattern.
export const CourtCardFrame = React.memo(CourtCardFrameComponent);
