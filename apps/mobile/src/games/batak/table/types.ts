import type { Card } from '@world-cards/engine';

export interface PendingBatakPlay {
  playerId: string;
  card: Card;
  originOffset?: { x: number; y: number };
}

// All 4 plays of a just-completed trick, captured before performMove commits (which resolves
// the trick atomically — winner computed and cards swept to won-<winner> within one call), so
// TrickCenter has a stable snapshot to animate away from while engine state is still mid-trick.
export interface GatheringTrick {
  entries: { playerId: string; card: Card }[];
  winnerId: string;
}
