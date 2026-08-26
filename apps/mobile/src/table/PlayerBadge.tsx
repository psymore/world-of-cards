// Shared player nameplate rendered above every seat on every game's table. Previously each game's
// own table file (PistiTable.tsx, BatakTable.tsx) independently declared a byte-identical
// PlayerBadge component and badge/badgeActive/badgeCompact/playerLabel/playerLabelCompact style
// block — this is the single copy both share. Each game still builds its own `statusText` string
// (Pişti: captured-card count; Batak: bid/tricks) since that part is genuinely game-specific.
//
// Top/bottom (normal) and left/right (compact) seats now use genuinely different layouts, not just
// different sizes of the same one (2026-08-22):
//   - normal: a row, avatar on the left overlapping into the pill (AVATAR_OVERLAP), name+status on
//     the right, on the same NAME_BADGE_PILL_IMAGE background as before.
//   - compact: unchanged column (avatar stacked above the pill), but the pill background is now
//     SIDE_NAMEPLATE_GLOW_IMAGE (an upright plaque) instead of the horizontal name-badge pill —
//     see that export's own doc comment in packages/ui/src/index.ts.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  BODY_SEMIBOLD,
  NAME_BADGE_PILL_ASPECT_RATIO,
  NAME_BADGE_PILL_IMAGE,
  SIDE_NAMEPLATE_GLOW_ASPECT_RATIO,
  SIDE_NAMEPLATE_GLOW_IMAGE,
} from '@world-of-cards/ui';
import { PlayerAvatar } from '../components/PlayerAvatar';

export interface PlayerBadgeProps {
  name: string;
  statusText: string;
  isHuman: boolean;
  // Width-constrained seats (the 96dp side seats in a 4-player table) need a smaller avatar/pill
  // and tighter spacing so the name/status text still fits without wrapping onto several lines.
  compact?: boolean;
}

// normal: wider than the pre-2026-08-22 96 — grown by exactly AVATAR_OVERLAP so the avatar has
// room to sink into the pill without eating into the text's own space versus before.
const PILL_WIDTH_NORMAL = 96 + 32 + 40;
const PILL_WIDTH_COMPACT = 78 + 22;
// Both pills render with resizeMode="stretch", so height no longer has to track each background
// image's own aspect ratio exactly — 2026-08-25: sized wider and taller than the current source
// art on purpose, ahead of new glyph PNGs being dropped in to match. Expect visible stretch on the
// existing name-badge-pill.png/side-nameplate-green-glow.png until those replacements land.
const PILL_HEIGHT_SCALE_NORMAL = 1.4;
// Compact's own aspect ratio is already tall/portrait (SIDE_NAMEPLATE_GLOW_ASPECT_RATIO ≈ 0.5), and
// it renders in the width-constrained 96dp side rail — kept near 1.0 so the width bump above doesn't
// also push it tall enough to overflow that rail vertically.
const PILL_HEIGHT_SCALE_COMPACT = 1.05;
// How far the normal-size avatar (66dp, see PlayerAvatar's own DIMENSIONS) sinks into the pill —
// avatar renders after the pill in the tree with its own zIndex so it stays on top where they
// overlap, "entering" the nameplate rather than just sitting beside it.
const AVATAR_OVERLAP = 32;

export function PlayerBadge({ name, statusText, isHuman, compact }: PlayerBadgeProps) {
  const label = `${name} · ${statusText}`;

  if (compact) {
    const pillWidth = PILL_WIDTH_COMPACT;
    const pillHeight = (pillWidth / SIDE_NAMEPLATE_GLOW_ASPECT_RATIO) * PILL_HEIGHT_SCALE_COMPACT;
    return (
      <View style={styles.badgeColumn}>
        <PlayerAvatar accent={isHuman} size="small" />
        <View style={[styles.pill, { width: pillWidth, height: pillHeight }]}>
          <Image
            source={SIDE_NAMEPLATE_GLOW_IMAGE}
            resizeMode="stretch"
            style={[StyleSheet.absoluteFill, styles.pillImage]}
          />
          <View style={[styles.nameplateBounds, { width: pillWidth, height: pillHeight }]}>
            <Text
              style={[styles.playerLabel, styles.playerLabelCompact]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {label}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const pillWidth = PILL_WIDTH_NORMAL;
  const pillHeight = (pillWidth / NAME_BADGE_PILL_ASPECT_RATIO) * PILL_HEIGHT_SCALE_NORMAL;
  return (
    <View style={styles.badgeRow}>
      <View style={styles.avatarOverlap}>
        <PlayerAvatar accent={isHuman} size="normal" />
      </View>
      <View style={[styles.pill, styles.pillRow, { width: pillWidth, height: pillHeight, marginLeft: -AVATAR_OVERLAP }]}>
        <Image
          source={NAME_BADGE_PILL_IMAGE}
          resizeMode="stretch"
          style={[StyleSheet.absoluteFill, styles.pillImage]}
        />
        <View
          style={[
            styles.nameplateBounds,
            { marginLeft: AVATAR_OVERLAP, width: pillWidth - AVATAR_OVERLAP, height: pillHeight },
          ]}>
          <Text
            style={[styles.playerLabel, { width: pillWidth - AVATAR_OVERLAP }]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'center',
    marginVertical: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 4,
  },
  // zIndex keeps the avatar painted above the pill's left edge on native, where children stack by
  // array order regardless of visual overlap (same reasoning as PlayingCard.tsx's corner index).
  avatarOverlap: { zIndex: 1 },
  pill: { alignItems: 'center', justifyContent: 'center' },
  pillRow: { justifyContent: 'center' },
  // react-native-web's Image falls back to the loaded image's natural pixel size unless width/
  // height are explicit — StyleSheet.absoluteFill alone leaves them 'auto' on web (see
  // TableShell.tsx's own styles.fill for the same fix) — explicit 100%/100% forces the fill on
  // web while staying a no-op on native.
  pillImage: { width: '100%', height: '100%' },
  // Dedicated container that bounds the nameplate's text and centers it on both axes, independent
  // of the pill's own background/sizing. Row-variant sizes/offsets it to the space actually left
  // after the avatar's overlap footprint (see the row-variant JSX) so centering happens against
  // that space, not the pill's full width, which would put it visibly off-center against the
  // avatar sitting in the left portion; compact-variant sizes it to the whole pill.
  nameplateBounds: { alignItems: 'center', justifyContent: 'center' },
  playerLabel: {
    fontFamily: BODY_SEMIBOLD,
    fontSize: 14,
    color: '#241a10',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  // playerLabel's #241a10 was tuned for name-badge-pill.png's light cream interior — SIDE_NAMEPLATE_
  // GLOW_IMAGE (compact's own background) is dark emerald felt instead, so this needs the same
  // light gold/cream text the other dark-felt panels use (BatakSettingsModal, DevTuningModalShell).
  playerLabelCompact: { fontSize: 13, paddingHorizontal: 6, color: '#f5f0e6' },
});
