# Batak (4-Player Individual) AI Strategies & Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `batakEasyAI`/`batakMediumAI`/`batakHardAI` (`AIStrategy<BatakState, BatakMove>`), register Batak in the engine's game registry, and add `simulateGames`-based card-conservation and Hard-vs-Easy win-rate tests.

**Architecture:** A shared bid/trump heuristic (`ai/handStrength.ts`) consumed by both Medium and Hard AI, since their bidding/trump judgment is identical — only their card-play sophistication differs. Three `AIStrategy<BatakState, BatakMove>` files under `packages/engine/src/games/batak/ai/` (one per difficulty), each branching on `state.phase` (`bidding` / `trump-selection` / `playing`) since — unlike Pişti's single-purpose AI files — every difficulty must handle all three move-producing phases through one `chooseMove` entry point. A new `packages/engine/src/games/batak/index.ts` assembles the `GameDescriptor` and registers it. Test coverage is unit tests per AI file, a registration test, and `simulateGames`-based integration tests.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`), no new dependencies.

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo.
- `BatakState` must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- Trump-suit honor scale (full value): A=4, K=3, Q=2, J=1.
- Non-trump honor scale (discounted): A=2, K=1, Q=0, J=0.
- Trump suit selection: the suit with the most cards in hand, full stop — length is the only factor in *which suit*; honor points (trump scale) only break ties between suits of equal length.
- Hand strength estimate: `totalStrength = (trump suit's card count + trump-suit honor points) + (non-trump honor points summed across the other three suits, discounted scale)`; `estimatedTricks = round(totalStrength / 2)`, clamped to `[0, 13]`.
- Bid decision: bid `estimatedTricks` (capped at 13) if `estimatedTricks >= max(5, currentHighestBid + 1)`; otherwise pass.
- Easy AI: pure uniform-random choice via the existing `pickRandom(legalMoves, rng)` utility (`packages/engine/src/ai/weightedRandom.ts`) — no phase-branching needed, `pickRandom` doesn't care what shape `BatakMove` is.
- Medium AI bidding/trump-selection: call the shared heuristic directly, no fallback logic (its output always matches a legal move by construction).
- Medium AI card play: "win cheaply if you can, else dump low" — simulate each legal card being appended to the current trick, use `trickWinnerIndex` (exported from `rules.ts`) to check if it would currently win; among winners pick the lowest-ranked; when leading (trick empty) or when nothing would currently win, pick the lowest-ranked legal move.
- Hard AI bidding/trump-selection: identical to Medium — calls the exact same shared heuristic functions, no search.
- Hard AI card play: `minimaxChooseMove` (`packages/engine/src/ai/minimax.ts`) with `maxDepth: 4`, `evaluate: (s) => calculateScore(s)[playerId] - <sum of the other three players' scores>` (same "everyone else is my adversary" pattern as Pişti's 4-player Hard AI).
- `batakDescriptor`: `id: 'batak'`, `displayName: 'Batak'`, `category: 'trick-taking'` (already a valid `GameCategory` member, no registry change needed), `minPlayers: 4`, `maxPlayers: 4`.

---

### Task 1: Shared Bid/Trump Heuristic

**Files:**
- Create: `packages/engine/src/games/batak/ai/handStrength.ts`
- Create: `packages/engine/src/games/batak/ai/handStrength.test.ts`

**Interfaces:**
- Consumes: `Card`, `Suit` from `packages/engine/src/core/types.ts` (existing).
- Produces: `chooseTrumpSuit(hand: Card[]): Suit` and `estimateBidDecision(hand: Card[], currentHighestBid: number): { type: 'bid'; amount: number } | { type: 'pass' }`, both consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/games/batak/ai/handStrength.test.ts`:

```ts
import { Card, Suit } from '../../../core/types';
import { chooseTrumpSuit, estimateBidDecision } from './handStrength';

const card = (id: string, rank: Card['rank'], suit: Suit): Card => ({ id, suit, rank });

describe('chooseTrumpSuit', () => {
  it('chooses the longer suit over a shorter suit holding an Ace and a Jack', () => {
    const hand: Card[] = [
      card('h1', 'A', 'hearts'),
      card('h2', 'J', 'hearts'),
      card('s1', '2', 'spades'),
      card('s2', '3', 'spades'),
      card('s3', '4', 'spades'),
      card('s4', '5', 'spades'),
      card('s5', '6', 'spades'),
    ];
    expect(chooseTrumpSuit(hand)).toBe('spades');
  });

  it('chooses the longer suit even over a shorter suit holding all four honors', () => {
    const hand: Card[] = [
      card('h1', 'A', 'hearts'),
      card('h2', 'K', 'hearts'),
      card('h3', 'Q', 'hearts'),
      card('h4', 'J', 'hearts'),
      card('s1', '2', 'spades'),
      card('s2', '3', 'spades'),
      card('s3', '4', 'spades'),
      card('s4', '5', 'spades'),
      card('s5', '6', 'spades'),
    ];
    expect(chooseTrumpSuit(hand)).toBe('spades');
  });

  it('breaks ties between equal-length suits by honor points', () => {
    const hand: Card[] = [
      card('h1', '2', 'hearts'),
      card('h2', '3', 'hearts'),
      card('h3', '4', 'hearts'),
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
    ];
    expect(chooseTrumpSuit(hand)).toBe('spades');
  });
});

describe('estimateBidDecision', () => {
  it('bids the estimated trick count when it clears the minimum', () => {
    const hand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
    ];
    // trump strength = 4 (length) + 10 (A+K+Q+J honors) = 14 -> estimatedTricks = round(14/2) = 7
    expect(estimateBidDecision(hand, 0)).toEqual({ type: 'bid', amount: 7 });
  });

  it('passes when the estimated trick count does not clear the minimum', () => {
    const hand: Card[] = [card('c1', '2', 'clubs'), card('c2', '3', 'clubs'), card('d1', '4', 'diamonds')];
    expect(estimateBidDecision(hand, 0)).toEqual({ type: 'pass' });
  });

  it('raises its required minimum to beat the current highest bid', () => {
    const hand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
    ];
    // estimatedTricks is 7 (see above): clears a highest bid of 6 (minimum becomes 7)...
    expect(estimateBidDecision(hand, 6)).toEqual({ type: 'bid', amount: 7 });
    // ...but not a highest bid of 7 (minimum becomes 8, which the hand can't clear)
    expect(estimateBidDecision(hand, 7)).toEqual({ type: 'pass' });
  });

  it('values the same honor cards far more highly when they are in the trump suit', () => {
    const trumpHonorsHand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
    ];
    const nonTrumpHonorsHand: Card[] = [
      card('h1', 'A', 'hearts'),
      card('h2', 'K', 'hearts'),
      card('h3', 'Q', 'hearts'),
      card('h4', 'J', 'hearts'),
      card('s1', '2', 'spades'),
      card('s2', '3', 'spades'),
      card('s3', '4', 'spades'),
      card('s4', '5', 'spades'),
      card('s5', '6', 'spades'),
    ];
    // Same AKQJ ranks: full trump-honor value drives a bid, discounted non-trump value doesn't.
    expect(estimateBidDecision(trumpHonorsHand, 0)).toEqual({ type: 'bid', amount: 7 });
    expect(estimateBidDecision(nonTrumpHonorsHand, 0)).toEqual({ type: 'pass' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from repo root): `npm test -- games/batak/ai/handStrength.test.ts`
Expected: FAIL — `./handStrength` module doesn't exist yet.

- [ ] **Step 3: Implement `handStrength.ts`**

Create `packages/engine/src/games/batak/ai/handStrength.ts`:

```ts
import { Card, Suit } from '../../../core/types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

const TRUMP_HONOR_POINTS: Partial<Record<Card['rank'], number>> = { A: 4, K: 3, Q: 2, J: 1 };
const NON_TRUMP_HONOR_POINTS: Partial<Record<Card['rank'], number>> = { A: 2, K: 1, Q: 0, J: 0 };

function honorPoints(cards: Card[], scale: Partial<Record<Card['rank'], number>>): number {
  return cards.reduce((sum, c) => sum + (scale[c.rank] ?? 0), 0);
}

export function chooseTrumpSuit(hand: Card[]): Suit {
  let best = SUITS[0];
  let bestLength = -1;
  let bestHonors = -1;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const length = cards.length;
    const honors = honorPoints(cards, TRUMP_HONOR_POINTS);
    if (length > bestLength || (length === bestLength && honors > bestHonors)) {
      best = suit;
      bestLength = length;
      bestHonors = honors;
    }
  }
  return best;
}

function estimateHandStrength(hand: Card[], trumpSuit: Suit): number {
  const trumpCards = hand.filter((c) => c.suit === trumpSuit);
  const trumpStrength = trumpCards.length + honorPoints(trumpCards, TRUMP_HONOR_POINTS);
  const nonTrumpStrength = SUITS.filter((suit) => suit !== trumpSuit).reduce(
    (sum, suit) => sum + honorPoints(hand.filter((c) => c.suit === suit), NON_TRUMP_HONOR_POINTS),
    0
  );
  return trumpStrength + nonTrumpStrength;
}

export function estimateBidDecision(
  hand: Card[],
  currentHighestBid: number
): { type: 'bid'; amount: number } | { type: 'pass' } {
  const trumpSuit = chooseTrumpSuit(hand);
  const totalStrength = estimateHandStrength(hand, trumpSuit);
  const estimatedTricks = Math.min(13, Math.max(0, Math.round(totalStrength / 2)));
  const minBid = Math.max(5, currentHighestBid + 1);
  if (estimatedTricks >= minBid) {
    return { type: 'bid', amount: estimatedTricks };
  }
  return { type: 'pass' };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from repo root): `npm test -- games/batak/ai/handStrength.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/batak/ai/handStrength.ts packages/engine/src/games/batak/ai/handStrength.test.ts
git commit -m "Add Batak shared bid/trump hand-strength heuristic"
```

---

### Task 2: Easy AI

**Files:**
- Create: `packages/engine/src/games/batak/ai/easy.ts`
- Create: `packages/engine/src/games/batak/ai/easy.test.ts`

**Interfaces:**
- Consumes: `AIStrategy<TState, TMove>` from `packages/engine/src/ai/types.ts` (existing). `pickRandom<T>(items: T[], rng: RNG): T` from `packages/engine/src/ai/weightedRandom.ts` (existing). `BatakState`, `BatakMove`, `BatakSetupOptions` from `packages/engine/src/games/batak/types.ts` (existing). `batakGame` from `packages/engine/src/games/batak/rules.ts` (existing, test only).
- Produces: `batakEasyAI: AIStrategy<BatakState, BatakMove>`.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/games/batak/ai/easy.test.ts`:

```ts
import { createRng } from '../../../core/rng';
import { createTable, createZone, TableState } from '../../../core/table';
import { Card, Suit } from '../../../core/types';
import { batakGame } from '../rules';
import { BatakSetupOptions, BatakState } from '../types';
import { batakEasyAI } from './easy';

const card = (id: string, rank: Card['rank'], suit: Suit = 'hearts'): Card => ({ id, suit, rank });

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function makeState(overrides: Partial<BatakState> & { table: TableState }): BatakState {
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

describe('batakEasyAI', () => {
  it('always returns a legal move during bidding', () => {
    const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    for (let seed = 1; seed <= 5; seed++) {
      const state = batakGame.setup(setupOptions, createRng(seed));
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed + 100));
      expect(legalMoves).toContainEqual(move);
    }
  });

  it('always returns a legal move during trump selection', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('a', '5', 'clubs')]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'trump-selection',
      bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 5,
      contract: 5,
      bidWinner: 'p1',
    });
    for (let seed = 1; seed <= 5; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(legalMoves).toContainEqual(move);
    }
  });

  it('always returns a legal move during play', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('a', '5', 'clubs'), card('b', '9', 'hearts')]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'playing',
      bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 5,
      contract: 5,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      trickLeader: 'p1',
    });
    for (let seed = 1; seed <= 5; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(legalMoves).toContainEqual(move);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from repo root): `npm test -- games/batak/ai/easy.test.ts`
Expected: FAIL — `./easy` module doesn't exist yet.

- [ ] **Step 3: Implement `easy.ts`**

Create `packages/engine/src/games/batak/ai/easy.ts`:

```ts
import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { BatakState, BatakMove } from '../types';

export const batakEasyAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'easy',
  chooseMove(_state, _playerId, legalMoves, rng) {
    return pickRandom(legalMoves, rng);
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from repo root): `npm test -- games/batak/ai/easy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/batak/ai/easy.ts packages/engine/src/games/batak/ai/easy.test.ts
git commit -m "Add batakEasyAI"
```

---

### Task 3: Export `trickWinnerIndex` + Medium AI

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts:70` (`trickWinnerIndex` visibility)
- Create: `packages/engine/src/games/batak/ai/medium.ts`
- Create: `packages/engine/src/games/batak/ai/medium.test.ts`

**Interfaces:**
- Consumes: `chooseTrumpSuit`, `estimateBidDecision` from `./handStrength` (Task 1). `trickWinnerIndex(trick: Card[], trumpSuit: Suit): number` from `../rules` (existing, made exported by this task's Step 1 — no behavior change). `compareRanks(a: Rank, b: Rank): number` from `../ranking` (existing). `pickRandom` from `packages/engine/src/ai/weightedRandom.ts` (existing).
- Produces: `batakMediumAI: AIStrategy<BatakState, BatakMove>`, and `trickWinnerIndex` becomes available to Task 4's tests too (via `../rules`).

- [ ] **Step 1: Export `trickWinnerIndex`**

In `packages/engine/src/games/batak/rules.ts`, find this exact line:

```ts
function trickWinnerIndex(trick: Card[], trumpSuit: Suit): number {
```

Replace it with:

```ts
export function trickWinnerIndex(trick: Card[], trumpSuit: Suit): number {
```

This is a one-line visibility change — `rules.test.ts` is unaffected since it doesn't reference the function by name.

- [ ] **Step 2: Run the full rules suite to confirm no regression from the export**

Run (from repo root): `npm test -- games/batak/rules.test.ts`
Expected: PASS — all pre-existing tests still pass unchanged.

- [ ] **Step 3: Write the failing tests**

Create `packages/engine/src/games/batak/ai/medium.test.ts`:

```ts
import { createRng } from '../../../core/rng';
import { createTable, createZone, TableState } from '../../../core/table';
import { Card, Suit } from '../../../core/types';
import { batakGame } from '../rules';
import { BatakState } from '../types';
import { batakMediumAI } from './medium';

const card = (id: string, rank: Card['rank'], suit: Suit): Card => ({ id, suit, rank });

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function makeState(overrides: Partial<BatakState> & { table: TableState }): BatakState {
  return {
    gameId: 'batak',
    players: PLAYERS,
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    phase: 'playing',
    bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
    highestBid: 5,
    contract: 5,
    bidWinner: 'p1',
    trumpSuit: 'spades',
    trumpBroken: false,
    currentTrick: [],
    trickLeader: 'p1',
    tricksWon: { p1: 0, p2: 0, p3: 0, p4: 0 },
    ...overrides,
  };
}

describe('batakMediumAI', () => {
  it('wins the trick as cheaply as possible, not with the strongest available card', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('high', 'K', 'hearts'),
        card('low', '10', 'hearts'),
        card('offsuit', '5', 'clubs'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true, [card('led', '9', 'hearts')]),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move).toEqual({ type: 'play', cardId: 'low' });
  });

  it('dumps the lowest legal card when no legal card would currently win', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('c1', '2', 'clubs'), card('c2', '5', 'diamonds')]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true, [card('led', 'K', 'spades')]),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move).toEqual({ type: 'play', cardId: 'c1' });
  });
});
```

(The first scenario has two legal moves that both currently win the trick — `high` (K) and `low` (10) — so it genuinely discriminates "cheapest winner" from "any winner," not just from a single-candidate case. The second scenario has two legal moves, neither of which wins, discriminating "lowest legal card" from a single-candidate case too.)

- [ ] **Step 4: Run the tests to verify they fail**

Run (from repo root): `npm test -- games/batak/ai/medium.test.ts`
Expected: FAIL — `./medium` module doesn't exist yet.

- [ ] **Step 5: Implement `medium.ts`**

Create `packages/engine/src/games/batak/ai/medium.ts`:

```ts
import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { BatakState, BatakMove } from '../types';
import { trickWinnerIndex } from '../rules';
import { compareRanks } from '../ranking';
import { chooseTrumpSuit, estimateBidDecision } from './handStrength';

