import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  MahoganyTableSurface,
  TABLE_SURFACE_ASPECT_RATIO,
  SeatIdentity,
  TableSeatPosition,
} from '@world-cards/ui';
import type { TableSurfaceMaterial } from '@world-cards/ui';
import { SEAT_SAMPLE, ACTIVE_TURN_CYCLE, turnStateFor } from './seatPreviewSample';

const MATERIAL_OPTIONS: { value: TableSurfaceMaterial; label: string }[] = [
  { value: 'classicFelt', label: 'Classic Felt' },
  { value: 'greenFelt', label: 'Green Felt' },
  { value: 'nightBlueFelt', label: 'Night Blue Felt' },
  { value: 'wood', label: 'Wood' },
];

// Anchors seats around MahoganyTableSurface's own hollow window, calibrated by eye against the
// frame image's baked plaque-bar positions — same approach TableShell.tsx's own SEAT_ANCHOR_STYLE
// comment describes for the shipped frame (a different, differently-shaped asset, hence its own
// separate anchor numbers here rather than reusing TableShell's).
const SEAT_ANCHOR_STYLE: Record<TableSeatPosition, ViewStyle> = {
  top: { position: 'absolute', top: '4%', left: '30%', right: '30%', height: '6%' },
  bottom: { position: 'absolute', top: '90%', left: '30%', right: '30%', height: '6%' },
  left: { position: 'absolute', left: '4%', top: '40%', bottom: '40%', width: '18%' },
  right: { position: 'absolute', right: '4%', top: '40%', bottom: '40%', width: '18%' },
};

// Demonstrates the frame+configurable-interior split described in the "Table Frame, Felt
// Backgrounds & Playground Avatars" task: MahoganyTableSurface (packages/ui) supplies the fixed
// burgundy-mahogany frame wrapping a swappable felt/wood interior; the seats below reuse
// SeatIdentity exactly as TableShellPreview does, which already renders both the requested
// avatar-female-01.png (SEAT_SAMPLE's avatar field) and the existing badge (SeatIdentity's own
// baked-in seat-badge.png) — no separate avatar/badge wiring needed here.
export function MahoganyTablePreview() {
  const [material, setMaterial] = useState<TableSurfaceMaterial>('greenFelt');
  const [activeSeat, setActiveSeat] = useState<TableSeatPosition | null>('top');

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Mahogany Table Surface (prototype)</Text>
      <View style={styles.controls}>
        {MATERIAL_OPTIONS.map((option) => {
          const isSelected = option.value === material;
          return (
            <Pressable
              key={option.value}
              testID={`mahogany-material-${option.value}`}
              onPress={() => setMaterial(option.value)}
              style={[styles.toggleButton, isSelected && styles.toggleButtonActive]}
            >
              <Text style={[styles.toggleButtonLabel, isSelected && styles.toggleButtonLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        testID="mahogany-active-turn-toggle"
        onPress={() =>
          setActiveSeat((current) => {
            const nextIndex = (ACTIVE_TURN_CYCLE.indexOf(current) + 1) % ACTIVE_TURN_CYCLE.length;
            return ACTIVE_TURN_CYCLE[nextIndex];
          })
        }
        style={[styles.toggleButton, styles.turnToggle]}
      >
        <Text style={styles.toggleButtonLabel}>Turn: {activeSeat ?? 'none'}</Text>
      </Pressable>
      <View style={[styles.tableWrapper, { aspectRatio: TABLE_SURFACE_ASPECT_RATIO }]} testID="mahogany-table-preview">
        <MahoganyTableSurface material={material} />
        <View style={SEAT_ANCHOR_STYLE.top} testID="mahogany-table-seat-top">
          <SeatIdentity {...SEAT_SAMPLE.top} turnState={turnStateFor('top', activeSeat)} />
        </View>
        <View style={SEAT_ANCHOR_STYLE.bottom} testID="mahogany-table-seat-bottom">
          <SeatIdentity {...SEAT_SAMPLE.bottom} turnState={turnStateFor('bottom', activeSeat)} />
        </View>
        <View style={SEAT_ANCHOR_STYLE.left} testID="mahogany-table-seat-left">
          <SeatIdentity {...SEAT_SAMPLE.left} orientation="rotated-left" turnState={turnStateFor('left', activeSeat)} />
        </View>
        <View style={SEAT_ANCHOR_STYLE.right} testID="mahogany-table-seat-right">
          <SeatIdentity {...SEAT_SAMPLE.right} orientation="rotated-right" turnState={turnStateFor('right', activeSeat)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#f4c542' },
  controls: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  toggleButton: { backgroundColor: '#2a1a13', padding: 10, borderRadius: 6, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#f4c542' },
  toggleButtonLabel: { color: '#e8e3d2', fontWeight: 'bold', fontSize: 13 },
  toggleButtonLabelActive: { color: '#111' },
  turnToggle: { alignSelf: 'flex-start', marginBottom: 12 },
  // aspectRatio, not a fixed height — same reasoning as TableShellPreview's own tableWrapper:
  // a fixed height would either overflow or leave gaps once the frame's real 941:1672 shape is
  // fit into it, across the range of viewport widths this scroll-view content can render at.
  tableWrapper: { position: 'relative' },
});
