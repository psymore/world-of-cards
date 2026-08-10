import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

const FRAME_IMAGE = require('../assets/table/table-shell-frame.png');
// A richer, gold-rimmed felt render (FELT-GREEN-BORDERED-01.png in the GPT-review catalog) —
// deliberately a separate file from TableFelt.tsx's shared `green.png` (used by Batak/Home/etc.)
// rather than replacing it, since this is TableShell-specific and per-app visual changes need an
// explicit decision before spreading elsewhere (see docs/governance/guardrails.md).
const FELT_IMAGE = require('../assets/table/felt-green-bordered.png');

// Matches table-shell-frame.png's pixel dimensions (941x1672) so the felt and frame layers
// stay pixel-aligned to each other regardless of the width TableShell is rendered at.
export const TABLE_SHELL_ASPECT_RATIO = 941 / 1672;

export type TableSeatPosition = 'top' | 'bottom' | 'left' | 'right';

// Calibrated against FRAME-C-NOFELT-01A.png's baked glass-plaque positions using the Task 5
// Playground preview: pixel-sampled where each plaque's dark glass interior actually falls
// versus the anchor box's center, then nudged each anchor toward that measured center (top
// needed the largest correction — the initial value centered "You" on the plaque's lower rim/
// gold trim rather than its glass; left/right and bottom needed smaller nudges).
//
// left/right width re-measured during the code-review fix-up for the "West AI"/"East AI"
// clipping bug: pixel-sampling a text-free row (2-seat mode, so the plaque is empty) found the
// baked glass interior is only ~34 CSS px wide at typical preview widths, versus this anchor's
// previous 13%-width (~46 CSS px) — the anchor was overshooting the glass into the wood/gold
// trim on the outward side of each plaque (right side of "left", both sides of "right").
// Narrowed to 9.5% (~34 CSS px) and re-centered so the anchor's edges land on the measured
// glass edges instead of spilling past them.
const SEAT_ANCHOR_STYLE: Record<TableSeatPosition, ViewStyle> = {
  top: { position: 'absolute', top: '1.4%', left: '29%', right: '30%', height: '10.5%' },
  bottom: { position: 'absolute', bottom: '4.3%', left: '29%', right: '30%', height: '10.5%' },
  left: { position: 'absolute', left: '9%', top: '31.3%', bottom: '33.9%', width: '9.5%' },
  right: { position: 'absolute', right: '11%', top: '31.3%', bottom: '33.9%', width: '9.5%' },
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
        <Image
          source={FELT_IMAGE}
          style={[StyleSheet.absoluteFill, styles.fill]}
          resizeMode="stretch"
          testID="table-shell-felt"
        />
        <Image
          source={FRAME_IMAGE}
          style={[StyleSheet.absoluteFill, styles.fill]}
          resizeMode="stretch"
          testID="table-shell-frame"
        />
        {children != null ? (
          <View style={[StyleSheet.absoluteFill, styles.centerContent]}>{children}</View>
        ) : null}
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
  // dimensions (e.g. 941x1672) unless width/height are explicit — StyleSheet.absoluteFill alone
  // (position/top/left/right/bottom) fills a plain View, but for Image on web it leaves
  // width/height as 'auto', so the image renders oversized and gets clipped instead of stretching
  // to the parent box. Explicit 100%/100% forces the fill on web while remaining a no-op on
  // native, where StyleSheet.absoluteFill already resolves this correctly. Applied alongside
  // StyleSheet.absoluteFill in a style array at each call site (matching AbsoluteOverlay's
  // precedent) rather than spread into one object, since absoluteFillObject isn't a real
  // TypeScript-visible API on this RN version.
  fill: { width: '100%', height: '100%' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
});
