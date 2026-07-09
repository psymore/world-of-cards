import { createRng } from '../../../core/rng';
import { createTable, createZone } from '../../../core/table';
import { Card } from '../../../core/types';
import { pistiGame } from '../rules';
import { PistiState } from '../types';
import { pistiMediumAI } from './medium';

const card = (id: string, rank: Card['rank'], suit: Card['suit'] = 'hearts'): Card => ({ id, suit, rank });

function makeState(table: PistiState['table']): PistiState {
  return {
    gameId: 'pisti',
    players: ['p1', 'p2'],
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    lastCapturedBy: null,
    pistiBonusPoints: { p1: 0, p2: 0 },
    teams: null,
    table,
  };
}

describe('pistiMediumAI', () => {
  it('picks the move that captures over one that does not', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '7', 'clubs')]),
      createZone('hand-p1', true, [card('capture', '7', 'spades'), card('nocapture', '3')]),
      createZone('hand-p2', true, [card('h2', '5')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState(table);
    const legalMoves = pistiGame.getLegalMoves(state, 'p1');
    const move = pistiMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move.cardId).toBe('capture');
  });
});
