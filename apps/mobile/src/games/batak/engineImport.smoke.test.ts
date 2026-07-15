import { batakDescriptor } from '@world-cards/engine/games/batak';
import type { BatakState, BatakMove } from '@world-cards/engine/games/batak';
import { createRng } from '@world-cards/engine';

describe('@world-cards/engine/games/batak subpath', () => {
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
});
