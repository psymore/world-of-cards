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
