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
