// Pure geometry for seating opponents around a 4-player table and fanning/stacking their
// face-down hands. No React/RN dependency, shared by every game whose table needs the same
// "3 opponents at left/top/right, human at bottom" layout (first shared use: Pişti's 4-player
// free-for-all mode; second: Batak, which is fixed 4-player).

export type SeatPosition = 'top' | 'left' | 'right';

export interface Seat {
  position: SeatPosition;
  playerId: string;
}

// 1 opponent sits across the table (top); 3 sit left/top/right around the human, who is
// always at the bottom. Turn order (state.players, human first) proceeds counter-clockwise —
// bottom → right → top → left → bottom — so the first opponent in turn order sits on the
// right, not the left. Any other count falls back to seating everyone across the top.
export function assignSeats(opponentPlayerIds: string[]): Seat[] {
  if (opponentPlayerIds.length === 3) {
    const [right, top, left] = opponentPlayerIds;
    return [
      { position: 'left', playerId: left },
      { position: 'top', playerId: top },
      { position: 'right', playerId: right },
    ];
  }
  return opponentPlayerIds.map((playerId) => ({ position: 'top' as const, playerId }));
}

const OPPONENT_FAN_DEGREES_PER_STEP = 8;
const OPPONENT_FAN_CURVE = 3;

export function fanRotationDeg(index: number, count: number): number {
  if (count <= 1) return 0;
  const mid = (count - 1) / 2;
  return (index - mid) * OPPONENT_FAN_DEGREES_PER_STEP;
}

// Cards further from the center card droop down slightly, like a fan held from below and
// spread facing the viewer, rather than sitting on a flat line.
export function fanCurveY(index: number, count: number): number {
  if (count <= 1) return 0;
  return Math.pow(Math.abs(index - (count - 1) / 2), 2) * OPPONENT_FAN_CURVE;
}

export const OPPONENT_CARD_OVERLAP = 21;

// Side seats (left/right, 4-player mode) stack their face-down cards vertically instead of
// fanning horizontally — a horizontal fan rotated 90° would keep its unrotated (wide) footprint
// reserved in the layout since RN transforms don't affect sizing, which risks overflowing a
// phone-width row. A vertical stack sidesteps that entirely.
export const SIDE_CARD_OVERLAP = 45;

// Precomputed per-index style for the side stack — a stable object reference per index (instead
// of a fresh `{marginTop: ...}` literal built inline on every render) means PlayingCard's
// React.memo can actually skip re-rendering unchanged face-down cards. Sized to 13 (not Pişti's
// original 8) because Batak hands start at 13 cards, not Pişti's capped-at-4 — a shared ceiling
// has to cover the largest real hand size across every consumer, not just the first one.
const MAX_SIDE_STACK_CARDS = 13;
export const SIDE_CARD_STYLES: ({ marginTop: number } | undefined)[] = Array.from(
  { length: MAX_SIDE_STACK_CARDS },
  (_, i) => (i > 0 ? { marginTop: -SIDE_CARD_OVERLAP } : undefined)
);
