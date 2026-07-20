import { createRng } from '../../../core/rng';
import { createTable, createZone, TableState } from '../../../core/table';
import { Card, Suit } from '../../../core/types';
import { batakGame } from '../rules';
import { BatakState } from '../types';
import { batakMediumAI } from './medium';

const card = (id: string, rank: Card['rank'], suit: Suit): Card => ({ id, suit, rank });

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function makeState(overrides: Partial<BatakState> & { table: TableState }): BatakState {
  return {
    gameId: 'batak',
    players: PLAYERS,
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    phase: 'playing',
    bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
    highestBid: 5,
    contract: 5,
    bidWinner: 'p1',
    trumpSuit: 'spades',
    trumpBroken: false,
    currentTrick: [],
    trickLeader: 'p1',
    tricksWon: { p1: 0, p2: 0, p3: 0, p4: 0 },
    kittyCardIds: null,
    ...overrides,
  };
}

describe('batakMediumAI', () => {
  it('wins the trick as cheaply as possible, not with the strongest available card', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('high', 'K', 'hearts'),
        card('low', '10', 'hearts'),
        card('offsuit', '5', 'clubs'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true, [card('led', '9', 'hearts')]),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move).toEqual({ type: 'play', cardId: 'low' });
  });

  it('dumps the lowest legal card when no legal card would currently win', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('c1', '2', 'clubs'), card('c2', '5', 'diamonds')]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true, [card('led', 'K', 'spades')]),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move).toEqual({ type: 'play', cardId: 'c1' });
  });

  it('discards a valid bury during kitty-exchange for a 3-player gömmeli game, preferring non-trump cards', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('nt1', '2', 'hearts'),
        card('nt2', '5', 'diamonds'),
        card('nt3', '9', 'clubs'),
        card('nt4', 'K', 'clubs'),
        card('trump1', '3', 'spades'),
        card('trump2', 'A', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['nt1', 'nt2', 'nt3', 'nt4'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.slice().sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt4'].sort());
    }
  });

  it('uses the 3-player gömmeli bid floor of 8 instead of the 4-player floor of 5', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('s1', 'A', 'spades'),
        card('s2', 'K', 'spades'),
        card('s3', 'Q', 'spades'),
        card('s4', 'J', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'bidding',
      bids: { p1: null, p2: null, p3: null },
      highestBid: 0,
      contract: null,
      bidWinner: null,
      trumpSuit: null,
      tricksWon: { p1: 0, p2: 0, p3: 0 },
    });
    // Same hand as the "estimatedTricks=7" case: clears the 4-player floor of 5 but not the
    // 3-player gömmeli floor of 8.
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move).toEqual({ type: 'pass' });
    expect(legalMoves).toContainEqual(move);
  });
});
