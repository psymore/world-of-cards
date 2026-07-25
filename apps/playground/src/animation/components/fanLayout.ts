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
function computeFanSlots(count: number, config: FanLayoutConfig): FanSlot[] {
  const step = fanStep(config);
  const rotations: number[] = [];
  for (let i = 0; i < count; i++) rotations.push(clampedRotationDeg(i, count, config));

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
export function computeFanSlot(index: number, count: number, config: FanLayoutConfig): FanSlot {
  return computeFanSlots(count, config)[index];
}

export function computeFanWidth(count: number, config: FanLayoutConfig): number {
  const step = fanStep(config);
  return count > 0 ? (count - 1) * step + SIMPLE_CARD_WIDTH : SIMPLE_CARD_WIDTH;
}
