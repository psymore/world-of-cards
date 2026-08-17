import { create } from 'zustand';
import type { TableSurfaceMaterial } from '@world-cards/ui';

// 'frame' pairs TableFelt with the shared, game-agnostic DefaultTableFrame overlay
// (packages/ui/src/DefaultTableFrame.tsx) — the same carved-wood border Pişti ships as its own
// default table look ('frameOnly' in PistiTableBackground below), made available to any game via
// this shared field rather than duplicated per-game. Now Batak's actual shipped default too
// (matching Pişti's), with 'felt' kept as the legacy look, opt-in via each game's own dev-tuning
// panel.
export type DevTableBackground = 'felt' | 'gemini' | 'frame';

// Pişti-only — unlike tableBackground above (shared with Batak, still only felt/gemini/frame), Pişti
// has its own richer set of table designs from the TableShell pilot
// (docs/superpowers/plans/2026-08-12-pisti-table-shell-pilot.md): the pre-pilot legacy looks
// ('felt'/'gemini', now rendered via Pişti's own legacy render path since the pilot replaced its
// default usage of TableFelt/GeminiTableBackground), the pilot's original TableShell surface
// ('tableShell'), an experiment stretching a plain felt panel to fill the full screen height
// non-uniformly ('stretchedFelt') — kept as a dev-tuning-only comparison rather than applied
// unconditionally, since it visibly distorts framed/carved artwork (fine for a flat panel, not for
// TableShell's ornate wood frame) — a newer full-bleed carved-frame felt panel ('legacyRevisited',
// TABLE-FELT-PANEL-TRY-02-GLOW.png) covered (not stretched) over the whole legacy table area, the
// same way TableFelt/GeminiTableBackground already are — a three-layer backdrop/felt-insert/wood-
// frame composite with its own baked-in bottom plaque ('newDesign', see
// TABLE_BACKDROP_GLASS_GOLD_GLOW_IMAGE's own doc comment in packages/ui/src/index.ts) — and that
// same wood frame alone, stretched to all four screen edges over plain TableFelt with no felt-
// insert or backdrop layers behind it ('frameOnly', labeled "Default Frame" in the dev-tuning
// panel — now the actual shipped default, having replaced 'tableShell' in that role). +
// 'frameBottomAnchored' is the same wood frame over the same TableFelt background, but laid out
// via the generic BottomAnchoredImage primitive (packages/ui/src/BottomAnchoredImage.tsx) instead
// of a non-uniform 4-edge stretch: full container width, proportional height, bottom/left/right
// touching exactly, top ending wherever the frame's own aspect ratio puts it rather than being
// stretched up to the screen's top edge — a comparison for 'frameOnly's distorted top.
export type PistiTableBackground =
  | 'felt'
  | 'gemini'
  | 'tableShell'
  | 'stretchedFelt'
  | 'legacyRevisited'
  | 'newDesign'
  | 'frameOnly'
  | 'frameBottomAnchored';

