// Pişti-specific seating additions: the generic "3 opponents at left/top/right, human at
// bottom" layout and fan/stack math now live in ../../table/seating (shared with Batak) and are
// re-exported here so existing imports of './pistiSeating' keep working unchanged. Only the
// genuinely Pişti-specific pieces (team partner seat, trick-reveal travel origins) stay local.

export {
  assignSeats,
  fillWidthMarginPx,
} from '../../table/seating';
export type { Seat, SeatPosition } from '../../table/seating';

import type { SeatPosition, Seat } from '../../table/seating';

// Index into the AI id list (aiIds[0..2], see PistiScreen.buildAiIds) that sits directly across
// the table from the human in the 3-opponent (4-player) layout — i.e. the "top" seat. In "with a
// partner" mode this is therefore always the human's partner, since there's only one human and
// partner geometry is unambiguous. assignSeats (above) and PistiScreen's buildTeams must agree
// on this index; exporting it as a constant keeps that invariant in one place instead of two.
export const PARTNER_SEAT_INDEX = 1;

// The reveal-motion origin a played card travels in from: an opponent seat's position, or
// 'bottom' for the human (who isn't part of the Seat[] array — always rendered separately).
export type RevealOrigin = SeatPosition | 'bottom';

// Fixed direction-based travel offsets for the trick-reveal motion (see
// docs/superpowers/specs/2026-07-10-pisti-trick-reveal-motion-design.md). Deliberately not
// measured from real seat layout (no onLayout) — a fixed offset per direction reads clearly as
// "came from that side" without needing new layout-measurement plumbing.
const REVEAL_ORIGIN_OFFSETS: Record<RevealOrigin, { x: number; y: number }> = {
  top: { x: 0, y: -195 },
  bottom: { x: 0, y: 195 },
  left: { x: -165, y: 0 },
  right: { x: 165, y: 0 },
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
