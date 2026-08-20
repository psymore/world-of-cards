import React from "react";
import { Image, StyleSheet } from "react-native";
import { AbsoluteOverlay } from "./AbsoluteOverlay";

// Locked as the one stable, game-agnostic frame asset for every game's table (Pişti, Batak, and
// any future game) — the "-trimmed" crop (see its own doc comment on
// TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE in index.ts) removes the raw file's baked-in
// transparent padding, so it touches all four container edges with no gap once stretched, unlike
// the untrimmed original. Only the interior (SURFACE_IMAGES below) is meant to vary between
// games/looks — the frame itself does not change without a deliberate follow-up request.
const FRAME_IMAGE = require("../assets/table/default/TABLE-FRAME-MAHOGANY-BURGUNDY-photoroom-trimmed.png");
// The original felt texture (not the 2026-08-15 NEW-TABLE-DEFAULT-GREEN-FELT swap below) — kept
// as its own distinct, genuinely "classic" option now that greenFelt is the live in-game default
// (devTuningStore.ts), rather than silently pointing at the same file as another named option.
const CLASSIC_FELT_IMAGE = require("../assets/table/themes/green.png");
const GREEN_FELT_IMAGE = require("../assets/table/default/NEW-TABLE-DEFAULT-GREEN-FELT.png");
const NIGHT_BLUE_FELT_IMAGE = require("../assets/table/default/NEW-TABLE-DEFAULT-NIGHT-BLUE.png");
const WOOD_IMAGE = require("../assets/table/default/NEW-TABLE-DEFAULT-MAHOGANY.png");

export type TableSurfaceMaterial =
  | "classicFelt"
  | "greenFelt"
  | "nightBlueFelt"
  | "wood";

const SURFACE_IMAGES: Record<TableSurfaceMaterial, number> = {
  classicFelt: CLASSIC_FELT_IMAGE,
  greenFelt: GREEN_FELT_IMAGE,
  nightBlueFelt: NIGHT_BLUE_FELT_IMAGE,
  wood: WOOD_IMAGE,
};

// The trimmed frame's own real pixel dimensions — for callers that need to size their own
// container box to this component's native aspect ratio (same role TABLE_SHELL_ASPECT_RATIO plays
// for TableShell.tsx's own tableBox), since MahoganyTableSurface itself fills whatever box its
// parent gives it rather than sizing itself. Matches the frame, the "locked" element here — the
// interior's own native ratio doesn't need to match this exactly (see the doc comment below on
// why a small mismatch there is harmless).
export const TABLE_SURFACE_ASPECT_RATIO = 874 / 1654;

export interface MahoganyTableSurfaceProps {
  // Which interior sits inside the frame's hollow window — swapping this changes nothing else
  // (card positions, seat layout, table geometry, frame dimensions all live entirely outside this
  // component). Defaults to 'classicFelt' (TableFelt's own texture) — the least surprising choice
  // for any caller that omits this prop, since it matches what the table looked like before this
  // component existed; the other three are opt-in.
  material?: TableSurfaceMaterial;
}

// The complete physical-table look: a configurable felt/wood interior (SURFACE_IMAGES) stacked
// exactly beneath the fixed burgundy-mahogany frame (alpha-cut hollow transparent center, opaque
// wood border) so the frame visually wraps the complete surface rather than sitting in front of
// an unrelated background.
//
// The frame is LOCKED (see FRAME_IMAGE's own doc comment) — its crop doesn't exactly match the
// interior images' own native 941x1672 canvas (the frame is 874x1654, trimmed on all four edges —
// the left/right crop already shipped, the top/bottom crop removed a residual fully-transparent
// sliver that used to leave a visible gap at the screen's top/bottom edge once stretched), so the
// frame's hollow window sits at a slightly different fraction of its own canvas than where the interior
// images' opaque content sits on theirs. That's fine, not a bug: measured directly (sharp, alpha
// channel), the interior images' opaque region already spans roughly 3%-97% of their own canvas —
// comfortably wider on both sides than the trimmed frame's window fraction (roughly 6%-94%) — so
// once both are stretched to the same box, the interior's opaque coverage still fully contains the
// window with margin to spare in every direction. No per-asset alignment compensation needed.
//
// Every layer is stretched non-uniformly (resizeMode="stretch" + width/height: '100%') and
// EXPLICITLY position: 'absolute' — both layers must overlap at identical bounds for this to work
// at all; without an explicit position, they'd lay out in AbsoluteOverlay's default flex column
// instead, stacking one below the other rather than overlapping (this was a real bug: the frame
// was being pushed out of view below the felt, not just painted underneath it, matching an earlier
// "felt covering frame" report — zIndex alone couldn't have fixed that, only stacking order for
// elements that already overlap).
function MahoganyTableSurfaceComponent({
  material = "classicFelt",
}: MahoganyTableSurfaceProps) {
  return (
    <AbsoluteOverlay>
      <Image
        source={SURFACE_IMAGES[material]}
        resizeMode="stretch"
        style={styles.interiorLayer}
        testID="mahogany-table-surface-interior"
      />
      <Image
        source={FRAME_IMAGE}
        resizeMode="stretch"
        style={styles.frameLayer}
        testID="mahogany-table-surface-frame"
      />
    </AbsoluteOverlay>
  );
}

export const MahoganyTableSurface = React.memo(MahoganyTableSurfaceComponent);

const styles = StyleSheet.create({
  interiorLayer: { position: "absolute", width: "100%", height: "100%", zIndex: 0 },
  frameLayer: { position: "absolute", width: "100%", height: "100%", zIndex: 1 },
});
