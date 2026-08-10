import React, { useCallback, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WOOD_TRIM_COLOR } from './woodPalette';

const BADGE_IMAGE = require('../assets/table/seat-badge.png');

export type SeatIdentityAvatar = 'male-01' | 'female-01' | 'male-02' | 'female-02' | 'male-03' | 'female-03';

const AVATAR_IMAGES: Record<SeatIdentityAvatar, number> = {
  'male-01': require('../assets/table/avatar-male-01.png'),
  'female-01': require('../assets/table/avatar-female-01.png'),
  'male-02': require('../assets/table/avatar-male-02.png'),
  'female-02': require('../assets/table/avatar-female-02.png'),
  'male-03': require('../assets/table/avatar-male-03.png'),
  'female-03': require('../assets/table/avatar-female-03.png'),
};

// The desired shape of the content row (avatar + name/tricks + badge). Not tied to any image
// asset — there's no background plaque image anymore (see the comment above ORIENTATION_TRANSFORM
// for why one existed briefly and was removed) — this is purely a layout choice.
const CONTENT_ASPECT_RATIO = 450 / 90;

// Used before the anchor's real size is known (first render, or a test environment that never
// fires onLayout) — deliberately small and unobtrusive rather than a guess at the real anchor
// size, since it's replaced the instant a real measurement arrives in any environment that
// actually lays views out.
const FALLBACK_SIZE = { width: 100, height: 100 / CONTENT_ASPECT_RATIO };

export type SeatIdentityOrientation = 'horizontal' | 'rotated-left' | 'rotated-right';

export interface SeatIdentityProps {
  name: string;
  trickCount: number;
  orientation?: SeatIdentityOrientation;
  avatar?: SeatIdentityAvatar;
}

// Rotating a View via `transform` is paint-only — it never changes the element's own layout box.
// That means the content row can't be sized with ordinary width/height percentages: a percentage
// only ever resolves against its *own* parent axis (width% against parent width, height% against
// parent height), but a rotated box needs its pre-rotation width constrained by the anchor's
// HEIGHT (since that's what the rotated footprint's long axis lands in) and vice versa — a
// same-axis percentage can't express that. So the anchor is measured for real via onLayout, and
// contentSize() below does a manual "contain fit": pick whichever anchor dimension is the rotated
// long axis, fit the desired aspect ratio into it, and clamp to the short axis if that would
// overflow it. This is the fix for a real bug: an earlier fixed-pixel version rendered flush at
// the anchor's top-left (View children don't stretch/center under RN's layout defaults when the
// child has an explicit size, and nothing here was centering it) and, for the rotated seats, the
// rotated footprint landed partly outside the anchor entirely.
const ORIENTATION_TRANSFORM: Record<SeatIdentityOrientation, ViewStyle['transform'] | undefined> = {
  horizontal: undefined,
  'rotated-left': [{ rotate: '90deg' }],
  'rotated-right': [{ rotate: '-90deg' }],
};

// Sideways text reads as an intentional style (labels on the side of a table); a sideways face
// does not. So the avatar ring gets the exact inverse rotation of its rotated parent, canceling
// the outer rotation out and keeping the photo upright regardless of which seat it's in.
const AVATAR_COUNTER_TRANSFORM: Record<SeatIdentityOrientation, ViewStyle['transform'] | undefined> = {
  horizontal: undefined,
  'rotated-left': [{ rotate: '-90deg' }],
  'rotated-right': [{ rotate: '90deg' }],
};

function contentSize(anchorWidth: number, anchorHeight: number, rotated: boolean): { width: number; height: number } {
  const availableLong = rotated ? anchorHeight : anchorWidth;
  const availableShort = rotated ? anchorWidth : anchorHeight;
  const heightFromLong = availableLong / CONTENT_ASPECT_RATIO;
  if (heightFromLong <= availableShort) {
    return { width: availableLong, height: heightFromLong };
  }
  return { width: availableShort * CONTENT_ASPECT_RATIO, height: availableShort };
}

function SeatIdentityComponent({ name, trickCount, orientation = 'horizontal', avatar = 'male-01' }: SeatIdentityProps) {
  const rotated = orientation !== 'horizontal';
  const transform = ORIENTATION_TRANSFORM[orientation];
  const [anchorSize, setAnchorSize] = useState<{ width: number; height: number } | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setAnchorSize({ width, height });
  }, []);

  const size = anchorSize ? contentSize(anchorSize.width, anchorSize.height, rotated) : FALLBACK_SIZE;
  // Every inner element (avatar ring, badge, text) was originally sized against a 100-wide
  // content row. Scaling them by how much bigger/smaller the measured size actually is keeps
  // their proportions correct instead of staying pinned at one fixed pixel size on every table
  // size.
  const scale = size.width / FALLBACK_SIZE.width;

  return (
    <View style={styles.anchorFill} onLayout={handleLayout}>
      <View
        style={[styles.content, { width: size.width, height: size.height, paddingHorizontal: 4 * scale, gap: 3 * scale }, transform ? { transform } : null]}
        testID="seat-identity"
      >
        <View
          style={[
            styles.avatarRing,
            { width: 14 * scale, height: 14 * scale, borderRadius: 7 * scale, borderWidth: 1 * scale },
          ]}
          testID="seat-identity-avatar"
        >
          <Image
            source={AVATAR_IMAGES[avatar]}
            style={[styles.avatarImage, AVATAR_COUNTER_TRANSFORM[orientation] ? { transform: AVATAR_COUNTER_TRANSFORM[orientation] } : null]}
            resizeMode="cover"
            testID="seat-identity-avatar-image"
          />
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
  );
}

export const SeatIdentity = React.memo(SeatIdentityComponent);

const styles = StyleSheet.create({
  // Fills and centers the content row inside whatever seat anchor this is placed in.
  anchorFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
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
    // Clips the avatar photo to the circle regardless of what's in the source crop's corners —
    // see build-avatar-assets.js's header for why the crop itself doesn't need to be pre-masked.
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  textColumn: { flex: 1, minWidth: 0 },
  nameText: { color: '#e8e3d2', fontWeight: 'bold', fontSize: 7, lineHeight: 9 },
  trickText: { color: '#b8b3a2', fontSize: 5.5, lineHeight: 7 },
  badge: { width: 12, height: 12 },
});
