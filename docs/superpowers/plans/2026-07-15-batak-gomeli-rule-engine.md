# Batak 3-Player Gömmeli RuleEngine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `batakGame: RuleEngine<BatakState, BatakMove>` (`packages/engine/src/games/batak/rules.ts`) to support 3-player "gömmeli" (buried-kitty) Batak, generalized entirely from `players.length`, with the existing 4-player behavior unchanged and every existing test still passing.

**Architecture:** No new files — this is a diff to the existing `rules.ts`/`types.ts`/`rules.test.ts` pair. Task 1 generalizes the data model and `setup()`/dealing for a 3rd player count and the new `kitty`/`buried` zones. Task 2 wires the bid-floor/max-bid/forced-contract constants that already differ by player count. Task 3 adds the new `trump-selection` → `kitty-exchange` transition and `getLegalMoves` for that phase. Task 4 adds the `bury` move. Task 5 wires the bust-threshold constant into scoring. Task 6 is a pure-test capstone task proving the whole state machine composes correctly end to end (bidding → trump → kitty-exchange → bury → 16 tricks → finished) with full card conservation.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`), no new dependencies.

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo.
- `BatakState` must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- Every variant-specific rule value is derived from `players.length` via one helper, `ruleConstants(playerCount)`, not scattered inline literals:

  | Constant | 4-player | 3-player (gömmeli) |
  |---|---|---|
  | `handSize` | 13 | 16 |
  | `kittySize` | 0 | 4 |
  | `bidFloor` | 5 | 8 |
  | `maxBid` | 13 | 16 |
  | `forcedContract` | 4 | 7 |
  | `bustThreshold` | 1 | 2 |

- `bustThreshold` means "minimum tricks needed to avoid scoring `-contract`" — a non-bidder scores `-contract` when `tricksWon < bustThreshold`, else scores `tricksWon`.
- Every existing 4-player test in `rules.test.ts` must keep passing unmodified — this is a generalization, not a rewrite. Do not edit any existing `it(...)` block's assertions; only add new ones (and the one shared `makeState` helper needs a new default field, see Task 1).
- Kitty visibility ("revealed incoming cards, hidden discard") is a **UI-layer concern**, out of scope for this plan — `GameState` stays fully omniscient, same as opponent hands today. This plan only needs to track *which* cards were the kitty (`kittyCardIds`) so a future UI has that information.
- No restrictions on which 4 cards the bidder may bury — any 4 of their post-pickup 20-card hand.

---

### Task 1: Data model diff + 3-player `setup()`/dealing

**Files:**
- Modify: `packages/engine/src/games/batak/types.ts`
- Modify: `packages/engine/src/games/batak/rules.ts`
- Modify: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: existing `BatakState`/`BatakMove`/`BatakSetupOptions` (`types.ts`), `createZone`, `moveAllCards` (already imported in `rules.ts` from `../../core/table`).
- Produces: `ruleConstants(playerCount: number): { handSize, kittySize, bidFloor, maxBid, forcedContract, bustThreshold }` (private helper in `rules.ts`, consumed by every later task in this plan). `BatakState.kittyCardIds: string[] | null`. `BatakMove`'s new `'bury'` variant (type-only in this task — no behavior yet, added in Task 4). `BatakSetupOptions.players: PlayerId[]` (widened from a 4-tuple).

- [ ] **Step 1: Write the failing tests**

In `packages/engine/src/games/batak/rules.test.ts`, add a `PLAYERS3` constant and an `emptyTable3` helper right after the existing `emptyTable` function (around line 17):

```ts
const PLAYERS3 = ['p1', 'p2', 'p3'];

function emptyTable3(): TableState {
  return createTable([
    ...PLAYERS3.map((p) => createZone(`hand-${p}`, true)),
    createZone('trick', true),
    ...PLAYERS3.map((p) => createZone(`won-${p}`, true)),
    createZone('kitty', false),
    createZone('buried', false),
  ]);
}
```

Add `kittyCardIds: null` to the `makeState` helper's default object (it currently ends with `tricksWon: Object.fromEntries(...)` right before `...overrides` — add the new field on the line after `tricksWon`):

```ts
    tricksWon: Object.fromEntries(players.map((p) => [p, 0])),
    kittyCardIds: null,
    ...overrides,
