import type { Card } from '@world-cards/engine';

export interface PendingBatakPlay {
  playerId: string;
  card: Card;
  originOffset?: { x: number; y: number };
  // The card's rotation (degrees) in its hand slot at the moment it was played — only ever set
  // for the human's own play (opponents have no rendered per-card hand visual to depart from).
  // Threaded into TravelCard's originRotateDeg so the card eases from its real fan angle down to
  // flat instead of snapping to 0deg the instant it starts moving. See
  // docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
  originRotateDeg?: number;
}

// All 4 plays of a just-completed trick, captured before performMove commits (which resolves
// the trick atomically — winner computed and cards swept to won-<winner> within one call), so
// TrickCenter has a stable snapshot to animate away from while engine state is still mid-trick.
export interface GatheringTrick {
  entries: { playerId: string; card: Card }[];
  winnerId: string;
}
