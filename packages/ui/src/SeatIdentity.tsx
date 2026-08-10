import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WOOD_TRIM_COLOR } from './woodPalette';

const PLAQUE_IMAGE = require('../assets/table/seat-plaque.png');
const BADGE_IMAGE = require('../assets/table/seat-badge.png');

// Matches seat-plaque.png's pixel crop (450x90) so the plaque image never stretches out of
// proportion. Starting size only — tune visually against TableShell's real seat anchors before
// treating as final, same approach as TableShell's own tilt angle.
const PLAQUE_ASPECT_RATIO = 450 / 90;
const PLAQUE_WIDTH = 100;
const PLAQUE_HEIGHT = PLAQUE_WIDTH / PLAQUE_ASPECT_RATIO;

export type SeatIdentityOrientation = 'horizontal' | 'rotated-left' | 'rotated-right';

export interface SeatIdentityProps {
  name: string;
  trickCount: number;
  orientation?: SeatIdentityOrientation;
}

// Rotating a React Native View via `transform` is paint-only — it does not change the element's
// own layout box or reflow its parent. The plaque's box (PLAQUE_WIDTH x PLAQUE_HEIGHT, wide and
// short) is intentionally never swapped for the rotated orientations: rotating a wide/short box
// 90 degrees around its own center visually occupies a tall/narrow footprint, which is exactly
// what TableShell's left/right seat anchors need — no separate "vertical" asset or layout is
// required. Left rotates +90 (reads top-to-bottom), right rotates -90 (reads bottom-to-top), so
// both lean into the table from their side.
const ORIENTATION_TRANSFORM: Record<SeatIdentityOrientation, ViewStyle['transform'] | undefined> = {
  horizontal: undefined,
  'rotated-left': [{ rotate: '90deg' }],
  'rotated-right': [{ rotate: '-90deg' }],
};

function SeatIdentityComponent({ name, trickCount, orientation = 'horizontal' }: SeatIdentityProps) {
  const transform = ORIENTATION_TRANSFORM[orientation];
  return (
    <View style={[styles.plaque, transform ? { transform } : null]} testID="seat-identity">
      <Image
        source={PLAQUE_IMAGE}
        style={[StyleSheet.absoluteFill, styles.fill]}
        resizeMode="stretch"
        testID="seat-identity-plaque"
      />
      <View style={styles.content}>
        <View style={styles.avatarRing} testID="seat-identity-avatar">
          <Svg width={9} height={9} viewBox="0 0 24 24">
            <Circle cx={12} cy={8} r={4} fill={WOOD_TRIM_COLOR} />
            <Path d="M4,20 C4,14 8,12 12,12 C16,12 20,14 20,20 Z" fill={WOOD_TRIM_COLOR} />
          </Svg>
        </View>
        <View style={styles.textColumn}>
          <Text style={styles.nameText} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.trickText} numberOfLines={1}>
            {trickCount} tricks
          </Text>
        </View>
        <Image source={BADGE_IMAGE} style={styles.badge} resizeMode="contain" testID="seat-identity-badge" />
      </View>
    </View>
  );
}

export const SeatIdentity = React.memo(SeatIdentityComponent);

const styles = StyleSheet.create({
  plaque: { width: PLAQUE_WIDTH, height: PLAQUE_HEIGHT },
  // See TableShell.tsx's `fill` style comment: react-native-web's Image needs explicit
  // width/height alongside StyleSheet.absoluteFill to actually stretch to its parent.
  fill: { width: '100%', height: '100%' },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 3,
  },
  avatarRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: WOOD_TRIM_COLOR,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: { flex: 1, minWidth: 0 },
  nameText: { color: '#e8e3d2', fontWeight: 'bold', fontSize: 7, lineHeight: 9 },
  trickText: { color: '#b8b3a2', fontSize: 5.5, lineHeight: 7 },
  badge: { width: 12, height: 12 },
});
