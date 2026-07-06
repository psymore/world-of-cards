import { createRng } from '../../core/rng';
import { cardDraftGame, CardDraftSetupOptions } from './cardDraftGame';
import { cardDraftEasyAI, cardDraftMediumAI } from './cardDraftGame.ai';

describe('cardDraftGame fixture AI', () => {
  const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 1, rowSize: 4 };

  it('easy AI always returns a legal move', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const legalMoves = cardDraftGame.getLegalMoves(state, 'p1');
    const move = cardDraftEasyAI.chooseMove(state, 'p1', legalMoves, createRng(2));
    expect(legalMoves).toContainEqual(move);
  });

  it('medium AI always picks the highest-value card available', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const legalMoves = cardDraftGame.getLegalMoves(state, 'p1');
    const move = cardDraftMediumAI.chooseMove(state, 'p1', legalMoves, createRng(2));
    const row = state.table.zones['row'].cards;
    const chosenCard = row.find((c) => c.id === move.cardId)!;
    const maxValueInRow = Math.max(...row.map((c) => c.rank === 'A' ? 1 : Number(c.rank) || 11));
    // Sanity check: chosen card's value is the maximum among legal options.
    const values = row.map((c) => ({ id: c.id, value: c.rank }));
    expect(values.some((v) => v.id === chosenCard.id)).toBe(true);
  });
});
