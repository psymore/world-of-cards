export interface RailAngleConfig {
  radius: number;
  overlap: number;
  arcDegrees: number;
  maxRotationDeg: number;
  spacingPx: number;
}

// Pure rail/angle geometry for a fixed-radius card fan: given a config and how many cards share
// the rail, compute each card's angle-step, then its (x, y, rotation) on that circle.
// Game-agnostic — originally Batak-only (batakRailFan.ts), promoted here once Pişti's hand needed
// the identical math with its own tuning — see
// docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §1. Batak's own
// STANDARD_RAIL_CONFIG/COMPACT_RAIL_CONFIG tuning stays in
// apps/mobile/src/games/batak/table/batakRailFan.ts; Pişti's own PISTI_RAIL_CONFIG lives in
// apps/mobile/src/games/pisti/table/pistiRailFan.ts — only the math itself is shared.
export function railAngleStepDeg(config: RailAngleConfig, referenceRowSize: number): number {
  const stepPx = config.spacingPx * (1 - config.overlap);
  const stepDeg = (stepPx / config.radius) * (180 / Math.PI);
  const maxStepDeg =
    referenceRowSize > 1 ? config.arcDegrees / (referenceRowSize - 1) : config.arcDegrees;
  return Math.min(stepDeg, maxStepDeg);
}

export function railAngles(count: number, angleStepDeg: number, maxRotationDeg: number): number[] {
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
export function railPosition(angleDeg: number, radius: number, extraRadius = 0): RailPosition {
  const rad = (angleDeg * Math.PI) / 180;
  const r = radius + extraRadius;
  return {
    x: r * Math.sin(rad),
    y: radius - r * Math.cos(rad),
    rotateDeg: angleDeg,
  };
}
