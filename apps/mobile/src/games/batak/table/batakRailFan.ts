import type { RailAngleConfig } from '../../../table/railFan';

// Tuned live against real PlayingCards and Batak's real two-row hand — see Task 1 of
// docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md (Demo09BatakHandTuning).
// Re-tuned again on-device after that session (2026-08-06) — STANDARD_RAIL_CONFIG confirmed,
// COMPACT_RAIL_CONFIG still being iterated on.
// radius lives on the config (not a single module constant) rather than each mode sharing one
// module-level value — still safe even where the two configs' radii currently coincide: a hand is
// always entirely one mode for its whole lifetime, so radius is still fixed for the duration of
// any single reflow, which is the actual invariant that matters (a reflow interpolates one card's
// angle along one fixed circle; it never needs to blend between two different circles mid-reflow).
// `overlap` on these two configs is a row-agnostic fallback only — used by handCardRotationDeg
// (the played-card travel-origin rotation estimate, which doesn't distinguish top/bottom row) and
// as this file's own single-value default. The real per-row baseline HumanHandFan.tsx's
// configForRow actually renders is STANDARD_TOP_OVERLAP/STANDARD_BOTTOM_OVERLAP and
// COMPACT_TOP_OVERLAP/COMPACT_BOTTOM_OVERLAP below — keep both in sync if retuning by feel again.
export const STANDARD_RAIL_CONFIG: RailAngleConfig = {
  radius: 320,
  overlap: 0.62,
  arcDegrees: 60,
  maxRotationDeg: 45,
  spacingPx: 120,
};

export const COMPACT_RAIL_CONFIG: RailAngleConfig = {
  radius: 320,
  overlap: 0.5,
  arcDegrees: 90,
  maxRotationDeg: 45,
  spacingPx: 120,
};

// Per-row overlap baseline — top and bottom rows read one of these instead of
// STANDARD_RAIL_CONFIG.overlap/COMPACT_RAIL_CONFIG.overlap directly, so the two rows can (and now
// do) genuinely differ. Requested directly by the user (2026-08-07): gömmeli's compact hand reads
// denser/more overlapped than Standard's on both rows equally; Standard's own two rows read
// slightly different from each other (bottom a touch tighter than top).
export const STANDARD_TOP_OVERLAP = 0.6;
export const STANDARD_BOTTOM_OVERLAP = 0.66;
export const COMPACT_TOP_OVERLAP = 0.7;
export const COMPACT_BOTTOM_OVERLAP = 0.7;

// Per-row spacing/position baseline (2026-08-22), same "row can differ from row, mode can differ
// from mode" reasoning as the overlap constants above — tuned live via BatakDevTuningModal's Top/
// Bottom X/Y and spacing steppers, then promoted here as the real shipped default (previously
// these steppers only ever affected __DEV__ builds; see HumanHandFan.tsx's configForRow/
// applyDevOffset for where these now apply in every build). X stays 0 for every row — only spacing
// and Y were retuned.
export const STANDARD_TOP_SPACING = 124;
export const STANDARD_BOTTOM_SPACING = 120;
export const COMPACT_TOP_SPACING = 120;
export const COMPACT_BOTTOM_SPACING = 106;
export const STANDARD_TOP_OFFSET_Y = 30;
export const STANDARD_BOTTOM_OFFSET_Y = 20;
export const COMPACT_TOP_OFFSET_Y = 30;
export const COMPACT_BOTTOM_OFFSET_Y = 24;
