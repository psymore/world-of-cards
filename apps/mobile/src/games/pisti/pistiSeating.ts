// Pişti-specific seating additions: the generic "3 opponents at left/top/right, human at
// bottom" layout, fan/stack math, and directional travel-offset geometry now live in
// ../../table/seating (shared with Batak) and are re-exported here so existing imports of
// './pistiSeating' keep working unchanged. Only the genuinely Pişti-specific piece (team partner
// seat) stays local.

export {
  assignSeats,
  fillWidthMarginPx,
  revealOriginOffset,
  resolveRevealOrigin,
} from '../../table/seating';
export type { Seat, SeatPosition, RevealOrigin } from '../../table/seating';

// Index into the AI id list (aiIds[0..2], see PistiScreen.buildAiIds) that sits directly across
// the table from the human in the 3-opponent (4-player) layout — i.e. the "top" seat. In "with a
// partner" mode this is therefore always the human's partner, since there's only one human and
// partner geometry is unambiguous. assignSeats (above) and PistiScreen's buildTeams must agree
// on this index; exporting it as a constant keeps that invariant in one place instead of two.
export const PARTNER_SEAT_INDEX = 1;
