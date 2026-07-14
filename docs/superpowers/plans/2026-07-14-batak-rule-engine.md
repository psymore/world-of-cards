# Batak RuleEngine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `batakGame: RuleEngine<BatakState, BatakMove>` for 4-player individual Batak — a fully correct, unit-tested rule engine with no AI, UI, or registry integration yet.

**Architecture:** One new file, `packages/engine/src/games/batak/rules.ts`, exporting a single `batakGame` object literal implementing all seven `RuleEngine` contract functions, built test-first against `packages/engine/src/games/batak/rules.test.ts`. Task 1 implements the scaffold (`setup`, `validateMove`, `calculateScore`, `determineWinner`, `gameOver`, and `getLegalMoves` for the `bidding`/`trump-selection`/`finished` phases) with a stubbed `performMove` and a stubbed `getLegalMoves('playing')`. Task 2 replaces the `performMove` stub for `bid`/`pass`/`selectTrump` (the auction/trump-selection state machine), leaving `play` still stubbed. Task 3 replaces both remaining stubs — `getLegalMoves('playing')` and `performMove('play')` — with the trick-taking logic, which is where the real game-rule complexity lives.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`), no new dependencies.

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo.
- `BatakState` must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- Bid range: first bid of an auction must be `>= 5`; every subsequent bid must exceed `highestBid`; maximum bid is `13`. Minimum legal bid at any point is `Math.max(5, highestBid + 1)`.
- Forced contract when every player passes: `contract: 4`, `bidWinner: state.players[0]` — regardless of bidding order or who passed last.
- Scoring has no ×10 multiplier. Bid winner: tricks won `>= contract` scores actual tricks won, else scores `-contract`. Every other player: `0` tricks won scores `-contract`; otherwise scores actual tricks won.
- **Implementation detail not spelled out in the state-model spec's algorithm summary, resolved here:** `currentPlayerIndex` must be explicitly set to the bid winner's index at **both** phase transitions — when the auction closes (`bidding` → `trump-selection`) and when trump is selected (`trump-selection` → `playing`). Every `getLegalMoves`/`validateMove` call is gated by `state.players[state.currentPlayerIndex] === playerId`; without this, the bid winner would have no legal moves during trump selection.
- **Load-bearing invariant, flagged by the state-model sub-project's final review:** `state.currentTrick` (an array of `{ playerId, cardId }`) and `state.table.zones['trick'].cards` (an array of `Card`) must always be modified in lockstep — same length at all times, and positionally corresponding by index (`currentTrick[i].playerId` played `table.zones['trick'].cards[i]`). Trick-resolution logic in Task 3 depends on this to map a winning `Card` back to the `PlayerId` who played it.

---

### Task 1: `batakGame` scaffold — setup, validateMove, calculateScore, determineWinner, gameOver, and getLegalMoves for bidding/trump-selection/finished

**Files:**
- Create: `packages/engine/src/games/batak/rules.ts`
- Create: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: `BatakState`, `BatakMove`, `BatakSetupOptions` from `packages/engine/src/games/batak/types.ts` (existing, see that file for the full shape). `RuleEngine<TState, TMove>`, `PlayerId`, `ScoreBoard` from `packages/engine/src/rules/types.ts`. `createDeck`, `shuffle` from `packages/engine/src/core/deck.ts`. `createTable`, `createZone`, `dealToZones`, `TableState` from `packages/engine/src/core/table.ts`. `RNG` from `packages/engine/src/core/rng.ts`. `Suit` from `packages/engine/src/core/types.ts`.
- Produces: `batakGame: RuleEngine<BatakState, BatakMove>` (with a stub `performMove` that throws, and a `getLegalMoves('playing')` branch that throws — Tasks 2 and 3 replace these), plus the private helpers `makeEmptyTable(players: PlayerId[]): TableState`, `biddingLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[]`, and `trumpSelectionLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[]` — all used internally by `rules.ts` and consumed by Tasks 2/3 without needing new exports (they edit the same file).

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/games/batak/rules.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — `./rules` module doesn't exist yet (`packages/engine/src/games/batak/rules.ts` not found).

- [ ] **Step 3: Implement `rules.ts` (with stubbed performMove and stubbed getLegalMoves('playing'))**

Create `packages/engine/src/games/batak/rules.ts`:

```ts
import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, TableState } from '../../core/table';
import { RNG } from '../../core/rng';
import { Suit } from '../../core/types';
import { BatakState, BatakMove, BatakSetupOptions } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function makeEmptyTable(players: PlayerId[]): TableState {
  return createTable([
    ...players.map((p) => createZone(`hand-${p}`, true)),
    createZone('trick', true),
    ...players.map((p) => createZone(`won-${p}`, true)),
  ]);
}

function biddingLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (state.bids[playerId] === 'pass') return [];
  const moves: BatakMove[] = [{ type: 'pass' }];
  const minBid = Math.max(5, state.highestBid + 1);
  for (let amount = minBid; amount <= 13; amount++) {
    moves.push({ type: 'bid', amount });
  }
  return moves;
}

function trumpSelectionLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (playerId !== state.bidWinner) return [];
  return SUITS.map((suit) => ({ type: 'selectTrump', suit }));
}

export const batakGame: RuleEngine<BatakState, BatakMove> = {
  setup(options: unknown, rng: RNG): BatakState {
    const opts = options as BatakSetupOptions;
    const { players } = opts;

    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const { table } = dealToZones(
      deck,
      makeEmptyTable(players),
      players.map((p) => ({ zoneId: `hand-${p}`, count: 13 }))
    );

    return {
      gameId: 'batak',
      players,
      currentPlayerIndex: 0,
      table,
      rngState: rng.getState(),
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
    };
  },

  validateMove(state: BatakState, move: BatakMove, playerId: PlayerId): boolean {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;

    switch (move.type) {
      case 'bid':
        return (
          state.phase === 'bidding' &&
          state.bids[playerId] !== 'pass' &&
          move.amount >= Math.max(5, state.highestBid + 1) &&
          move.amount <= 13
        );
      case 'pass':
        return state.phase === 'bidding' && state.bids[playerId] !== 'pass';
      case 'selectTrump':
        return state.phase === 'trump-selection' && playerId === state.bidWinner;
      case 'play':
        return (
          state.phase === 'playing' &&
          batakGame.getLegalMoves(state, playerId).some((m) => m.type === 'play' && m.cardId === move.cardId)
        );
    }
  },

  performMove(): BatakState {
    throw new Error('batakGame.performMove: not yet implemented');
  },

  getLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
    if (state.players[state.currentPlayerIndex] !== playerId) return [];
    switch (state.phase) {
      case 'bidding':
        return biddingLegalMoves(state, playerId);
      case 'trump-selection':
        return trumpSelectionLegalMoves(state, playerId);
      case 'playing':
        throw new Error('batakGame.getLegalMoves: playing phase not yet implemented');
      case 'finished':
        return [];
    }
  },

  calculateScore(state: BatakState): ScoreBoard {
    const score: ScoreBoard = {};
    const contract = state.contract!;
    for (const p of state.players) {
      const tricks = state.tricksWon[p];
      if (p === state.bidWinner) {
        score[p] = tricks >= contract ? tricks : -contract;
      } else {
        score[p] = tricks === 0 ? -contract : tricks;
      }
    }
    return score;
  },

  determineWinner(state: BatakState): PlayerId[] | null {
    if (state.status !== 'finished') return null;
    const score = batakGame.calculateScore(state);
    const maxScore = Math.max(...state.players.map((p) => score[p]));
    return state.players.filter((p) => score[p] === maxScore);
  },

  gameOver(state: BatakState): boolean {
    return state.status === 'finished';
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS — every test in this task's file (none of them call `performMove` or `getLegalMoves` during the `'playing'` phase).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite, including the new `rules.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Add Batak rule engine scaffold (setup, validateMove, bidding/trump-selection legal moves, scoring)"
```

---

### Task 2: `performMove` for bidding and trump selection — the auction state machine

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts` (replace the `performMove` stub)
- Modify: `packages/engine/src/games/batak/rules.test.ts` (append a new top-level `describe` block)

**Interfaces:**
- Consumes: everything Task 1 produced — `batakGame`, `makeEmptyTable`, `biddingLegalMoves`, `trumpSelectionLegalMoves`, and the `card`/`makeState`/`emptyTable`/`PLAYERS` test helpers already defined in `rules.test.ts`.
- Produces: `batakGame.performMove` correctly handling `'bid'`, `'pass'`, and `'selectTrump'` moves, with `'play'` still throwing (Task 3 replaces that branch). Also produces the private helper `nextActivePlayerIndex(state: BatakState, fromIndex: number): number`, consumed only within this same file.

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `packages/engine/src/games/batak/rules.test.ts`, as a new top-level block placed after the closing `});` of the existing `describe('batakGame (rule engine)', ...)` block (a sibling, not nested inside it):

```ts
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

  it('still throws for an unimplemented play move', () => {
    const state = {
      ...batakGame.setup(setupOptions, createRng(1)),
      phase: 'playing' as const,
      trumpSuit: 'hearts' as const,
      currentPlayerIndex: 0,
    };
    const cardId = state.table.zones['hand-p1'].cards[0].id;
    expect(() => batakGame.performMove(state, { type: 'play', cardId })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — every new test in the `performMove — bidding and trump selection` block throws `Error: batakGame.performMove: not yet implemented`, except the last one (which expects a throw and will already pass).

- [ ] **Step 3: Implement `performMove` for bid/pass/selectTrump**

In `packages/engine/src/games/batak/rules.ts`, add this helper function directly after `trumpSelectionLegalMoves`:

```ts
function nextActivePlayerIndex(state: BatakState, fromIndex: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (state.bids[state.players[idx]] !== 'pass') return idx;
  }
  return fromIndex;
}
```

Then replace this exact block:

```ts
  performMove(): BatakState {
    throw new Error('batakGame.performMove: not yet implemented');
  },
