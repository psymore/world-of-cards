import type { RailAngleConfig } from '../../../table/railFan';

// Pişti's hand never exceeds 4 cards (dealt 4 max) — a single config, no compact/two-row variant
// (unlike Batak's STANDARD_RAIL_CONFIG/COMPACT_RAIL_CONFIG). radius/spacingPx match Batak's
// STANDARD_RAIL_CONFIG (same physical card size, so the same circle/spacing reads consistently);
// arcDegrees/maxRotationDeg are much smaller than Batak's 60°/45°, which is tuned for up to 13
// fanned cards — the same arc across Pişti's 4-card hand would look absurdly splayed. A picked
// starting point (no dedicated Playground tuning tool this round, per explicit decision) — adjust
// live once running. See docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-
// design.md §2.
export const PISTI_RAIL_CONFIG: RailAngleConfig = {
  radius: 320,
  overlap: 0.5,
  arcDegrees: 36,
  maxRotationDeg: 20,
  spacingPx: 120,
};

// Pushed outward along a card's own rail angle when selected — between Pişti's old flat
// DEFAULT_LIFT_DISTANCE (16, SelectableCard.tsx, deleted in Task 5) and Batak's
// SELECTED_LIFT_DISTANCE (40) — Pişti's arc is much gentler than Batak's, so a smaller lift still
// reads clearly.
export const PISTI_SELECTED_LIFT_DISTANCE = 24;
