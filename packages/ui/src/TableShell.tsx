import React from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";

// A single pre-merged wood-frame + green-felt + ambient-glow image (source:
// docs/references/GPT-powerful-assets-review/assets-v1/TABLE-ASSEMBLED-TRY-02-GLOW.png) —
// already cleanly cut (alpha 0 outside the wood ring, ~253 inside), so unlike the frame this
// replaces, there's no separate felt layer to composite: this one image is the whole table
// surface.
const SURFACE_IMAGE = require("../assets/table/themes/table-shell-surface.png");

// Matches table-shell-surface.png's pixel dimensions (1024x1536).
export const TABLE_SHELL_ASPECT_RATIO = 1024 / 1536;

export type TableSeatPosition = "top" | "bottom" | "left" | "right";

// Calibrated against table-shell-surface.png's own baked plaque-bar positions — measured by eye
// against the rendered image (see docs/superpowers/specs/2026-08-12-pisti-table-shell-pilot-design.md
// §2), the same percentages already validated in the Playground's v1 comparison tab
// (apps/playground/src/components/TableShellPreview.tsx's V1_SEAT_ANCHOR_STYLE) before this asset
// was adopted as the real default.
const SEAT_ANCHOR_STYLE: Record<TableSeatPosition, ViewStyle> = {
  top: {
    position: "absolute",
    top: "5%",
    left: "31%",
    right: "29%",
    height: "4.6%",
  },
  bottom: {
    position: "absolute",
    bottom: "10.5%",
    left: "31%",
    right: "29%",
    height: "4.9%",
  },
  left: {
    position: "absolute",
    left: "7.3%",
    top: "34.8%",
    bottom: "38.2%",
    width: "13.7%",
  },
  right: {
    position: "absolute",
    right: "7.3%",
    top: "34.8%",
    bottom: "38.2%",
    width: "13.7%",
  },
};

const SEAT_POSITIONS: TableSeatPosition[] = ["top", "bottom", "left", "right"];

export interface TableShellProps {
  seats?: Partial<Record<TableSeatPosition, React.ReactNode>>;
  tilt?: boolean;
  children?: React.ReactNode;
}

// rotateX angle picked during brainstorming (subtler than a 38deg mockup, more than a 12deg
// one) — see docs/superpowers/specs/2026-08-10-table-shell-redesign-design.md §7.
//
// perspective retuned up from 1400 to 2500 after the tilt visibly softened seat text: a CSS 3D
// transform gets rasterized once at the element's flat layout size and then GPU-warped, so any
// point far from the rotation's center (top/bottom seats sit right at the far/near edges) gets
// resampled through a real scale change — shrunk at the far edge, magnified at the near one —
// and both directions blur a bitmap that was never re-rendered at the new size. `perspective` is
// the lever for how aggressively that scale varies with distance from center: a bigger value
// reads as a more distant "camera," which flattens the projection (less scale swing top-to-
// bottom) for the same rotateX angle. Verified visually at 1400/2000/2500/3000/4000 — 2500 was
// the smallest increase where seat text stopped looking visibly softer than the flat state,
// while the table still clearly reads as tilted (2000 was close but still a little soft; 3000+
// started flattening the depth cue further than needed for the sharpness gained).
const TILT_TRANSFORM: NonNullable<ViewStyle["transform"]> = [
  { perspective: 2500 },
  { rotateX: "20deg" },
];

function TableShellComponent({
  seats,
  tilt = false,
  children,
}: TableShellProps) {
  return (
    <View style={styles.backdrop}>
      <View
        style={[styles.tableBox, tilt ? { transform: TILT_TRANSFORM } : null]}
        testID="table-shell">
        <Image
          source={SURFACE_IMAGE}
          style={[StyleSheet.absoluteFill, styles.fill]}
          resizeMode="stretch"
          testID="table-shell-surface"
        />
        {children != null ? (
          <View style={[StyleSheet.absoluteFill, styles.centerContent]}>
            {children}
          </View>
        ) : null}
        {SEAT_POSITIONS.map(position => {
          const content = seats?.[position];
          if (content == null) return null;
          return (
            <View
              key={position}
              style={SEAT_ANCHOR_STYLE[position]}
              testID={`table-shell-seat-${position}`}>
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
  backdrop: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  // Height-driven (not width-driven): the box claims nearly all of the backdrop's available
  // height, with width following from aspectRatio — so the table fills the screen's vertical
  // space consistently, rather than being sized off width and only incidentally reaching full
  // height on some viewport shapes. Portrait phones keep the resulting width well within the
  // container's own width (the source asset is itself portrait, aspectRatio < 1).
  tableBox: { height: "100%", aspectRatio: TABLE_SHELL_ASPECT_RATIO },
  // react-native-web's Image implementation falls back to the loaded image's *natural* pixel
  // dimensions (e.g. 941x1672) unless width/height are explicit — StyleSheet.absoluteFill alone
  // (position/top/left/right/bottom) fills a plain View, but for Image on web it leaves
  // width/height as 'auto', so the image renders oversized and gets clipped instead of stretching
  // to the parent box. Explicit 100%/100% forces the fill on web while remaining a no-op on
  // native, where StyleSheet.absoluteFill already resolves this correctly. Applied alongside
  // StyleSheet.absoluteFill in a style array at each call site (matching AbsoluteOverlay's
  // precedent) rather than spread into one object, since absoluteFillObject isn't a real
  // TypeScript-visible API on this RN version.
  fill: { width: "100%", height: "100%" },
  centerContent: { alignItems: "center", justifyContent: "center" },
});
