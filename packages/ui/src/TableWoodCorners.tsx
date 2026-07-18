import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Pattern, Stop } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';
import { shadeColor } from './colorUtils';

export const CORNER_WEDGE_SIZE = 140; // 2.5x the original 56dp
const TRIM_COLOR = '#ffd966';
const DEFAULT_WOOD_LIGHT = '#5c2a1e';
const DEFAULT_WOOD_DARK = '#331209';
const GRAIN_COLOR = '#ffab6b';

export interface TableWoodCornersProps {
  // Overrides the wood gradient's base color; the light/dark two-tone gradient is derived from
  // it via shadeColor so the existing textured-wood look is preserved under any base hue.
  // Undefined => today's exact hardcoded mahogany look.
  woodColor?: string;
  // Which corners to render. Defaults to all 4 (today's behavior, unchanged for every existing
  // caller). Batak passes ['topLeft', 'topRight'] once the wooden hand-frame's own bottom
  // corners take over the bottom two.
  corners?: Corner[];
}

export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface WedgeGeometry {
  fillPath: string;
  trimPath: string;
  positionStyle: { top?: number; bottom?: number; left?: number; right?: number };
}

const S = CORNER_WEDGE_SIZE;

// Each wedge is a quarter-disc pie slice centered on the box's own outer corner (radius S),
// matching the CSS border-radius corner shape from the brainstormed mockup (see
// docs/superpowers/specs/2026-07-10-pisti-wood-corners-design.md). trimPath draws just the
// curved boundary (no straight radius lines) for the gold edge accent.
const WEDGE_GEOMETRY: Record<Corner, WedgeGeometry> = {
  topLeft: {
    fillPath: `M0,0 L${S},0 A${S},${S} 0 0 1 0,${S} Z`,
    trimPath: `M${S},0 A${S},${S} 0 0 1 0,${S}`,
    positionStyle: { top: 0, left: 0 },
  },
  topRight: {
    fillPath: `M${S},0 L0,0 A${S},${S} 0 0 0 ${S},${S} Z`,
    trimPath: `M0,0 A${S},${S} 0 0 0 ${S},${S}`,
    positionStyle: { top: 0, right: 0 },
  },
  bottomLeft: {
    fillPath: `M0,${S} L${S},${S} A${S},${S} 0 0 0 0,0 Z`,
    trimPath: `M${S},${S} A${S},${S} 0 0 0 0,0`,
    positionStyle: { bottom: 0, left: 0 },
  },
  bottomRight: {
    fillPath: `M${S},${S} L0,${S} A${S},${S} 0 0 1 ${S},0 Z`,
    trimPath: `M0,${S} A${S},${S} 0 0 1 ${S},0`,
    positionStyle: { bottom: 0, right: 0 },
  },
};

const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

function Wedge({ corner, woodLight, woodDark }: { corner: Corner; woodLight: string; woodDark: string }) {
  const { fillPath, trimPath, positionStyle } = WEDGE_GEOMETRY[corner];
  const gradId = `woodGradient-${corner}`;
  const grainId = `woodGrain-${corner}`;
  return (
    <View style={[styles.wedgeWrap, positionStyle]} testID={`wood-corner-${corner}`}>
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={woodLight} />
            <Stop offset="100%" stopColor={woodDark} />
          </LinearGradient>
          <Pattern id={grainId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <Line x1={0} y1={0} x2={0} y2={6} stroke={GRAIN_COLOR} strokeOpacity={0.1} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Path d={fillPath} fill={`url(#${gradId})`} />
        <Path d={fillPath} fill={`url(#${grainId})`} />
        <Path d={trimPath} fill="none" stroke={TRIM_COLOR} strokeOpacity={0.85} strokeWidth={2} />
      </Svg>
    </View>
  );
}

// Zero props, output never changes — memoize so it paints once and is never redone by the
// move-by-move re-renders that drive the rest of the table, same rule as TableFelt.
function TableWoodCornersComponent({ woodColor, corners = CORNERS }: TableWoodCornersProps) {
  const woodLight = woodColor != null ? shadeColor(woodColor, 0.18) : DEFAULT_WOOD_LIGHT;
  const woodDark = woodColor != null ? shadeColor(woodColor, -0.25) : DEFAULT_WOOD_DARK;
  return (
    <AbsoluteOverlay>
      {corners.map((corner) => (
        <Wedge key={corner} corner={corner} woodLight={woodLight} woodDark={woodDark} />
      ))}
    </AbsoluteOverlay>
  );
}

export const TableWoodCorners = React.memo(TableWoodCornersComponent);

const styles = StyleSheet.create({
  wedgeWrap: { position: 'absolute', width: S, height: S },
});
