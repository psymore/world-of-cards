import { createRng } from '../../../core/rng';
import { createTable, createZone } from '../../../core/table';
import { Card } from '../../../core/types';
import { pisYedeliGame } from '../rules';
import { PisYedeliState, PisYedeliSetupOptions } from '../types';
import { pisYedeliMediumAI } from './medium';

const card = (id: string, rank: Card['rank'], suit: Card['suit'] = 'hearts'): Card => ({ id, suit, rank });

function makeState(overrides: Partial<PisYedeliState> & { table: PisYedeliState['table'] }): PisYedeliState {
  return {
    gameId: 'pis-yedili',
    players: ['p1', 'p2'],
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    activeSuit: null,
    pendingDraw: 0,
    ...overrides,
  };
}

describe('pisYedeliMediumAI', () => {
  it('prefers a play that shrinks the hand over drawing', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'clubs')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs' });
    const legalMoves = pisYedeliGame.getLegalMoves(state, 'p1');
    const move = pisYedeliMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move).toEqual({ type: 'play', cardId: 'h1' });
  });

  it('on a tie in resulting hand size, prefers dumping a seven over a plain card', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('c7', '7', 'hearts'), card('cPlain', '5', 'clubs')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs' });
    const legalMoves = pisYedeliGame.getLegalMoves(state, 'p1');
    const move = pisYedeliMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move).toEqual({ type: 'play', cardId: 'c7' });
  });

  it('always returns a legal move across many dealt hands', () => {
    const setupOptions: PisYedeliSetupOptions = { players: ['p1', 'p2'] };
    for (let seed = 1; seed <= 10; seed++) {
      const state = pisYedeliGame.setup(setupOptions, createRng(seed));
      const currentPlayer = state.players[state.currentPlayerIndex];
      const legalMoves = pisYedeliGame.getLegalMoves(state, currentPlayer);
      const move = pisYedeliMediumAI.chooseMove(state, currentPlayer, legalMoves, createRng(seed + 100));
      expect(legalMoves).toContainEqual(move);
    }
  });
});
