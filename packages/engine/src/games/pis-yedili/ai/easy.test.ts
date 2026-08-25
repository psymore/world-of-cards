import { createRng } from '../../../core/rng';
import { pisYedeliGame } from '../rules';
import { PisYedeliSetupOptions } from '../types';
import { pisYedeliEasyAI } from './easy';

describe('pisYedeliEasyAI', () => {
  const setupOptions: PisYedeliSetupOptions = { players: ['p1', 'p2'] };

  it('always returns a legal move', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = pisYedeliGame.setup(setupOptions, createRng(seed));
      const legalMoves = pisYedeliGame.getLegalMoves(state, state.players[state.currentPlayerIndex]);
      const move = pisYedeliEasyAI.chooseMove(
        state,
        state.players[state.currentPlayerIndex],
        legalMoves,
        createRng(seed + 100)
      );
      expect(legalMoves).toContainEqual(move);
    }
  });
});
