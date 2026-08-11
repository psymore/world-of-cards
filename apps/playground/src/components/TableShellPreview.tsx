import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SeatIdentity, SeatIdentityTurnState, TABLE_SHELL_ASPECT_RATIO, TableShell, TableSeatPosition } from '@world-cards/ui';

const SEAT_SAMPLE = {
  top: { name: 'You', trickCount: 0, avatar: 'female-01' },
  bottom: { name: 'South AI', trickCount: 2, avatar: 'female-01' },
  left: { name: 'West AI', trickCount: 1, avatar: 'female-01' },
  right: { name: 'East AI', trickCount: 0, avatar: 'female-01' },
} as const;

// Cycle order for the turn toggle below — null (no seat active) included so the placeholder
// glow can be compared side-by-side against the fully-idle state.
const ACTIVE_TURN_CYCLE: (TableSeatPosition | null)[] = ['top', 'right', 'bottom', 'left', null];

// Clockwise seating order, used only to derive which seat is "next" after whichever one is
// active — matches TABLE-034's 3-state reference (active/next/idle), not any real game's turn
// rule (no game is wired to this prototype screen).
const CLOCKWISE_ORDER: TableSeatPosition[] = ['top', 'right', 'bottom', 'left'];

function turnStateFor(position: TableSeatPosition, activeSeat: TableSeatPosition | null): SeatIdentityTurnState {
  if (position === activeSeat) return 'active';
  if (activeSeat != null) {
    const nextIndex = (CLOCKWISE_ORDER.indexOf(activeSeat) + 1) % CLOCKWISE_ORDER.length;
    if (position === CLOCKWISE_ORDER[nextIndex]) return 'next';
  }
  return 'idle';
}

// Prototype-only screen: exercises TableShell's flat/tilted and 4-seat/2-seat cases with no
// game-state dependency, so the component can be judged purely on how it looks before it's
// wired into a real game (a separate, later plan). No zustand store entry for tilt/seat-count
// — this is throwaway exploration state, not a persisted card/table template.
export function TableShellPreview() {
  const [tilt, setTilt] = useState(false);
  const [fourSeats, setFourSeats] = useState(true);
  const [activeSeat, setActiveSeat] = useState<TableSeatPosition | null>('top');

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
      <View style={styles.controls}>
        <Pressable testID="tilt-toggle" onPress={() => setTilt((v) => !v)} style={styles.toggleButton}>
          <Text style={styles.toggleButtonLabel}>{tilt ? 'Tilt: ON' : 'Tilt: OFF'}</Text>
        </Pressable>
        <Pressable testID="seat-count-toggle" onPress={() => setFourSeats((v) => !v)} style={styles.toggleButton}>
          <Text style={styles.toggleButtonLabel}>{fourSeats ? '4 seats' : '2 seats'}</Text>
        </Pressable>
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
