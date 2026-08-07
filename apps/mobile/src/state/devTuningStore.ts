import { create } from 'zustand';
import { STANDARD_RAIL_CONFIG } from '../games/batak/table/batakRailFan';

export type DevTableBackground = 'felt' | 'gemini';

export interface DevTuningState {
  tableBackground: DevTableBackground;
  topOverlap: number;
  bottomOverlap: number;
  topSpacingPx: number;
  bottomSpacingPx: number;
  setTableBackground: (v: DevTableBackground) => void;
  setTopOverlap: (v: number) => void;
  setBottomOverlap: (v: number) => void;
  setTopSpacingPx: (v: number) => void;
  setBottomSpacingPx: (v: number) => void;
}

// __DEV__-only live-tuning state (BatakDevTuningModal.tsx) — session-only, no persistence.
// Overlap/spacing all default to STANDARD_RAIL_CONFIG's current production values, so opening the
// panel changes nothing visually until a control is actually touched.
export const useDevTuningStore = create<DevTuningState>((set) => ({
  tableBackground: 'felt',
  topOverlap: STANDARD_RAIL_CONFIG.overlap,
  bottomOverlap: STANDARD_RAIL_CONFIG.overlap,
  topSpacingPx: STANDARD_RAIL_CONFIG.spacingPx,
  bottomSpacingPx: STANDARD_RAIL_CONFIG.spacingPx,
  setTableBackground: (tableBackground) => set({ tableBackground }),
  setTopOverlap: (topOverlap) => set({ topOverlap }),
  setBottomOverlap: (bottomOverlap) => set({ bottomOverlap }),
  setTopSpacingPx: (topSpacingPx) => set({ topSpacingPx }),
  setBottomSpacingPx: (bottomSpacingPx) => set({ bottomSpacingPx }),
}));