type PlayMove = Extract<BatakMove, { type: 'play' }>;

export const batakMediumAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'medium',
  chooseMove(state, playerId, legalMoves, rng) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return estimateBidDecision(hand, state.highestBid);
    }

    if (state.phase === 'trump-selection') {
      return { type: 'selectTrump', suit: chooseTrumpSuit(hand) };
    }

    const trick = state.table.zones['trick'].cards;
    const playMoves = legalMoves.filter((m): m is PlayMove => m.type === 'play');
    const cardFor = (move: PlayMove) => hand.find((c) => c.id === move.cardId)!;

    const winningMoves =
      trick.length === 0
        ? []
        : playMoves.filter((move) => {
            const candidateTrick = [...trick, cardFor(move)];
            return trickWinnerIndex(candidateTrick, state.trumpSuit!) === candidateTrick.length - 1;
          });

    const pool = winningMoves.length > 0 ? winningMoves : playMoves;
    const lowest = pool.reduce((best, move) => (compareRanks(cardFor(move).rank, cardFor(best).rank) < 0 ? move : best));
    const lowestMoves = pool.filter((move) => compareRanks(cardFor(move).rank, cardFor(lowest).rank) === 0);
    return pickRandom(lowestMoves, rng);
  },
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from repo root): `npm test -- games/batak/ai/medium.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the focused Batak AI tests together to confirm no interference**

Run (from repo root): `npm test -- games/batak/ai`
Expected: PASS — `handStrength.test.ts`, `easy.test.ts`, and `medium.test.ts` all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/ai/medium.ts packages/engine/src/games/batak/ai/medium.test.ts
git commit -m "Export trickWinnerIndex and add batakMediumAI"
```

