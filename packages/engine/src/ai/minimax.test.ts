import { createRng } from '../core/rng';
import { cardDraftGame, CardDraftSetupOptions } from '../rules/__fixtures__/cardDraftGame';
import { minimaxChooseMove } from './minimax';

describe('minimaxChooseMove', () => {
  it('picks a legal move', () => {
    const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 1, rowSize: 4 };
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const legalMoves = cardDraftGame.getLegalMoves(state, 'p1');
    const move = minimaxChooseMove(state, 'p1', legalMoves, {
      ruleEngine: cardDraftGame,
      maximizingPlayer: 'p1',
      evaluate: (s) => {
        const score = cardDraftGame.calculateScore(s);
        return score['p1'] - score['p2'];
      },
      maxDepth: 4,
    });
    expect(legalMoves).toContainEqual(move);
  });
});
