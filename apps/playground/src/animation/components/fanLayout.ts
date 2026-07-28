import { SIMPLE_CARD_WIDTH } from './SimpleCard';

export interface FanLayoutConfig {
  overlap: number; // 0..1 fraction of card width overlapped between neighbors
  arcDegrees: number; // total rotation sweep from leftmost to rightmost card
  maxRotationDeg: number; // hard clamp on any single card's rotation
  spacingPx: number; // base per-card horizontal step before overlap reduces it
}

export interface FanSlot {
  x: number;
  y: number;
  rotateDeg: number;
}

function fanStep(config: FanLayoutConfig): number {
  return config.spacingPx * (1 - config.overlap);
}

function clampedRotationDeg(index: number, count: number, config: FanLayoutConfig): number {
  const t = count > 1 ? (index / (count - 1)) * 2 - 1 : 0;
  const raw = t * (config.arcDegrees / 2);
  return Math.max(-config.maxRotationDeg, Math.min(config.maxRotationDeg, raw));
}

// Optional per-side arc/rotation weighting — used only by Demo 06 (hand reflow after
// a card is removed) to make the remaining cards' reflow reflect how many of them
// were originally left/right of the played card, instead of every recompute treating
// the shrunken hand as a fresh, symmetric fan from scratch. Omitted (or leftWeight
// left undefined) reproduces the plain symmetric behavior every other demo uses —
// Demo 01 never passes this, so it's completely unaffected.
export interface AsymmetryOptions {
  // Fraction of the total arcDegrees allocated to the left side (0..1). 0.5 means
  // symmetric.
  leftWeight?: number;
}

// Walks the whole hand as a chain of fixed-length steps, each pointed in the direction
// its own rotation implies (a "tangent walk"), instead of computing each card's x and y
// independently. The previous approach (x = index * step, y = f(|rotation|) alone) let
// the two axes drift apart as spacing grew — a bigger step widened x with no matching
// change to y, exposing the outward top corner of the outer cards once the horizontal
// gap outgrew the fixed vertical compensation ("Fan Layout Arc Refinement" bug report).
// Deriving both x and y from the same (step, rotation) pair for every card makes that
// impossible: at any spacing, count, or rotation clamp, each card sits exactly where
// its own rotation says the previous card's edge should continue. Verified numerically
// against the reported bug (zero measurable seam at wide spacing / large hand counts,
// vs. several pixels of exposed corner before this fix).
function computeFanSlots(count: number, config: FanLayoutConfig, asym?: AsymmetryOptions): FanSlot[] {
  const step = fanStep(config);
  const rotations: number[] = [];

  if (!asym || asym.leftWeight === undefined) {
    for (let i = 0; i < count; i++) rotations.push(clampedRotationDeg(i, count, config));
  } else {
    const leftWeight = Math.max(0, Math.min(1, asym.leftWeight));
    const totalArc = config.arcDegrees;
    const leftArc = totalArc * leftWeight;
    const rightArc = totalArc - leftArc;
    const leftShare = totalArc > 0 ? leftArc / totalArc : 0.5;
    const rightShare = totalArc > 0 ? rightArc / totalArc : 0.5;

    // Blend the per-side arc share smoothly across a window straddling the center
    // card (t=0) instead of hard-switching sides there. A hard switch matches
    // rotation VALUE at the center (both sides evaluate to 0) but not its SLOPE
    // (leftArc/2 vs rightArc/2 per unit t, whenever leftArc != rightArc) — a genuine
    // derivative discontinuity, not a rendering artifact, that the tangent-walk
    // below then bakes straight into the y curve as a visible kink. smoothstep is
    // flat (zero-derivative) at both ends of the blend window, so blending the side
    // SHARE through it keeps the whole rotation(t) function continuously
    // differentiable (C1) everywhere — center, window edges, in between — with no
    // branch and no seam. Endpoints are unchanged: at t=-1/+1 the blend is fully
    // saturated to leftShare/rightShare, so rotation(-1) = -leftArc/2 and
    // rotation(1) = +rightArc/2 exactly — each side's rotation range is still half
    // its own allocated arc, same "2:1 ratio per side" the symmetric case has.
    const BLEND_HALF_WIDTH = 0.3; // in normalized t (-1..1)
    const smoothstep01 = (x: number) => {
      const u = Math.max(0, Math.min(1, x));
      return u * u * (3 - 2 * u);
    };

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
      const base = t * (totalArc / 2);
      const blend = smoothstep01((t + BLEND_HALF_WIDTH) / (2 * BLEND_HALF_WIDTH));
      const sideShare = leftShare * (1 - blend) + rightShare * blend;
      const raw = base * sideShare;
      // Same hard per-card clamp the symmetric branch applies.
      rotations.push(Math.max(-config.maxRotationDeg, Math.min(config.maxRotationDeg, raw)));
    }
  }

  const xs = [0];
  const ys = [0];
  for (let i = 1; i < count; i++) {
    const avgRad = ((rotations[i - 1] + rotations[i]) / 2) * (Math.PI / 180);
    xs.push(xs[i - 1] + step * Math.cos(avgRad));
    ys.push(ys[i - 1] + step * Math.sin(avgRad));
  }
  // Re-baseline so the highest point (smallest y — least "top" offset) sits at 0,
  // matching the pre-existing "center card highest, ends droop" convention.
  const minY = Math.min(...ys);
  return rotations.map((rotateDeg, i) => ({ x: xs[i], y: ys[i] - minY, rotateDeg }));
}

// Pure function: a card's slot depends only on its index, the hand's total count, and
// these 4 config values — no taps, no animation, no external state. Reused unchanged by
// Hand (Demo 01) and every later demo's hand rendering. Recomputes the whole hand's
// slots internally (cheap: hands here max out at 13 cards) rather than changing this
// function's signature, since every existing call site already asks for one card at a
// time — see computeFanSlots above for why a single card's slot can't be computed in
// isolation anymore.
export function computeFanSlot(
  index: number,
  count: number,
  config: FanLayoutConfig,
  asym?: AsymmetryOptions,
): FanSlot {
  return computeFanSlots(count, config, asym)[index];
}

export function computeFanWidth(count: number, config: FanLayoutConfig): number {
  const step = fanStep(config);
  return count > 0 ? (count - 1) * step + SIMPLE_CARD_WIDTH : SIMPLE_CARD_WIDTH;
}
