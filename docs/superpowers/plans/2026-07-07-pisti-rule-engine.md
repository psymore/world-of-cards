# Pişti RuleEngine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `pistiGame: RuleEngine<PistiState, PistiMove>` for Pişti — a fully correct, unit-tested rule engine with no AI, UI, or registry integration yet.

**Architecture:** One new file, `packages/engine/src/games/pisti/rules.ts`, exporting a single `pistiGame` object literal implementing all seven `RuleEngine` contract functions, built test-first against `packages/engine/src/games/pisti/rules.test.ts`. Task 1 implements the six simpler functions (with a stub `performMove`); Task 2 replaces the stub with the full capture/flow-control logic, which is the one function with real game-rule complexity.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`), no new dependencies.

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo.
- `PistiState` must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- Card values: 1 pt each for Ace and Jack, 2 pts for the 2 of Clubs, 3 pts for the 10 of Diamonds. 3-pt majority bonus to whoever captured strictly more cards (no bonus on a 26–26 tie).
- **Pişti bonus (corrected — see `docs/superpowers/specs/2026-07-07-pisti-rules-and-state-design.md`'s Section 1 and Section 3, as amended):** on a capture where the pile had exactly 1 card before the play: award **20 points** if that lone card was a Jack (only capturable by another Jack); award **10 points** if the played card's rank matches the lone card's rank (a non-Jack, same-rank capture); award **no bonus** if a Jack captured a lone non-Jack card via wildcard. This is a corrected rule — do not use the simpler "any capture of a lone card scores a bonus" version that appeared in an earlier draft of the spec.
- Jack rule: if the pile's top card is a Jack, only another Jack can capture it. Otherwise, a play captures if it matches the top card's rank, or if the played card is a Jack.
- `validateMove` checks `status === 'in-progress'`, that it's the given player's turn, and that the card is in their hand. `performMove` does not re-validate — it trusts the caller, relying on `moveCard` to throw on an invalid `cardId`.

---

### Task 1: `pistiGame` scaffold — setup, validateMove, getLegalMoves, calculateScore, determineWinner, gameOver

**Files:**
- Create: `packages/engine/src/games/pisti/rules.ts`
- Create: `packages/engine/src/games/pisti/rules.test.ts`

**Interfaces:**
- Consumes: `PistiState`, `PistiMove`, `PistiSetupOptions` from `packages/engine/src/games/pisti/types.ts` (existing: `PistiState extends GameState` with `lastCapturedBy: PlayerId | null` and `pistiBonusPoints: Record<PlayerId, number>`; `PistiMove = { type: 'play'; cardId: string }`; `PistiSetupOptions = { players: [PlayerId, PlayerId] }`). `RuleEngine<TState, TMove>`, `PlayerId`, `ScoreBoard` from `packages/engine/src/rules/types.ts`. `createDeck`, `shuffle` from `packages/engine/src/core/deck.ts`. `createTable`, `createZone`, `dealToZones` from `packages/engine/src/core/table.ts`. `RNG`, `createRng` from `packages/engine/src/core/rng.ts`. `Card` from `packages/engine/src/core/types.ts`.
- Produces: `pistiGame: RuleEngine<PistiState, PistiMove>` (with a stub `performMove` that throws — Task 2 replaces it), and the private helpers `cardPoints(card: Card): number` and `makeEmptyTable(p0: PlayerId, p1: PlayerId): TableState`, both used internally by `rules.ts` and by Task 2 without needing new exports (Task 2 edits the same file).

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/games/pisti/rules.test.ts`:

```ts
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
        expect(state.table.zones['pile'].cards.some((c) => c.rank === 'J')).toBe(false);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — `./rules` module doesn't exist yet.

- [ ] **Step 3: Implement `rules.ts` (with a stubbed `performMove`)**

Create `packages/engine/src/games/pisti/rules.ts`:

```ts
import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, TableState } from '../../core/table';
import { RNG } from '../../core/rng';
import { Card } from '../../core/types';
import { PistiState, PistiMove, PistiSetupOptions } from './types';

function cardPoints(card: Card): number {
  if (card.rank === 'A' || card.rank === 'J') return 1;
  if (card.suit === 'clubs' && card.rank === '2') return 2;
  if (card.suit === 'diamonds' && card.rank === '10') return 3;
  return 0;
}

function makeEmptyTable(p0: PlayerId, p1: PlayerId): TableState {
  return createTable([
    createZone('stock', false),
    createZone('pile', 'top-only'),
    createZone(`hand-${p0}`, true),
    createZone(`hand-${p1}`, true),
    createZone(`captured-${p0}`, true),
    createZone(`captured-${p1}`, true),
  ]);
}

