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
  });

  describe('gameOver', () => {
    it('is false during play and true once finished', () => {
      const state = pistiGame.setup(setupOptions, createRng(1));
      expect(pistiGame.gameOver(state)).toBe(false);
      expect(pistiGame.gameOver({ ...state, status: 'finished' as const })).toBe(true);
    });
  });
});