---

### Task 4: Hard AI

**Files:**
- Create: `packages/engine/src/games/batak/ai/hard.ts`
- Create: `packages/engine/src/games/batak/ai/hard.test.ts`

**Interfaces:**
- Consumes: `minimaxChooseMove<TState, TMove>(state, playerId, legalMoves, options: MinimaxOptions<TState, TMove>): TMove` from `packages/engine/src/ai/minimax.ts` (existing). `chooseTrumpSuit`, `estimateBidDecision` from `./handStrength` (Task 1). `batakMediumAI` from `./medium` (Task 3, test only — proves the bidding/trump code path is genuinely shared). `batakGame` from `../rules` (existing).
- Produces: `batakHardAI: AIStrategy<BatakState, BatakMove>`.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/games/batak/ai/hard.test.ts`:

```ts
import { createRng } from '../../../core/rng';
import { createTable, createZone, TableState } from '../../../core/table';
import { Card, Suit } from '../../../core/types';
import { batakGame } from '../rules';
import { BatakState } from '../types';
import { batakHardAI } from './hard';
import { batakMediumAI } from './medium';

const card = (id: string, rank: Card['rank'], suit: Suit): Card => ({ id, suit, rank });

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function makeState(overrides: Partial<BatakState> & { table: TableState }): BatakState {
  return {
    gameId: 'batak',
    players: PLAYERS,
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    phase: 'bidding',
    bids: { p1: null, p2: null, p3: null, p4: null },
    highestBid: 0,
    contract: null,
    bidWinner: null,
    trumpSuit: null,
    trumpBroken: false,
    currentTrick: [],
    trickLeader: null,
    tricksWon: { p1: 0, p2: 0, p3: 0, p4: 0 },
    ...overrides,
  };
}

