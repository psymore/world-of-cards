# Pis Yedili Rule Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `PisYedeliState`/`PisYedeliMove`/`PisYedeliSetupOptions` types and the full `pisYedeliGame: RuleEngine<PisYedeliState, PisYedeliMove, PisYedeliSetupOptions>` (setup, getLegalMoves, validateMove, performMove, calculateScore, determineWinner, gameOver) defined in `docs/superpowers/specs/2026-08-21-pis-yedili-rules-and-state-design.md`, so the next sub-project (AI strategies) has a fully working, tested rule engine to drive.

**Architecture:** One data-only file (`types.ts`, no runtime logic, matching `packages/engine/src/games/pisti/types.ts`'s precedent of no dedicated test file) plus one rule-engine file (`rules.ts`) implementing the `RuleEngine` contract from `packages/engine/src/rules/types.ts`, built directly on existing shared primitives (`createDeck`/`shuffle` from `core/deck.ts`, `createTable`/`createZone`/`dealToZones`/`moveCard` from `core/table.ts`) with no new shared/core code — this game needs no rank comparator (unlike Batak), since matching is pure suit/rank equality with no "beats" relationship anywhere in the rules.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`) for the engine package's Node-environment test project.

**Spec:** `docs/superpowers/specs/2026-08-21-pis-yedili-rules-and-state-design.md`

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo.
- `GameState` (and `PisYedeliState`, which extends it) must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- Single 52-card deck, no jokers (spec Section 1).
- 2–4 players, free-for-all only — no partnership/team mode (spec Context).
- No card ranking/order matters for gameplay beyond suit/rank equality — the only place a rank order is needed at all is the one-time "lowest club starts" bootstrap check in `setup`, which is a self-contained convention local to this game (ace counted high), not a reusable core primitive.
- `performMove(state, move)` receives no `RNG` (only `setup` does) — the stock-replenishment-when-empty mechanic must be a plain flip of `discard` (minus its top card) into `stock`, never a reshuffle.
- AI strategies, the mobile UI, and `simulateGames`-based invariant tests are explicitly out of scope for this plan (spec's "Out of Scope" section) — they are later sub-projects.

---

### Task 1: Data model, `setup`, and the terminal-state functions (`gameOver`, `determineWinner`, `calculateScore`)

**Files:**
- Create: `packages/engine/src/games/pis-yedili/types.ts`
- Create: `packages/engine/src/games/pis-yedili/rules.ts`
- Create: `packages/engine/src/games/pis-yedili/rules.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId`, `RuleEngine`, `ScoreBoard` from `packages/engine/src/rules/types.ts` (existing: `interface GameState { gameId: string; players: PlayerId[]; currentPlayerIndex: number; table: TableState; rngState: RngState; status: 'setup' | 'in-progress' | 'finished'; }`; `type PlayerId = string`; `interface RuleEngine<TState, TMove, TOptions> { setup(options, rng): TState; validateMove(state, move, playerId): boolean; performMove(state, move): TState; getLegalMoves(state, playerId): TMove[]; calculateScore(state): ScoreBoard; determineWinner(state): PlayerId[] | null; gameOver(state): boolean; }`); `Card`, `Suit`, `Rank` from `packages/engine/src/core/types.ts`; `createDeck`, `shuffle` from `packages/engine/src/core/deck.ts` (existing: `createDeck(config: { deckCount: number; includeJokers: boolean }): Card[]`, `shuffle(cards: Card[], rng: RNG): Card[]`); `createTable`, `createZone`, `dealToZones`, `TableState` from `packages/engine/src/core/table.ts` (existing: `createTable(zones: Zone[]): TableState`, `createZone(id: string, faceUp: boolean | 'top-only', cards?: Card[]): Zone`, `dealToZones(deck, table, assignments: Array<{zoneId, count}>): { table, remainingDeck }`); `RNG` from `packages/engine/src/core/rng.ts` (existing: `createRng(seed: number): RNG`, `RNG.getState(): RngState`).
- Produces: `PisYedeliState`, `PisYedeliMove`, `PisYedeliSetupOptions` (types); `pisYedeliGame: RuleEngine<PisYedeliState, PisYedeliMove, PisYedeliSetupOptions>` with working `setup`, `calculateScore`, `determineWinner`, `gameOver` (this task) and stub `getLegalMoves`/`validateMove`/`performMove` that throw `new Error('not implemented')` (replaced for real in Tasks 2–3); `findStartingPlayerIndex(players: PlayerId[], table: TableState): number` and `canDraw(table: TableState): boolean` as separately-exported pure helper functions, each with their own dedicated unit tests (mirroring how Batak exports `trickWinnerIndex`/`fourCardCombinations`/`buriableCards` from `rules.ts` for direct testing) — later tasks and the AI sub-project may reuse `canDraw`.

- [ ] **Step 1: Create the types file**

Create `packages/engine/src/games/pis-yedili/types.ts`:

```ts
import { GameState, PlayerId } from '../../rules/types';
import { Suit } from '../../core/types';

export interface PisYedeliState extends GameState {
  activeSuit: Suit | null; // suit that must be matched next; null only before the game opens
  pendingDraw: number;     // cards the current player owes from stacked 7s; 0 = no penalty active
}

export type PisYedeliMove =
  | { type: 'play'; cardId: string; declaredSuit?: Suit } // declaredSuit required iff cardId is a Jack
  | { type: 'draw' }
  | { type: 'pass' };

export interface PisYedeliSetupOptions {
  players: PlayerId[]; // 2-4
}
```

- [ ] **Step 2: Write the failing tests for `findStartingPlayerIndex`, `canDraw`, `setup`, `gameOver`, `determineWinner`, `calculateScore`**

Create `packages/engine/src/games/pis-yedili/rules.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from repo root): `npm test -- packages/engine/src/games/pis-yedili/rules.test.ts`
Expected: FAIL — `packages/engine/src/games/pis-yedili/rules.ts` does not exist yet (module not found).

- [ ] **Step 4: Implement `rules.ts` (this task's portion)**

Create `packages/engine/src/games/pis-yedili/rules.ts`:

```ts
import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, moveCard, TableState } from '../../core/table';
import { Card, Rank } from '../../core/types';
import { PisYedeliState, PisYedeliMove, PisYedeliSetupOptions } from './types';

// Used only to pick a "lowest club" starting player in setup() — Pis Yedili has no rank-comparison
// rule anywhere else in play, so this ascending order (ace counted high) is a bootstrap-only
// convention, not a reusable general rule.
const ASCENDING_RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function makeEmptyTable(players: PlayerId[]): TableState {
  return createTable([
    createZone('stock', false),
    createZone('discard', true),
    ...players.map((p) => createZone(`hand-${p}`, true)),
  ]);
}

export function findStartingPlayerIndex(players: PlayerId[], table: TableState): number {
  let bestIndex = 0;
  let bestRankValue = Infinity;
  players.forEach((p, i) => {
    for (const c of table.zones[`hand-${p}`].cards) {
      if (c.suit === 'clubs') {
        const value = ASCENDING_RANK_ORDER.indexOf(c.rank);
        if (value < bestRankValue) {
          bestRankValue = value;
          bestIndex = i;
        }
      }
    }
  });
  return bestIndex;
}

export function canDraw(table: TableState): boolean {
  if (table.zones['stock'].cards.length > 0) return true;
  return table.zones['discard'].cards.length > 1;
}

export const pisYedeliGame: RuleEngine<PisYedeliState, PisYedeliMove, PisYedeliSetupOptions> = {
  setup(options: PisYedeliSetupOptions, rng): PisYedeliState {
    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const { table, remainingDeck } = dealToZones(
      deck,
      makeEmptyTable(options.players),
      options.players.map((p) => ({ zoneId: `hand-${p}`, count: 7 }))
    );
    const finalTable: TableState = {
      zones: { ...table.zones, stock: { ...table.zones['stock'], cards: remainingDeck } },
    };
    return {
      gameId: 'pis-yedili',
      players: options.players,
      currentPlayerIndex: findStartingPlayerIndex(options.players, finalTable),
      table: finalTable,
      rngState: rng.getState(),
      status: 'in-progress',
      activeSuit: null,
      pendingDraw: 0,
    };
  },

  getLegalMoves(): PisYedeliMove[] {
    throw new Error('not implemented');
  },

  validateMove(): boolean {
    throw new Error('not implemented');
  },

  performMove(): PisYedeliState {
    throw new Error('not implemented');
  },

  calculateScore(state: PisYedeliState): ScoreBoard {
    const score: ScoreBoard = {};
    const winner = state.players.find((p) => state.table.zones[`hand-${p}`].cards.length === 0);
    for (const p of state.players) {
      score[p] = p === winner ? 1 : 0;
    }
    return score;
  },

  determineWinner(state: PisYedeliState): PlayerId[] | null {
    if (state.status !== 'finished') return null;
    const winner = state.players.find((p) => state.table.zones[`hand-${p}`].cards.length === 0);
    return winner ? [winner] : null;
  },

  gameOver(state: PisYedeliState): boolean {
    return state.status === 'finished';
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from repo root): `npm test -- packages/engine/src/games/pis-yedili/rules.test.ts`
Expected: PASS for every test written in Step 2. (`getLegalMoves`/`validateMove`/`performMove` are not called by any of these tests, so their `throw` stubs are never hit.)

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/pis-yedili/types.ts packages/engine/src/games/pis-yedili/rules.ts packages/engine/src/games/pis-yedili/rules.test.ts
git commit -m "Add Pis Yedili data model, setup, and terminal-state rule-engine functions"
```

---

### Task 2: `getLegalMoves` and `validateMove`

**Files:**
- Modify: `packages/engine/src/games/pis-yedili/rules.ts` (replace the `getLegalMoves`/`validateMove` stubs)
- Modify: `packages/engine/src/games/pis-yedili/rules.test.ts` (append new `describe` blocks)

**Interfaces:**
- Consumes: `PisYedeliState`, `PisYedeliMove` (Task 1); `canDraw` (Task 1, same file); `Suit` from `packages/engine/src/core/types.ts` (existing: `type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'`).
- Produces: working `getLegalMoves(state, playerId): PisYedeliMove[]` and `validateMove(state, move, playerId): boolean` that Task 3's `performMove` and the eventual AI sub-project both call.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/src/games/pis-yedili/rules.test.ts`:

```ts
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
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/engine/src/games/pis-yedili/rules.test.ts`
Expected: FAIL — every new test throws `Error: not implemented`.

- [ ] **Step 3: Implement `getLegalMoves` and `validateMove`**

In `packages/engine/src/games/pis-yedili/rules.ts`, add near the top (below the `ASCENDING_RANK_ORDER` constant):

```ts
import { Suit } from '../../core/types'; // add Suit to the existing core/types import

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
```

Replace the `getLegalMoves` and `validateMove` stubs inside `pisYedeliGame`:

```ts
  getLegalMoves(state: PisYedeliState, playerId: PlayerId): PisYedeliMove[] {
    if (state.status !== 'in-progress') return [];
    if (state.players[state.currentPlayerIndex] !== playerId) return [];

    const hand = state.table.zones[`hand-${playerId}`].cards;
    const discard = state.table.zones['discard'].cards;
    const drawable = canDraw(state.table);

    if (discard.length === 0) {
      const clubs = hand.filter((c) => c.suit === 'clubs');
      if (clubs.length > 0) {
        return clubs.map((c) => ({ type: 'play' as const, cardId: c.id }));
      }
      return drawable ? [{ type: 'draw' as const }] : [];
    }

    if (state.pendingDraw > 0) {
      const moves: PisYedeliMove[] = hand
        .filter((c) => c.rank === '7')
        .map((c) => ({ type: 'play' as const, cardId: c.id }));
      if (drawable) moves.push({ type: 'draw' });
      if (moves.length === 0) moves.push({ type: 'pass' });
      return moves;
    }

    const topRank = discard[discard.length - 1].rank;
    const moves: PisYedeliMove[] = [];
    for (const c of hand) {
      if (c.rank === 'J') {
        for (const suit of SUITS) {
          moves.push({ type: 'play', cardId: c.id, declaredSuit: suit });
        }
      } else if (c.rank === '7' || c.suit === state.activeSuit || c.rank === topRank) {
        moves.push({ type: 'play', cardId: c.id });
      }
    }
    if (drawable) moves.push({ type: 'draw' });
    if (!moves.some((m) => m.type === 'play')) moves.push({ type: 'pass' });
    return moves;
  },

  validateMove(state: PisYedeliState, move: PisYedeliMove, playerId: PlayerId): boolean {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;
    const legal = pisYedeliGame.getLegalMoves(state, playerId);
    if (move.type === 'play') {
      return legal.some(
        (m) => m.type === 'play' && m.cardId === move.cardId && m.declaredSuit === move.declaredSuit
      );
    }
    return legal.some((m) => m.type === move.type);
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/engine/src/games/pis-yedili/rules.test.ts`
Expected: PASS — all tests from Task 1 and Task 2.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/pis-yedili/rules.ts packages/engine/src/games/pis-yedili/rules.test.ts
git commit -m "Add Pis Yedili getLegalMoves and validateMove"
```

---

### Task 3: `performMove`

**Files:**
- Modify: `packages/engine/src/games/pis-yedili/rules.ts` (replace the `performMove` stub)
- Modify: `packages/engine/src/games/pis-yedili/rules.test.ts` (append a new `describe` block)

**Interfaces:**
- Consumes: `moveCard` from `packages/engine/src/core/table.ts` (existing: `moveCard(table, cardId, fromZoneId, toZoneId): TableState`); `getLegalMoves`/`canDraw` (Tasks 1–2, same file).
- Produces: a fully working `pisYedeliGame`, ready for the AI-strategies sub-project to drive via `simulateGames`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/src/games/pis-yedili/rules.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/engine/src/games/pis-yedili/rules.test.ts`
Expected: FAIL — every new test throws `Error: not implemented`.

- [ ] **Step 3: Implement `performMove`**

Replace the `performMove` stub inside `pisYedeliGame`:

```ts
  performMove(state: PisYedeliState, move: PisYedeliMove): PisYedeliState {
    const playerId = state.players[state.currentPlayerIndex];
    const playerCount = state.players.length;

    if (move.type === 'pass') {
      return { ...state, currentPlayerIndex: (state.currentPlayerIndex + 1) % playerCount };
    }

    if (move.type === 'draw') {
      let table = state.table;
      if (table.zones['stock'].cards.length === 0) {
        const discardCards = table.zones['discard'].cards;
        const top = discardCards[discardCards.length - 1];
        const rest = discardCards.slice(0, -1).reverse();
        table = {
          zones: {
            ...table.zones,
            discard: { ...table.zones['discard'], cards: [top] },
            stock: { ...table.zones['stock'], cards: rest },
          },
        };
      }
      const stockCards = table.zones['stock'].cards;
      const drawnCard = stockCards[stockCards.length - 1];
      table = moveCard(table, drawnCard.id, 'stock', `hand-${playerId}`);
      return { ...state, table, pendingDraw: state.pendingDraw > 0 ? state.pendingDraw - 1 : 0 };
    }

    const handZone = `hand-${playerId}`;
    const playedCard = state.table.zones[handZone].cards.find((c) => c.id === move.cardId)!;
    const table = moveCard(state.table, move.cardId, handZone, 'discard');
    const activeSuit = playedCard.rank === 'J' ? move.declaredSuit! : playedCard.suit!;
    const pendingDraw = playedCard.rank === '7' ? state.pendingDraw + 2 : 0;
    const advance = playedCard.rank === 'J' ? 2 : 1;
    const nextIndex = (state.currentPlayerIndex + advance) % playerCount;
    const handEmpty = table.zones[handZone].cards.length === 0;

    return {
      ...state,
      table,
      activeSuit,
      pendingDraw,
      currentPlayerIndex: nextIndex,
      status: handEmpty ? 'finished' : 'in-progress',
    };
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/engine/src/games/pis-yedili/rules.test.ts`
Expected: PASS — every test in the file (Tasks 1–3).

- [ ] **Step 5: Run the full engine test suite to confirm no regressions**

Run: `npm test`
Expected: PASS — every existing suite across `packages/engine`, plus the new `pis-yedili` tests.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/pis-yedili/rules.ts packages/engine/src/games/pis-yedili/rules.test.ts
git commit -m "Add Pis Yedili performMove, completing the rule engine"
```

---

## Self-Review Notes

- **Spec coverage:** Section 2 (Data Model) is covered by Task 1's `types.ts`. Section 3's `setup` is covered by Task 1; `getLegalMoves` (all three branches — pre-opening, pending-penalty, normal) by Task 2; `performMove` (draw incl. stock-flip, pass, play incl. suit activation, seven-stacking, Jack-skip, hand-empty finish) by Task 3; `calculateScore`/`determineWinner`/`gameOver` by Task 1. Out-of-scope items (AI, UI, `simulateGames` tests, teams, multi-deck) are correctly left untouched, per the spec's own "Out of Scope" section.
- **Placeholder scan:** No TBD/TODO. Task 1's `getLegalMoves`/`validateMove`/`performMove` stubs `throw new Error('not implemented')` rather than returning fabricated values — a deliberate, temporary placeholder that Tasks 2–3 replace before the plan ends, not a permanent gap.
- **Type consistency:** `PisYedeliState`/`PisYedeliMove`/`PisYedeliSetupOptions` field and variant names are used identically across all three tasks (`activeSuit`, `pendingDraw`, `declaredSuit`, `players`). `findStartingPlayerIndex` and `canDraw` keep the same signatures from their Task 1 introduction through their Task 2/3 call sites. `RuleEngine<PisYedeliState, PisYedeliMove, PisYedeliSetupOptions>` matches the shared contract in `packages/engine/src/rules/types.ts` exactly (`determineWinner` returns `PlayerId[] | null`, `performMove` takes no `RNG`).

## Next Step

Brainstorm and plan the Pis Yedili `AIStrategy` (Easy/Medium/Hard) implementation sub-project, building on `pisYedeliGame`, `PisYedeliState`/`PisYedeliMove`, and `canDraw` from this plan — that sub-project is also where `index.ts`/`registerGame` wiring and the first `simulateGames`-based invariant tests belong, matching the Pişti/Batak precedent of registering a game only once its `AIStrategy` set exists.
