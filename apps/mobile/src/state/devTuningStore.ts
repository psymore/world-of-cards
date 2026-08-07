import { create } from 'zustand';

export type DevTableBackground = 'felt' | 'gemini';

export interface DevTuningState {
  tableBackground: DevTableBackground;
  // null means "not yet overridden by the panel" — HumanHandFan then falls back to whichever rail
  // config (Standard or Compact) is actually live for that hand, instead of a baked-in
  // Standard-shaped default that would silently corrupt Compact/gömmeli's baseline.
  topOverlap: number | null;
  bottomOverlap: number | null;
  topSpacingPx: number | null;
  bottomSpacingPx: number | null;
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
  setTopOverlap: (v: number) => void;
  setBottomOverlap: (v: number) => void;
  setTopSpacingPx: (v: number) => void;
  setBottomSpacingPx: (v: number) => void;
  setArcDegrees: (v: number) => void;
  setPistiOverlap: (v: number) => void;
  setPistiSpacingPx: (v: number) => void;
  setPistiArcDegrees: (v: number) => void;
}

// __DEV__-only live-tuning state (BatakDevTuningModal.tsx, PistiDevTuningModal.tsx) —
// session-only, no persistence. Overlap/spacing/arcDegrees all default to null ("untouched"), so
// opening the panel changes nothing visually until a control is actually touched.
export const useDevTuningStore = create<DevTuningState>((set) => ({
  tableBackground: 'felt',
  topOverlap: null,
  bottomOverlap: null,
  topSpacingPx: null,
  bottomSpacingPx: null,
  arcDegrees: null,
  pistiOverlap: null,
  pistiSpacingPx: null,
  pistiArcDegrees: null,
  setTableBackground: (tableBackground) => set({ tableBackground }),
  setTopOverlap: (topOverlap) => set({ topOverlap }),
  setBottomOverlap: (bottomOverlap) => set({ bottomOverlap }),
  setTopSpacingPx: (topSpacingPx) => set({ topSpacingPx }),
  setBottomSpacingPx: (bottomSpacingPx) => set({ bottomSpacingPx }),
  setArcDegrees: (arcDegrees) => set({ arcDegrees }),
  setPistiOverlap: (pistiOverlap) => set({ pistiOverlap }),
  setPistiSpacingPx: (pistiSpacingPx) => set({ pistiSpacingPx }),
  setPistiArcDegrees: (pistiArcDegrees) => set({ pistiArcDegrees }),
}));
