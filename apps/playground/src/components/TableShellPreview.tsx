import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  SeatIdentity,
  SeatIdentityTurnStateFrames,
  TABLE_SHELL_ASPECT_RATIO,
  TableShell,
  TableSeatPosition,
} from '@world-cards/ui';
import { SEAT_SAMPLE, ACTIVE_TURN_CYCLE, turnStateFor } from './seatPreviewSample';

type TableShellVersionId = 'v0' | 'v1';

interface TableShellVersion {
  id: TableShellVersionId;
  label: string;
  // null = the real, currently-shipped TableShell (felt + wired-up seats/tilt). Anything else is
  // just a candidate asset being eyeballed side-by-side before it's wired into a real composited
  // table — add one entry + one required image per new candidate, no other plumbing needed.
  frameImage: number | null;
  // Rendered behind frameImage, same stacking TableShell itself uses. null = no felt candidate
  // added yet for this version (the frame alone is shown, letting the page background show
  // through its hole).
  feltImage: number | null;
  aspectRatio: number;
}

const TABLE_SHELL_VERSIONS: TableShellVersion[] = [
  { id: 'v0', label: 'v0', frameImage: null, feltImage: null, aspectRatio: TABLE_SHELL_ASPECT_RATIO },
  {
    id: 'v1',
    label: 'v1',
    // docs/references/GPT-powerful-assets-review/assets-v1/TABLE-FRAME-TRY-02-GLOW-Photoroom-holepunched.png
    frameImage: require('../../assets/table-shell-versions/v1-frame.png'),
    // Built by scripts/assets/build-table-shell-v1-felt.js from TABLE-FELT-PANEL-TRY-03-RED-GLOW.png,
    // masked down to this frame's actual hole shape (same corner-seeded flood-fill technique as
    // the shipped v0 felt) rather than just stretched behind it — a plain stretch would have
    // bled red through the frame's outer transparent corners the same way the original v0 felt
    // leak did.
    feltImage: require('../../assets/table-shell-versions/v1-felt.png'),
    aspectRatio: 1024 / 1536,
  },
];

// One ring image per turn state — the AVATAR-FRAME-MEDIUM-{IDLE,GLOW,APEAK-GLOW} set, cropped
// from docs/references/GPT-powerful-assets-review/assets-v1/ — passed to SeatIdentity's
// turnStateFrames prop so v1's seats cross-fade between them instead of using the default
// glowShadow placeholder.
const V1_BADGE_FRAMES: SeatIdentityTurnStateFrames = {
  idle: require('../../assets/table-shell-versions/v1-badge-idle.png'),
  next: require('../../assets/table-shell-versions/v1-badge-next.png'),
  active: require('../../assets/table-shell-versions/v1-badge-active.png'),
};

// Calibrated by eye against v1-frame.png's own baked plaque-bar positions (same approach
// TableShell.tsx's own SEAT_ANCHOR_STYLE comment describes for the shipped frame) — a first
// pass, not pixel-measured, since this frame is still a "try" candidate and may not survive.
const V1_SEAT_ANCHOR_STYLE: Record<TableSeatPosition, ViewStyle> = {
  top: { position: 'absolute', top: '5%', left: '31%', right: '29%', height: '4.6%' },
  bottom: { position: 'absolute', bottom: '10.5%', left: '31%', right: '29%', height: '4.9%' },
  left: { position: 'absolute', left: '7.3%', top: '34.8%', bottom: '38.2%', width: '13.7%' },
  right: { position: 'absolute', right: '7.3%', top: '34.8%', bottom: '38.2%', width: '13.7%' },
};

