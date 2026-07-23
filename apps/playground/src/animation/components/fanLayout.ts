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

// Pure function: a card's position/rotation depends only on its index, the hand's
// total count, and these 4 config values — no taps, no animation, no external state.
// Reused unchanged by Hand (Demo 01) and every later demo's hand rendering.
export function computeFanSlot(index: number, count: number, config: FanLayoutConfig): FanSlot {
  const step = fanStep(config);
  const t = count > 1 ? (index / (count - 1)) * 2 - 1 : 0;
  const rawRotate = t * (config.arcDegrees / 2);
  const rotateDeg = Math.max(-config.maxRotationDeg, Math.min(config.maxRotationDeg, rawRotate));
  // Small vertical rise proportional to |rotation| so the fan reads as a curve rather
  // than cards merely rotating in place along a flat line.
  const y = Math.abs(rotateDeg) * 0.6;
  return { x: index * step, y, rotateDeg };
}

export function computeFanWidth(count: number, config: FanLayoutConfig): number {
  const step = fanStep(config);
  return count > 0 ? (count - 1) * step + SIMPLE_CARD_WIDTH : SIMPLE_CARD_WIDTH;
}
