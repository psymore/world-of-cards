import { pistiDescriptor } from '@world-cards/engine/games/pisti';
import type { PistiState, PistiMove } from '@world-cards/engine/games/pisti';
import { createRng } from '@world-cards/engine';

describe('@world-cards/engine/games/pisti subpath', () => {
  it('resolves pistiDescriptor with a working rule engine', () => {
    const state: PistiState = pistiDescriptor.ruleEngine.setup(
      { players: ['human', 'ai'] },
      createRng(1)
    );
    expect(state.gameId).toBe('pisti');
    expect(state.table.zones['hand-human'].cards).toHaveLength(4);

    const legalMoves = pistiDescriptor.ruleEngine.getLegalMoves(state, 'human');
    expect(legalMoves.length).toBeGreaterThan(0);

    const move: PistiMove = legalMoves[0];
    const next = pistiDescriptor.ruleEngine.performMove(state, move);
    expect(next.currentPlayerIndex).toBe(1);
  });
});
