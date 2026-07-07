# Pişti AI Strategies & Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `pistiEasyAI`/`pistiMediumAI`/`pistiHardAI` (`AIStrategy<PistiState, PistiMove>`), register Pişti in the engine's game registry, and add `simulateGames`-based card-conservation and Hard-vs-Easy win-rate tests.

**Architecture:** Three small, single-responsibility files under `packages/engine/src/games/pisti/ai/` (one per difficulty), each a thin application of an existing shared AI utility (`pickRandom`, a hand-rolled immediate-score heuristic, `minimaxChooseMove`). A new `packages/engine/src/games/pisti/index.ts` assembles the `GameDescriptor` and registers it. Test coverage is unit tests per AI file, a registration test, and a `simulateGames`-based integration test.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`), no new dependencies.

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo.
- `PistiState` must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- Easy AI: pure uniform-random choice via the existing `pickRandom(legalMoves, rng)` utility (`packages/engine/src/ai/weightedRandom.ts`) — no weighting.
- Medium AI: score each legal move by immediate points gained this turn (`calculateScore` after `performMove`, minus `calculateScore` before), pick the max; break ties via `pickRandom` over the tied moves.
- Hard AI: use the existing `minimaxChooseMove` utility (`packages/engine/src/ai/minimax.ts`) with `evaluate = calculateScore[playerId] - <sum of opponent scores>` and `maxDepth: 8` (matching the existing `cardDraftHardAI` precedent).
- `GameCategory` (`packages/engine/src/registry/types.ts`) gets a new `'fishing'` member for Pişti's matching-capture mechanic.
- Pişti's `GameDescriptor`: `id: 'pisti'`, `displayName: 'Pişti'`, `category: 'fishing'`, `minPlayers: 2`, `maxPlayers: 2`.

---

### Task 1: Easy AI

**Files:**
- Create: `packages/engine/src/games/pisti/ai/easy.ts`
- Create: `packages/engine/src/games/pisti/ai/easy.test.ts`

**Interfaces:**
- Consumes: `AIStrategy<TState, TMove>` from `packages/engine/src/ai/types.ts` (existing: `{ difficulty: Difficulty; chooseMove(state, playerId, legalMoves, rng): TMove }`). `pickRandom<T>(items: T[], rng: RNG): T` from `packages/engine/src/ai/weightedRandom.ts`. `PistiState`, `PistiMove` from `packages/engine/src/games/pisti/types.ts` (existing). `pistiGame` from `packages/engine/src/games/pisti/rules.ts` (existing, for the test only).
- Produces: `pistiEasyAI: AIStrategy<PistiState, PistiMove>`.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/games/pisti/ai/easy.test.ts`:

```ts
import { createRng } from '../../../core/rng';
import { pistiGame } from '../rules';
import { PistiSetupOptions } from '../types';
import { pistiEasyAI } from './easy';

describe('pistiEasyAI', () => {
  const setupOptions: PistiSetupOptions = { players: ['p1', 'p2'] };

  it('always returns a legal move', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = pistiGame.setup(setupOptions, createRng(seed));
      const legalMoves = pistiGame.getLegalMoves(state, 'p1');
      const move = pistiEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed + 100));
      expect(legalMoves).toContainEqual(move);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from repo root): `npm test -- ai/easy.test.ts`
Expected: FAIL — `./easy` module doesn't exist yet.

- [ ] **Step 3: Implement `easy.ts`**

Create `packages/engine/src/games/pisti/ai/easy.ts`:

```ts
import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { PistiState, PistiMove } from '../types';

