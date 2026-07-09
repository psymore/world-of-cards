import React from 'react';
import Svg, { Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';

// A faint diagonal weave plus a radial vignette darkening the edges — a felt-table texture
// reusable by any game with a tabletop playing surface, not just Pişti. Pure decoration: no
// props, painted once, never redone by game state changes.
function TableFeltComponent() {
  return (
    <AbsoluteOverlay>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="feltWeave" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={14} stroke="#ffffff" strokeOpacity={0.035} strokeWidth={1} />
            <Line x1={0} y1={0} x2={14} y2={0} stroke="#ffffff" strokeOpacity={0.035} strokeWidth={1} />
          </Pattern>
          <RadialGradient id="feltVignette" cx="50%" cy="45%" r="75%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="70%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.4} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#feltWeave)" />
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#feltVignette)" />
      </Svg>
    </AbsoluteOverlay>
  );
}

// Takes no props and its output never changes — memoizing makes it provably a one-time paint,
// never redone on the move-by-move re-renders that drive the rest of a table.
export const TableFelt = React.memo(TableFeltComponent);
