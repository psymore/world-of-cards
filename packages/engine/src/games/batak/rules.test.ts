import { createRng } from '../../core/rng';
import { createTable, createZone, TableState } from '../../core/table';
import { Card, Suit } from '../../core/types';
import { batakGame } from './rules';
import { BatakSetupOptions, BatakState } from './types';

const card = (id: string, rank: Card['rank'], suit: Suit = 'hearts'): Card => ({ id, suit, rank });

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function emptyTable(): TableState {
  return createTable([
    ...PLAYERS.map((p) => createZone(`hand-${p}`, true)),
    createZone('trick', true),
    ...PLAYERS.map((p) => createZone(`won-${p}`, true)),
  ]);
}

function makeState(overrides: Partial<BatakState> & { table: BatakState['table'] }): BatakState {
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

describe('batakGame (rule engine)', () => {
  const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };

  describe('setup', () => {
    it('deals 13 cards to each of the 4 hands', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      for (const p of PLAYERS) {
        expect(state.table.zones[`hand-${p}`].cards).toHaveLength(13);
      }
    });

    it('deals every card exactly once across all hands', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      const allIds = PLAYERS.flatMap((p) => state.table.zones[`hand-${p}`].cards.map((c) => c.id));
      expect(new Set(allIds).size).toBe(52);
    });

    it('initializes bidding-phase state and empty trick/won zones', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      expect(state.status).toBe('in-progress');
      expect(state.phase).toBe('bidding');
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.bids).toEqual({ p1: null, p2: null, p3: null, p4: null });
      expect(state.highestBid).toBe(0);
      expect(state.contract).toBeNull();
      expect(state.bidWinner).toBeNull();
      expect(state.trumpSuit).toBeNull();
      expect(state.trumpBroken).toBe(false);
      expect(state.currentTrick).toEqual([]);
      expect(state.trickLeader).toBeNull();
      expect(state.tricksWon).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
      expect(state.table.zones['trick'].cards).toEqual([]);
      expect(state.table.zones['won-p1'].cards).toEqual([]);
    });
  });

  describe('validateMove', () => {
    it('rejects a move from any player other than the current one', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      expect(batakGame.validateMove(state, { type: 'bid', amount: 5 }, 'p2')).toBe(false);
    });

    it('rejects any move once the game has finished', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      const finished = { ...state, status: 'finished' as const };
      expect(batakGame.validateMove(finished, { type: 'pass' }, 'p1')).toBe(false);
    });

    describe('during bidding', () => {
      it('accepts a bid at or above 5 and at most 13', () => {
        const state = batakGame.setup(setupOptions, createRng(1));
        expect(batakGame.validateMove(state, { type: 'bid', amount: 5 }, 'p1')).toBe(true);
        expect(batakGame.validateMove(state, { type: 'bid', amount: 13 }, 'p1')).toBe(true);
        expect(batakGame.validateMove(state, { type: 'bid', amount: 4 }, 'p1')).toBe(false);
        expect(batakGame.validateMove(state, { type: 'bid', amount: 14 }, 'p1')).toBe(false);
      });

      it('rejects a bid at or below the current highest bid', () => {
        const state = { ...batakGame.setup(setupOptions, createRng(1)), highestBid: 7 };
        expect(batakGame.validateMove(state, { type: 'bid', amount: 7 }, 'p1')).toBe(false);
        expect(batakGame.validateMove(state, { type: 'bid', amount: 8 }, 'p1')).toBe(true);
      });

      it('accepts pass, and rejects any move from a player who already passed', () => {
        const state = batakGame.setup(setupOptions, createRng(1));
        expect(batakGame.validateMove(state, { type: 'pass' }, 'p1')).toBe(true);
        const passed = { ...state, bids: { ...state.bids, p1: 'pass' as const } };
        expect(batakGame.validateMove(passed, { type: 'pass' }, 'p1')).toBe(false);
        expect(batakGame.validateMove(passed, { type: 'bid', amount: 6 }, 'p1')).toBe(false);
      });
    });

    describe('during trump selection', () => {
      it('allows the bid winner to select trump', () => {
        const state = {
          ...batakGame.setup(setupOptions, createRng(1)),
          phase: 'trump-selection' as const,
          bidWinner: 'p1',
          currentPlayerIndex: 0,
        };
        expect(batakGame.validateMove(state, { type: 'selectTrump', suit: 'hearts' }, 'p1')).toBe(true);
      });

      it('rejects selectTrump from a player other than the bid winner', () => {
        const state = {
          ...batakGame.setup(setupOptions, createRng(1)),
          phase: 'trump-selection' as const,
          bidWinner: 'p1',
          currentPlayerIndex: 1,
        };
        expect(batakGame.validateMove(state, { type: 'selectTrump', suit: 'hearts' }, 'p2')).toBe(false);
      });
    });
  });

  describe('getLegalMoves', () => {
    it('offers pass plus every bid from 5 up to 13, at the start of an auction', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      const moves = batakGame.getLegalMoves(state, 'p1');
      expect(moves).toContainEqual({ type: 'pass' });
      expect(moves).toContainEqual({ type: 'bid', amount: 5 });
      expect(moves).toContainEqual({ type: 'bid', amount: 13 });
      expect(moves).not.toContainEqual({ type: 'bid', amount: 4 });
      expect(moves).toHaveLength(1 + (13 - 5 + 1));
    });

    it('raises the minimum bid to one above the current highest', () => {
      const state = { ...batakGame.setup(setupOptions, createRng(1)), highestBid: 9 };
      const moves = batakGame.getLegalMoves(state, 'p1');
      expect(moves).toContainEqual({ type: 'bid', amount: 10 });
      expect(moves).not.toContainEqual({ type: 'bid', amount: 9 });
    });

    it('returns nothing for a player who already passed', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      const passed = { ...state, bids: { ...state.bids, p1: 'pass' as const } };
      expect(batakGame.getLegalMoves(passed, 'p1')).toEqual([]);
    });

    it('returns nothing for a player who is not current', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      expect(batakGame.getLegalMoves(state, 'p2')).toEqual([]);
    });

    it('offers one selectTrump move per suit, only to the bid winner, during trump selection', () => {
      const state = {
        ...batakGame.setup(setupOptions, createRng(1)),
        phase: 'trump-selection' as const,
        bidWinner: 'p1',
        currentPlayerIndex: 0,
      };
      const moves = batakGame.getLegalMoves(state, 'p1');
      expect(moves).toEqual([
        { type: 'selectTrump', suit: 'hearts' },
        { type: 'selectTrump', suit: 'diamonds' },
        { type: 'selectTrump', suit: 'clubs' },
        { type: 'selectTrump', suit: 'spades' },
      ]);
    });

    it('returns nothing during the finished phase', () => {
      const state = {
        ...batakGame.setup(setupOptions, createRng(1)),
        phase: 'finished' as const,
        status: 'finished' as const,
      };
      expect(batakGame.getLegalMoves(state, 'p1')).toEqual([]);
    });
  });

  describe('calculateScore', () => {
    it("scores the bid winner their actual tricks won when they meet or exceed the contract", () => {
      const state = makeState({
        table: emptyTable(),
        status: 'finished',
        contract: 5,
        bidWinner: 'p1',
        tricksWon: { p1: 7, p2: 2, p3: 2, p4: 2 },
      });
      expect(batakGame.calculateScore(state)['p1']).toBe(7);
    });

    it('scores the bid winner -contract when they fail to meet it', () => {
      const state = makeState({
        table: emptyTable(),
        status: 'finished',
        contract: 5,
        bidWinner: 'p1',
        tricksWon: { p1: 3, p2: 4, p3: 3, p4: 3 },
      });
      expect(batakGame.calculateScore(state)['p1']).toBe(-5);
    });

    it('scores the bid winner -contract when they take exactly zero tricks', () => {
      const state = makeState({
        table: emptyTable(),
        status: 'finished',
        contract: 5,
        bidWinner: 'p1',
        tricksWon: { p1: 0, p2: 5, p3: 4, p4: 4 },
      });
      expect(batakGame.calculateScore(state)['p1']).toBe(-5);
    });

    it('scores a non-bidder their actual tricks won when nonzero', () => {
      const state = makeState({
        table: emptyTable(),
        status: 'finished',
        contract: 5,
        bidWinner: 'p1',
        tricksWon: { p1: 5, p2: 3, p3: 3, p4: 2 },
      });
      expect(batakGame.calculateScore(state)['p2']).toBe(3);
    });

    it('scores a non-bidder -contract when they take zero tricks', () => {
      const state = makeState({
        table: emptyTable(),
        status: 'finished',
        contract: 6,
        bidWinner: 'p1',
        tricksWon: { p1: 6, p2: 0, p3: 4, p4: 3 },
      });
      expect(batakGame.calculateScore(state)['p2']).toBe(-6);
    });
  });

  describe('determineWinner', () => {
    it('returns null before the game is finished', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      expect(batakGame.determineWinner(state)).toBeNull();
    });

    it('returns the single higher-scoring player once finished', () => {
      const state = makeState({
        table: emptyTable(),
        status: 'finished',
        contract: 5,
        bidWinner: 'p1',
        tricksWon: { p1: 6, p2: 1, p3: 1, p4: 1 },
      });
      expect(batakGame.determineWinner(state)).toEqual(['p1']);
    });

    it('returns every tied player', () => {
      const state = makeState({
        table: emptyTable(),
        status: 'finished',
        contract: 5,
        bidWinner: 'p1',
        tricksWon: { p1: 5, p2: 5, p3: 1, p4: 2 },
      });
      expect(batakGame.determineWinner(state)).toEqual(['p1', 'p2']);
    });
  });

  describe('gameOver', () => {
    it('is false during play and true once finished', () => {
      const state = batakGame.setup(setupOptions, createRng(1));
      expect(batakGame.gameOver(state)).toBe(false);
      expect(batakGame.gameOver({ ...state, status: 'finished' as const })).toBe(true);
    });
  });
});
