import { createRng } from '../../../core/rng';
import { createTable, createZone, TableState } from '../../../core/table';
import { Card, Suit } from '../../../core/types';
import { batakGame } from '../rules';
import { BatakState } from '../types';
import { batakHardAI } from './hard';
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
    phase: 'bidding',
    bids: { p1: null, p2: null, p3: null, p4: null },
    highestBid: 0,
    contract: null,
    bidWinner: null,
    trumpSuit: null,
    trumpBroken: false,
    currentTrick: [],
    trickLeader: null,
    tricksWon: { p1: 0, p2: 0, p3: 0, p4: 0 },
    ...overrides,
  };
}

describe('batakHardAI', () => {
  it('bids the same as medium AI on the same hand, sharing the bid heuristic', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('s1', 'A', 'spades'),
        card('s2', 'K', 'spades'),
        card('s3', 'Q', 'spades'),
        card('s4', 'J', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(hardMove).toEqual(mediumMove);
    expect(hardMove).toEqual({ type: 'bid', amount: 7 });
  });

  it('selects the same trump suit as medium AI on the same hand, sharing the trump heuristic', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('h1', 'A', 'hearts'),
        card('h2', 'J', 'hearts'),
        card('s1', '2', 'spades'),
        card('s2', '3', 'spades'),
        card('s3', '4', 'spades'),
        card('s4', '5', 'spades'),
        card('s5', '6', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'trump-selection',
      bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 5,
      contract: 5,
      bidWinner: 'p1',
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(hardMove).toEqual(mediumMove);
    expect(hardMove).toEqual({ type: 'selectTrump', suit: 'spades' });
  });

  it('leads the card that wins the trick within its depth-4 search window, where a greedy one-ply heuristic leads low and loses it', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('low', '2', 'hearts'), card('trump', 'A', 'spades')]),
      createZone('hand-p2', true, [card('p2c', '9', 'hearts')]),
      createZone('hand-p3', true, [card('p3c', '8', 'diamonds')]),
      createZone('hand-p4', true, [card('p4c', '7', 'clubs')]),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'playing',
      bids: { p1: 1, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 1,
      contract: 1,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      trumpBroken: true,
      trickLeader: 'p1',
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    // Medium always leads its lowest legal card (nothing "currently wins" an empty trick by
    // definition) - here that loses the trick to p2's 9 of hearts. Hard's depth-4 search reads
    // out the whole trick (a full 4-ply lead-to-resolution window) and sees that leading the
    // spade Ace wins outright, since none of p2/p3/p4 hold any spades.
    expect(mediumMove).toEqual({ type: 'play', cardId: 'low' });
    expect(hardMove).toEqual({ type: 'play', cardId: 'trump' });
  });
});
