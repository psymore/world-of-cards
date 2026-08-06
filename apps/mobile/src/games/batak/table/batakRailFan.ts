export interface RailAngleConfig {
  radius: number;
  overlap: number;
  arcDegrees: number;
  maxRotationDeg: number;
  spacingPx: number;
}

// Tuned live against real PlayingCards and Batak's real two-row hand — see Task 1 of
// docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md (Demo09BatakHandTuning).
// Re-tuned again on-device after that session (2026-08-06) — STANDARD_RAIL_CONFIG confirmed,
// COMPACT_RAIL_CONFIG still being iterated on.
// radius lives on the config (not a single module constant) rather than each mode sharing one
// module-level value — still safe even where the two configs' radii currently coincide: a hand is
// always entirely one mode for its whole lifetime, so radius is still fixed for the duration of
// any single reflow, which is the actual invariant that matters (a reflow interpolates one card's
// angle along one fixed circle; it never needs to blend between two different circles mid-reflow).
export function railAngleStepDeg(
  config: RailAngleConfig,
  referenceRowSize: number,
): number {
  const stepPx = config.spacingPx * (1 - config.overlap);
  const stepDeg = (stepPx / config.radius) * (180 / Math.PI);
  const maxStepDeg =
    referenceRowSize > 1
      ? config.arcDegrees / (referenceRowSize - 1)
      : config.arcDegrees;
  return Math.min(stepDeg, maxStepDeg);
}

export function railAngles(
  count: number,
  angleStepDeg: number,
  maxRotationDeg: number,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const angles: number[] = [];
  for (let i = 0; i < count; i++) {
    const raw = (i - (count - 1) / 2) * angleStepDeg;
    angles.push(Math.max(-maxRotationDeg, Math.min(maxRotationDeg, raw)));
  }
  return angles;
}

export interface RailPosition {
  x: number;
  y: number;
  rotateDeg: number;
}

// extraRadius pushes a card straight out along its own angle (used for the select-lift) — never
// sideways along the rail.
export function railPosition(
  angleDeg: number,
  radius: number,
  extraRadius = 0,
): RailPosition {
  const rad = (angleDeg * Math.PI) / 180;
  const r = radius + extraRadius;
  return {
    x: r * Math.sin(rad),
    y: radius - r * Math.cos(rad),
    rotateDeg: angleDeg,
  };
}

// The two tuned configs from Task 1 — HumanHandFan.tsx (Task 5) selects between them via its
// existing `compact` prop.
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
