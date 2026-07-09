import { createRng } from '../../core/rng';
import { createTable, createZone } from '../../core/table';
import { Card } from '../../core/types';
import { pistiGame } from './rules';
import { PistiSetupOptions, PistiState } from './types';

const card = (id: string, rank: Card['rank'], suit: Card['suit'] = 'hearts'): Card => ({ id, suit, rank });

function makeState(overrides: Partial<PistiState> & { table: PistiState['table'] }): PistiState {
  return {
    gameId: 'pisti',
    players: ['p1', 'p2'],
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    lastCapturedBy: null,
    pistiBonusPoints: { p1: 0, p2: 0 },
    teams: null,
    ...overrides,
  };
}

describe('pistiGame (rule engine)', () => {
  const setupOptions: PistiSetupOptions = { players: ['p1', 'p2'] };

  describe('setup', () => {
    it('deals 4 cards to the pile, 4 to each hand, and the remaining 40 to stock', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      expect(state.table.zones['pile'].cards).toHaveLength(4);
      expect(state.table.zones['hand-p1'].cards).toHaveLength(4);
      expect(state.table.zones['hand-p2'].cards).toHaveLength(4);
      expect(state.table.zones['stock'].cards).toHaveLength(40);
    });

    it('never deals a Jack into the initial pile, across many seeds', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const state = pistiGame.setup(setupOptions, createRng(seed));
        expect(state.table.zones['pile'].cards.some((c: Card) => c.rank === 'J')).toBe(false);
      }
    });

    it('deals every card exactly once across all zones', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      const allIds = [
        ...state.table.zones['pile'].cards,
        ...state.table.zones['hand-p1'].cards,
        ...state.table.zones['hand-p2'].cards,
        ...state.table.zones['stock'].cards,
      ].map((c) => c.id);
      expect(new Set(allIds).size).toBe(52);
    });

    it('initializes status, turn order, and Pişti-specific fields', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      expect(state.status).toBe('in-progress');
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.lastCapturedBy).toBeNull();
      expect(state.pistiBonusPoints).toEqual({ p1: 0, p2: 0 });
      expect(state.table.zones['captured-p1'].cards).toEqual([]);
      expect(state.table.zones['captured-p2'].cards).toEqual([]);
    });

    it('deals 4 cards to the pile, 4 to each of 4 hands, and the remaining 32 to stock', () => {
      const fourPlayerOptions: PistiSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
      const state = pistiGame.setup(fourPlayerOptions, createRng(1));
      expect(state.table.zones['pile'].cards).toHaveLength(4);
      for (const p of ['p1', 'p2', 'p3', 'p4']) {
        expect(state.table.zones[`hand-${p}`].cards).toHaveLength(4);
        expect(state.table.zones[`captured-${p}`].cards).toEqual([]);
      }
      expect(state.table.zones['stock'].cards).toHaveLength(32);
      expect(state.pistiBonusPoints).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
    });
  });

  describe('validateMove', () => {
    it('only allows the current player to move, and only cards in their hand', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      const cardId = state.table.zones['hand-p1'].cards[0].id;
      expect(pistiGame.validateMove(state, { type: 'play', cardId }, 'p2')).toBe(false);
      expect(pistiGame.validateMove(state, { type: 'play', cardId }, 'p1')).toBe(true);
      expect(pistiGame.validateMove(state, { type: 'play', cardId: 'not-a-real-card' }, 'p1')).toBe(false);
    });

    it('rejects any move once the game has finished', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      const finished = { ...state, status: 'finished' as const };
      const cardId = state.table.zones['hand-p1'].cards[0].id;
      expect(pistiGame.validateMove(finished, { type: 'play', cardId }, 'p1')).toBe(false);
    });
  });

  describe('getLegalMoves', () => {
    it('returns one move per card in hand for the current player, none for the other', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      expect(pistiGame.getLegalMoves(state, 'p1')).toHaveLength(4);
      expect(pistiGame.getLegalMoves(state, 'p2')).toHaveLength(0);
    });
  });

  describe('calculateScore', () => {
    it('scores Aces, Jacks, the 2 of clubs, and the 10 of diamonds, plus the majority bonus', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('captured-p1', true, [
          card('a', 'A'),
          card('j', 'J'),
          card('2c', '2', 'clubs'),
          card('10d', '10', 'diamonds'),
        ]),
        createZone('captured-p2', true),
      ]);
      const state = makeState({ table, status: 'finished' });
      const score = pistiGame.calculateScore(state);
      expect(score['p1']).toBe(1 + 1 + 2 + 3 + 3); // card points + majority bonus
      expect(score['p2']).toBe(0);
    });

    it('awards no majority bonus on a tied card count', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('captured-p1', true, [card('c1', '3')]),
        createZone('captured-p2', true, [card('c2', '4')]),
      ]);
      const state = makeState({ table, status: 'finished' });
      const score = pistiGame.calculateScore(state);
      expect(score['p1']).toBe(0);
      expect(score['p2']).toBe(0);
    });

    it('with 4 players, awards the majority bonus only to the sole leader', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('hand-p3', true),
        createZone('hand-p4', true),
        createZone('captured-p1', true, [card('a', '3'), card('b', '3'), card('c', '3')]),
        createZone('captured-p2', true, [card('d', '3'), card('e', '3')]),
        createZone('captured-p3', true, [card('f', '3')]),
        createZone('captured-p4', true, []),
      ]);
      const state = makeState({
        table,
        status: 'finished',
        players: ['p1', 'p2', 'p3', 'p4'],
        pistiBonusPoints: { p1: 0, p2: 0, p3: 0, p4: 0 },
      });
      const score = pistiGame.calculateScore(state);
      expect(score['p1']).toBe(3);
      expect(score['p2']).toBe(0);
      expect(score['p3']).toBe(0);
      expect(score['p4']).toBe(0);
    });

    it('with 4 players, awards no majority bonus when two players tie for the most captured cards', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('hand-p3', true),
        createZone('hand-p4', true),
        createZone('captured-p1', true, [card('a', '3'), card('b', '3')]),
        createZone('captured-p2', true, [card('c', '3'), card('d', '3')]),
        createZone('captured-p3', true, [card('e', '3')]),
        createZone('captured-p4', true, []),
      ]);
      const state = makeState({
        table,
        status: 'finished',
        players: ['p1', 'p2', 'p3', 'p4'],
        pistiBonusPoints: { p1: 0, p2: 0, p3: 0, p4: 0 },
      });
      const score = pistiGame.calculateScore(state);
      expect(score['p1']).toBe(0);
      expect(score['p2']).toBe(0);
    });

    it('pools captured cards and pişti bonuses per team, comparing team totals for the majority bonus', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('hand-p3', true),
        createZone('hand-p4', true),
        // Team A (p1+p2) individually has one big leader (p1, 5 cards) but a smaller team total.
        createZone('captured-p1', true, [card('a', 'A'), card('b', '3'), card('c', '3'), card('d', '3'), card('e', '3')]),
        createZone('captured-p2', true, []),
        // Team B (p3+p4) has no single leader, but the larger combined team total (7 vs 5).
        createZone('captured-p3', true, [card('f', '3'), card('g', '3'), card('h', '3'), card('i', '3')]),
        createZone('captured-p4', true, [card('j', '3'), card('k', '3'), card('l', '3')]),
      ]);
      const state = makeState({
        table,
        status: 'finished',
        players: ['p1', 'p2', 'p3', 'p4'],
        pistiBonusPoints: { p1: 0, p2: 0, p3: 0, p4: 0 },
        teams: [
          ['p1', 'p2'],
          ['p3', 'p4'],
        ],
      });
      const score = pistiGame.calculateScore(state);
      // Team A: 1 (Ace) card point, no majority bonus (team B has more captured cards).
      expect(score['p1']).toBe(1);
      expect(score['p2']).toBe(1);
      // Team B: 0 card points (all 3s) + 3 majority bonus, split identically to both members.
      expect(score['p3']).toBe(3);
      expect(score['p4']).toBe(3);
    });

    it('awards no majority bonus when teams tie on total captured cards', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('hand-p3', true),
        createZone('hand-p4', true),
        createZone('captured-p1', true, [card('a', '3')]),
        createZone('captured-p2', true, [card('b', '3')]),
        createZone('captured-p3', true, [card('c', '3'), card('d', '3')]),
        createZone('captured-p4', true, []),
      ]);
      const state = makeState({
        table,
        status: 'finished',
        players: ['p1', 'p2', 'p3', 'p4'],
        pistiBonusPoints: { p1: 0, p2: 0, p3: 0, p4: 0 },
        teams: [
          ['p1', 'p2'],
          ['p3', 'p4'],
        ],
      });
      const score = pistiGame.calculateScore(state);
      expect(score['p1']).toBe(0);
      expect(score['p3']).toBe(0);
    });

    it('includes accumulated pişti bonus points', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('captured-p1', true),
        createZone('captured-p2', true),
      ]);
      const state = makeState({ table, status: 'finished', pistiBonusPoints: { p1: 30, p2: 0 } });
      const score = pistiGame.calculateScore(state);
      expect(score['p1']).toBe(30);
    });
  });

  describe('determineWinner', () => {
    it('returns null before the game is finished', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      expect(pistiGame.determineWinner(state)).toBeNull();
    });

    it('returns the higher-scoring player once finished', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('captured-p1', true, [card('a', 'A')]),
        createZone('captured-p2', true),
      ]);
      const state = makeState({ table, status: 'finished' });
      expect(pistiGame.determineWinner(state)).toEqual(['p1']);
    });

    it('returns both players when tied', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('captured-p1', true),
        createZone('captured-p2', true),
      ]);
      const state = makeState({ table, status: 'finished' });
      expect(pistiGame.determineWinner(state)).toEqual(['p1', 'p2']);
    });

    it('with teams, returns both members of the winning team since they share a pooled score', () => {
      const table = createTable([
        createZone('stock', false),
        createZone('pile', 'top-only'),
        createZone('hand-p1', true),
        createZone('hand-p2', true),
        createZone('hand-p3', true),
        createZone('hand-p4', true),
        createZone('captured-p1', true, [card('a', 'A')]),
        createZone('captured-p2', true, []),
        createZone('captured-p3', true, []),
        createZone('captured-p4', true, []),
      ]);
      const state = makeState({
        table,
        status: 'finished',
        players: ['p1', 'p2', 'p3', 'p4'],
        pistiBonusPoints: { p1: 0, p2: 0, p3: 0, p4: 0 },
        teams: [
          ['p1', 'p2'],
          ['p3', 'p4'],
        ],
      });
      expect(pistiGame.determineWinner(state)).toEqual(['p1', 'p2']);
    });
  });

  describe('gameOver', () => {
    it('is false during play and true once finished', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      expect(pistiGame.gameOver(state)).toBe(false);
      expect(pistiGame.gameOver({ ...state, status: 'finished' as const })).toBe(true);
    });
  });
});

