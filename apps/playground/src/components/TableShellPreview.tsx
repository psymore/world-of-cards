import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SeatIdentity, TABLE_SHELL_ASPECT_RATIO, TableShell } from '@world-cards/ui';

const SEAT_SAMPLE = {
  top: { name: 'You', trickCount: 0 },
  bottom: { name: 'South AI', trickCount: 2 },
  left: { name: 'West AI', trickCount: 1 },
  right: { name: 'East AI', trickCount: 0 },
} as const;

// Prototype-only screen: exercises TableShell's flat/tilted and 4-seat/2-seat cases with no
// game-state dependency, so the component can be judged purely on how it looks before it's
// wired into a real game (a separate, later plan). No zustand store entry for tilt/seat-count
// — this is throwaway exploration state, not a persisted card/table template.
export function TableShellPreview() {
  const [tilt, setTilt] = useState(false);
  const [fourSeats, setFourSeats] = useState(true);

  const seats = fourSeats
    ? {
        top: <SeatIdentity {...SEAT_SAMPLE.top} />,
        bottom: <SeatIdentity {...SEAT_SAMPLE.bottom} />,
        left: <SeatIdentity {...SEAT_SAMPLE.left} orientation="rotated-left" />,
        right: <SeatIdentity {...SEAT_SAMPLE.right} orientation="rotated-right" />,
      }
    : {
        top: <SeatIdentity {...SEAT_SAMPLE.top} />,
        bottom: <SeatIdentity {...SEAT_SAMPLE.bottom} />,
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
  // aspectRatio, not a fixed height: a fixed 480 caused the tall (941x1672) table image to
  // overflow its box and bleed into the heading/toggles above and CardGallery below on
  // narrower viewports.
  tableWrapper: { aspectRatio: TABLE_SHELL_ASPECT_RATIO },
});
