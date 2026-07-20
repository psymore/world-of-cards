// Generic "filter this game's opponent seats down to the ones at `position`, render each" wrapper
// — shared by every game's table. Previously PistiTable.tsx and BatakTable.tsx each declared a
// byte-identical version of this filter+map, plus duplicated the `middleRow`/`opponentAreaSide`
// layout styles it's used alongside. Each game still supplies its own per-seat content via
// `renderSeat` (Batak: badge only; Pişti: badge + face-down card stack), since that part is
// genuinely game-specific.
import React from 'react';
import { StyleSheet } from 'react-native';
import type { Seat, SeatPosition } from './seating';

export interface OpponentSeatGroupProps<S extends Seat> {
  position: SeatPosition;
  seats: S[];
  renderSeat: (seat: S) => React.ReactNode;
}

export function OpponentSeatGroup<S extends Seat>({ position, seats, renderSeat }: OpponentSeatGroupProps<S>) {
  return (
    <>
      {seats
        .filter((seat) => seat.position === position)
        .map((seat) => (
          <React.Fragment key={seat.playerId}>{renderSeat(seat)}</React.Fragment>
        ))}
    </>
  );
}

// `opponentArea` (the top/side seat's own wrapping box) is deliberately NOT shared here — Batak's
// and Pişti's differ (Pişti's still shows a face-down card stack beneath the badge and needs more
// height; Batak's is badge-only), so each game keeps its own. `opponentAreaSide` and `middleRow`
// are identical across both today.
export const seatLayoutStyles = StyleSheet.create({
  opponentAreaSide: { minHeight: 0, width: 96, paddingVertical: 4 },
  // zIndex only orders direct siblings sharing a parent (here: the top opponent group, this row,
  // and the hand area, all children of the table's root container) — it does not let a deeply
  // nested descendant "escape" and outrank an entirely different sibling subtree on its own.
  // Without this, a card-travel animation's own zIndex (scoped to its own trick/pile siblings)
  // has no effect on whether it paints above or below the hand area's cards whenever the travel
  // path visually overlaps the hand (both games hit this once cards started traveling from their
  // real hand position instead of a fixed offset).
  middleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
});