describe('pistiGame performMove', () => {
  it('captures the whole pile on a matching rank play, with no pişti bonus for a 2+ card pile', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '7', 'clubs'), card('p2c', '7', 'diamonds')]),
      createZone('hand-p1', true, [card('h1', '7', 'spades')]),
      createZone('hand-p2', true, [card('h2', '3')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.table.zones['pile'].cards).toEqual([]);
    expect(next.table.zones['captured-p1'].cards.map((c) => c.id)).toEqual(['p1c', 'p2c', 'h1']);
    expect(next.lastCapturedBy).toBe('p1');
    expect(next.pistiBonusPoints['p1']).toBe(0);
  });

  it('captures with a Jack when the pile has 2+ cards, regardless of the top card rank', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs'), card('p2c', '3', 'diamonds')]),
      createZone('hand-p1', true, [card('h1', 'J', 'spades')]),
      createZone('hand-p2', true, [card('h2', '5')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.table.zones['pile'].cards).toEqual([]);
    expect(next.table.zones['captured-p1'].cards.map((c) => c.id)).toEqual(['p1c', 'p2c', 'h1']);
    expect(next.lastCapturedBy).toBe('p1');
  });

  it('awards no bonus when a Jack captures a lone non-Jack card via wildcard', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '7', 'clubs')]),
      createZone('hand-p1', true, [card('h1', 'J', 'spades')]),
      createZone('hand-p2', true, [card('h2', '3')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.table.zones['pile'].cards).toEqual([]);
    expect(next.table.zones['captured-p1'].cards.map((c) => c.id)).toEqual(['p1c', 'h1']);
    expect(next.lastCapturedBy).toBe('p1');
    expect(next.pistiBonusPoints['p1']).toBe(0);
  });

  it('does not let a non-Jack capture a Jack on top of the pile', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', 'J', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '9', 'spades')]),
      createZone('hand-p2', true, [card('h2', 'J', 'hearts')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.table.zones['pile'].cards.map((c) => c.id)).toEqual(['p1c', 'h1']);
    expect(next.lastCapturedBy).toBeNull();
    expect(next.pistiBonusPoints['p1']).toBe(0);
  });

  it('places a non-matching, non-Jack card without capturing', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'spades')]),
      createZone('hand-p2', true, [card('h2', '3')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.table.zones['pile'].cards.map((c) => c.id)).toEqual(['p1c', 'h1']);
    expect(next.lastCapturedBy).toBeNull();
  });

  it('awards a 10-point pişti bonus for a non-Jack capturing a lone card of matching rank', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '7', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '7', 'spades')]),
      createZone('hand-p2', true, [card('h2', '3')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.pistiBonusPoints['p1']).toBe(10);
  });

  it('awards a 20-point double pişti bonus for capturing a lone Jack with another Jack', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', 'J', 'clubs')]),
      createZone('hand-p1', true, [card('h1', 'J', 'spades')]),
      createZone('hand-p2', true, [card('h2', '3')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.pistiBonusPoints['p1']).toBe(20);
  });

  it('advances currentPlayerIndex after every move', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'spades')]),
      createZone('hand-p2', true, [card('h2', '3')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('redeals 4 cards to each hand when both hands become empty and stock remains', () => {
    const stockCards = Array.from({ length: 8 }, (_, i) => card(`s${i}`, '4', 'clubs'));
    const table = createTable([
      createZone('stock', false, stockCards),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'spades')]),
      createZone('hand-p2', true, []),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0 });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.table.zones['hand-p1'].cards).toHaveLength(4);
    expect(next.table.zones['hand-p2'].cards).toHaveLength(4);
    expect(next.table.zones['stock'].cards).toHaveLength(0);
    expect(next.status).toBe('in-progress');
  });

  it('with 4 players, redeals 4 cards to each hand when all hands become empty and stock remains', () => {
    const stockCards = Array.from({ length: 16 }, (_, i) => card(`s${i}`, '4', 'clubs'));
    const table = createTable([
      createZone('stock', false, stockCards),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'spades')]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
      createZone('captured-p3', true),
      createZone('captured-p4', true),
    ]);
    const state = makeState({
      table,
      currentPlayerIndex: 0,
      players: ['p1', 'p2', 'p3', 'p4'],
      pistiBonusPoints: { p1: 0, p2: 0, p3: 0, p4: 0 },
    });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    for (const p of ['p1', 'p2', 'p3', 'p4']) {
      expect(next.table.zones[`hand-${p}`].cards).toHaveLength(4);
    }
    expect(next.table.zones['stock'].cards).toHaveLength(0);
    expect(next.status).toBe('in-progress');
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('with 4 players, finishes the hand and sweeps remaining pile cards to the last capturer when stock and all hands are empty', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'spades')]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
      createZone('captured-p3', true),
      createZone('captured-p4', true),
    ]);
    const state = makeState({
      table,
      currentPlayerIndex: 0,
      players: ['p1', 'p2', 'p3', 'p4'],
      pistiBonusPoints: { p1: 0, p2: 0, p3: 0, p4: 0 },
      lastCapturedBy: 'p3',
    });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.status).toBe('finished');
    expect(next.table.zones['pile'].cards).toEqual([]);
    expect(next.table.zones['captured-p3'].cards.map((c) => c.id)).toEqual(['p1c', 'h1']);
  });

  it('finishes the hand and sweeps remaining pile cards to the last capturer when stock and both hands are empty', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'spades')]),
      createZone('hand-p2', true, []),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0, lastCapturedBy: 'p2' });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.status).toBe('finished');
    expect(next.table.zones['pile'].cards).toEqual([]);
    expect(next.table.zones['captured-p2'].cards.map((c) => c.id)).toEqual(['p1c', 'h1']);
  });

  it('leaves pile cards uncaptured when the hand ends with no capture ever having happened', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'spades')]),
      createZone('hand-p2', true, []),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState({ table, currentPlayerIndex: 0, lastCapturedBy: null });
    const next = pistiGame.performMove(state, { type: 'play', cardId: 'h1' });

    expect(next.status).toBe('finished');
    expect(next.table.zones['pile'].cards.map((c) => c.id)).toEqual(['p1c', 'h1']);
    expect(next.table.zones['captured-p1'].cards).toEqual([]);
    expect(next.table.zones['captured-p2'].cards).toEqual([]);
  });
});
