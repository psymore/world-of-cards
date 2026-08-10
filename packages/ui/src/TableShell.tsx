import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

const FRAME_IMAGE = require('../assets/table/table-shell-frame.png');
const FELT_IMAGE = require('../assets/table/green.png');

// Matches table-shell-frame.png's pixel dimensions (941x1672) so the felt and frame layers
// stay pixel-aligned to each other regardless of the width TableShell is rendered at.
export const TABLE_SHELL_ASPECT_RATIO = 941 / 1672;

export type TableSeatPosition = 'top' | 'bottom' | 'left' | 'right';

// Calibrated against FRAME-C-NOFELT-01A.png's baked glass-plaque positions using the Task 5
// Playground preview: pixel-sampled where each plaque's dark glass interior actually falls
// versus the anchor box's center, then nudged each anchor toward that measured center (top
// needed the largest correction — the initial value centered "You" on the plaque's lower rim/
// gold trim rather than its glass; left/right and bottom needed smaller nudges).
const SEAT_ANCHOR_STYLE: Record<TableSeatPosition, ViewStyle> = {
  top: { position: 'absolute', top: '1.4%', left: '29%', right: '30%', height: '10.5%' },
  bottom: { position: 'absolute', bottom: '4.3%', left: '29%', right: '30%', height: '10.5%' },
  left: { position: 'absolute', left: '9%', top: '31.3%', bottom: '33.9%', width: '13%' },
  right: { position: 'absolute', right: '9%', top: '31.3%', bottom: '33.9%', width: '13%' },
};

const SEAT_POSITIONS: TableSeatPosition[] = ['top', 'bottom', 'left', 'right'];

export interface TableShellProps {
  seats?: Partial<Record<TableSeatPosition, React.ReactNode>>;
  tilt?: boolean;
  children?: React.ReactNode;
}

// Starting value picked during brainstorming (subtler than a 38deg mockup, more than a
// 12deg one) — see docs/superpowers/specs/2026-08-10-table-shell-redesign-design.md §7.
// Tune visually against this component, not the CSS mockup, before treating as final.
const TILT_TRANSFORM: NonNullable<ViewStyle['transform']> = [{ perspective: 1400 }, { rotateX: '20deg' }];

function TableShellComponent({ seats, tilt = false, children }: TableShellProps) {
  return (
    <View style={styles.backdrop}>
      <View style={[styles.tableBox, tilt ? { transform: TILT_TRANSFORM } : null]} testID="table-shell">
        <Image source={FELT_IMAGE} style={styles.fill} resizeMode="stretch" testID="table-shell-felt" />
        <Image source={FRAME_IMAGE} style={styles.fill} resizeMode="stretch" testID="table-shell-frame" />
        {children != null ? <View style={styles.centerContent}>{children}</View> : null}
        {SEAT_POSITIONS.map((position) => {
          const content = seats?.[position];
          if (content == null) return null;
          return (
            <View key={position} style={SEAT_ANCHOR_STYLE[position]} testID={`table-shell-seat-${position}`}>
              {content}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const TableShell = React.memo(TableShellComponent);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  tableBox: { width: '92%', aspectRatio: TABLE_SHELL_ASPECT_RATIO },
  // react-native-web's Image implementation falls back to the loaded image's *natural* pixel
  // dimensions (e.g. 941x1672) unless width/height are explicit — StyleSheet.absoluteFillObject
  // alone (position/top/left/right/bottom) fills a plain View, but for Image on web it leaves
  // width/height as 'auto', so the image renders oversized and gets clipped instead of stretching
  // to the parent box. Explicit 100%/100% forces the fill on web while remaining a no-op on
  // native, where absoluteFillObject already resolves this correctly.
  fill: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  centerContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