describe('batakHardAI', () => {
  it('bids the same as medium AI on the same hand, sharing the bid heuristic', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('s1', 'A', 'spades'),
        card('s2', 'K', 'spades'),
        card('s3', 'Q', 'spades'),
        card('s4', 'J', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(hardMove).toEqual(mediumMove);
    expect(hardMove).toEqual({ type: 'bid', amount: 7 });
  });

  it('selects the same trump suit as medium AI on the same hand, sharing the trump heuristic', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('h1', 'A', 'hearts'),
        card('h2', 'J', 'hearts'),
        card('s1', '2', 'spades'),
        card('s2', '3', 'spades'),
        card('s3', '4', 'spades'),
        card('s4', '5', 'spades'),
        card('s5', '6', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'trump-selection',
      bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 5,
      contract: 5,
      bidWinner: 'p1',
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(hardMove).toEqual(mediumMove);
    expect(hardMove).toEqual({ type: 'selectTrump', suit: 'spades' });
  });

  it('leads the card that wins the trick within its depth-4 search window, where a greedy one-ply heuristic leads low and loses it', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('low', '2', 'hearts'), card('trump', 'A', 'spades')]),
      createZone('hand-p2', true, [card('p2c', '9', 'hearts')]),
      createZone('hand-p3', true, [card('p3c', '8', 'diamonds')]),
      createZone('hand-p4', true, [card('p4c', '7', 'clubs')]),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'playing',
      bids: { p1: 1, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 1,
      contract: 1,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      trumpBroken: true,
      trickLeader: 'p1',
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    // Medium always leads its lowest legal card (nothing "currently wins" an empty trick by
    // definition) - here that loses the trick to p2's 9 of hearts. Hard's depth-4 search reads
    // out the whole trick (a full 4-ply lead-to-resolution window) and sees that leading the
    // spade Ace wins outright, since none of p2/p3/p4 hold any spades.
    expect(mediumMove).toEqual({ type: 'play', cardId: 'low' });
    expect(hardMove).toEqual({ type: 'play', cardId: 'trump' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from repo root): `npm test -- games/batak/ai/hard.test.ts`
Expected: FAIL — `./hard` module doesn't exist yet.

- [ ] **Step 3: Implement `hard.ts`**

Create `packages/engine/src/games/batak/ai/hard.ts`:

```ts
import { AIStrategy } from '../../../ai/types';
import { minimaxChooseMove } from '../../../ai/minimax';
import { BatakState, BatakMove } from '../types';
import { batakGame } from '../rules';
import { chooseTrumpSuit, estimateBidDecision } from './handStrength';

export const batakHardAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'hard',
  chooseMove(state, playerId, legalMoves) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return estimateBidDecision(hand, state.highestBid);
    }

    if (state.phase === 'trump-selection') {
      return { type: 'selectTrump', suit: chooseTrumpSuit(hand) };
    }

    return minimaxChooseMove(state, playerId, legalMoves, {
      ruleEngine: batakGame,
      maximizingPlayer: playerId,
      evaluate: (s) => {
        const score = batakGame.calculateScore(s);
        const opponentTotal = s.players
          .filter((p) => p !== playerId)
          .reduce((sum, p) => sum + score[p], 0);
        return score[playerId] - opponentTotal;
      },
      maxDepth: 4,
    });
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from repo root): `npm test -- games/batak/ai/hard.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/ai/hard.ts packages/engine/src/games/batak/ai/hard.test.ts
git commit -m "Add batakHardAI"
```

---

### Task 5: Registration

**Files:**
- Create: `packages/engine/src/games/batak/index.ts`
- Create: `packages/engine/src/games/batak/index.test.ts`

**Interfaces:**
- Consumes: `GameDescriptor<TState, TMove>` from `packages/engine/src/registry/types.ts` (existing — `category: 'trick-taking'` is already a valid `GameCategory` member). `registerGame(descriptor): void`, `getGame(id): GameDescriptor | undefined` from `packages/engine/src/registry/registry.ts` (existing). `batakGame` from `./rules`, `BatakState`/`BatakMove` from `./types`, `batakEasyAI`/`batakMediumAI`/`batakHardAI` from `./ai/easy`/`./ai/medium`/`./ai/hard` (Tasks 2–4).
- Produces: `batakDescriptor: GameDescriptor<BatakState, BatakMove>`, and the `registerGame(batakDescriptor)` import side effect.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/games/batak/index.test.ts`:

```ts
import { getGame } from '../../registry/registry';
import { batakDescriptor } from './index';

describe('batak registration', () => {
  it('registers batak in the game registry with the expected shape', () => {
    expect(getGame('batak')).toBe(batakDescriptor);
    expect(batakDescriptor.displayName).toBe('Batak');
    expect(batakDescriptor.category).toBe('trick-taking');
    expect(batakDescriptor.minPlayers).toBe(4);
    expect(batakDescriptor.maxPlayers).toBe(4);
    expect(batakDescriptor.aiStrategies.easy.difficulty).toBe('easy');
    expect(batakDescriptor.aiStrategies.medium.difficulty).toBe('medium');
    expect(batakDescriptor.aiStrategies.hard.difficulty).toBe('hard');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from repo root): `npm test -- games/batak/index.test.ts`
Expected: FAIL — `./index` module doesn't exist yet.

- [ ] **Step 3: Implement `index.ts`**

Create `packages/engine/src/games/batak/index.ts`:

```ts
import { GameDescriptor } from '../../registry/types';
import { registerGame } from '../../registry/registry';
import { BatakState, BatakMove } from './types';
import { batakGame } from './rules';
import { batakEasyAI } from './ai/easy';
import { batakMediumAI } from './ai/medium';
import { batakHardAI } from './ai/hard';

export * from './types';

export const batakDescriptor: GameDescriptor<BatakState, BatakMove> = {
  id: 'batak',
  displayName: 'Batak',
  category: 'trick-taking',
  minPlayers: 4,
  maxPlayers: 4,
  ruleEngine: batakGame,
  aiStrategies: {
    easy: batakEasyAI,
    medium: batakMediumAI,
    hard: batakHardAI,
  },
};

registerGame(batakDescriptor);
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from repo root): `npm test -- games/batak/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite, including the pre-existing `registry.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/index.ts packages/engine/src/games/batak/index.test.ts
git commit -m "Register Batak in the game registry"
```

---

### Task 6: Simulation tests

**Files:**
- Create: `packages/engine/src/games/batak/simulate.test.ts`

**Interfaces:**
- Consumes: `simulateGames<TState, TMove>(options: SimulateGamesOptions<TState, TMove>): SimulateGamesResult<TState>` from `packages/engine/src/testing/simulate.ts` (existing). `batakGame` from `./rules`, `BatakSetupOptions` from `./types`, `batakEasyAI` from `./ai/easy` (Task 2), `batakHardAI` from `./ai/hard` (Task 4).
- Produces: nothing consumed by later tasks — this is the plan's last task.

- [ ] **Step 1: Write the tests**

Create `packages/engine/src/games/batak/simulate.test.ts`:

```ts
import { simulateGames } from '../../testing/simulate';
import { batakGame } from './rules';
import { BatakSetupOptions } from './types';
import { batakEasyAI } from './ai/easy';
import { batakHardAI } from './ai/hard';

describe('batak simulateGames', () => {
  it('runs many 4-player easy-vs-easy-vs-easy-vs-easy games without invariant violations', () => {
    const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    const result = simulateGames({
      ruleEngine: batakGame,
      setupOptions,
      aiStrategies: { p1: batakEasyAI, p2: batakEasyAI, p3: batakEasyAI, p4: batakEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('hard AI beats easy AI significantly more than the 25% pure-chance baseline in a 4-player free-for-all', () => {
    const setupOptions: BatakSetupOptions = { players: ['p1', 'p2', 'p3', 'p4'] };
    const result = simulateGames({
      ruleEngine: batakGame,
      setupOptions,
      aiStrategies: { p1: batakHardAI, p2: batakEasyAI, p3: batakEasyAI, p4: batakEasyAI },
      count: 200,
      seedStart: 1,
    });
    const hardWins = result.winCounts['p1'] ?? 0;
    expect(hardWins).toBeGreaterThan(70);
  });
});
```

`simulateGames` calls `assertCardsConserved` internally after every move and throws on any violation — so the first test's assertion (`toHaveLength(500)`, i.e. every one of the 500 games ran a full bidding-through-13-tricks-through-scoring hand to completion without throwing) is what proves the card-conservation invariant held throughout.

- [ ] **Step 2: Run the tests**

Run (from repo root): `npm test -- games/batak/simulate.test.ts`
Expected: PASS. There's no separate "stub" implementation to write here (`simulateGames`, `batakGame`, and both AI strategies already exist from prior tasks) — go straight to running the test. If it fails, that's a real defect in an already-implemented piece, not a missing piece.

- [ ] **Step 3: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/batak/simulate.test.ts
git commit -m "Add Batak simulateGames card-conservation and Hard-vs-Easy win-rate tests"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's five sections map directly — Section 1 (shared heuristic) → Task 1; Section 2 (AI strategies) → Tasks 2–4; Section 3 (`trickWinnerIndex` export) → Task 3 Step 1; Section 4 (registration) → Task 5; Section 5 (testing) → each task's own test file plus Task 6. The spec's Out of Scope section (mobile UI, app-layer glue, on-device profiling, 3-player/eşli variants, recalibrating the heuristic) is correctly not addressed here.
- **Type consistency:** `batakEasyAI`/`batakMediumAI`/`batakHardAI`/`batakDescriptor`/`batakGame`/`BatakState`/`BatakMove`/`chooseTrumpSuit`/`estimateBidDecision`/`trickWinnerIndex` are named identically across every task that references them. `batakHardAI`'s `chooseMove(state, playerId, legalMoves)` (three declared params) is still assignable to the four-parameter `AIStrategy.chooseMove` signature, matching the existing `pistiHardAI`/`cardDraftHardAI` precedent.
- **No placeholders:** every step has complete, runnable code and exact commands. Task 4's hand-crafted minimax scenario (Step 1) is accompanied by an inline comment explaining *why* Hard diverges from Medium there, not just asserting that it does — the divergence was hand-traced against the actual `rules.ts`/`minimax.ts` code during planning to confirm both AIs' outputs before writing the assertions.
- **Test-gap pattern check** (per the recurring "find the extreme element tested with only one candidate" lesson from the RuleEngine sub-project): Task 3's two Medium AI tests each use two legal candidates where the correct answer isn't the trivial single-option case (`high`/`low` both currently win, `c1`/`c2` both currently lose) — the "cheapest winner" and "lowest dump" logic are both `reduce`-based extreme-element searches, so this was deliberately checked.

## Next Step

Once this plan merges, update `CLAUDE.md`'s Status section, then brainstorm and plan the Batak mobile UI sub-project, building on `batakGame` and the three `AIStrategy` implementations from this plan — at which point Batak becomes fully playable end-to-end, mirroring how Pişti's UI sub-project followed its own AI sub-project.
