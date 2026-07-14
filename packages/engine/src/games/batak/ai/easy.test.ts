import { createRng } from '../../../core/rng';
import { createTable, createZone, TableState } from '../../../core/table';
import { Card, Suit } from '../../../core/types';
import { batakGame } from '../rules';
import { BatakSetupOptions, BatakState } from '../types';
import { batakEasyAI } from './easy';

const card = (id: string, rank: Card['rank'], suit: Suit = 'hearts'): Card => ({ id, suit, rank });

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function makeState(overrides: Partial<BatakState> & { table: TableState }): BatakState {
  const players = overrides.players ?? PLAYERS;
  return {
    gameId: 'batak',
    players,
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    phase: 'bidding',
    bids: Object.fromEntries(players.map((p) => [p, null])),
    highestBid: 0,
    contract: null,
    bidWinner: null,
    trumpSuit: null,
    trumpBroken: false,
    currentTrick: [],
    trickLeader: null,
    tricksWon: Object.fromEntries(players.map((p) => [p, 0])),
    ...overrides,
  };
}

describe('batakEasyAI', () => {
  it('always returns a legal move during bidding', () => {
    const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    for (let seed = 1; seed <= 5; seed++) {
      const state = batakGame.setup(setupOptions, createRng(seed));
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed + 100));
      expect(legalMoves).toContainEqual(move);
    }
  });

  it('always returns a legal move during trump selection', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('a', '5', 'clubs')]),
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
    for (let seed = 1; seed <= 5; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(legalMoves).toContainEqual(move);
    }
  });

  it('always returns a legal move during play', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('a', '5', 'clubs'), card('b', '9', 'hearts')]),
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
      phase: 'playing',
      bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 5,
      contract: 5,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      trickLeader: 'p1',
    });
    for (let seed = 1; seed <= 5; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(legalMoves).toContainEqual(move);
    }
  });
});
