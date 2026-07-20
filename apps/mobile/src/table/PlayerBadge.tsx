// Shared player-name pill (avatar + name + status text) rendered above every seat on every
// game's table. Previously each game's own table file (PistiTable.tsx, BatakTable.tsx)
// independently declared a byte-identical PlayerBadge component and badge/badgeActive/
// badgeCompact/playerLabel/playerLabelCompact style block — this is the single copy both share.
// Each game still builds its own `statusText` string (Pişti: captured-card count; Batak:
// bid/tricks) since that part is genuinely game-specific.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { glowShadow } from '@world-cards/ui';
import { PlayerAvatar } from '../components/PlayerAvatar';

export interface PlayerBadgeProps {
  name: string;
  statusText: string;
  active: boolean;
  isHuman: boolean;
  // Width-constrained seats (the 96dp side seats in a 4-player table) need a smaller avatar and
  // tighter spacing so the name/status text still fits without wrapping onto several lines.
  compact?: boolean;
}

export function PlayerBadge({ name, statusText, active, isHuman, compact }: PlayerBadgeProps) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact, active && styles.badgeActive]}>
      <PlayerAvatar accent={isHuman} size={compact ? 'small' : 'normal'} />
      <Text style={[styles.playerLabel, compact && styles.playerLabelCompact]} numberOfLines={1}>
        {`${name} · ${statusText}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  badgeActive: {
    borderColor: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    ...glowShadow('#4ade80', 8),
  },
  badgeCompact: { gap: 3, paddingHorizontal: 5 },
  playerLabel: { fontSize: 13, fontWeight: '700', color: '#f5f0e6', textAlign: 'center' },
  playerLabelCompact: { fontSize: 11 },
});
