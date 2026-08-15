// Game-agnostic "whose turn is it" classification shared by every game's own seat-rendering code
// (PistiTable.tsx's LegacyOpponentSeat, BatakTable.tsx's OpponentSeat) — both engines' states
// shape turn order identically (a `players` array + a round-robin `currentPlayerIndex`), so this
// one function covers both instead of each game re-deriving the same three lines. Mirrors
// PistiTable.tsx's own turnStateForPlayer (kept there, tested directly, and now implemented in
// terms of this) — see PlayerAvatar.tsx for what idle/active actually render as. Used to have a
// third 'next' state (whoever plays right after the current player); dropped as a turn indicator
// since a "coming up soon" ring read as more noise than signal next to the single active ring.
export type SeatTurnState = 'idle' | 'active';

export function turnStateForSeat(
  playerId: string,
  players: readonly string[],
  currentPlayerIndex: number,
): SeatTurnState {
  return players[currentPlayerIndex] === playerId ? 'active' : 'idle';
}