export const pistiEasyAI: AIStrategy<PistiState, PistiMove> = {
  difficulty: 'easy',
  chooseMove(_state, _playerId, legalMoves, rng) {
    return pickRandom(legalMoves, rng);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from repo root): `npm test -- ai/easy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/pisti/ai/easy.ts packages/engine/src/games/pisti/ai/easy.test.ts
git commit -m "Add pistiEasyAI"
```

---

### Task 2: Medium AI

**Files:**
- Create: `packages/engine/src/games/pisti/ai/medium.ts`
- Create: `packages/engine/src/games/pisti/ai/medium.test.ts`

**Interfaces:**
- Consumes: same as Task 1, plus `pistiGame.calculateScore(state: PistiState): ScoreBoard` and `pistiGame.performMove(state: PistiState, move: PistiMove): PistiState` (both existing, from `packages/engine/src/games/pisti/rules.ts`). `createTable`, `createZone` from `packages/engine/src/core/table.ts`. `Card` from `packages/engine/src/core/types.ts`.
- Produces: `pistiMediumAI: AIStrategy<PistiState, PistiMove>`.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/games/pisti/ai/medium.test.ts`:

```ts
import { createRng } from '../../../core/rng';
import { createTable, createZone } from '../../../core/table';
import { Card } from '../../../core/types';
import { pistiGame } from '../rules';
import { PistiState } from '../types';
import { pistiMediumAI } from './medium';

const card = (id: string, rank: Card['rank'], suit: Card['suit'] = 'hearts'): Card => ({ id, suit, rank });

function makeState(table: PistiState['table']): PistiState {
  return {
    gameId: 'pisti',
    players: ['p1', 'p2'],
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    lastCapturedBy: null,
    pistiBonusPoints: { p1: 0, p2: 0 },
    table,
  };
}

describe('pistiMediumAI', () => {
  it('picks the move that captures over one that does not', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '7', 'clubs')]),
      createZone('hand-p1', true, [card('capture', '7', 'spades'), card('nocapture', '3')]),
      createZone('hand-p2', true, [card('h2', '5')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState(table);
    const legalMoves = pistiGame.getLegalMoves(state, 'p1');
    const move = pistiMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move.cardId).toBe('capture');
  });
});
```

(The `createRng(1)` passed as the `rng` argument is exercised by `pickRandom` inside `pistiMediumAI` even though this scenario has only one move tying for the maximum score — `pickRandom` always calls `rng.next()`, so a real `RNG` is needed here, not a stand-in value.)

- [ ] **Step 2: Run the test to verify it fails**

Run (from repo root): `npm test -- ai/medium.test.ts`
Expected: FAIL — `./medium` module doesn't exist yet.

- [ ] **Step 3: Implement `medium.ts`**

Create `packages/engine/src/games/pisti/ai/medium.ts`:

```ts
import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { PistiState, PistiMove } from '../types';
import { pistiGame } from '../rules';

