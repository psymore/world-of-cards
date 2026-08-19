import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { WOOD_DEFAULT_LIGHT, WOOD_DEFAULT_DARK, WOOD_GRAIN_COLOR } from '@world-of-cards/ui';

// The "platform" — the shared bid/trump decision panel (DecisionPanel) — gets the same
// gradient+grain+trim wood recipe as TableWoodCorners/TableEdgeRails/HandFrame (via the shared
// WOOD_* constants) rather than a new material, so it reads as part of the same wooden-table
// identity. Brainstormed via the visual companion (mockup:
// .superpowers/brainstorm/994-1784508967/content/platform-style.html).

// Absolutely fills its parent (DecisionPanel's modalCard, which clips via overflow:'hidden').
// modalCard is a shrink-to-fit box (its size varies between the bid grid and the narrower trump
// suit row), and percentage width/height on <Svg> didn't reliably resolve against that dynamic
// parent size in practice (left gaps at the edges) — so this measures its own rendered box via
// onLayout instead, the same pattern already used by TrickCenter's destRef/handleDestLayout, and
// gives the Svg/Rect explicit pixel dimensions like BidButton's own Svg already does successfully.
export function PlatformWoodBackground() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.noPointerEvents]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}>
      {size && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id="platformWoodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={WOOD_DEFAULT_LIGHT} />
              <Stop offset="100%" stopColor={WOOD_DEFAULT_DARK} />
            </LinearGradient>
            <Pattern
              id="platformWoodGrain"
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)">
              <Line x1={0} y1={0} x2={0} y2={6} stroke={WOOD_GRAIN_COLOR} strokeOpacity={0.1} strokeWidth={1} />
            </Pattern>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#platformWoodGradient)" />
          <Rect width={size.width} height={size.height} fill="url(#platformWoodGrain)" />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noPointerEvents: { pointerEvents: 'none' },
});
