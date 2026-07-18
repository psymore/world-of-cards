import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { shadeColor } from './colorUtils';

const TRIM_COLOR = '#ffd966';
const DEFAULT_WOOD_LIGHT = '#5c2a1e';
const DEFAULT_WOOD_DARK = '#331209';
const GRAIN_COLOR = '#ffab6b';

export interface HeaderWoodFrameProps {
  // Target visible strip height in dp — the caller measures its own header row (e.g. via
  // onLayout) and passes that real height, rather than this component guessing one.
  height: number;
  // Same override contract as TableWoodCorners/TableEdgeRails: undefined => today's hardcoded
  // mahogany look.
  woodColor?: string;
}

// Hand-drawn (react-native-svg gradient + grain + gold trim) wood strip behind the header bar —
// same recipe as TableEdgeRails' own Rail/TableWoodCorners' own Wedge, just sized to the header's
// real content height instead of a thin table-edge rail. Replaces an earlier photo-cropped
// attempt (a cropped wooden-background.png), which this component no longer references.
function HeaderWoodFrameComponent({ height, woodColor }: HeaderWoodFrameProps) {
  const { width } = useWindowDimensions();
  const woodLight = woodColor != null ? shadeColor(woodColor, 0.18) : DEFAULT_WOOD_LIGHT;
  const woodDark = woodColor != null ? shadeColor(woodColor, -0.25) : DEFAULT_WOOD_DARK;

  return (
    <View style={[styles.container, { height }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="headerWoodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={woodLight} />
            <Stop offset="100%" stopColor={woodDark} />
          </LinearGradient>
          <Pattern
            id="headerWoodGrain"
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)">
            <Line x1={0} y1={0} x2={0} y2={6} stroke={GRAIN_COLOR} strokeOpacity={0.1} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#headerWoodGradient)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#headerWoodGrain)" />
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke={TRIM_COLOR}
          strokeOpacity={0.85}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

export const HeaderWoodFrame = React.memo(HeaderWoodFrameComponent);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