export const pistiMediumAI: AIStrategy<PistiState, PistiMove> = {
  difficulty: 'medium',
  chooseMove(state, playerId, legalMoves, rng) {
    const before = pistiGame.calculateScore(state)[playerId];
    const scores = legalMoves.map((move) => {
      const after = pistiGame.calculateScore(pistiGame.performMove(state, move))[playerId];
      return after - before;
    });
    const maxScore = Math.max(...scores);
    const bestMoves = legalMoves.filter((_, i) => scores[i] === maxScore);
    return pickRandom(bestMoves, rng);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from repo root): `npm test -- ai/medium.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the focused Task 1+2 tests together to confirm no interference**

Run (from repo root): `npm test -- games/pisti/ai`
Expected: PASS — both `easy.test.ts` and `medium.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/pisti/ai/medium.ts packages/engine/src/games/pisti/ai/medium.test.ts
git commit -m "Add pistiMediumAI"
```

---

### Task 3: Hard AI

**Files:**
- Create: `packages/engine/src/games/pisti/ai/hard.ts`
- Create: `packages/engine/src/games/pisti/ai/hard.test.ts`

**Interfaces:**
- Consumes: `minimaxChooseMove<TState, TMove>(state, playerId, legalMoves, options: MinimaxOptions<TState, TMove>): TMove` from `packages/engine/src/ai/minimax.ts` (existing; `MinimaxOptions` = `{ ruleEngine, maximizingPlayer, evaluate: (state) => number, maxDepth: number }`). Same `pistiGame`, `PistiState`, `PistiMove`, `createTable`/`createZone`/`Card`/`createRng` as prior tasks.
- Produces: `pistiHardAI: AIStrategy<PistiState, PistiMove>`.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/games/pisti/ai/hard.test.ts`:

```ts
import { createRng } from '../../../core/rng';
import { createTable, createZone } from '../../../core/table';
import { Card } from '../../../core/types';
import { pistiGame } from '../rules';
import { PistiState } from '../types';
import { pistiHardAI } from './hard';

const card = (id: string, rank: Card['rank'], suit: Card['suit'] = 'hearts'): Card => ({ id, suit, rank });

function makeState(table: PistiState['table']): PistiState {
  return {
    gameId: 'pisti',
    players: ['p1', 'p2'],
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    lastCapturedBy: null,
    pistiBonusPoints: { p1: 0, p2: 0 },
    table,
  };
}

describe('pistiHardAI', () => {
  it('picks the move that captures over one that does not', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '7', 'clubs')]),
      createZone('hand-p1', true, [card('capture', '7', 'spades'), card('nocapture', '3')]),
      createZone('hand-p2', true, [card('h2', '5')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState(table);
    const legalMoves = pistiGame.getLegalMoves(state, 'p1');
    const move = pistiHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move.cardId).toBe('capture');
  });

  it('always returns a legal move', () => {
    const table = createTable([
      createZone('stock', false),
      createZone('pile', 'top-only', [card('p1c', '9', 'clubs')]),
      createZone('hand-p1', true, [card('a', '4'), card('b', '6')]),
      createZone('hand-p2', true, [card('h2', '5')]),
      createZone('captured-p1', true),
      createZone('captured-p2', true),
    ]);
    const state = makeState(table);
    const legalMoves = pistiGame.getLegalMoves(state, 'p1');
    const move = pistiHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(legalMoves).toContainEqual(move);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from repo root): `npm test -- ai/hard.test.ts`
Expected: FAIL — `./hard` module doesn't exist yet.

- [ ] **Step 3: Implement `hard.ts`**

Create `packages/engine/src/games/pisti/ai/hard.ts`:

```ts
import { AIStrategy } from '../../../ai/types';
import { minimaxChooseMove } from '../../../ai/minimax';
import { PistiState, PistiMove } from '../types';
import { pistiGame } from '../rules';

export const pistiHardAI: AIStrategy<PistiState, PistiMove> = {
  difficulty: 'hard',
  chooseMove(state, playerId, legalMoves) {
    return minimaxChooseMove(state, playerId, legalMoves, {
      ruleEngine: pistiGame,
      maximizingPlayer: playerId,
      evaluate: (s) => {
        const score = pistiGame.calculateScore(s);
        const opponentTotal = s.players
          .filter((p) => p !== playerId)
          .reduce((sum, p) => sum + score[p], 0);
        return score[playerId] - opponentTotal;
      },
      maxDepth: 8,
    });
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from repo root): `npm test -- ai/hard.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/pisti/ai/hard.ts packages/engine/src/games/pisti/ai/hard.test.ts
git commit -m "Add pistiHardAI"
```

---

### Task 4: Registration (`GameCategory` + `pisti/index.ts`)

**Files:**
- Modify: `packages/engine/src/registry/types.ts`
- Create: `packages/engine/src/games/pisti/index.ts`
- Create: `packages/engine/src/games/pisti/index.test.ts`

**Interfaces:**
- Consumes: `GameDescriptor<TState, TMove>` and `GameCategory` from `packages/engine/src/registry/types.ts` (existing, modified by this task). `registerGame(descriptor): void`, `getGame(id): GameDescriptor | undefined` from `packages/engine/src/registry/registry.ts` (existing). `pistiGame` from `./rules`, `PistiState`/`PistiMove` from `./types`, `pistiEasyAI`/`pistiMediumAI`/`pistiHardAI` from `./ai/easy`/`./ai/medium`/`./ai/hard` (all from Tasks 1–3).
- Produces: `pistiDescriptor: GameDescriptor<PistiState, PistiMove>`, and the `registerGame(pistiDescriptor)` import side effect.

- [ ] **Step 1: Modify `GameCategory`**

In `packages/engine/src/registry/types.ts`, find this exact line:

```ts
export type GameCategory = 'trick-taking' | 'patience' | 'betting' | 'draw-and-discard' | 'other';
```

Replace it with:

```ts
export type GameCategory = 'trick-taking' | 'patience' | 'betting' | 'draw-and-discard' | 'fishing' | 'other';
```

- [ ] **Step 2: Write the failing test**

Create `packages/engine/src/games/pisti/index.test.ts`:

```ts
import { getGame } from '../../registry/registry';
import { pistiDescriptor } from './index';

describe('pisti registration', () => {
  it('registers pisti in the game registry with the expected shape', () => {
    expect(getGame('pisti')).toBe(pistiDescriptor);
    expect(pistiDescriptor.displayName).toBe('Pişti');
    expect(pistiDescriptor.category).toBe('fishing');
    expect(pistiDescriptor.minPlayers).toBe(2);
    expect(pistiDescriptor.maxPlayers).toBe(2);
    expect(pistiDescriptor.aiStrategies.easy.difficulty).toBe('easy');
    expect(pistiDescriptor.aiStrategies.medium.difficulty).toBe('medium');
    expect(pistiDescriptor.aiStrategies.hard.difficulty).toBe('hard');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from repo root): `npm test -- games/pisti/index.test.ts`
Expected: FAIL — `./index` module doesn't exist yet.

- [ ] **Step 4: Implement `index.ts`**

Create `packages/engine/src/games/pisti/index.ts`:

```ts
import { GameDescriptor } from '../../registry/types';
import { registerGame } from '../../registry/registry';
import { PistiState, PistiMove } from './types';
import { pistiGame } from './rules';
import { pistiEasyAI } from './ai/easy';
import { pistiMediumAI } from './ai/medium';
import { pistiHardAI } from './ai/hard';

export const pistiDescriptor: GameDescriptor<PistiState, PistiMove> = {
  id: 'pisti',
  displayName: 'Pişti',
  category: 'fishing',
  minPlayers: 2,
  maxPlayers: 2,
  ruleEngine: pistiGame,
  aiStrategies: {
    easy: pistiEasyAI,
    medium: pistiMediumAI,
    hard: pistiHardAI,
  },
};

registerGame(pistiDescriptor);
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from repo root): `npm test -- games/pisti/index.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite, including the pre-existing `registry.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/registry/types.ts packages/engine/src/games/pisti/index.ts packages/engine/src/games/pisti/index.test.ts
git commit -m "Register Pişti in the game registry with a new 'fishing' GameCategory"
```

---

### Task 5: Simulation tests

**Files:**
- Create: `packages/engine/src/games/pisti/simulate.test.ts`

**Interfaces:**
- Consumes: `simulateGames<TState, TMove>(options: SimulateGamesOptions<TState, TMove>): SimulateGamesResult<TState>` from `packages/engine/src/testing/simulate.ts` (existing; `SimulateGamesOptions` = `{ ruleEngine, setupOptions: unknown, aiStrategies: Record<PlayerId, AIStrategy>, count: number, seedStart: number, maxMoves?: number }`; `SimulateGamesResult` = `{ finalStates: TState[], winCounts: Record<PlayerId, number> }`). `pistiGame` from `./rules`, `PistiSetupOptions` from `./types`, `pistiEasyAI` from `./ai/easy` (Task 1), `pistiHardAI` from `./ai/hard` (Task 3).
- Produces: nothing consumed by later tasks — this is the plan's last task.

- [ ] **Step 1: Write the tests**

Create `packages/engine/src/games/pisti/simulate.test.ts`:

```ts
import { simulateGames } from '../../testing/simulate';
import { pistiGame } from './rules';
import { PistiSetupOptions } from './types';
import { pistiEasyAI } from './ai/easy';
import { pistiHardAI } from './ai/hard';

describe('pisti simulateGames', () => {
  it('runs many easy-vs-easy games without invariant violations', () => {
    const setupOptions: PistiSetupOptions = { players: ['p1', 'p2'] };
    const result = simulateGames({
      ruleEngine: pistiGame,
      setupOptions,
      aiStrategies: { p1: pistiEasyAI, p2: pistiEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('hard AI beats easy AI significantly more than half the time', () => {
    const setupOptions: PistiSetupOptions = { players: ['hard', 'easy'] };
    const result = simulateGames({
      ruleEngine: pistiGame,
      setupOptions,
      aiStrategies: { hard: pistiHardAI, easy: pistiEasyAI },
      count: 200,
      seedStart: 1,
    });
    const hardWins = result.winCounts['hard'] ?? 0;
    expect(hardWins).toBeGreaterThan(120);
  });
});
```

`simulateGames` calls `assertCardsConserved` internally after every move and throws on any violation (duplicate card id, card count change, etc.) — so the first test's assertion (`toHaveLength(500)`, i.e. every one of the 500 games ran to completion without throwing) is what proves the card-conservation invariant held throughout.

- [ ] **Step 2: Run the tests**

Run (from repo root): `npm test -- games/pisti/simulate.test.ts`
Expected: PASS. This is not a TDD red/green cycle in the usual sense (there's no separate "stub" implementation to write — `simulateGames`, `pistiGame`, and both AI strategies already exist from prior tasks), so there is no expected-failure step; go straight to running the test and confirming it passes. If it fails, that's a real defect in one of the already-implemented pieces (`pistiGame`, `pistiEasyAI`, or `pistiHardAI`), not a missing piece — investigate rather than assuming a red-then-green flow is expected here.

- [ ] **Step 3: Run the full suite to confirm no regressions**

Run (from repo root): `npm test`
Expected: PASS — every suite.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/pisti/simulate.test.ts
git commit -m "Add Pişti simulateGames card-conservation and Hard-vs-Easy win-rate tests"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's three sections (AI Strategies, Registration, Testing) map to Tasks 1–3 (AI), Task 4 (registration), and Tasks 1–3's per-file tests plus Task 5 (simulation tests) respectively. Nothing in the spec's in-scope sections is left uncovered; the spec's own "Out of Scope" section (UI, app-layer AI glue, games barrel, on-device profiling) is correctly not addressed here.
- **Type consistency:** `pistiEasyAI`, `pistiMediumAI`, `pistiHardAI`, `pistiDescriptor`, `pistiGame`, `PistiState`, `PistiMove` are named identically across all five tasks. `pistiHardAI`'s `chooseMove(state, playerId, legalMoves)` (three declared params, matching the existing `cardDraftHardAI` precedent) is still assignable to the four-parameter `AIStrategy.chooseMove` signature — the same technique already used for the `PistiState`/`RuleEngine` stub in the prior rule-engine plan.
- **No placeholders:** every step has complete, runnable code and exact commands. (Task 2's Step 1 walks through why a real `RNG` is needed rather than a stand-in value, then gives the one correct file to actually write — this is an explanation of a design choice, not a placeholder.)

## Next Step

Once the mobile UI sub-project exists, wire `pistiDescriptor`'s AI strategies into the app layer (`InteractionManager.runAfterInteractions` + a "thinking" delay) and profile Hard AI's real frame timing on a mid-range device, per the standing Phase 1 performance-risk note.