export interface DevTuningState {
  tableBackground: DevTableBackground;
  pistiTableBackground: PistiTableBackground;
  // Which interior MahoganyTableSurface renders inside the mahogany frame — shared across both
  // games (like tableBackground above), since the frame+interior split is itself game-agnostic.
  // Only visible when a game's own background selection actually renders MahoganyTableSurface
  // ('frame' for Batak, 'frameOnly' for Pişti); otherwise this is inert. Defaults to 'greenFelt'
  // (2026-08-15) — the actual shipped in-game felt for both games now, not just a dev-tuning
  // candidate; 'classicFelt' is the pre-2026-08-15 look, kept as an opt-in comparison.
  tableSurfaceMaterial: TableSurfaceMaterial;
  // null means "not yet overridden by the panel" — HumanHandFan then falls back to whichever rail
  // config (Standard or Compact) is actually live for that hand, instead of a baked-in
  // Standard-shaped default that would silently corrupt Compact/gömmeli's baseline.
  topOverlap: number | null;
  bottomOverlap: number | null;
  topSpacingPx: number | null;
  bottomSpacingPx: number | null;
  // Per-row position nudge (px), added to that row's fan on top of its rail geometry — same
  // null-means-untouched convention as the fields above. Batak-only, like topOverlap/bottomOverlap.
  topOffsetX: number | null;
  topOffsetY: number | null;
  bottomOffsetX: number | null;
  bottomOffsetY: number | null;
  // Shared across both rows (not split top/bottom) — matches how STANDARD_RAIL_CONFIG/
  // COMPACT_RAIL_CONFIG already treat arcDegrees as one value for the whole hand, not a per-row one.
  arcDegrees: number | null;
  // Pişti's hand is a single row (PISTI_RAIL_CONFIG, no Standard/Compact split) — one overlap/
  // spacing/arcDegrees each, not top/bottom pairs. Same null-means-untouched convention as Batak's
  // fields above.
  pistiOverlap: number | null;
  pistiSpacingPx: number | null;
  pistiArcDegrees: number | null;
  setTableBackground: (v: DevTableBackground) => void;
  setPistiTableBackground: (v: PistiTableBackground) => void;
  setTableSurfaceMaterial: (v: TableSurfaceMaterial) => void;
  setTopOverlap: (v: number) => void;
  setBottomOverlap: (v: number) => void;
  setTopSpacingPx: (v: number) => void;
  setBottomSpacingPx: (v: number) => void;
  setTopOffsetX: (v: number) => void;
  setTopOffsetY: (v: number) => void;
  setBottomOffsetX: (v: number) => void;
  setBottomOffsetY: (v: number) => void;
  setArcDegrees: (v: number) => void;
  setPistiOverlap: (v: number) => void;
  setPistiSpacingPx: (v: number) => void;
  setPistiArcDegrees: (v: number) => void;
}

// __DEV__-only live-tuning state (BatakDevTuningModal.tsx, PistiDevTuningModal.tsx) —
// session-only, no persistence. Overlap/spacing/arcDegrees all default to null ("untouched"), so
// opening the panel changes nothing visually until a control is actually touched.
export const useDevTuningStore = create<DevTuningState>((set) => ({
  tableBackground: 'frame',
  pistiTableBackground: 'frameOnly',
  tableSurfaceMaterial: 'greenFelt',
  topOverlap: null,
  bottomOverlap: null,
  topSpacingPx: null,
  bottomSpacingPx: null,
  topOffsetX: null,
  topOffsetY: null,
  bottomOffsetX: null,
  bottomOffsetY: null,
  arcDegrees: null,
  pistiOverlap: null,
  pistiSpacingPx: null,
  pistiArcDegrees: null,
  setTableBackground: (tableBackground) => set({ tableBackground }),
  setPistiTableBackground: (pistiTableBackground) => set({ pistiTableBackground }),
  setTableSurfaceMaterial: (tableSurfaceMaterial) => set({ tableSurfaceMaterial }),
  setTopOverlap: (topOverlap) => set({ topOverlap }),
  setBottomOverlap: (bottomOverlap) => set({ bottomOverlap }),
  setTopSpacingPx: (topSpacingPx) => set({ topSpacingPx }),
  setBottomSpacingPx: (bottomSpacingPx) => set({ bottomSpacingPx }),
  setTopOffsetX: (topOffsetX) => set({ topOffsetX }),
  setTopOffsetY: (topOffsetY) => set({ topOffsetY }),
  setBottomOffsetX: (bottomOffsetX) => set({ bottomOffsetX }),
  setBottomOffsetY: (bottomOffsetY) => set({ bottomOffsetY }),
  setArcDegrees: (arcDegrees) => set({ arcDegrees }),
  setPistiOverlap: (pistiOverlap) => set({ pistiOverlap }),
  setPistiSpacingPx: (pistiSpacingPx) => set({ pistiSpacingPx }),
  setPistiArcDegrees: (pistiArcDegrees) => set({ pistiArcDegrees }),
}));
