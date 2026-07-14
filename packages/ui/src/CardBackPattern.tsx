import React from 'react';
import Svg, { Defs, Line, Pattern, Polygon, Rect } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';

const BACK_ACCENT = '#f4c542';

export interface CardBackPatternProps {
  width: number;
  height: number;
}

// Diamond-lattice weave + an inset frame + a centered lozenge emblem, in the app's own
// navy/gold identity rather than a literal copy of any reference app's back design. Kept to
// simple vector shapes (no per-rank/per-suit detail) since the back renders at the same tiny
// 36-56px width as the front, where anything more ornate would just blur into noise.
function CardBackPatternComponent({ width, height }: CardBackPatternProps) {
  const cx = width / 2;
  const cy = height / 2;
  const dw = width * 0.3;
  const dh = height * 0.29;
  const tile = width <= 40 ? 5 : 7;

  return (
    <AbsoluteOverlay>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="cardBackLattice" width={tile} height={tile} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={tile} stroke={BACK_ACCENT} strokeOpacity={0.16} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#cardBackLattice)" />
        <Rect
          x={3}
          y={3}
          width={Math.max(width - 6, 0)}
          height={Math.max(height - 6, 0)}
          rx={4}
          fill="none"
          stroke={BACK_ACCENT}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
        <Polygon
          points={`${cx},${cy - dh} ${cx + dw},${cy} ${cx},${cy + dh} ${cx - dw},${cy}`}
          fill="none"
          stroke={BACK_ACCENT}
          strokeOpacity={0.6}
          strokeWidth={1.2}
        />
      </Svg>
    </AbsoluteOverlay>
  );
}

// Only two possible (width, height) pairs ever get passed in (normal/small) — memoize so
// re-selecting or re-rendering face-down cards never redoes this SVG tree.
export const CardBackPattern = React.memo(CardBackPatternComponent);
