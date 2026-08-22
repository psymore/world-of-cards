import { createRng } from '../../core/rng';
import { createTable, createZone } from '../../core/table';
import { Card } from '../../core/types';
import { pisYedeliGame, findStartingPlayerIndex, canDraw } from './rules';
import { PisYedeliSetupOptions, PisYedeliState } from './types';

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

describe('findStartingPlayerIndex', () => {
  it('picks the player holding the lowest club', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('a', '9', 'clubs'), card('b', 'K')]),
      createZone('hand-p2', true, [card('c', '3', 'clubs')]),
    ]);
    expect(findStartingPlayerIndex(['p1', 'p2'], table)).toBe(1);
  });

  it('defaults to index 0 when nobody holds a club', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('a', '9', 'hearts')]),
      createZone('hand-p2', true, [card('b', '3', 'spades')]),
    ]);
    expect(findStartingPlayerIndex(['p1', 'p2'], table)).toBe(0);
  });

  it('treats ace as the highest club, not the lowest', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('a', 'A', 'clubs')]),
      createZone('hand-p2', true, [card('b', '2', 'clubs')]),
    ]);
    expect(findStartingPlayerIndex(['p1', 'p2'], table)).toBe(1);
  });
});

describe('canDraw', () => {
  it('is true when stock has cards', () => {
    const table = createTable([createZone('stock', false, [card('s1', '4')]), createZone('discard', true)]);
    expect(canDraw(table)).toBe(true);
  });

  it('is true when discard has more than just its top card', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('discard', true, [card('d1', '4'), card('d2', '5')]),
    ]);
    expect(canDraw(table)).toBe(true);
  });

  it('is false when stock is empty and discard has only its top card', () => {
    const table = createTable([createZone('stock', false), createZone('discard', true, [card('d1', '4')])]);
    expect(canDraw(table)).toBe(false);
  });

  it('is false when both stock and discard are empty', () => {
    const table = createTable([createZone('stock', false), createZone('discard', true)]);
    expect(canDraw(table)).toBe(false);
  });
});

describe('pisYedeliGame.setup', () => {
  const setupOptions: PisYedeliSetupOptions = { players: ['p1', 'p2'] };

  it('deals 7 cards to each hand, the rest to stock, and starts discard empty', () => {
    const state = pisYedeliGame.setup(setupOptions, createRng(1));
    expect(state.table.zones['hand-p1'].cards).toHaveLength(7);
    expect(state.table.zones['hand-p2'].cards).toHaveLength(7);
    expect(state.table.zones['stock'].cards).toHaveLength(38);
    expect(state.table.zones['discard'].cards).toEqual([]);
  });

  it('deals every card exactly once across all zones', () => {
    const state = pisYedeliGame.setup(setupOptions, createRng(1));
    const allIds = [
      ...state.table.zones['hand-p1'].cards,
      ...state.table.zones['hand-p2'].cards,
      ...state.table.zones['stock'].cards,
    ].map((c) => c.id);
    expect(new Set(allIds).size).toBe(52);
  });

  it('initializes status and Pis Yedili-specific fields', () => {
    const state = pisYedeliGame.setup(setupOptions, createRng(1));
    expect(state.status).toBe('in-progress');
    expect(state.activeSuit).toBeNull();
    expect(state.pendingDraw).toBe(0);
  });

  it('sets currentPlayerIndex via findStartingPlayerIndex, reproducibly for a given seed', () => {
    const stateA = pisYedeliGame.setup(setupOptions, createRng(7));
    const stateB = pisYedeliGame.setup(setupOptions, createRng(7));
    expect(stateA.currentPlayerIndex).toBe(stateB.currentPlayerIndex);
    expect(stateA.currentPlayerIndex).toBe(findStartingPlayerIndex(['p1', 'p2'], stateA.table));
  });

  it('deals 7 cards to each of 4 hands, and the remaining 24 to stock', () => {
    const fourPlayerOptions: PisYedeliSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    const state = pisYedeliGame.setup(fourPlayerOptions, createRng(1));
    for (const p of ['p1', 'p2', 'p3', 'p4']) {
      expect(state.table.zones[`hand-${p}`].cards).toHaveLength(7);
    }
    expect(state.table.zones['stock'].cards).toHaveLength(24);
  });
});

