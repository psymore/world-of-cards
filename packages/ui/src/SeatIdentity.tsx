import React, { useCallback, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WOOD_TRIM_COLOR } from './woodPalette';

const PLAQUE_IMAGE = require('../assets/table/seat-plaque.png');
const BADGE_IMAGE = require('../assets/table/seat-badge.png');

// Matches seat-plaque.png's pixel crop (450x90).
const PLAQUE_ASPECT_RATIO = 450 / 90;

// Used before the anchor's real size is known (first render, or a test environment that never
// fires onLayout) — deliberately small and unobtrusive rather than a guess at the real anchor
// size, since it's replaced the instant a real measurement arrives in any environment that
// actually lays views out.
const FALLBACK_SIZE = { width: 100, height: 100 / PLAQUE_ASPECT_RATIO };

export type SeatIdentityOrientation = 'horizontal' | 'rotated-left' | 'rotated-right';

export interface SeatIdentityProps {
  name: string;
  trickCount: number;
  orientation?: SeatIdentityOrientation;
}

// Rotating a View via `transform` is paint-only — it never changes the element's own layout box.
// That means the plaque can't be sized with ordinary width/height percentages: a percentage only
// ever resolves against its *own* parent axis (width% against parent width, height% against
// parent height), but a rotated box needs its pre-rotation width constrained by the anchor's
// HEIGHT (since that's what the rotated footprint's long axis lands in) and vice versa — a
// same-axis percentage can't express that. So the anchor is measured for real via onLayout, and
// plaqueSize() below does a manual "contain fit": pick whichever anchor dimension is the rotated
// long axis, fit the pill's aspect ratio into it, and clamp to the short axis if that would
// overflow it. This is the fix for a real bug: the previous fixed-pixel plaque rendered flush at
// the anchor's top-left (View children don't stretch/center under RN's layout defaults when the
// child has an explicit size, and nothing here was centering it) and, for the rotated seats, the
// rotated footprint landed partly outside the anchor entirely.
const ORIENTATION_TRANSFORM: Record<SeatIdentityOrientation, ViewStyle['transform'] | undefined> = {
  horizontal: undefined,
  'rotated-left': [{ rotate: '90deg' }],
  'rotated-right': [{ rotate: '-90deg' }],
};

function plaqueSize(anchorWidth: number, anchorHeight: number, rotated: boolean): { width: number; height: number } {
  const availableLong = rotated ? anchorHeight : anchorWidth;
  const availableShort = rotated ? anchorWidth : anchorHeight;
  const heightFromLong = availableLong / PLAQUE_ASPECT_RATIO;
  if (heightFromLong <= availableShort) {
    return { width: availableLong, height: heightFromLong };
  }
  return { width: availableShort * PLAQUE_ASPECT_RATIO, height: availableShort };
}

function SeatIdentityComponent({ name, trickCount, orientation = 'horizontal' }: SeatIdentityProps) {
  const rotated = orientation !== 'horizontal';
  const transform = ORIENTATION_TRANSFORM[orientation];
  const [anchorSize, setAnchorSize] = useState<{ width: number; height: number } | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setAnchorSize({ width, height });
  }, []);

  const size = anchorSize ? plaqueSize(anchorSize.width, anchorSize.height, rotated) : FALLBACK_SIZE;
  // Every inner element (avatar ring, badge, text) was originally sized against a 100-wide
  // plaque. Scaling them by how much bigger/smaller the measured plaque actually is keeps their
  // proportions correct instead of staying pinned at one fixed pixel size on every table size.
  const scale = size.width / FALLBACK_SIZE.width;

  return (
    <View style={styles.anchorFill} onLayout={handleLayout}>
      <View
        style={[{ width: size.width, height: size.height }, transform ? { transform } : null]}
        testID="seat-identity"
      >
        <Image
          source={PLAQUE_IMAGE}
          style={[StyleSheet.absoluteFill, styles.fill]}
          resizeMode="stretch"
          testID="seat-identity-plaque"
        />
        <View style={[styles.content, { paddingHorizontal: 4 * scale, gap: 3 * scale }]}>
          <View
            style={[
              styles.avatarRing,
              { width: 14 * scale, height: 14 * scale, borderRadius: 7 * scale, borderWidth: 1 * scale },
            ]}
            testID="seat-identity-avatar"
          >
            <Svg width={9 * scale} height={9 * scale} viewBox="0 0 24 24">
              <Circle cx={12} cy={8} r={4} fill={WOOD_TRIM_COLOR} />
              <Path d="M4,20 C4,14 8,12 12,12 C16,12 20,14 20,20 Z" fill={WOOD_TRIM_COLOR} />
            </Svg>
          </View>
          <View style={styles.textColumn}>
            <Text style={[styles.nameText, { fontSize: 7 * scale, lineHeight: 9 * scale }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.trickText, { fontSize: 5.5 * scale, lineHeight: 7 * scale }]} numberOfLines={1}>
              {trickCount} tricks
            </Text>
          </View>
          <Image
            source={BADGE_IMAGE}
            style={[styles.badge, { width: 12 * scale, height: 12 * scale }]}
            resizeMode="contain"
            testID="seat-identity-badge"
          />
        </View>
      </View>
    </View>
  );
}

export const SeatIdentity = React.memo(SeatIdentityComponent);

const styles = StyleSheet.create({
  // Fills and centers the plaque inside whatever seat anchor this is placed in — restores the
  // centering the old placeholder (SeatBadge) used to provide, which the plaque lost when it
  // switched from a flex:1 text box to an explicitly-sized image box.
  anchorFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
