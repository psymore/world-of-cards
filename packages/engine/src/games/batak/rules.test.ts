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

describe('batakGame performMove — bidding and trump selection', () => {
  const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };

  it('records a bid, updates highestBid, and advances to the next active player', () => {
    const state = batakGame.setup(setupOptions, createRng(1));
    const next = batakGame.performMove(state, { type: 'bid', amount: 5 });
    expect(next.bids['p1']).toBe(5);
    expect(next.highestBid).toBe(5);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.phase).toBe('bidding');
  });

  it('skips passed players when advancing the turn', () => {
    let state = batakGame.setup(setupOptions, createRng(1));
    state = batakGame.performMove(state, { type: 'bid', amount: 5 }); // p1
    state = batakGame.performMove(state, { type: 'pass' }); // p2 passes
    expect(state.currentPlayerIndex).toBe(2); // p3
    state = batakGame.performMove(state, { type: 'pass' }); // p3 passes
    expect(state.currentPlayerIndex).toBe(3); // p4
  });

  it('closes the auction the moment only one active bidder remains, using their latest bid as the contract', () => {
    let state = batakGame.setup(setupOptions, createRng(1));
    state = batakGame.performMove(state, { type: 'bid', amount: 5 }); // p1
    state = batakGame.performMove(state, { type: 'bid', amount: 6 }); // p2
    state = batakGame.performMove(state, { type: 'pass' }); // p3
    state = batakGame.performMove(state, { type: 'pass' }); // p4
    state = batakGame.performMove(state, { type: 'pass' }); // p1 passes; only p2 remains active
    expect(state.phase).toBe('trump-selection');
    expect(state.bidWinner).toBe('p2');
    expect(state.contract).toBe(6);
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('forces a contract of 4 to player 0 when every player passes', () => {
    let state = batakGame.setup(setupOptions, createRng(1));
    state = batakGame.performMove(state, { type: 'pass' }); // p1
    state = batakGame.performMove(state, { type: 'pass' }); // p2
    state = batakGame.performMove(state, { type: 'pass' }); // p3
    // After p3 passes, only p4 remains active but hasn't acted yet. The guard must prevent
    // early close and give p4 their own turn — if the guard is removed, p4 would wrongly be
    // crowned winner with a bid of null/0 they never made.
    expect(state.phase).toBe('bidding'); // NOT 'trump-selection' yet
    expect(state.currentPlayerIndex).toBe(3); // p4's turn (not skipped with wrong early close)
    state = batakGame.performMove(state, { type: 'pass' }); // p4
    expect(state.phase).toBe('trump-selection');
    expect(state.bidWinner).toBe('p1');
    expect(state.contract).toBe(4);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('selecting trump moves to the playing phase and sets the bid winner as trick leader and current player', () => {
    const state = {
      ...batakGame.setup(setupOptions, createRng(1)),
      phase: 'trump-selection' as const,
      bidWinner: 'p3',
      contract: 5,
      currentPlayerIndex: 2,
    };
    const next = batakGame.performMove(state, { type: 'selectTrump', suit: 'spades' });
    expect(next.trumpSuit).toBe('spades');
    expect(next.phase).toBe('playing');
    expect(next.trickLeader).toBe('p3');
    expect(next.currentPlayerIndex).toBe(2);
  });
});

function batakTable(overrides: Partial<Record<string, Card[]>>): TableState {
  return createTable([
    ...PLAYERS.map((p) => createZone(`hand-${p}`, true, overrides[`hand-${p}`] ?? [])),
    createZone('trick', true, overrides['trick'] ?? []),
    ...PLAYERS.map((p) => createZone(`won-${p}`, true, overrides[`won-${p}`] ?? [])),
  ]);
}

describe('getLegalMoves during play', () => {
  it('excludes trump when leading and trump has not been broken', () => {
    const table = batakTable({ 'hand-p1': [card('h1', 'K', 'hearts'), card('s1', 'Q', 'spades')] });
    const state = makeState({ table, phase: 'playing', trumpSuit: 'spades', trumpBroken: false, currentPlayerIndex: 0 });
    expect(batakGame.getLegalMoves(state, 'p1')).toEqual([{ type: 'play', cardId: 'h1' }]);
  });

  it('allows leading trump once trump has been broken', () => {
    const table = batakTable({ 'hand-p1': [card('h1', 'K', 'hearts'), card('s1', 'Q', 'spades')] });
    const state = makeState({ table, phase: 'playing', trumpSuit: 'spades', trumpBroken: true, currentPlayerIndex: 0 });
    const moves = batakGame.getLegalMoves(state, 'p1');
    expect(moves).toHaveLength(2);
    expect(moves).toEqual(
      expect.arrayContaining([{ type: 'play', cardId: 'h1' }, { type: 'play', cardId: 's1' }])
    );
  });

  it('allows leading trump when the hand holds only trump cards, even unbroken', () => {
    const table = batakTable({ 'hand-p1': [card('s1', 'Q', 'spades'), card('s2', 'K', 'spades')] });
    const state = makeState({ table, phase: 'playing', trumpSuit: 'spades', trumpBroken: false, currentPlayerIndex: 0 });
    expect(batakGame.getLegalMoves(state, 'p1')).toHaveLength(2);
  });

  it('requires a higher card of the led suit when one is held (mandatory raise)', () => {
    const table = batakTable({
      'hand-p1': [card('h1', 'K', 'hearts'), card('h2', '9', 'hearts'), card('c1', '2', 'clubs')],
      trick: [card('t1', '10', 'hearts')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 0,
      currentTrick: [{ playerId: 'p4', cardId: 't1' }],
    });
    expect(batakGame.getLegalMoves(state, 'p1')).toEqual([{ type: 'play', cardId: 'h1' }]);
  });

  it('allows any card of the led suit when no higher card is held', () => {
    const table = batakTable({
      'hand-p1': [card('h1', '5', 'hearts'), card('h2', '3', 'hearts'), card('c1', '2', 'clubs')],
      trick: [card('t1', 'K', 'hearts')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 0,
      currentTrick: [{ playerId: 'p4', cardId: 't1' }],
    });
    const moves = batakGame.getLegalMoves(state, 'p1');
    expect(moves).toHaveLength(2);
    expect(moves).toEqual(
      expect.arrayContaining([{ type: 'play', cardId: 'h1' }, { type: 'play', cardId: 'h2' }])
    );
  });

  it('allows any card, including trump, when void in the led suit', () => {
    const table = batakTable({
      'hand-p1': [card('c1', '5', 'clubs'), card('s1', 'Q', 'spades')],
      trick: [card('t1', 'K', 'hearts')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 0,
      currentTrick: [{ playerId: 'p4', cardId: 't1' }],
    });
    expect(batakGame.getLegalMoves(state, 'p1')).toHaveLength(2);
  });
});

describe('batakGame performMove — play', () => {
  it('adds the card to the trick, advances the turn, and sets trumpBroken when a trump is played', () => {
    const table = batakTable({ 'hand-p1': [card('s1', 'Q', 'spades')] });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      trumpBroken: false,
      currentPlayerIndex: 0,
      trickLeader: 'p1',
    });
    const next = batakGame.performMove(state, { type: 'play', cardId: 's1' });
    expect(next.table.zones['trick'].cards.map((c) => c.id)).toEqual(['s1']);
    expect(next.currentTrick).toEqual([{ playerId: 'p1', cardId: 's1' }]);
    expect(next.trumpBroken).toBe(true);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.phase).toBe('playing');
  });

  it('resolves a trick to the highest card of the led suit when no trump was played', () => {
    const table = batakTable({
      'hand-p4': [card('h4', '9', 'hearts')],
      trick: [card('h1', 'K', 'hearts'), card('h2', '5', 'hearts'), card('c3', '2', 'clubs')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 3,
      trickLeader: 'p1',
      currentTrick: [
        { playerId: 'p1', cardId: 'h1' },
        { playerId: 'p2', cardId: 'h2' },
        { playerId: 'p3', cardId: 'c3' },
      ],
    });
    const next = batakGame.performMove(state, { type: 'play', cardId: 'h4' });
    expect(next.table.zones['won-p1'].cards.map((c) => c.id).sort()).toEqual(['c3', 'h1', 'h2', 'h4']);
    expect(next.tricksWon['p1']).toBe(1);
    expect(next.trickLeader).toBe('p1');
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.currentTrick).toEqual([]);
    expect(next.table.zones['trick'].cards).toEqual([]);
  });

  it('resolves a trick to the highest trump, beating a higher-ranked led-suit card', () => {
    const table = batakTable({
      'hand-p4': [card('s4', '2', 'spades')],
      trick: [card('h1', 'A', 'hearts'), card('h2', 'K', 'hearts'), card('h3', 'Q', 'hearts')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 3,
      trickLeader: 'p1',
      currentTrick: [
        { playerId: 'p1', cardId: 'h1' },
        { playerId: 'p2', cardId: 'h2' },
        { playerId: 'p3', cardId: 'h3' },
      ],
    });
    const next = batakGame.performMove(state, { type: 'play', cardId: 's4' });
    expect(next.trickLeader).toBe('p4');
    expect(next.tricksWon['p4']).toBe(1);
  });

  it('resolves a trick to the highest trump even when it was not the first or last card played', () => {
    const table = batakTable({
      'hand-p4': [card('s4', '3', 'spades')],
      trick: [card('s1', '2', 'spades'), card('s2', 'K', 'spades'), card('h3', '5', 'hearts')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 3,
      trickLeader: 'p1',
      currentTrick: [
        { playerId: 'p1', cardId: 's1' }, // First card: low trump (2 of spades)
        { playerId: 'p2', cardId: 's2' }, // Second card: HIGHEST trump (K of spades) — in the middle
        { playerId: 'p3', cardId: 'h3' }, // Third card: non-trump (5 of hearts)
      ],
    });
    const next = batakGame.performMove(state, { type: 'play', cardId: 's4' });
    // p2 played the highest-ranked trump (K) and should win, NOT p1 (who played first) or p4 (who played last)
    expect(next.trickLeader).toBe('p2');
    expect(next.tricksWon['p2']).toBe(1);
    // Verify that no other player won the trick
    expect(next.tricksWon['p1']).toBe(0);
    expect(next.tricksWon['p3']).toBe(0);
    expect(next.tricksWon['p4']).toBe(0);
  });

  it('finishes the hand once the 13th trick completes', () => {
    const table = batakTable({
      'hand-p1': [],
      'hand-p2': [],
      'hand-p3': [],
      'hand-p4': [card('s4', '2', 'spades')],
      trick: [card('h1', 'A', 'hearts'), card('h2', 'K', 'hearts'), card('h3', 'Q', 'hearts')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 3,
      trickLeader: 'p1',
      currentTrick: [
        { playerId: 'p1', cardId: 'h1' },
        { playerId: 'p2', cardId: 'h2' },
        { playerId: 'p3', cardId: 'h3' },
      ],
    });
    const next = batakGame.performMove(state, { type: 'play', cardId: 's4' });
    expect(next.phase).toBe('finished');
    expect(next.status).toBe('finished');
  });
});

describe('validateMove during play', () => {
  it('accepts a card that getLegalMoves allows, and rejects one it does not', () => {
    const table = batakTable({
      'hand-p1': [card('h1', 'K', 'hearts'), card('h2', '9', 'hearts')],
      trick: [card('t1', '10', 'hearts')],
    });
    const state = makeState({
      table,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 0,
      currentTrick: [{ playerId: 'p4', cardId: 't1' }],
    });
    expect(batakGame.validateMove(state, { type: 'play', cardId: 'h1' }, 'p1')).toBe(true);
    expect(batakGame.validateMove(state, { type: 'play', cardId: 'h2' }, 'p1')).toBe(false);
  });
});
