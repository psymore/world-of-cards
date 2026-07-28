import { SIMPLE_CARD_WIDTH } from './SimpleCard';
import { FanLayoutConfig } from './fanLayout';

export interface RailSlot {
  angleDeg: number;
}

// One fixed radius for every rail-constrained fan, regardless of hand size or
// slider settings — see Demo06HandReposition.tsx's own comment for why this must
// never vary: a card's reposition is a straight interpolation of its OWN angle on
// this ONE circle. If the radius itself also changed between the old and new
// layout, a reflow would need to blend between two different circles instead of
// sliding along one, undoing the entire point of the rail model (per the user's
// rail-fan-layout.png reference — two concentric arcs a card's center rides along,
// rotation always tangent to it).
export const RAIL_RADIUS = 230;

// The per-card angular increment, derived from the Overlap/Spacing sliders at a
// REFERENCE hand size (not the current, possibly-reduced count) — so overlap ratio
// (arc-length between adjacent cards, at the fixed RAIL_RADIUS) stays constant
// regardless of how many cards remain: cards never crowd MORE tightly just because
// the hand got smaller. Capped so a reference-sized hand never exceeds the
// configured total arc span (arcDegrees) — the same "arcDegrees is a whole-fan
// ceiling, not a per-card value" role it already plays in fanLayout.ts.
export function railAngleStepDeg(config: FanLayoutConfig, referenceHandSize: number): number {
  const stepPx = config.spacingPx * (1 - config.overlap);
  const stepDeg = (stepPx / RAIL_RADIUS) * (180 / Math.PI);
  const maxStepDeg =
    referenceHandSize > 1 ? config.arcDegrees / (referenceHandSize - 1) : config.arcDegrees;
  return Math.min(stepDeg, maxStepDeg);
}

// Every card's angle on the rail for the CURRENT count, redistributing
// symmetrically around 0 as cards are added/removed — same "center highest, ends
// droop" fan shape fanLayout.ts's tangent walk produces, just parameterized by
// angle instead of a Cartesian step. maxRotationDeg still hard-clamps any single
// card's angle, exactly as it already does for the discrete model.
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

// Converts an angle (plus an optional extra radial distance — used for the
// perpendicular-to-rail select lift) into actual x/y/rotation — the only place
// sin/cos appears anywhere in this module. x is centered on 0 (the fan's own
// symmetric midline, angle 0); y follows the same "droops below the center card"
// convention fanLayout.ts already uses. Increasing extraRadius moves the card
// further from the pivot along its own angle — i.e. straight out from the rail,
// never sideways along it.
export function railPosition(angleDeg: number, extraRadius = 0): RailPosition {
  const rad = (angleDeg * Math.PI) / 180;
  const radius = RAIL_RADIUS + extraRadius;
  return {
    x: radius * Math.sin(rad),
    y: RAIL_RADIUS - radius * Math.cos(rad),
    rotateDeg: angleDeg,
  };
}

// Horizontal extent of the fan at rest — used only to size the hand's own fixed
// display envelope (so the ScrollView/container knows how wide to reserve), not
// for positioning individual cards (those are always centered on 0 already).
export function railFanWidth(count: number, angleStepDeg: number, maxRotationDeg: number): number {
  const angles = railAngles(count, angleStepDeg, maxRotationDeg);
  if (angles.length === 0) return SIMPLE_CARD_WIDTH;
  const xs = angles.map(a => railPosition(a).x);
  return Math.max(...xs) - Math.min(...xs) + SIMPLE_CARD_WIDTH;
}
