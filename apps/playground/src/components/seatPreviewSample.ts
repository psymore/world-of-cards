import type { TableSeatPosition, SeatIdentityTurnState } from '@world-cards/ui';

// Shared throwaway sample data for Playground's table-preview prototypes (TableShellPreview,
// MahoganyTablePreview) — not persisted state, not tied to any real game. 'female-01' on every
// seat is deliberate: it's the one avatar asset these prototypes exercise (avatar-female-01.png).
export const SEAT_SAMPLE = {
  top: { name: 'You', statusText: '0 tricks', avatar: 'female-01' },
  bottom: { name: 'South AI', statusText: '2 tricks', avatar: 'female-01' },
  left: { name: 'West AI', statusText: '1 tricks', avatar: 'female-01' },
  right: { name: 'East AI', statusText: '0 tricks', avatar: 'female-01' },
} as const;

// Clockwise seating order, used only to derive which seat is "next" after whichever one is
// active — matches TABLE-034's 3-state reference (active/next/idle), not any real game's turn
// rule (no game is wired to these prototype screens).
export const CLOCKWISE_ORDER: TableSeatPosition[] = ['top', 'right', 'bottom', 'left'];

// Cycle order for each preview's turn toggle — null (no seat active) included so the placeholder
// glow can be compared side-by-side against the fully-idle state.
export const ACTIVE_TURN_CYCLE: (TableSeatPosition | null)[] = ['top', 'right', 'bottom', 'left', null];

export function turnStateFor(
  position: TableSeatPosition,
  activeSeat: TableSeatPosition | null,
): SeatIdentityTurnState {
  if (position === activeSeat) return 'active';
  if (activeSeat != null) {
    const nextIndex = (CLOCKWISE_ORDER.indexOf(activeSeat) + 1) % CLOCKWISE_ORDER.length;
    if (position === CLOCKWISE_ORDER[nextIndex]) return 'next';
  }
  return 'idle';
}