```

with:

```ts
  performMove(state: BatakState, move: BatakMove): BatakState {
    const playerId = state.players[state.currentPlayerIndex];

    if (move.type === 'bid' || move.type === 'pass') {
      const bids = { ...state.bids, [playerId]: move.type === 'bid' ? move.amount : ('pass' as const) };
      const highestBid = move.type === 'bid' ? move.amount : state.highestBid;
      const activePlayers = state.players.filter((p) => bids[p] !== 'pass');

      // Closing early (activePlayers.length === 1) is only correct once that sole remaining
      // player has actually placed a bid. If they haven't acted yet (bids[player] === null),
      // they still need their own turn — falling through to the "advance turn" branch below
      // gives it to them, rather than crowning them winner on a bid of 0 they never made.
      if (activePlayers.length === 1 && typeof bids[activePlayers[0]] === 'number') {
        const winner = activePlayers[0];
        const contract = bids[winner] as number;
        return {
          ...state,
          bids,
          highestBid,
          contract,
          bidWinner: winner,
          phase: 'trump-selection',
          currentPlayerIndex: state.players.indexOf(winner),
        };
      }

      if (activePlayers.length === 0) {
        return {
          ...state,
          bids,
          highestBid,
          contract: 4,
          bidWinner: state.players[0],
          phase: 'trump-selection',
          currentPlayerIndex: 0,
        };
      }

      return {
        ...state,
        bids,
        highestBid,
        currentPlayerIndex: nextActivePlayerIndex({ ...state, bids }, state.currentPlayerIndex),
      };
    }

    if (move.type === 'selectTrump') {
      const winner = state.bidWinner!;
      return {
        ...state,
        trumpSuit: move.suit,
        phase: 'playing',
        trickLeader: winner,
        currentPlayerIndex: state.players.indexOf(winner),
      };
    }

    throw new Error('batakGame.performMove: play not yet implemented');
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
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Implement Batak auction and trump-selection state machine"
```

---

### Task 3: `getLegalMoves` for play and `performMove` for play — trick-taking logic

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts` (replace both remaining stubs)
- Modify: `packages/engine/src/games/batak/rules.test.ts` (append two new top-level `describe` blocks)

**Interfaces:**
- Consumes: everything Tasks 1–2 produced, plus `compareRanks` from `packages/engine/src/games/batak/ranking.ts` (existing: `compareRanks(a: Rank, b: Rank): number`, positive when `a` outranks `b`) and `moveCard`, `moveAllCards` from `packages/engine/src/core/table.ts` (both already exist).
- Produces: a fully working `batakGame.getLegalMoves` and `batakGame.performMove` covering every move type. Nothing later in this plan depends on it (this is the plan's last task), but the next sub-project (AI strategies) will call both directly. Also produces the private helper `playingLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[]` and `trickWinnerIndex(trick: Card[], trumpSuit: Suit): number`, consumed only within this same file.

- [ ] **Step 1: Write the failing tests**

Add these two `describe` blocks to `packages/engine/src/games/batak/rules.test.ts`, as new top-level blocks placed after the closing `});` of `describe('batakGame performMove — bidding and trump selection', ...)` (siblings, not nested):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — the `getLegalMoves during play` tests throw `Error: batakGame.getLegalMoves: playing phase not yet implemented`; the `performMove — play` and `validateMove during play` tests throw `Error: batakGame.performMove: play not yet implemented` (the latter transitively, since `validateMove`'s `'play'` case calls `getLegalMoves`, which throws first).

- [ ] **Step 3: Implement `getLegalMoves('playing')` and `performMove('play')`**

In `packages/engine/src/games/batak/rules.ts`, replace this existing line:

```ts
import { createTable, createZone, dealToZones, TableState } from '../../core/table';
```

with:

```ts
import { createTable, createZone, dealToZones, moveCard, moveAllCards, TableState } from '../../core/table';
```

Replace this existing line:

```ts
import { Suit } from '../../core/types';
```

with:

```ts
import { Card, Suit } from '../../core/types';
```

Then add a new import line directly after it:

```ts
import { compareRanks } from './ranking';
```

Add these two helper functions directly after `nextActivePlayerIndex`:

```ts
function playingLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const trick = state.table.zones['trick'].cards;
  const trumpSuit = state.trumpSuit!;

  if (trick.length === 0) {
    const nonTrump = hand.filter((c) => c.suit !== trumpSuit);
    const canLeadTrump = state.trumpBroken || nonTrump.length === 0;
    const eligible = canLeadTrump ? hand : nonTrump;
    return eligible.map((c) => ({ type: 'play', cardId: c.id }));
  }

  const ledSuit = trick[0].suit;
  const ofLedSuit = hand.filter((c) => c.suit === ledSuit);

  if (ofLedSuit.length > 0) {
    const highestInTrick = trick
      .filter((c) => c.suit === ledSuit)
      .reduce((best, c) => (compareRanks(c.rank, best.rank) > 0 ? c : best));
    const higher = ofLedSuit.filter((c) => compareRanks(c.rank, highestInTrick.rank) > 0);
    const eligible = higher.length > 0 ? higher : ofLedSuit;
    return eligible.map((c) => ({ type: 'play', cardId: c.id }));
  }

  return hand.map((c) => ({ type: 'play', cardId: c.id }));
}

function trickWinnerIndex(trick: Card[], trumpSuit: Suit): number {
  const ledSuit = trick[0].suit;
  const trumps = trick.filter((c) => c.suit === trumpSuit);
  const candidates = trumps.length > 0 ? trumps : trick.filter((c) => c.suit === ledSuit);
  const winningCard = candidates.reduce((best, c) => (compareRanks(c.rank, best.rank) > 0 ? c : best));
  return trick.indexOf(winningCard);
}
```

Replace this exact line inside `getLegalMoves`:

```ts
      case 'playing':
        throw new Error('batakGame.getLegalMoves: playing phase not yet implemented');
```

with:

```ts
      case 'playing':
        return playingLegalMoves(state, playerId);
```

Then replace this exact line at the end of `performMove`:

```ts
    throw new Error('batakGame.performMove: play not yet implemented');
```

with:

```ts
    const handZone = `hand-${playerId}`;
    const playedCard = state.table.zones[handZone].cards.find((c) => c.id === move.cardId)!;
    let table = moveCard(state.table, move.cardId, handZone, 'trick');
    const currentTrick = [...state.currentTrick, { playerId, cardId: move.cardId }];
    const trumpBroken = state.trumpBroken || playedCard.suit === state.trumpSuit;

    if (currentTrick.length < state.players.length) {
      return {
        ...state,
        table,
        currentTrick,
        trumpBroken,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      };
    }

    const trickCards = table.zones['trick'].cards;
    const winnerPos = trickWinnerIndex(trickCards, state.trumpSuit!);
    const winner = currentTrick[winnerPos].playerId;

    table = moveAllCards(table, 'trick', `won-${winner}`);
    const tricksWon = { ...state.tricksWon, [winner]: state.tricksWon[winner] + 1 };
    const handsEmpty = state.players.every((p) => table.zones[`hand-${p}`].cards.length === 0);

    return {
      ...state,
      table,
      currentTrick: [],
      trumpBroken,
      tricksWon,
      trickLeader: winner,
      currentPlayerIndex: state.players.indexOf(winner),
      phase: handsEmpty ? 'finished' : state.phase,
      status: handsEmpty ? 'finished' : state.status,
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
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Implement Batak trick-taking legal moves and performMove"
```

---

## Self-Review Notes

- **Spec coverage:** The RuleEngine design spec's Section 1 (file structure), Section 2 (`validateMove` semantics), and Section 3 (test coverage plan) are each covered — Task 1 covers `setup`/`validateMove` (bid/pass/selectTrump branches)/`calculateScore`/`determineWinner`/`gameOver` and bidding/trump-selection `getLegalMoves`; Task 2 covers the full auction state machine including the all-pass forced-contract case; Task 3 covers every `getLegalMoves('playing')` branch (leading excludes/includes trump, mandatory raise, void) and trick resolution (led-suit win, trump win, `trumpBroken` flip, hand-finish).
- **Resolved implementation gap:** the state-model spec's algorithm summary didn't specify `currentPlayerIndex` management across the `bidding` → `trump-selection` → `playing` transitions. This plan resolves it (see Global Constraints) and both Task 2 and Task 3 test it explicitly (`expect(next.currentPlayerIndex).toBe(...)` after auction close and after trump selection).
- **Type consistency:** `batakGame`, `BatakState`, `BatakMove`, `makeEmptyTable`, `biddingLegalMoves`, `trumpSelectionLegalMoves`, `nextActivePlayerIndex`, `playingLegalMoves`, `trickWinnerIndex` are named identically across all three tasks. `performMove`'s final signature (`(state: BatakState, move: BatakMove): BatakState`) matches the `RuleEngine<BatakState, BatakMove>` contract.
- **No placeholders:** every step has complete, runnable code and exact commands.

## Next Step

Brainstorm and plan the Batak `AIStrategy` (Easy/Medium/Hard) sub-project, building on `batakGame` from this plan — at which point `registerGame` and `simulateGames`-based testing both become possible.
