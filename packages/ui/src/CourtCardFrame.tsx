import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';
import type { PlayingCardSize } from './PlayingCard';

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
const GEOMETRY: Record<PlayingCardSize, FrameGeometry> = {
  normal: {
    width: 94,
    height: 132,
    topRightBracket: 'M32.5,17 L82,17 L82,83.5',
    bottomLeftBracket: 'M12,48.5 L12,115 L61.5,115',
    strokeWidth: 1.5,
  },
  small: {
    width: 64,
    height: 86,
    topRightBracket: 'M22,11 L56,11 L56,52',
    bottomLeftBracket: 'M8,34 L8,75 L42,75',
    strokeWidth: 1,
  },
};

function CourtCardFrameComponent({ size }: CourtCardFrameProps) {
  const { width, height, topRightBracket, bottomLeftBracket, strokeWidth } = GEOMETRY[size];
  return (
    <AbsoluteOverlay>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={topRightBracket} fill="none" stroke="#111" strokeWidth={strokeWidth} />
        <Path d={bottomLeftBracket} fill="none" stroke="#111" strokeWidth={strokeWidth} />
      </Svg>
    </AbsoluteOverlay>
  );
}

// `size` is the only prop and is a per-render-site constant that never changes across a card's
// lifetime — memoize so this never repaints on unrelated table re-renders, same rule already
// applied to TableFelt/TableWoodCorners/CardBackPattern.
export const CourtCardFrame = React.memo(CourtCardFrameComponent);