export const pistiGame: RuleEngine<PistiState, PistiMove> = {
  setup(options: unknown, rng: RNG): PistiState {
    const opts = options as PistiSetupOptions;
    const [p0, p1] = opts.players;

    let deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    let dealt = dealToZones(deck, makeEmptyTable(p0, p1), [{ zoneId: 'pile', count: 4 }]);
    while (dealt.table.zones['pile'].cards.some((c) => c.rank === 'J')) {
      deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
      dealt = dealToZones(deck, makeEmptyTable(p0, p1), [{ zoneId: 'pile', count: 4 }]);
    }

    const { table: tableWithHands, remainingDeck } = dealToZones(dealt.remainingDeck, dealt.table, [
      { zoneId: `hand-${p0}`, count: 4 },
      { zoneId: `hand-${p1}`, count: 4 },
    ]);

    const table: TableState = {
      ...tableWithHands,
      zones: {
        ...tableWithHands.zones,
        stock: { ...tableWithHands.zones['stock'], cards: remainingDeck },
      },
    };

    return {
      gameId: 'pisti',
      players: [p0, p1],
      currentPlayerIndex: 0,
      table,
      rngState: rng.getState(),
      status: 'in-progress',
      lastCapturedBy: null,
      pistiBonusPoints: { [p0]: 0, [p1]: 0 },
    };
  },

  validateMove(state: PistiState, move: PistiMove, playerId: PlayerId): boolean {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;
    return state.table.zones[`hand-${playerId}`].cards.some((c) => c.id === move.cardId);
  },

  performMove(): PistiState {
    throw new Error('pistiGame.performMove: not yet implemented');
  },

  getLegalMoves(state: PistiState, playerId: PlayerId): PistiMove[] {
    if (state.players[state.currentPlayerIndex] !== playerId) return [];
    return state.table.zones[`hand-${playerId}`].cards.map((card) => ({ type: 'play', cardId: card.id }));
  },

  calculateScore(state: PistiState): ScoreBoard {
    const score: ScoreBoard = {};
    const [p0, p1] = state.players;
    const captured0 = state.table.zones[`captured-${p0}`].cards;
    const captured1 = state.table.zones[`captured-${p1}`].cards;

    score[p0] = captured0.reduce((sum, c) => sum + cardPoints(c), 0) + state.pistiBonusPoints[p0];
    score[p1] = captured1.reduce((sum, c) => sum + cardPoints(c), 0) + state.pistiBonusPoints[p1];

    if (captured0.length > captured1.length) {
      score[p0] += 3;
    } else if (captured1.length > captured0.length) {
      score[p1] += 3;
    }

    return score;
  },

  determineWinner(state: PistiState): PlayerId[] | null {
    if (state.status !== 'finished') return null;
    const score = pistiGame.calculateScore(state);
    const maxScore = Math.max(...state.players.map((p) => score[p]));
    return state.players.filter((p) => score[p] === maxScore);
  },

  gameOver(state: PistiState): boolean {
    return state.status === 'finished';
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS for every test except none — all tests in this task avoid calling `performMove`, so all should pass. If any test unexpectedly calls `performMove`, that's a mistake in the test file — fix it to match Step 1 exactly.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite, including the new `rules.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/pisti/rules.ts packages/engine/src/games/pisti/rules.test.ts
git commit -m "Add Pişti rule engine scaffold (setup, validateMove, getLegalMoves, calculateScore, determineWinner, gameOver)"
```

---

### Task 2: `performMove` — capture rules and flow control

**Files:**
- Modify: `packages/engine/src/games/pisti/rules.ts` (replace the `performMove` stub)
- Modify: `packages/engine/src/games/pisti/rules.test.ts` (append a `describe('performMove', ...)` block)

**Interfaces:**
- Consumes: everything Task 1 produced — `pistiGame`, `cardPoints`, `makeEmptyTable`, and the `card`/`makeState` test helpers already defined at the top of `rules.test.ts`. Also needs `moveCard` and `moveAllCards` from `packages/engine/src/core/table.ts` (both already exist — `moveAllCards` was added in the prior `pisti-state-model` plan).
- Produces: a fully working `pistiGame.performMove(state, move): PistiState`. Nothing later in this plan depends on it (this is the plan's last task), but the next sub-project (AI strategies) will call it directly.

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `packages/engine/src/games/pisti/rules.test.ts`, as a new top-level block alongside the existing `describe('pistiGame (rule engine)', ...)` (i.e., add it as a sibling `describe` at the end of the file, after the closing `});` of the existing outer describe — do not nest it inside):

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — every new test in `pistiGame performMove` throws `Error: pistiGame.performMove: not yet implemented`.

- [ ] **Step 3: Implement `performMove`**

In `packages/engine/src/games/pisti/rules.ts`, first update the import line to add `moveCard` and `moveAllCards`:

```ts
import { createTable, createZone, dealToZones, moveCard, moveAllCards, TableState } from '../../core/table';
```

Then replace this exact block:

```ts
  performMove(): PistiState {
    throw new Error('pistiGame.performMove: not yet implemented');
  },