```

Add a new top-level `describe` block, after the existing `describe('setup', ...)` block closes (around line 75, right before `describe('validateMove', ...)`):

```ts
describe('setup — 3-player gömmeli', () => {
  const setupOptions3: BatakSetupOptions = { players: PLAYERS3 };

  it('deals 16 cards to each of the 3 hands and 4 to the kitty', () => {
    const state = batakGame.setup(setupOptions3, createRng(1));
    for (const p of PLAYERS3) {
      expect(state.table.zones[`hand-${p}`].cards).toHaveLength(16);
    }
    expect(state.table.zones['kitty'].cards).toHaveLength(4);
  });

  it('deals every card exactly once across the 3 hands and the kitty', () => {
    const state = batakGame.setup(setupOptions3, createRng(1));
    const allIds = [
      ...PLAYERS3.flatMap((p) => state.table.zones[`hand-${p}`].cards.map((c) => c.id)),
      ...state.table.zones['kitty'].cards.map((c) => c.id),
    ];
    expect(new Set(allIds).size).toBe(52);
  });

  it('initializes kittyCardIds to null, phase to bidding, and an empty buried zone', () => {
    const state = batakGame.setup(setupOptions3, createRng(1));
    expect(state.kittyCardIds).toBeNull();
    expect(state.phase).toBe('bidding');
    expect(state.table.zones['buried'].cards).toEqual([]);
  });

  it('does not create kitty/buried zones for a 4-player game', () => {
    const state = batakGame.setup({ players: PLAYERS }, createRng(1));
    expect(state.table.zones['kitty']).toBeUndefined();
    expect(state.table.zones['buried']).toBeUndefined();
    expect(state.kittyCardIds).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — TypeScript compile errors (`kittyCardIds` does not exist on type `BatakState`'s expected shape / object literal may only specify known properties) and/or `state.table.zones['kitty']` being `undefined` at runtime once compiled, since `types.ts` and `rules.ts` haven't changed yet.

- [ ] **Step 3: Update `types.ts`**

Replace the full contents of `packages/engine/src/games/batak/types.ts`:

```ts
import { GameState, PlayerId } from '../../rules/types';
import { Suit } from '../../core/types';

export interface BatakState extends GameState {
  phase: 'bidding' | 'trump-selection' | 'kitty-exchange' | 'playing' | 'finished';
  bids: Record<PlayerId, number | 'pass' | null>;
  highestBid: number;
  contract: number | null;
  bidWinner: PlayerId | null;
  trumpSuit: Suit | null;
  trumpBroken: boolean;
  currentTrick: Array<{ playerId: PlayerId; cardId: string }>;
  trickLeader: PlayerId | null;
  tricksWon: Record<PlayerId, number>;
  kittyCardIds: string[] | null;
}

export type BatakMove =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'bury'; cardIds: [string, string, string, string] }
  | { type: 'play'; cardId: string };

export interface BatakSetupOptions {
  players: PlayerId[];
}
```

- [ ] **Step 4: Add `ruleConstants` and update `makeEmptyTable`/`setup` in `rules.ts`**

In `packages/engine/src/games/batak/rules.ts`, add this right after the `const SUITS: Suit[] = [...]` line (around line 9):

```ts
interface RuleConstants {
  handSize: number;
  kittySize: number;
  bidFloor: number;
  maxBid: number;
  forcedContract: number;
  bustThreshold: number;
}

function ruleConstants(playerCount: number): RuleConstants {
  return playerCount === 3
    ? { handSize: 16, kittySize: 4, bidFloor: 8, maxBid: 16, forcedContract: 7, bustThreshold: 2 }
    : { handSize: 13, kittySize: 0, bidFloor: 5, maxBid: 13, forcedContract: 4, bustThreshold: 1 };
}
```

Replace the existing `makeEmptyTable` function (currently lines 11-17):

```ts
function makeEmptyTable(players: PlayerId[]): TableState {
  const { kittySize } = ruleConstants(players.length);
  return createTable([
    ...players.map((p) => createZone(`hand-${p}`, true)),
    createZone('trick', true),
    ...players.map((p) => createZone(`won-${p}`, true)),
    ...(kittySize > 0 ? [createZone('kitty', false), createZone('buried', false)] : []),
  ]);
}
```

Replace the `setup` method's body (currently lines 79-108):

```ts
  setup(options: unknown, rng: RNG): BatakState {
    const opts = options as BatakSetupOptions;
    const { players } = opts;
    const { handSize, kittySize } = ruleConstants(players.length);

    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const { table } = dealToZones(deck, makeEmptyTable(players), [
      ...players.map((p) => ({ zoneId: `hand-${p}`, count: handSize })),
      ...(kittySize > 0 ? [{ zoneId: 'kitty', count: kittySize }] : []),
    ]);

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
      kittyCardIds: null,
    };
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS (the 4 new tests, plus every pre-existing test in this file — the 4-player `setup` tests must be untouched and green).

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/types.ts packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Generalize Batak types/setup for 3-player gömmeli (kitty zone, ruleConstants)"
```

---

### Task 2: Wire bid-floor/max-bid/forced-contract constants into bidding

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts`
- Modify: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: `ruleConstants` from Task 1.
- Produces: no new exports — `biddingLegalMoves`, `validateMove`'s `'bid'` case, and `performMove`'s all-passed branch now read `bidFloor`/`maxBid`/`forcedContract` instead of literal `5`/`13`/`4`.

- [ ] **Step 1: Write the failing tests**

Add a new top-level `describe` block in `rules.test.ts`, after the `describe('setup — 3-player gömmeli', ...)` block from Task 1:

```ts
describe('bidding constants — 3-player gömmeli', () => {
  const setupOptions3: BatakSetupOptions = { players: PLAYERS3 };

  it('rejects a first bid below 8 and accepts 8', () => {
    const state = batakGame.setup(setupOptions3, createRng(1));
    expect(batakGame.validateMove(state, { type: 'bid', amount: 7 }, 'p1')).toBe(false);
    expect(batakGame.validateMove(state, { type: 'bid', amount: 8 }, 'p1')).toBe(true);
  });

  it('rejects a bid above 16', () => {
    const state = batakGame.setup(setupOptions3, createRng(1));
    expect(batakGame.validateMove(state, { type: 'bid', amount: 17 }, 'p1')).toBe(false);
    expect(batakGame.validateMove(state, { type: 'bid', amount: 16 }, 'p1')).toBe(true);
  });

  it('offers pass plus every bid from 8 to 16 at the start of a 3-player auction', () => {
    const state = batakGame.setup(setupOptions3, createRng(1));
    const moves = batakGame.getLegalMoves(state, 'p1');
    expect(moves).toContainEqual({ type: 'bid', amount: 8 });
    expect(moves).toContainEqual({ type: 'bid', amount: 16 });
    expect(moves).not.toContainEqual({ type: 'bid', amount: 7 });
    expect(moves).toHaveLength(1 + (16 - 8 + 1));
  });

  it('forces a contract of 7 to player 0 when all 3 players pass', () => {
    let state = batakGame.setup(setupOptions3, createRng(1));
    state = batakGame.performMove(state, { type: 'pass' }); // p1
    state = batakGame.performMove(state, { type: 'pass' }); // p2
    expect(state.phase).toBe('bidding'); // p3 hasn't acted yet — must get their own turn
    state = batakGame.performMove(state, { type: 'pass' }); // p3
    expect(state.phase).toBe('trump-selection');
    expect(state.bidWinner).toBe('p1');
    expect(state.contract).toBe(7);
  });

  it('does not regress the 4-player bid floor/ceiling/forced-contract', () => {
    const state = batakGame.setup({ players: PLAYERS }, createRng(1));
    expect(batakGame.validateMove(state, { type: 'bid', amount: 4 }, 'p1')).toBe(false);
    expect(batakGame.validateMove(state, { type: 'bid', amount: 5 }, 'p1')).toBe(true);
    expect(batakGame.validateMove(state, { type: 'bid', amount: 14 }, 'p1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — the 3-player bid-floor/ceiling/forced-contract tests fail (bid 8 rejected, bid 17 accepted, forced contract still 4) since `biddingLegalMoves`, `validateMove`, and `performMove`'s all-passed branch still hardcode the 4-player constants.

- [ ] **Step 3: Wire the constants**

In `rules.ts`, replace `biddingLegalMoves` (currently lines 19-27):

```ts
function biddingLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (state.bids[playerId] === 'pass') return [];
  const { bidFloor, maxBid } = ruleConstants(state.players.length);
  const moves: BatakMove[] = [{ type: 'pass' }];
  const minBid = Math.max(bidFloor, state.highestBid + 1);
  for (let amount = minBid; amount <= maxBid; amount++) {
    moves.push({ type: 'bid', amount });
  }
  return moves;
}
```

In `validateMove`, replace the `'bid'` case (currently lines 115-121):

```ts
      case 'bid': {
        const { bidFloor, maxBid } = ruleConstants(state.players.length);
        return (
          state.phase === 'bidding' &&
          state.bids[playerId] !== 'pass' &&
          move.amount >= Math.max(bidFloor, state.highestBid + 1) &&
          move.amount <= maxBid
        );
      }
```

In `performMove`, replace the all-passed branch (currently lines 160-170):

```ts
      if (activePlayers.length === 0) {
        const { forcedContract } = ruleConstants(state.players.length);
        return {
          ...state,
          bids,
          highestBid,
          contract: forcedContract,
          bidWinner: state.players[0],
          phase: 'trump-selection',
          currentPlayerIndex: 0,
        };
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS — all 5 new tests, and every pre-existing 4-player bidding test (`accepts a bid at or above 5 and at most 13`, `forces a contract of 4 to player 0 when every player passes`, etc.) still green.

- [ ] **Step 5: Run the full suite**

Run (from repo root): `npm test`
Expected: PASS — no regressions elsewhere in the monorepo (e.g. `index.test.ts`, `simulate.test.ts`, AI tests, which all exercise 4-player games and must be unaffected).

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Wire bid-floor/max-bid/forced-contract constants for 3-player gömmeli"
```

---

### Task 3: Trump-selection → kitty-exchange transition + `getLegalMoves` for `bury`

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts`
- Modify: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: `ruleConstants`, `moveAllCards` (already imported).
- Produces: `fourCardCombinations(cards: Card[]): Card[][]` and `kittyExchangeLegalMoves(state, playerId): BatakMove[]` (both private helpers in `rules.ts`), consumed by `getLegalMoves`'s new `'kitty-exchange'` branch and, in Task 4, by `validateMove`'s `'bury'` case.

- [ ] **Step 1: Write the failing tests**

Add a `batakTable3` helper to `rules.test.ts`, right after `emptyTable3` (from Task 1):

```ts
function batakTable3(overrides: Partial<Record<string, Card[]>>): TableState {
  return createTable([
    ...PLAYERS3.map((p) => createZone(`hand-${p}`, true, overrides[`hand-${p}`] ?? [])),
    createZone('trick', true, overrides['trick'] ?? []),
    ...PLAYERS3.map((p) => createZone(`won-${p}`, true, overrides[`won-${p}`] ?? [])),
    createZone('kitty', false, overrides['kitty'] ?? []),
    createZone('buried', false, overrides['buried'] ?? []),
  ]);
}

function twentyCards(): Card[] {
  return Array.from({ length: 20 }, (_, i) => card(`c${i}`, '2', i % 2 === 0 ? 'hearts' : 'clubs'));
}
```

Add two new `describe` blocks (place them after the `describe('bidding constants — 3-player gömmeli', ...)` block from Task 2):

```ts
describe('batakGame performMove — selectTrump into kitty-exchange (3-player)', () => {
  it("moves the kitty into the bidder's hand, reveals kittyCardIds, and enters kitty-exchange", () => {
    const kittyCards = [
      card('k1', '2', 'diamonds'),
      card('k2', '3', 'diamonds'),
      card('k3', '4', 'diamonds'),
      card('k4', '5', 'diamonds'),
    ];
    const table = batakTable3({ 'hand-p1': [card('h1', 'A', 'hearts')], kitty: kittyCards });
    const state = makeState({
      table,
      players: PLAYERS3,
      phase: 'trump-selection',
      bidWinner: 'p1',
      contract: 8,
      currentPlayerIndex: 0,
    });
    const next = batakGame.performMove(state, { type: 'selectTrump', suit: 'spades' });
    expect(next.trumpSuit).toBe('spades');
    expect(next.phase).toBe('kitty-exchange');
    expect(next.kittyCardIds).toEqual(['k1', 'k2', 'k3', 'k4']);
    expect(next.table.zones['kitty'].cards).toEqual([]);
    expect(next.table.zones['hand-p1'].cards.map((c) => c.id).sort()).toEqual(['h1', 'k1', 'k2', 'k3', 'k4']);
  });

  it('still goes straight to playing for a 4-player game (no kitty)', () => {
    const state = {
      ...batakGame.setup({ players: PLAYERS }, createRng(1)),
      phase: 'trump-selection' as const,
      bidWinner: 'p3',
      contract: 5,
      currentPlayerIndex: 2,
    };
    const next = batakGame.performMove(state, { type: 'selectTrump', suit: 'spades' });
    expect(next.phase).toBe('playing');
    expect(next.kittyCardIds).toBeNull();
  });
});

describe('getLegalMoves — kitty-exchange (3-player)', () => {
  it('returns bury moves only for the bid winner', () => {
    const table = batakTable3({ 'hand-p1': twentyCards() });
    const state = makeState({
      table,
      players: PLAYERS3,
      phase: 'kitty-exchange',
      bidWinner: 'p1',
      currentPlayerIndex: 0,
    });
    expect(batakGame.getLegalMoves(state, 'p2')).toEqual([]);
  });

  it('returns exactly C(20,4) = 4845 combinations, each of 4 distinct cards from the hand', () => {
    const hand = twentyCards();
    const table = batakTable3({ 'hand-p1': hand });
    const state = makeState({
      table,
      players: PLAYERS3,
      phase: 'kitty-exchange',
      bidWinner: 'p1',
      currentPlayerIndex: 0,
    });
    const moves = batakGame.getLegalMoves(state, 'p1');
    expect(moves).toHaveLength(4845);
    for (const move of moves) {
      if (move.type !== 'bury') throw new Error('expected only bury moves');
      expect(new Set(move.cardIds).size).toBe(4);
      for (const id of move.cardIds) {
        expect(hand.some((c) => c.id === id)).toBe(true);
      }
    }
  });

  it('includes a specific known combination and excludes one containing a card not in hand', () => {
    const hand = twentyCards();
    const table = batakTable3({ 'hand-p1': hand });
    const state = makeState({
      table,
      players: PLAYERS3,
      phase: 'kitty-exchange',
      bidWinner: 'p1',
      currentPlayerIndex: 0,
    });
    const moves = batakGame.getLegalMoves(state, 'p1');
    expect(moves).toContainEqual({ type: 'bury', cardIds: ['c0', 'c1', 'c2', 'c3'] });
    expect(
      moves.some((m) => m.type === 'bury' && m.cardIds.includes('not-in-hand'))
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — `selectTrump` still goes straight to `'playing'` for 3-player games (no `kitty-exchange` phase, `kittyCardIds` stays `null`), and `getLegalMoves` has no `'kitty-exchange'` case so it falls through to `undefined`/throws on the `switch`.

- [ ] **Step 3: Implement**

In `rules.ts`, add these two helpers right after `trumpSelectionLegalMoves` (currently lines 29-32):

```ts
function fourCardCombinations(cards: Card[]): Card[][] {
  const combos: Card[][] = [];
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      for (let c = b + 1; c < cards.length; c++) {
        for (let d = c + 1; d < cards.length; d++) {
          combos.push([cards[a], cards[b], cards[c], cards[d]]);
        }
      }
    }
  }
  return combos;
}

function kittyExchangeLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (playerId !== state.bidWinner) return [];
  const hand = state.table.zones[`hand-${playerId}`].cards;
  return fourCardCombinations(hand).map((combo) => ({
    type: 'bury' as const,
    cardIds: combo.map((c) => c.id) as [string, string, string, string],
  }));
}
```

Replace the `'selectTrump'` branch inside `performMove` (currently lines 180-189):

```ts
    if (move.type === 'selectTrump') {
      const winner = state.bidWinner!;
      const { kittySize } = ruleConstants(state.players.length);

      if (kittySize > 0) {
        const kittyCardIds = state.table.zones['kitty'].cards.map((c) => c.id);
        const table = moveAllCards(state.table, 'kitty', `hand-${winner}`);
        return {
          ...state,
          table,
          trumpSuit: move.suit,
          phase: 'kitty-exchange',
          kittyCardIds,
        };
      }

      return {
        ...state,
        trumpSuit: move.suit,
        phase: 'playing',
        trickLeader: winner,
        currentPlayerIndex: state.players.indexOf(winner),
      };
    }
```

Add a `'kitty-exchange'` case to `getLegalMoves`'s switch (currently lines 228-240), right after the `'trump-selection'` case:

```ts
      case 'kitty-exchange':
        return kittyExchangeLegalMoves(state, playerId);
```

- [ ] **Step 4: Run test to verify it passes**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS — all new tests, and the existing 4-player `selecting trump moves to the playing phase...` test still green.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Add trump-selection -> kitty-exchange transition and bury move enumeration"
```

---

### Task 4: `bury` move (`validateMove` + `performMove`)

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts`
- Modify: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: `getLegalMoves` (from Task 3), `moveCard` (already imported).
- Produces: `sameCards(a, b): boolean` (private helper in `rules.ts`). `validateMove`'s new `'bury'` case and `performMove`'s new `'bury'` case.

- [ ] **Step 1: Write the failing tests**

Add two new `describe` blocks to `rules.test.ts`, after the `describe('getLegalMoves — kitty-exchange (3-player)', ...)` block from Task 3:

```ts
describe('validateMove — bury (3-player)', () => {
  function kittyExchangeState() {
    const hand = twentyCards();
    const table = batakTable3({ 'hand-p1': hand });
    const state = makeState({
      table,
      players: PLAYERS3,
      phase: 'kitty-exchange' as const,
      bidWinner: 'p1',
      currentPlayerIndex: 0,
    });
    return { hand, state };
  }

  it("accepts a valid 4-card bury from the bidder's hand", () => {
    const { state } = kittyExchangeState();
    expect(batakGame.validateMove(state, { type: 'bury', cardIds: ['c0', 'c1', 'c2', 'c3'] }, 'p1')).toBe(true);
  });

  it('accepts the same 4 cards in a different order (order-insensitive)', () => {
    const { state } = kittyExchangeState();
    expect(batakGame.validateMove(state, { type: 'bury', cardIds: ['c3', 'c1', 'c2', 'c0'] }, 'p1')).toBe(true);
  });

  it("rejects a bury naming a card not in the bidder's hand", () => {
    const { state } = kittyExchangeState();
    expect(
      batakGame.validateMove(state, { type: 'bury', cardIds: ['c0', 'c1', 'c2', 'not-in-hand'] }, 'p1')
    ).toBe(false);
  });

  it('rejects a bury from a player other than the bidder', () => {
    const { state } = kittyExchangeState();
    expect(batakGame.validateMove(state, { type: 'bury', cardIds: ['c0', 'c1', 'c2', 'c3'] }, 'p2')).toBe(false);
  });

  it('rejects a bury naming fewer than 4 cards', () => {
    const { state } = kittyExchangeState();
    expect(
      batakGame.validateMove(state, { type: 'bury', cardIds: ['c0', 'c1', 'c2'] as unknown as [string, string, string, string] }, 'p1')
    ).toBe(false);
  });

  it('rejects a bury that repeats the same card id (not 4 distinct cards)', () => {
    const { state } = kittyExchangeState();
    expect(
      batakGame.validateMove(state, { type: 'bury', cardIds: ['c0', 'c0', 'c1', 'c2'] }, 'p1')
    ).toBe(false);
  });
});

describe('batakGame performMove — bury', () => {
  it('moves the 4 named cards to buried, returns hand to 16, and starts play with the bidder leading', () => {
    const hand = twentyCards();
    const table = batakTable3({ 'hand-p1': hand });
    const state = makeState({
      table,
      players: PLAYERS3,
      phase: 'kitty-exchange',
      bidWinner: 'p1',
      trumpSuit: 'spades',
      currentPlayerIndex: 0,
    });
    const next = batakGame.performMove(state, { type: 'bury', cardIds: ['c0', 'c1', 'c2', 'c3'] });
    expect(next.table.zones['hand-p1'].cards).toHaveLength(16);
    const remainingIds = next.table.zones['hand-p1'].cards.map((c) => c.id);
    expect(remainingIds).not.toEqual(expect.arrayContaining(['c0', 'c1', 'c2', 'c3']));
    expect(next.table.zones['buried'].cards.map((c) => c.id).sort()).toEqual(['c0', 'c1', 'c2', 'c3']);
    expect(next.phase).toBe('playing');
    expect(next.trickLeader).toBe('p1');
    expect(next.currentPlayerIndex).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — `validateMove`'s `switch` has no `'bury'` case (falls through to the implicit `undefined`/type error), and `performMove` has no handling for `move.type === 'bury'` (would fall into the `'play'` code path and throw, since there's no `hand-p1` card with a matching id via the play-shaped lookup).

- [ ] **Step 3: Implement**

In `rules.ts`, add `sameCards` right after `fourCardCombinations`/`kittyExchangeLegalMoves` (from Task 3):

```ts
function sameCards(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}
```

In `validateMove`, add a `'bury'` case to the `switch` (right after the `'selectTrump'` case, before `'play'`):

```ts
      case 'bury':
        return (
          state.phase === 'kitty-exchange' &&
          playerId === state.bidWinner &&
          batakGame
            .getLegalMoves(state, playerId)
            .some((m) => m.type === 'bury' && sameCards(m.cardIds, move.cardIds))
        );
```

In `performMove`, add a `'bury'` branch right after the `'selectTrump'` branch (from Task 3), before the trick-play code that currently starts with `const handZone = ...`:

```ts
    if (move.type === 'bury') {
      const bidder = state.bidWinner!;
      let table = state.table;
      for (const cardId of move.cardIds) {
        table = moveCard(table, cardId, `hand-${bidder}`, 'buried');
      }
      return {
        ...state,
        table,
        phase: 'playing',
        trickLeader: bidder,
        currentPlayerIndex: state.players.indexOf(bidder),
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS — all new `bury` tests green, no regressions.

- [ ] **Step 5: Run the full suite**

Run (from repo root): `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Add bury move (validateMove + performMove) for 3-player gömmeli"
```

---

### Task 5: Wire the bust-threshold constant into `calculateScore`

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts`
- Modify: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: `ruleConstants`.
- Produces: no new exports — `calculateScore`'s non-bidder branch now reads `bustThreshold` instead of the literal `tricks === 0` check.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `rules.test.ts`, after the `describe('batakGame performMove — bury', ...)` block from Task 4:

```ts
describe('calculateScore — bust threshold (3-player gömmeli)', () => {
  it('scores a non-bidder -contract when they take exactly 1 trick (below the 2-trick threshold)', () => {
    const state = makeState({
      table: emptyTable3(),
      players: PLAYERS3,
      status: 'finished',
      contract: 8,
      bidWinner: 'p1',
      tricksWon: { p1: 10, p2: 1, p3: 5 },
    });
    expect(batakGame.calculateScore(state)['p2']).toBe(-8);
  });

  it('scores a non-bidder their actual tricks once they meet the 2-trick threshold', () => {
    const state = makeState({
      table: emptyTable3(),
      players: PLAYERS3,
      status: 'finished',
      contract: 8,
      bidWinner: 'p1',
      tricksWon: { p1: 8, p2: 2, p3: 6 },
    });
    expect(batakGame.calculateScore(state)['p2']).toBe(2);
  });

  it('still scores a non-bidder -contract at exactly 0 tricks', () => {
    const state = makeState({
      table: emptyTable3(),
      players: PLAYERS3,
      status: 'finished',
      contract: 8,
      bidWinner: 'p1',
      tricksWon: { p1: 12, p2: 0, p3: 4 },
    });
    expect(batakGame.calculateScore(state)['p2']).toBe(-8);
  });

  it('does not regress the 4-player behavior where 1 trick is safe', () => {
    const state = makeState({
      table: emptyTable(),
      status: 'finished',
      contract: 5,
      bidWinner: 'p1',
      tricksWon: { p1: 5, p2: 1, p3: 4, p4: 3 },
    });
    expect(batakGame.calculateScore(state)['p2']).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `npm test -- rules.test.ts`
Expected: FAIL — the "exactly 1 trick" 3-player test fails, since `calculateScore` still uses the hardcoded `tricks === 0` check (1 trick currently scores `1`, not `-8`).

- [ ] **Step 3: Implement**

In `rules.ts`, replace `calculateScore`'s body (currently lines 242-254):

```ts
  calculateScore(state: BatakState): ScoreBoard {
    const score: ScoreBoard = {};
    const contract = state.contract!;
    const { bustThreshold } = ruleConstants(state.players.length);
    for (const p of state.players) {
      const tricks = state.tricksWon[p];
      if (p === state.bidWinner) {
        score[p] = tricks >= contract ? tricks : -contract;
      } else {
        score[p] = tricks < bustThreshold ? -contract : tricks;
      }
    }
    return score;
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS — all new tests, and every pre-existing `calculateScore`/`determineWinner` test (which all use 4-player states) still green.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Wire bust-threshold constant into calculateScore for 3-player gömmeli"
```

---

### Task 6: Full-hand integration test (capstone, no production code changes)

**Files:**
- Modify: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-5 (`batakGame.setup`/`getLegalMoves`/`performMove`/`gameOver`/`determineWinner`).
- Produces: nothing new — this task is pure test coverage proving the whole 3-player state machine composes correctly, including card conservation across the new `kitty`/`buried` zones.

- [ ] **Step 1: Write the tests**

Add two new `describe` blocks to `rules.test.ts`, after the `describe('calculateScore — bust threshold (3-player gömmeli)', ...)` block from Task 5:

```ts
describe('trick play at a 3-player table', () => {
  it('resolves a trick to the highest trump among 3 played cards, not the first or last played', () => {
    const table = batakTable3({
      'hand-p3': [card('s3', '3', 'spades')],
      trick: [card('s1', '2', 'spades'), card('s2', 'K', 'spades')],
    });
    const state = makeState({
      table,
      players: PLAYERS3,
      phase: 'playing',
      trumpSuit: 'spades',
      currentPlayerIndex: 2,
      trickLeader: 'p1',
      currentTrick: [
        { playerId: 'p1', cardId: 's1' },
        { playerId: 'p2', cardId: 's2' },
      ],
    });
    const next = batakGame.performMove(state, { type: 'play', cardId: 's3' });
    expect(next.trickLeader).toBe('p2');
    expect(next.tricksWon['p2']).toBe(1);
    expect(next.tricksWon['p1']).toBe(0);
    expect(next.tricksWon['p3']).toBe(0);
  });
});

describe('full-hand integration (3-player gömmeli)', () => {
  it('plays a complete hand end to end, conserving all 52 cards throughout', () => {
    let state = batakGame.setup({ players: PLAYERS3 }, createRng(7));
    let guard = 0;
    while (!batakGame.gameOver(state) && guard < 500) {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const moves = batakGame.getLegalMoves(state, currentPlayer);
      expect(moves.length).toBeGreaterThan(0);
      state = batakGame.performMove(state, moves[0]);
      guard++;
    }
    expect(batakGame.gameOver(state)).toBe(true);
    expect(state.phase).toBe('finished');

    const allCardIds = [
      ...PLAYERS3.flatMap((p) => state.table.zones[`hand-${p}`].cards.map((c) => c.id)),
      ...state.table.zones['trick'].cards.map((c) => c.id),
      ...PLAYERS3.flatMap((p) => state.table.zones[`won-${p}`].cards.map((c) => c.id)),
      ...state.table.zones['buried'].cards.map((c) => c.id),
    ];
    expect(new Set(allCardIds).size).toBe(52);
    expect(state.table.zones['buried'].cards).toHaveLength(4);

    const totalTricks = PLAYERS3.reduce((sum, p) => sum + state.tricksWon[p], 0);
    expect(totalTricks).toBe(16);

    expect(batakGame.determineWinner(state)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run (from repo root): `npm test -- rules.test.ts`
Expected: PASS. If the integration test times out or the `guard < 500` loop exhausts without `gameOver` becoming true, that indicates a real bug in one of Tasks 1-5 (a phase transition that never reaches `'playing'`, or `getLegalMoves` returning `[]` somewhere it shouldn't) — do not raise the guard limit to paper over it; investigate via `systematic-debugging` instead.

- [ ] **Step 3: Run the full suite**

Run (from repo root): `npm test`
Expected: PASS — the entire monorepo test suite is green, including `packages/engine/src/games/batak/index.test.ts`, `simulate.test.ts`, and every AI test (all still 4-player-only, unaffected by this plan).

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/batak/rules.test.ts
git commit -m "Add 3-player gömmeli trick-play and full-hand integration tests"
```

## Out of Scope (Deferred to Later Sub-Projects)

- `AIStrategy` adjustments (Easy needs none; Medium/Hard need bidding/bury heuristics recalibrated for the 8-16 bid range and kitty exchange).
- UI: 3-seat table layout, kitty-reveal presentation, the bury interaction.
- `simulateGames`-based card-conservation and win-rate testing for 3-player games (requires an `AIStrategy`).
- The 4-player "eşli" (partnered) variant; multi-hand match play; the bid-16 "Draw" instant-match-win rule.

## Next Step

Brainstorm and plan the `AIStrategy` adjustments sub-project (Easy/Medium/Hard bidding and bury heuristics for the 3-player gömmeli variant), building on `batakGame` from this plan.