describe('pisYedeliGame.gameOver', () => {
  it('is false during play and true once finished', () => {
    const state = pisYedeliGame.setup({ players: ['p1', 'p2'] }, createRng(1));
    expect(pisYedeliGame.gameOver(state)).toBe(false);
    expect(pisYedeliGame.gameOver({ ...state, status: 'finished' as const })).toBe(true);
  });
});

describe('pisYedeliGame.determineWinner', () => {
  it('returns null before the game is finished', () => {
    const state = pisYedeliGame.setup({ players: ['p1', 'p2'] }, createRng(1));
    expect(pisYedeliGame.determineWinner(state)).toBeNull();
  });

  it('returns the player whose hand is empty once finished', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('discard', true, [card('d1', '5')]),
      createZone('hand-p1', true, []),
      createZone('hand-p2', true, [card('h1', '3')]),
    ]);
    const state = makeState({ table, status: 'finished' });
    expect(pisYedeliGame.determineWinner(state)).toEqual(['p1']);
  });
});

describe('pisYedeliGame.calculateScore', () => {
  it('scores the winner 1 and everyone else 0', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('discard', true, [card('d1', '5')]),
      createZone('hand-p1', true, []),
      createZone('hand-p2', true, [card('h1', '3')]),
    ]);
    const state = makeState({ table, status: 'finished' });
    const score = pisYedeliGame.calculateScore(state);
    expect(score['p1']).toBe(1);
    expect(score['p2']).toBe(0);
  });
});

describe('pisYedeliGame.getLegalMoves', () => {
  it('before the game opens, offers only clubs in hand if any are held', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true),
      createZone('hand-p1', true, [card('h1', '9', 'clubs'), card('h2', '3', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: null });
    expect(pisYedeliGame.getLegalMoves(state, 'p1')).toEqual([{ type: 'play', cardId: 'h1' }]);
  });

  it('before the game opens, offers only draw when the current player holds no club', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true),
      createZone('hand-p1', true, [card('h1', '9', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: null });
    expect(pisYedeliGame.getLegalMoves(state, 'p1')).toEqual([{ type: 'draw' }]);
  });

  it('returns nothing for a player who is not current', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true),
      createZone('hand-p1', true, [card('h1', '9', 'clubs')]),
      createZone('hand-p2', true, [card('h2', '3', 'clubs')]),
    ]);
    const state = makeState({ table, activeSuit: null });
    expect(pisYedeliGame.getLegalMoves(state, 'p2')).toEqual([]);
  });

  it('with a pending draw penalty, offers only sevens in hand plus draw', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '7', 'spades')]),
      createZone('hand-p1', true, [card('h1', '7', 'hearts'), card('h2', 'K', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'spades', pendingDraw: 2 });
    expect(pisYedeliGame.getLegalMoves(state, 'p1')).toEqual([
      { type: 'play', cardId: 'h1' },
      { type: 'draw' },
    ]);
  });

  it('with a pending draw penalty and no seven or draw available, falls back to pass', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('discard', true, [card('d1', '7', 'spades')]),
      createZone('hand-p1', true, [card('h1', 'K', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'spades', pendingDraw: 2 });
    expect(pisYedeliGame.getLegalMoves(state, 'p1')).toEqual([{ type: 'pass' }]);
  });

  it('once opened, offers cards matching the active suit or the discard top rank', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [
        card('h1', '5', 'clubs'),   // matches active suit
        card('h2', '9', 'hearts'),  // matches discard top rank
        card('h3', '3', 'hearts'),  // matches neither
      ]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs' });
    const moves = pisYedeliGame.getLegalMoves(state, 'p1');
    expect(moves).toEqual(
      expect.arrayContaining([{ type: 'play', cardId: 'h1' }, { type: 'play', cardId: 'h2' }, { type: 'draw' }])
    );
    expect(moves).not.toContainEqual({ type: 'play', cardId: 'h3' });
  });

  it('always offers a seven regardless of match', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '7', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs' });
    expect(pisYedeliGame.getLegalMoves(state, 'p1')).toContainEqual({ type: 'play', cardId: 'h1' });
  });

  it('expands a Jack into one candidate move per declared suit', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', 'J', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs' });
    const moves = pisYedeliGame.getLegalMoves(state, 'p1');
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
    for (const suit of suits) {
      expect(moves).toContainEqual({ type: 'play', cardId: 'h1', declaredSuit: suit });
    }
  });

  it('offers pass only when no legal play exists', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '3', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs' });
    expect(pisYedeliGame.getLegalMoves(state, 'p1')).toEqual([{ type: 'draw' }, { type: 'pass' }]);
  });

  it('does not offer pass when a legal play exists, even though draw is always offered too', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'clubs')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs' });
    const moves = pisYedeliGame.getLegalMoves(state, 'p1');
    expect(moves).not.toContainEqual({ type: 'pass' });
  });
});