```

with:

```ts
  performMove(state: PistiState, move: PistiMove): PistiState {
    const playerId = state.players[state.currentPlayerIndex];
    const handZone = `hand-${playerId}`;
    const playedCard = state.table.zones[handZone].cards.find((c) => c.id === move.cardId)!;
    const pileBefore = state.table.zones['pile'].cards;
    const pileSizeBefore = pileBefore.length;
    const topCardBefore = pileBefore[pileBefore.length - 1];

    let table = moveCard(state.table, move.cardId, handZone, 'pile');

    let captured = false;
    if (topCardBefore) {
      if (topCardBefore.rank === 'J') {
        captured = playedCard.rank === 'J';
      } else {
        captured = playedCard.rank === topCardBefore.rank || playedCard.rank === 'J';
      }
    }

    let lastCapturedBy = state.lastCapturedBy;
    let pistiBonusPoints = state.pistiBonusPoints;

    if (captured) {
      table = moveAllCards(table, 'pile', `captured-${playerId}`);
      lastCapturedBy = playerId;

      if (pileSizeBefore === 1) {
        let bonus = 0;
        if (topCardBefore.rank === 'J') {
          bonus = 20;
        } else if (playedCard.rank === topCardBefore.rank) {
          bonus = 10;
        }
        if (bonus > 0) {
          pistiBonusPoints = { ...pistiBonusPoints, [playerId]: pistiBonusPoints[playerId] + bonus };
        }
      }
    }

    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const [p0, p1] = state.players;
    const bothHandsEmpty =
      table.zones[`hand-${p0}`].cards.length === 0 && table.zones[`hand-${p1}`].cards.length === 0;

    let status = state.status;
    if (bothHandsEmpty) {
      const stock = table.zones['stock'].cards;
      if (stock.length > 0) {
        const dealt = dealToZones(stock, table, [
          { zoneId: `hand-${p0}`, count: 4 },
          { zoneId: `hand-${p1}`, count: 4 },
        ]);
        table = {
          ...dealt.table,
          zones: { ...dealt.table.zones, stock: { ...dealt.table.zones['stock'], cards: dealt.remainingDeck } },
        };
      } else {
        if (table.zones['pile'].cards.length > 0 && lastCapturedBy) {
          table = moveAllCards(table, 'pile', `captured-${lastCapturedBy}`);
        }
        status = 'finished';
      }
    }

    return {
      ...state,
      table,
      currentPlayerIndex: nextIndex,
      lastCapturedBy,
      pistiBonusPoints,
      status,
    };
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS — every test in `rules.test.ts`.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/pisti/rules.ts packages/engine/src/games/pisti/rules.test.ts
git commit -m "Implement Pişti performMove capture rules and flow control"
```

---

## Self-Review Notes

- **Spec coverage:** The RuleEngine design spec's Section 1 (file structure), Section 2 (`validateMove` semantics), and Section 3 (test coverage plan) are each covered — Task 1 covers setup/validateMove/getLegalMoves/calculateScore/determineWinner/gameOver and their listed test categories; Task 2 covers every capture-rule branch listed (matching capture with no bonus, Jack-captures-anything, Jack-only-captures-Jack, non-capturing placement, pişti bonus, double pişti bonus), plus turn advancement, redeal, and end-of-hand sweep.
- **Corrected pişti-bonus rule:** this plan's Task 2 test suite includes the "awards no bonus when a Jack captures a lone non-Jack card via wildcard" case specifically, which exercises the bug caught and fixed in the state-model spec during this plan's writing (see the Global Constraints section above and the amended spec).
- **Type consistency:** `pistiGame`, `PistiState`, `PistiMove`, `cardPoints`, `makeEmptyTable` are named identically across both tasks. Task 2's `performMove` signature (`(state: PistiState, move: PistiMove): PistiState`) matches the `RuleEngine<PistiState, PistiMove>` contract and the stub it replaces.
- **No placeholders:** every step has complete, runnable code and exact commands.

## Next Step

Brainstorm and plan the Pişti `AIStrategy` (Easy/Medium/Hard) sub-project, building on `pistiGame` from this plan — at which point `registerGame` and `simulateGames`-based testing both become possible.
