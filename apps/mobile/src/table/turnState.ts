// Game-agnostic "whose turn is it" classification shared by every game's own seat-rendering code
// (PistiTable.tsx's LegacyOpponentSeat, BatakTable.tsx's OpponentSeat) — both engines' states
// shape turn order identically (a `players` array + a round-robin `currentPlayerIndex`), so this
// one function covers both instead of each game re-deriving the same three lines. Mirrors
// PistiTable.tsx's own turnStateForPlayer (kept there, tested directly, and now implemented in
// terms of this) — see PlayerAvatar.tsx for what idle/next/active actually render as.
export type SeatTurnState = 'idle' | 'next' | 'active';

export function turnStateForSeat(
  playerId: string,
  players: readonly string[],
  currentPlayerIndex: number,
): SeatTurnState {
  if (players[currentPlayerIndex] === playerId) return 'active';
  const nextIndex = (currentPlayerIndex + 1) % players.length;
  if (players[nextIndex] === playerId) return 'next';
  return 'idle';
}
