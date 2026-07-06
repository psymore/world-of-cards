import { createRng } from '../../core/rng';
import { cardDraftGame, CardDraftSetupOptions } from './cardDraftGame';

describe('cardDraftGame (rule engine fixture)', () => {
  const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 1, rowSize: 4 };

  it('deals rowSize cards face up into the row on setup', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    expect(state.table.zones['row'].cards).toHaveLength(4);
    expect(state.table.zones['hand-p1'].cards).toHaveLength(0);
    expect(state.status).toBe('in-progress');
  });

  it('only allows the current player to move', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const cardId = state.table.zones['row'].cards[0].id;
    expect(cardDraftGame.validateMove(state, { type: 'pick', cardId }, 'p2')).toBe(false);
    expect(cardDraftGame.validateMove(state, { type: 'pick', cardId }, 'p1')).toBe(true);
  });

  it('returns one legal move per card in the row', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    expect(cardDraftGame.getLegalMoves(state, 'p1')).toHaveLength(4);
  });

  it('moves the picked card into the current player hand and advances the turn', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const cardId = state.table.zones['row'].cards[0].id;
    const next = cardDraftGame.performMove(state, { type: 'pick', cardId });
    expect(next.table.zones['hand-p1'].cards.map((c) => c.id)).toContain(cardId);
    expect(next.table.zones['row'].cards.map((c) => c.id)).not.toContain(cardId);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('ends the game once the row is empty and declares the higher-value hand the winner', () => {
    let state = cardDraftGame.setup(setupOptions, createRng(1));
    while (!cardDraftGame.gameOver(state)) {
      const playerId = state.players[state.currentPlayerIndex];
      const [move] = cardDraftGame.getLegalMoves(state, playerId);
      state = cardDraftGame.performMove(state, move);
    }
    const score = cardDraftGame.calculateScore(state);
    const winners = cardDraftGame.determineWinner(state);
    expect(winners).not.toBeNull();
    const maxScore = Math.max(score['p1'], score['p2']);
    expect(winners).toEqual(state.players.filter((p) => score[p] === maxScore));
  });
});
