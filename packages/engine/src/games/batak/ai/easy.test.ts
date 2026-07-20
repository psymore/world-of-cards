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
    kittyCardIds: null,
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

  it('always passes during bidding, regardless of hand strength or the current highest bid', () => {
    const strongHand: Card[] = [
      card('a', 'A', 'spades'),
      card('b', 'K', 'spades'),
      card('c', 'Q', 'spades'),
      card('d', 'J', 'spades'),
    ];
    const table = createTable([
      createZone('hand-p1', true, strongHand),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    for (const highestBid of [0, 5, 8, 12]) {
      const state = makeState({ table, phase: 'bidding', highestBid });
      for (let seed = 1; seed <= 10; seed++) {
        const legalMoves = batakGame.getLegalMoves(state, 'p1');
        const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
        expect(move).toEqual({ type: 'pass' });
      }
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

  it('selects the length/honor-based trump suit deterministically, instead of a random suit', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('a', '2', 'hearts'),
        card('b', '3', 'hearts'),
        card('c', '4', 'hearts'),
        card('d', 'A', 'spades'),
        card('e', 'K', 'spades'),
        card('f', 'Q', 'spades'),
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
    for (let seed = 1; seed <= 20; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(move).toEqual({ type: 'selectTrump', suit: 'spades' });
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

  it('plays the lowest legal card, instead of a uniformly random one, even though a higher card is available', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('a', '5', 'clubs'),
        card('b', '9', 'clubs'),
        card('c', 'A', 'clubs'),
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
      phase: 'playing',
      bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 5,
      contract: 5,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      trickLeader: 'p1',
    });
    for (let seed = 1; seed <= 20; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(move).toEqual({ type: 'play', cardId: 'a' });
    }
  });

  it('discards a valid 4-card bury during kitty-exchange for a 3-player gömmeli game, preferring non-trump cards', () => {
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
    const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.slice().sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt4'].sort());
    }
  });
});
