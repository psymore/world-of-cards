import type { Card } from '@world-cards/engine';

export type DemoId =
  | 'fan-layout'
  | 'selection'
  | 'play-travel'
  | 'landing'
  | 'transform'
  | 'hand-reposition'
  | 'complete-sequence'
  | 'reanimated-hand-reposition'
  | 'batak-hand-tuning'
  | 'batak-trick-resize-tuning';

export const DEMO_ORDER: DemoId[] = [
  'fan-layout',
  'selection',
  'play-travel',
  'landing',
  'transform',
  'hand-reposition',
  'complete-sequence',
  'reanimated-hand-reposition',
  'batak-hand-tuning',
  'batak-trick-resize-tuning',
];

export const DEMO_LABELS: Record<DemoId, string> = {
  'fan-layout': 'Demo 1: Fan Layout',
  selection: 'Demo 2: Selection',
  'play-travel': 'Demo 3: Play Card',
  landing: 'Demo 4: Landing',
  transform: 'Demo 5: Transform',
  'hand-reposition': 'Demo 6: Hand Reposition',
  'complete-sequence': 'Demo 7: Complete Sequence',
  // Standalone Reanimated + Gesture Handler experiment, per
  // docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md — does not replace
  // Demo 6, which stays as today's Animated-based baseline.
  'reanimated-hand-reposition': 'Demo 8: Reanimated Reposition',
  // Tunes the real Batak hand-fan geometry (real PlayingCard, real two-row layout) against
  // Demo08's proven rail/angle model, before those values get hardcoded into production — see
  // docs/superpowers/specs/2026-07-30-batak-hand-fan-demo08-migration-design.md.
  'batak-hand-tuning': 'Demo 9: Batak Hand Tuning',
  // Tunes the real trick-center resize (scale + contentScale) against real PlayingCard art,
  // before those values get hardcoded into production — see
  // docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md.
  'batak-trick-resize-tuning': 'Demo 10: Batak Trick Resize',
};

// A single point in a card's animated life: position/rotation/scale, plus the
// corner/watermark glyph's own independent scale (used from Demo 05 onward). Every
// animated card property in this module is derived from exactly one pair of these
// keyframes interpolated against one progress value — see useCardMotion (Task 4).
export interface CardMotionKeyframe {
  x: number;
  y: number;
  rotateDeg: number;
  scale: number;
  glyphScale: number;
}

export function idleKeyframe(overrides: Partial<CardMotionKeyframe> = {}): CardMotionKeyframe {
  return { x: 0, y: 0, rotateDeg: 0, scale: 1, glyphScale: 1, ...overrides };
}

export interface DealSeatState {
  seat: number;
  hand: Card[];
}
