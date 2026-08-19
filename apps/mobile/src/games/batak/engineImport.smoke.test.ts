import { batakDescriptor, trickWinnerIndex } from '@world-of-cards/engine/games/batak';
import type { BatakState, BatakMove } from '@world-of-cards/engine/games/batak';
import { createRng } from '@world-of-cards/engine';
import type { Card } from '@world-of-cards/engine';

describe('@world-of-cards/engine/games/batak subpath', () => {
  it('resolves batakDescriptor with a working rule engine', () => {
    const state: BatakState = batakDescriptor.ruleEngine.setup(
      { players: ['human', 'ai-1', 'ai-2', 'ai-3'] },
      createRng(1)
    );
    expect(state.gameId).toBe('batak');
    expect(state.table.zones['hand-human'].cards).toHaveLength(13);

    const legalMoves = batakDescriptor.ruleEngine.getLegalMoves(state, 'human');
    expect(legalMoves.length).toBeGreaterThan(0);

    const move: BatakMove = legalMoves[0];
    const next = batakDescriptor.ruleEngine.performMove(state, move);
    // players[0] is 'human'; a pass move advances to the next active bidder, 'ai-1' (index 1).
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('exposes trickWinnerIndex from the public subpath', () => {
    const trick: Card[] = [
      { id: 'c1', suit: 'hearts', rank: '2' },
      { id: 'c2', suit: 'hearts', rank: 'K' },
      { id: 'c3', suit: 'spades', rank: '3' },
      { id: 'c4', suit: 'hearts', rank: 'A' },
    ];
    // Only c3 is trump (spades); trumps always beat non-trumps regardless of rank, so it wins
    // even though c4 (Ace of hearts) is the highest-ranked card overall.
    expect(trickWinnerIndex(trick, 'spades')).toBe(2);
  });
});
