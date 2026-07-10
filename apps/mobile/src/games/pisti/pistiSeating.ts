// Pure geometry for seating opponents around the Pişti table and fanning/stacking their
// face-down hands. No React/RN dependency, so it's independently testable and doesn't need to
// sit next to rendering code in PistiTable.tsx.

export type SeatPosition = 'top' | 'left' | 'right';

export interface Seat {
  position: SeatPosition;
  playerId: string;
}

// Index into the AI id list (aiIds[0..2], see PistiScreen.buildAiIds) that sits directly across
// the table from the human in the 3-opponent (4-player) layout — i.e. the "top" seat. In "with a
// partner" mode this is therefore always the human's partner, since there's only one human and
// partner geometry is unambiguous. assignSeats (below) and PistiScreen's buildTeams must agree
// on this index; exporting it as a constant keeps that invariant in one place instead of two.
export const PARTNER_SEAT_INDEX = 1;

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
  const mid = (count - 1) / 2;
  return Math.pow(Math.abs(index - mid), 2) * OPPONENT_FAN_CURVE;
}

export const OPPONENT_CARD_OVERLAP = 14;

// Side seats (left/right, 4-player mode) stack their face-down cards vertically instead of
// fanning horizontally — a horizontal fan rotated 90° would keep its unrotated (wide) footprint
// reserved in the layout since RN transforms don't affect sizing, which risks overflowing a
// phone-width row. A vertical stack sidesteps that entirely.
export const SIDE_CARD_OVERLAP = 30;

// Precomputed per-index style for the side stack, mirroring PistiTable's PILE_CARD_OFFSETS
// pattern — a stable object reference per index (instead of a fresh `{marginTop: ...}` literal
// built inline on every render) means PlayingCard's React.memo can actually skip re-rendering
// unchanged face-down cards. Pişti hands never really approach this length; the ceiling is just
// a safety margin, not a real gameplay limit.
const MAX_SIDE_STACK_CARDS = 8;
export const SIDE_CARD_STYLES: ({ marginTop: number } | undefined)[] = Array.from(
  { length: MAX_SIDE_STACK_CARDS },
  (_, i) => (i > 0 ? { marginTop: -SIDE_CARD_OVERLAP } : undefined)
);

// The reveal-motion origin a played card travels in from: an opponent seat's position, or
// 'bottom' for the human (who isn't part of the Seat[] array — always rendered separately).
export type RevealOrigin = SeatPosition | 'bottom';

// Fixed direction-based travel offsets for the trick-reveal motion (see
// docs/superpowers/specs/2026-07-10-pisti-trick-reveal-motion-design.md). Deliberately not
// measured from real seat layout (no onLayout) — a fixed offset per direction reads clearly as
// "came from that side" without needing new layout-measurement plumbing.
const REVEAL_ORIGIN_OFFSETS: Record<RevealOrigin, { x: number; y: number }> = {
  top: { x: 0, y: -130 },
  bottom: { x: 0, y: 130 },
  left: { x: -110, y: 0 },
  right: { x: 110, y: 0 },
};

export function revealOriginOffset(origin: RevealOrigin): { x: number; y: number } {
  return REVEAL_ORIGIN_OFFSETS[origin];
}

// Resolves which direction a given play travels in from: the human is always 'bottom' (not part
// of `seats`); an AI seat not found in `seats` (shouldn't happen — every opponentPlayerId gets a
// seat) falls back to 'top', matching assignSeats' own single-opponent fallback.
export function resolveRevealOrigin(playerId: string, humanPlayerId: string, seats: Seat[]): RevealOrigin {
  if (playerId === humanPlayerId) return 'bottom';
  const seat = seats.find((s) => s.playerId === playerId);
  return seat ? seat.position : 'top';
}
