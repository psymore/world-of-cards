import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import {
  AVATAR_FRAME_ACTIVE_IMAGE,
  AVATAR_FRAME_IDLE_IMAGE,
  AVATAR_FRAME_NEXT_IMAGE,
  PLAYER_AVATAR_PHOTO_IMAGE,
} from '@world-cards/ui';

export type PlayerAvatarTurnState = 'idle' | 'next' | 'active';

export interface PlayerAvatarProps {
  accent?: boolean;
  // 'small' is for width-constrained contexts (e.g. the 64dp side seats in a 4-player table),
  // where the default size leaves too little room for the name/capture-count text next to it.
  size?: 'normal' | 'small';
  turnState?: PlayerAvatarTurnState;
}

// 3x the original code-drawn-silhouette-era sizing (22/14) — a real photo reads as a placeholder
// silhouette at that size, where the old plain SVG glyph didn't need to be nearly as large to be
// legible.
const DIMENSIONS = {
  normal: 66,
  small: 42,
} as const;

const TURN_STATE_FRAMES: Record<PlayerAvatarTurnState, number> = {
  idle: AVATAR_FRAME_IDLE_IMAGE,
  next: AVATAR_FRAME_NEXT_IMAGE,
  active: AVATAR_FRAME_ACTIVE_IMAGE,
};
const TURN_STATES: PlayerAvatarTurnState[] = ['idle', 'next', 'active'];
// Matches SeatIdentity.tsx's own TURN_STATE_CROSSFADE_MS — same three-frame ring set, same feel.
const CROSSFADE_MS = 350;
// The ring art (avatar-frame-idle/next/active.png) is a thick decorative band, authored to sit
// well outside a plain face crop — drawn at the photo's own box size it would mostly overlap
// PLAYER_AVATAR_PHOTO_IMAGE's own baked-in ring instead of surrounding it. Scaling the ring layer
// up (paint-only, via transform — the outer View stays at DIMENSIONS[size] so this doesn't change
// PlayerBadge's layout/spacing) lets it read as an outer status ring around the photo's own inner
// ring instead of a second ring fighting the first at the same radius.
const RING_OVERLAY_SCALE = 1.35;

// PLAYER_AVATAR_PHOTO_IMAGE already comes with its own circular gold ring baked in (Photoroom
// export), so unlike the old code-drawn silhouette this needs no separate ring View or
// accent-color glyph — 'contain' (not 'cover') so that ring stays fully visible instead of being
// cropped to fill a square box. `accent` is kept as a prop (every call site already passes it,
// isHuman vs not) for whenever a per-seat visual distinction is wanted again, but it's currently
// unused now that every seat shares one photo — see PlayerBadge.tsx's own call sites.
function PlayerAvatarComponent({ size = 'normal', turnState = 'idle' }: PlayerAvatarProps) {
  const ringSize = DIMENSIONS[size];

  // One Animated.Value per state, mirroring SeatIdentity.tsx's own cross-fade rig exactly —
  // initialized directly to the starting turnState (not always 0) so the first render shows the
  // right ring immediately instead of fading in from nothing.
  const idleOpacity = useRef(new Animated.Value(turnState === 'idle' ? 1 : 0)).current;
  const nextOpacity = useRef(new Animated.Value(turnState === 'next' ? 1 : 0)).current;
  const activeOpacity = useRef(new Animated.Value(turnState === 'active' ? 1 : 0)).current;
  const opacities: Record<PlayerAvatarTurnState, Animated.Value> = {
    idle: idleOpacity,
    next: nextOpacity,
    active: activeOpacity,
  };

  useEffect(() => {
    Animated.parallel(
      TURN_STATES.map((state) =>
        Animated.timing(opacities[state], {
          toValue: state === turnState ? 1 : 0,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
      ),
    ).start();
    // opacities is rebuilt every render from the same three ref-backed Animated.Values, so it
    // isn't a stable dependency — depending on the refs directly avoids re-running this on every
    // render, same reasoning as SeatIdentity.tsx's identical effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnState, idleOpacity, nextOpacity, activeOpacity]);

  return (
    <View style={{ width: ringSize, height: ringSize }} testID="player-avatar">
      <Image source={PLAYER_AVATAR_PHOTO_IMAGE} resizeMode="contain" style={styles.image} />
      {TURN_STATES.map((state) => (
        <Animated.Image
          key={state}
          source={TURN_STATE_FRAMES[state]}
          resizeMode="contain"
          style={[
            StyleSheet.absoluteFill,
            styles.ringOverlay,
            { opacity: opacities[state], transform: [{ scale: RING_OVERLAY_SCALE }] },
          ]}
          testID={`player-avatar-frame-${state}`}
        />
      ))}
    </View>
  );
}

export const PlayerAvatar = React.memo(PlayerAvatarComponent);

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  ringOverlay: { width: '100%', height: '100%' },
});
