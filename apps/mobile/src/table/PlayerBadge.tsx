// Shared player nameplate (avatar circle + name/status pill, stacked vertically) rendered above
// every seat on every game's table. Previously each game's own table file (PistiTable.tsx,
// BatakTable.tsx) independently declared a byte-identical PlayerBadge component and badge/
// badgeActive/badgeCompact/playerLabel/playerLabelCompact style block — this is the single copy
// both share. Each game still builds its own `statusText` string (Pişti: captured-card count;
// Batak: bid/tricks) since that part is genuinely game-specific.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { BODY_SEMIBOLD, NAME_BADGE_PILL_ASPECT_RATIO, NAME_BADGE_PILL_IMAGE } from '@world-cards/ui';
import { PlayerAvatar } from '../components/PlayerAvatar';
import type { SeatTurnState } from './turnState';

export interface PlayerBadgeProps {
  name: string;
  statusText: string;
  turnState: SeatTurnState;
  isHuman: boolean;
  // Width-constrained seats (the 96dp side seats in a 4-player table) need a smaller avatar/pill
  // and tighter spacing so the name/status text still fits without wrapping onto several lines.
  compact?: boolean;
}

// The pill's own fixed width at each size — deliberately wider than PlayerAvatar's own ring
// (66/42, see PlayerAvatar.tsx's DIMENSIONS) so it reads as a wider plaque the circle sits above,
// not a same-width strip. Height follows from NAME_BADGE_PILL_ASPECT_RATIO so the pill art is
// never stretched off its own proportions.
const PILL_WIDTH = { normal: 96, compact: 68 } as const;

// PlayerAvatar's own turn-state ring (avatar-frame-idle/active.png, cross-faded — see
// PlayerAvatar.tsx) is now the turn indicator; this badge doesn't additionally glow itself the
// way it once did for a plain `active` boolean; that would fight the ring for attention instead
// of complementing it.
export function PlayerBadge({ name, statusText, turnState, isHuman, compact }: PlayerBadgeProps) {
  const size = compact ? 'compact' : 'normal';
  const pillWidth = PILL_WIDTH[size];
  const pillHeight = pillWidth / NAME_BADGE_PILL_ASPECT_RATIO;

  return (
    <View style={styles.badge}>
      <PlayerAvatar accent={isHuman} size={compact ? 'small' : 'normal'} turnState={turnState} />
      <View style={[styles.pill, { width: pillWidth, height: pillHeight }]}>
        <Image
          source={NAME_BADGE_PILL_IMAGE}
          resizeMode="stretch"
          style={[StyleSheet.absoluteFill, styles.pillImage]}
        />
        <Text
          style={[styles.playerLabel, compact && styles.playerLabelCompact]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {`${name} · ${statusText}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'center',
    marginVertical: 4,
  },
  pill: { alignItems: 'center', justifyContent: 'center' },
  // react-native-web's Image falls back to the loaded image's natural pixel size unless width/
  // height are explicit — StyleSheet.absoluteFill alone leaves them 'auto' on web (see
  // TableShell.tsx's own styles.fill for the same fix) — explicit 100%/100% forces the fill on
  // web while staying a no-op on native.
  pillImage: { width: '100%', height: '100%' },
  playerLabel: {
    fontFamily: BODY_SEMIBOLD,
    fontSize: 11,
    color: '#241a10',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  playerLabelCompact: { fontSize: 9, paddingHorizontal: 4 },
});