describe('pisYedeliGame.validateMove', () => {
  const baseTable = createTable([
    createZone('stock', false, [card('s1', '4')]),
    createZone('discard', true, [card('d1', '9', 'clubs')]),
    createZone('hand-p1', true, [card('h1', '5', 'clubs'), card('h2', 'J', 'hearts')]),
    createZone('hand-p2', true, [card('h3', '3', 'hearts')]),
  ]);

  it('rejects a move from a player who is not current', () => {
    const state = makeState({ table: baseTable, activeSuit: 'clubs' });
    expect(pisYedeliGame.validateMove(state, { type: 'draw' }, 'p2')).toBe(false);
  });

  it('rejects any move once the game has finished', () => {
    const state = makeState({ table: baseTable, activeSuit: 'clubs', status: 'finished' });
    expect(pisYedeliGame.validateMove(state, { type: 'draw' }, 'p1')).toBe(false);
  });

  it('accepts a legal play matching the active suit', () => {
    const state = makeState({ table: baseTable, activeSuit: 'clubs' });
    expect(pisYedeliGame.validateMove(state, { type: 'play', cardId: 'h1' }, 'p1')).toBe(true);
  });

  it('accepts a Jack play with a declared suit that matches a legal candidate', () => {
    const state = makeState({ table: baseTable, activeSuit: 'clubs' });
    expect(
      pisYedeliGame.validateMove(state, { type: 'play', cardId: 'h2', declaredSuit: 'spades' }, 'p1')
    ).toBe(true);
  });

  it('rejects a Jack play with no declared suit', () => {
    const state = makeState({ table: baseTable, activeSuit: 'clubs' });
    expect(pisYedeliGame.validateMove(state, { type: 'play', cardId: 'h2' }, 'p1')).toBe(false);
  });

  it('rejects a card not in hand', () => {
    const state = makeState({ table: baseTable, activeSuit: 'clubs' });
    expect(pisYedeliGame.validateMove(state, { type: 'play', cardId: 'not-a-real-card' }, 'p1')).toBe(false);
  });

  it('accepts draw', () => {
    const state = makeState({ table: baseTable, activeSuit: 'clubs' });
    expect(pisYedeliGame.validateMove(state, { type: 'draw' }, 'p1')).toBe(true);
  });
});

