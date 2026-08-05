import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WOOD_TRIM_COLOR } from '@world-cards/ui';

export interface PlayerAvatarProps {
  accent?: boolean;
  // 'small' is for width-constrained contexts (e.g. the 64dp side seats in a 4-player table),
  // where the default size leaves too little room for the name/capture-count text next to it.
  size?: 'normal' | 'small';
}

const DIMENSIONS = {
  normal: { ring: 22, glyph: 14 },
  small: { ring: 14, glyph: 9 },
} as const;

const ACCENT_COLOR = WOOD_TRIM_COLOR;
const MUTED_RING_COLOR = 'rgba(255, 255, 255, 0.15)';
const MUTED_GLYPH_COLOR = '#cbd5c9';

// A deliberately generic person silhouette (circle head + rounded-shoulder body) — no facial
// detail or per-player distinguishing marks, same "keep it simple at tiny render size" reasoning
// as SuitIcon. `accent` is generic, not "isHuman": this component has no concept
// of which seat is the human — the caller decides who gets the ring.
function PlayerAvatarComponent({ accent = false, size = 'normal' }: PlayerAvatarProps) {
  const ringColor = accent ? ACCENT_COLOR : MUTED_RING_COLOR;
  const glyphColor = accent ? ACCENT_COLOR : MUTED_GLYPH_COLOR;
  const { ring: ringSize, glyph: glyphSize } = DIMENSIONS[size];

  return (
    <View
      style={[
        styles.ring,
        { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: ringColor },
      ]}
      testID="player-avatar"
    >
      <Svg width={glyphSize} height={glyphSize} viewBox="0 0 24 24">
        <Circle cx={12} cy={8} r={4} fill={glyphColor} />
        <Path d="M4,20 C4,14 8,12 12,12 C16,12 20,14 20,20 Z" fill={glyphColor} />
      </Svg>
    </View>
  );
}

export const PlayerAvatar = React.memo(PlayerAvatarComponent);

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
