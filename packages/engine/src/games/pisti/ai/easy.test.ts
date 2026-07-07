import { createRng } from '../../../core/rng';
import { pistiGame } from '../rules';
import { PistiSetupOptions } from '../types';
import { pistiEasyAI } from './easy';

describe('pistiEasyAI', () => {
  const setupOptions: PistiSetupOptions = { players: ['p1', 'p2'] };

  it('always returns a legal move', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = pistiGame.setup(setupOptions, createRng(seed));
      const legalMoves = pistiGame.getLegalMoves(state, 'p1');
      const move = pistiEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed + 100));
      expect(legalMoves).toContainEqual(move);
    }
  });
});