// Prototype-only screen: exercises TableShell's flat/tilted and 4-seat/2-seat cases with no
// game-state dependency, so the component can be judged purely on how it looks before it's
// wired into a real game (a separate, later plan). No zustand store entry for tilt/seat-count
// — this is throwaway exploration state, not a persisted card/table template.
export function TableShellPreview() {
  const [tilt, setTilt] = useState(false);
  const [fourSeats, setFourSeats] = useState(true);
  const [activeSeat, setActiveSeat] = useState<TableSeatPosition | null>('top');
  const [versionId, setVersionId] = useState<TableShellVersionId>('v0');
  const version = TABLE_SHELL_VERSIONS.find((v) => v.id === versionId) ?? TABLE_SHELL_VERSIONS[0];

  const seats = fourSeats
    ? {
        top: <SeatIdentity {...SEAT_SAMPLE.top} turnState={turnStateFor('top', activeSeat)} />,
        bottom: <SeatIdentity {...SEAT_SAMPLE.bottom} turnState={turnStateFor('bottom', activeSeat)} />,
        left: (
          <SeatIdentity {...SEAT_SAMPLE.left} orientation="rotated-left" turnState={turnStateFor('left', activeSeat)} />
        ),
        right: (
          <SeatIdentity {...SEAT_SAMPLE.right} orientation="rotated-right" turnState={turnStateFor('right', activeSeat)} />
        ),
      }
    : {
        top: <SeatIdentity {...SEAT_SAMPLE.top} turnState={turnStateFor('top', activeSeat)} />,
        bottom: <SeatIdentity {...SEAT_SAMPLE.bottom} turnState={turnStateFor('bottom', activeSeat)} />,
      };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Table Shell (prototype)</Text>
      <View style={styles.versionTabRow}>
        {TABLE_SHELL_VERSIONS.map((v) => (
          <Pressable
            key={v.id}
            testID={`table-shell-version-tab-${v.id}`}
            onPress={() => setVersionId(v.id)}
            style={[styles.versionTab, v.id === versionId && styles.versionTabActive]}
          >
            <Text style={[styles.versionTabLabel, v.id === versionId && styles.versionTabLabelActive]}>
              {v.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.controls}>
        {version.frameImage == null ? (
          <>
            <Pressable testID="tilt-toggle" onPress={() => setTilt((v) => !v)} style={styles.toggleButton}>
              <Text style={styles.toggleButtonLabel}>{tilt ? 'Tilt: ON' : 'Tilt: OFF'}</Text>
            </Pressable>
            <Pressable testID="seat-count-toggle" onPress={() => setFourSeats((v) => !v)} style={styles.toggleButton}>
              <Text style={styles.toggleButtonLabel}>{fourSeats ? '4 seats' : '2 seats'}</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          testID="active-turn-toggle"
          onPress={() =>
            setActiveSeat((current) => {
              const nextIndex = (ACTIVE_TURN_CYCLE.indexOf(current) + 1) % ACTIVE_TURN_CYCLE.length;
              return ACTIVE_TURN_CYCLE[nextIndex];
            })
          }
          style={styles.toggleButton}
        >
          <Text style={styles.toggleButtonLabel}>Turn: {activeSeat ?? 'none'}</Text>
        </Pressable>
      </View>
      <View style={[styles.tableWrapper, { aspectRatio: version.aspectRatio }]}>
        {version.frameImage == null ? (
          <TableShell seats={seats} tilt={tilt} />
        ) : (
          <View style={styles.versionPreviewBox} testID={`table-shell-version-preview-${version.id}`}>
            {version.feltImage != null ? (
              <Image source={version.feltImage} style={[StyleSheet.absoluteFill, styles.versionPreviewImage]} resizeMode="contain" />
            ) : null}
            <Image source={version.frameImage} style={[StyleSheet.absoluteFill, styles.versionPreviewImage]} resizeMode="contain" />
            {(['top', 'bottom', 'left', 'right'] as TableSeatPosition[]).map((position) => (
              <View key={position} style={V1_SEAT_ANCHOR_STYLE[position]} testID={`table-shell-v1-seat-${position}`}>
                <SeatIdentity
                  {...SEAT_SAMPLE[position]}
                  orientation={position === 'left' ? 'rotated-left' : position === 'right' ? 'rotated-right' : 'horizontal'}
                  turnState={turnStateFor(position, activeSeat)}
                  turnStateFrames={V1_BADGE_FRAMES}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#f4c542' },
  controls: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  toggleButton: { backgroundColor: '#2a1a13', padding: 10, borderRadius: 6, alignItems: 'center' },
  toggleButtonLabel: { color: '#e8e3d2', fontWeight: 'bold' },
  versionTabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  versionTab: { backgroundColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  versionTabActive: { backgroundColor: '#f4c542' },
  versionTabLabel: { color: '#e8e3d2', fontWeight: 'bold', fontSize: 13 },
  versionTabLabelActive: { color: '#111' },
  // aspectRatio, not a fixed height: a fixed 480 caused the tall (941x1672) table image to
  // overflow its box and bleed into the heading/toggles above and CardGallery below on
  // narrower viewports. Each version supplies its own aspectRatio (v1+ candidates aren't
  // necessarily the same shape as the shipped v0 frame) so the box is never stretched.
  tableWrapper: { aspectRatio: TABLE_SHELL_ASPECT_RATIO },
  versionPreviewBox: { flex: 1 },
  versionPreviewImage: { width: '100%', height: '100%' },
});
