import type { Card } from '@world-cards/engine';

export type DemoId =
  | 'fan-layout'
  | 'selection'
  | 'play-travel'
  | 'landing'
  | 'transform'
  | 'hand-reposition'
  | 'complete-sequence';

export const DEMO_ORDER: DemoId[] = [
  'fan-layout',
  'selection',
  'play-travel',
  'landing',
  'transform',
  'hand-reposition',
  'complete-sequence',
];

export const DEMO_LABELS: Record<DemoId, string> = {
  'fan-layout': 'Demo 1: Fan Layout',
  selection: 'Demo 2: Selection',
  'play-travel': 'Demo 3: Play Card',
  landing: 'Demo 4: Landing',
  transform: 'Demo 5: Transform',
  'hand-reposition': 'Demo 6: Hand Reposition',
  'complete-sequence': 'Demo 7: Complete Sequence',
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
