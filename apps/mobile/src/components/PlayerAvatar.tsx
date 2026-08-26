import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AVATAR_FRAME_PLAIN_IMAGE, PLAYER_AVATAR_PHOTO_IMAGE } from '@world-of-cards/ui';

export interface PlayerAvatarProps {
  accent?: boolean;
  // 'small' is for width-constrained contexts (e.g. the 64dp side seats in a 4-player table),
  // where the default size leaves too little room for the name/capture-count text next to it.
  size?: 'normal' | 'small';
}

// 3x the original code-drawn-silhouette-era sizing (22/14) — a real photo reads as a placeholder
// silhouette at that size, where the old plain SVG glyph didn't need to be nearly as large to be
// legible.
const DIMENSIONS = {
  normal: 66,
  small: 42,
} as const;

// AVATAR_FRAME_PLAIN_IMAGE (see its own doc comment in packages/ui/src/index.ts) is a solid
// locket-style frame with an opaque photo well, so the photo goes smaller and inset rather than
// filling the box on its own. Tuned by eye against the asset's own glass-opening proportions.
const FRAME_PLAIN_PHOTO_INSET_SCALE = 0.56;

// PLAYER_AVATAR_PHOTO_IMAGE already comes with its own circular gold ring baked in (Photoroom
// export), nested inside AVATAR_FRAME_PLAIN_IMAGE's own glass opening (see
// FRAME_PLAIN_PHOTO_INSET_SCALE above). 'contain' (not 'cover') so that inner ring stays fully
// visible instead of being cropped. `accent` is kept as a prop (every call site already passes
// it, isHuman vs not) for whenever a per-seat visual distinction is wanted again, but it's
// currently unused now that every seat shares one photo — see PlayerBadge.tsx's own call sites.
function PlayerAvatarComponent({ size = 'normal' }: PlayerAvatarProps) {
  const ringSize = DIMENSIONS[size];
  const photoInsetSize = ringSize * FRAME_PLAIN_PHOTO_INSET_SCALE;

  return (
    <View style={{ width: ringSize, height: ringSize }} testID="player-avatar">
      <Image source={AVATAR_FRAME_PLAIN_IMAGE} resizeMode="contain" style={styles.image} />
      <View style={[StyleSheet.absoluteFill, styles.photoInsetWrapper]}>
        <Image
          source={PLAYER_AVATAR_PHOTO_IMAGE}
          resizeMode="contain"
          style={{ width: photoInsetSize, height: photoInsetSize }}
        />
      </View>
    </View>
  );
}

export const PlayerAvatar = React.memo(PlayerAvatarComponent);

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  photoInsetWrapper: { alignItems: 'center', justifyContent: 'center' },
});
