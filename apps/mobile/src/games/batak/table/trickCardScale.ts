// Tuned live against real PlayingCards — see Task 2 of
// docs/superpowers/plans/2026-08-05-batak-trick-resize.md (Demo10BatakTrickResize).
export const TRICK_CARD_SCALE = 0.75;
export const TRICK_CARD_CONTENT_SCALE = 0.91;

// First pass: the entire shrink happens during BatakHandCard's local-departure leg; by the time
// TravelCard takes over, a human-played card is already at TRICK_CARD_SCALE, and TravelCard
// holds it constant for the rest of the flight — no scale interpolation needed there for a human
// play (see TrickCenter.tsx's human-pending-play call site). Retune this toward 1 (spreading
// more of the shrink into TravelCard's own flight instead) if the ~200ms local-departure window
// reads as too abrupt once checked live — this exact split was flagged as unconfirmed during
// design (docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md §3), not settled.
export const LOCAL_DEPARTURE_SCALE = TRICK_CARD_SCALE;
