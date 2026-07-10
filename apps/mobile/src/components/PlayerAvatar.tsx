import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export interface PlayerAvatarProps {
  accent?: boolean;
}

const SIZE = 22;
const GLYPH_SIZE = 14;
const ACCENT_COLOR = '#ffd966';
const MUTED_RING_COLOR = 'rgba(255, 255, 255, 0.15)';
const MUTED_GLYPH_COLOR = '#cbd5c9';

// A deliberately generic person silhouette (circle head + rounded-shoulder body) — no facial
// detail or per-player distinguishing marks, same "keep it simple at tiny render size" reasoning
// as SuitIcon/CardBackPattern. `accent` is generic, not "isHuman": this component has no concept
// of which seat is the human — the caller decides who gets the ring.
function PlayerAvatarComponent({ accent = false }: PlayerAvatarProps) {
  const ringColor = accent ? ACCENT_COLOR : MUTED_RING_COLOR;
  const glyphColor = accent ? ACCENT_COLOR : MUTED_GLYPH_COLOR;

  return (
    <View style={[styles.ring, { borderColor: ringColor }]} testID="player-avatar">
      <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
        <Circle cx={12} cy={8} r={4} fill={glyphColor} />
        <Path d="M4,20 C4,14 8,12 12,12 C16,12 20,14 20,20 Z" fill={glyphColor} />
      </Svg>
    </View>
  );
}

export const PlayerAvatar = React.memo(PlayerAvatarComponent);

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
