import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';
import { CORNER_WEDGE_SIZE } from './TableWoodCorners';
import { shadeColor } from './colorUtils';

const RAIL_THICKNESS = 24;
const TRIM_COLOR = '#ffd966';
const DEFAULT_WOOD_LIGHT = '#5c2a1e';
const DEFAULT_WOOD_DARK = '#331209';
const GRAIN_COLOR = '#ffab6b';

export interface TableEdgeRailsProps {
  // Same override contract as TableWoodCorners: undefined => today's hardcoded mahogany look.
  woodColor?: string;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';

const EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

// Each rail spans one edge, inset by CORNER_WEDGE_SIZE on both ends so it meets
// TableWoodCorners' quarter-circle wedges without overlapping them.
const EDGE_STYLES: Record<Edge, ViewStyle> = {
  top: { position: 'absolute', top: 0, left: CORNER_WEDGE_SIZE, right: CORNER_WEDGE_SIZE, height: RAIL_THICKNESS },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: CORNER_WEDGE_SIZE,
    right: CORNER_WEDGE_SIZE,
    height: RAIL_THICKNESS,
  },
  left: { position: 'absolute', left: 0, top: CORNER_WEDGE_SIZE, bottom: CORNER_WEDGE_SIZE, width: RAIL_THICKNESS },
  right: {
    position: 'absolute',
    right: 0,
    top: CORNER_WEDGE_SIZE,
    bottom: CORNER_WEDGE_SIZE,
    width: RAIL_THICKNESS,
  },
};

function Rail({ edge, woodLight, woodDark }: { edge: Edge; woodLight: string; woodDark: string }) {
  const gradId = `railGradient-${edge}`;
  const grainId = `railGrain-${edge}`;
  return (
    <View style={EDGE_STYLES[edge]} testID={`wood-rail-${edge}`}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={woodLight} />
            <Stop offset="100%" stopColor={woodDark} />
          </LinearGradient>
          <Pattern id={grainId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <Line x1={0} y1={0} x2={0} y2={6} stroke={GRAIN_COLOR} strokeOpacity={0.1} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${gradId})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${grainId})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill="none" stroke={TRIM_COLOR} strokeOpacity={0.85} strokeWidth={2} />
      </Svg>
    </View>
  );
}

// Zero props (aside from the same optional woodColor override TableWoodCorners takes), output
// never changes — memoized so it paints once, same rule as TableFelt/TableWoodCorners.
function TableEdgeRailsComponent({ woodColor }: TableEdgeRailsProps) {
  const woodLight = woodColor != null ? shadeColor(woodColor, 0.18) : DEFAULT_WOOD_LIGHT;
  const woodDark = woodColor != null ? shadeColor(woodColor, -0.25) : DEFAULT_WOOD_DARK;
  return (
    <AbsoluteOverlay>
      {EDGES.map((edge) => (
        <Rail key={edge} edge={edge} woodLight={woodLight} woodDark={woodDark} />
      ))}
    </AbsoluteOverlay>
  );
}

export const TableEdgeRails = React.memo(TableEdgeRailsComponent);
