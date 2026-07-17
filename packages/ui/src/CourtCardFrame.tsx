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
// IMPORTANT background (2026-07-18, discovered via real pixel measurement in a browser render —
// see the design spec's follow-up-fix section): this SVG is rendered *inside* PlayingCard's
// innermost bordered content box (frameInnerRing), not directly inside the outer CARD_DIMS-sized
// box. PlayingCard's DEFAULT_BORDERS (two 1px rings) eat 1px off every edge each, so the actual
// content box this SVG paints into is 4px smaller in HEIGHT than CARD_DIMS — 128 (not 132) at
// `normal`, 82 (not 86) at `small`; width is unaffected. This is why a *computed* mirrored Y
// (boxHeight - topValue) must use the inner height (128/82), not CARD_DIMS.height (132/86) — an
// earlier revision got this wrong, causing a real ~4px misalignment. That said, the exact
// coordinates below are no longer a pure computed derivation: after the height-mismatch fix, the
// user hand-tuned all four paths (and both strokeWidths) against a live render for the best
// visual result — treat GEOMETRY as visually verified ground truth, not something to
// recompute from the corner-index formula without re-checking against a live render.
const GEOMETRY: Record<PlayingCardSize, FrameGeometry> = {
  normal: {
    width: 94,
    height: 132,
    // Hand-tuned (2026-07-18) starting from the computed corner-index-block-midpoint baseline —
    // see the background note above.
    topRightBracket: "M32.5,14 L75,14 L75,79.5",
    bottomLeftBracket: "M15,48.5 L15,119 L63.5,119",
    strokeWidth: 1.2,
  },
  small: {
    width: 64,
    height: 86,
    // Hand-tuned (2026-07-18), same basis as `normal` above.
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
