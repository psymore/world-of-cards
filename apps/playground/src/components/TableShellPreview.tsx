import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TABLE_SHELL_ASPECT_RATIO, TableShell } from '@world-cards/ui';

const SEAT_LABEL = { top: 'You', bottom: 'South AI', left: 'West AI', right: 'East AI' } as const;

function SeatBadge({ label }: { label: string }) {
  return (
    <View style={styles.seatBadge}>
      <Text style={styles.seatBadgeText}>{label}</Text>
    </View>
  );
}

// Prototype-only screen: exercises TableShell's flat/tilted and 4-seat/2-seat cases with no
// game-state dependency, so the component can be judged purely on how it looks before it's
// wired into a real game (a separate, later plan). No zustand store entry for tilt/seat-count
// — this is throwaway exploration state, not a persisted card/table template.
export function TableShellPreview() {
  const [tilt, setTilt] = useState(false);
  const [fourSeats, setFourSeats] = useState(true);

  const seats = fourSeats
    ? {
        top: <SeatBadge label={SEAT_LABEL.top} />,
        bottom: <SeatBadge label={SEAT_LABEL.bottom} />,
        left: <SeatBadge label={SEAT_LABEL.left} />,
        right: <SeatBadge label={SEAT_LABEL.right} />,
      }
    : {
        top: <SeatBadge label={SEAT_LABEL.top} />,
        bottom: <SeatBadge label={SEAT_LABEL.bottom} />,
      };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Table Shell (prototype)</Text>
      <View style={styles.controls}>
        <Pressable testID="tilt-toggle" onPress={() => setTilt((v) => !v)} style={styles.toggleButton}>
          <Text style={styles.toggleButtonLabel}>{tilt ? 'Tilt: ON' : 'Tilt: OFF'}</Text>
        </Pressable>
        <Pressable testID="seat-count-toggle" onPress={() => setFourSeats((v) => !v)} style={styles.toggleButton}>
          <Text style={styles.toggleButtonLabel}>{fourSeats ? '4 seats' : '2 seats'}</Text>
        </Pressable>
      </View>
      <View style={styles.tableWrapper}>
        <TableShell seats={seats} tilt={tilt} />
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
  // Matches TableShell's own aspect ratio (rather than a fixed pixel height) so this wrapper
  // never over/under-shoots the height TableShell actually needs for the rendered width —
  // a fixed 480 caused the tall (941x1672) table image to overflow its box and bleed into
  // the heading/toggles above and CardGallery below on narrower viewports.
  tableWrapper: { aspectRatio: TABLE_SHELL_ASPECT_RATIO },
  seatBadge: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seatBadgeText: { color: '#2a1a13', fontWeight: 'bold', fontSize: 12 },
});