describe('pisYedeliGame.performMove', () => {
  it('pass advances to the next player and changes nothing else', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '3', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'pass' });
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.table).toBe(state.table);
    expect(next.activeSuit).toBe('clubs');
  });

  it('draw moves one card from stock to hand and does not advance the turn', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4'), card('s2', '5')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '3', 'hearts')]),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'draw' });
    expect(next.table.zones['hand-p1'].cards.map((c) => c.id)).toEqual(['h1', 's2']);
    expect(next.table.zones['stock'].cards.map((c) => c.id)).toEqual(['s1']);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('draw decrements pendingDraw when a penalty is active', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '7', 'clubs')]),
      createZone('hand-p1', true, []),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', pendingDraw: 2, currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'draw' });
    expect(next.pendingDraw).toBe(1);
  });

  it('draw flips discard-minus-top into stock when stock is empty', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('discard', true, [card('d1', '4'), card('d2', '5'), card('d3', '9', 'clubs')]),
      createZone('hand-p1', true, []),
      createZone('hand-p2', true, []),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'draw' });
    expect(next.table.zones['discard'].cards.map((c) => c.id)).toEqual(['d3']);
    // stock held [d1, d2] before the draw (reversed play order); one was drawn, leaving one.
    expect(next.table.zones['stock'].cards).toHaveLength(1);
    expect(next.table.zones['hand-p1'].cards).toHaveLength(1);
  });

  it('play moves the card to discard and sets activeSuit to its own suit', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'diamonds')]),
      createZone('hand-p2', true, [card('h2', '3', 'hearts')]),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'play', cardId: 'h1' });
    expect(next.table.zones['discard'].cards.map((c) => c.id)).toEqual(['d1', 'h1']);
    expect(next.activeSuit).toBe('diamonds');
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.pendingDraw).toBe(0);
  });

  it('playing a seven adds 2 to pendingDraw (fresh)', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '7', 'diamonds')]),
      createZone('hand-p2', true, [card('h2', '3', 'hearts')]),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0, pendingDraw: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'play', cardId: 'h1' });
    expect(next.pendingDraw).toBe(2);
  });

  it('stacking a seven onto an existing penalty adds 2 more', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '7', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '7', 'diamonds')]),
      createZone('hand-p2', true, [card('h2', '3', 'hearts')]),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0, pendingDraw: 2 });
    const next = pisYedeliGame.performMove(state, { type: 'play', cardId: 'h1' });
    expect(next.pendingDraw).toBe(4);
  });

  it('playing a Jack sets activeSuit to the declared suit, not the Jack\'s own suit', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', 'J', 'diamonds')]),
      createZone('hand-p2', true, [card('h2', '3', 'hearts')]),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'play', cardId: 'h1', declaredSuit: 'spades' });
    expect(next.activeSuit).toBe('spades');
  });

  it('playing a Jack skips the next player (3+ players)', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', 'J', 'diamonds')]),
      createZone('hand-p2', true, [card('h2', '3', 'hearts')]),
      createZone('hand-p3', true, [card('h3', '4', 'hearts')]),
    ]);
    const state = makeState({
      table,
      activeSuit: 'clubs',
      currentPlayerIndex: 0,
      players: ['p1', 'p2', 'p3'],
    });
    const next = pisYedeliGame.performMove(state, { type: 'play', cardId: 'h1', declaredSuit: 'spades' });
    expect(next.currentPlayerIndex).toBe(2); // p2 skipped, lands on p3
  });

  it('playing a Jack in a 2-player game wraps back to the same player', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', 'J', 'diamonds')]),
      createZone('hand-p2', true, [card('h2', '3', 'hearts')]),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'play', cardId: 'h1', declaredSuit: 'spades' });
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('playing the last card in hand finishes the game', () => {
    const table = createTable([
      createZone('stock', false, [card('s1', '4')]),
      createZone('discard', true, [card('d1', '9', 'clubs')]),
      createZone('hand-p1', true, [card('h1', '5', 'clubs')]),
      createZone('hand-p2', true, [card('h2', '3', 'hearts')]),
    ]);
    const state = makeState({ table, activeSuit: 'clubs', currentPlayerIndex: 0 });
    const next = pisYedeliGame.performMove(state, { type: 'play', cardId: 'h1' });
    expect(next.status).toBe('finished');
    expect(pisYedeliGame.determineWinner(next)).toEqual(['p1']);
  });
});
