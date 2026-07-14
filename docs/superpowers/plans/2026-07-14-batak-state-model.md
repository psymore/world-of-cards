# Batak State Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Batak-specific rank comparator and the `BatakState`/`BatakMove`/`BatakSetupOptions` type declarations defined in `docs/superpowers/specs/2026-07-14-batak-rules-and-state-design.md`, so the next sub-project (the Batak `RuleEngine`/`AIStrategy` implementation) has both the data shapes and the ace-high rank comparison it needs already in place.

**Architecture:** One new file, `packages/engine/src/games/batak/ranking.ts`, wrapping the existing generic `createRankComparator` (`packages/engine/src/core/ranking.ts`) with a Batak-specific ace-high rank order — this has real runtime logic, so per the engine-core testing policy it gets a test file. A second new file, `packages/engine/src/games/batak/types.ts`, holding pure type declarations with no runtime logic — following the same pattern as `packages/engine/src/games/pisti/types.ts` and `packages/engine/src/rules/types.ts`.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`) for the engine package's Node-environment test project.

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo — do not import anything from `apps/mobile` or add such a dependency.
- `GameState` (and anything extending it, like `BatakState`) must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- No jokers: Batak is played with the standard 52-card deck, so the rank order excludes `'joker'` even though it's a valid `Rank` union member.

---

### Task 1: Batak rank comparator

**Files:**
- Create: `packages/engine/src/games/batak/ranking.ts`
- Test: `packages/engine/src/games/batak/ranking.test.ts`

**Interfaces:**
- Consumes: `Rank` from `packages/engine/src/core/types.ts` (existing: `type Rank = 'A' | '2' | ... | 'K' | 'joker'`); `createRankComparator` from `packages/engine/src/core/ranking.ts` (existing: `createRankComparator(order: Rank[]): (a: Rank, b: Rank) => number`, returns negative/zero/positive like a standard JS comparator, i.e. `compareRanks(a, b) > 0` means `a` outranks `b`).
- Produces: `BATAK_RANK_ORDER: Rank[]` and `compareRanks(a: Rank, b: Rank): number` — the exact names the upcoming Batak `RuleEngine` implementation (next sub-project) will import to implement the mandatory-raise rule and trick-winner determination.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/games/batak/ranking.test.ts`:

```ts
import { compareRanks, BATAK_RANK_ORDER } from './ranking';

describe('BATAK_RANK_ORDER', () => {
  it('has all 13 non-joker ranks, ace first (highest)', () => {
    expect(BATAK_RANK_ORDER).toEqual([
      'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2',
    ]);
  });
});

describe('compareRanks', () => {
  it('ranks ace above king', () => {
    expect(compareRanks('A', 'K')).toBeGreaterThan(0);
  });

  it('ranks 10 above 9', () => {
    expect(compareRanks('10', '9')).toBeGreaterThan(0);
  });

  it('ranks 2 as the lowest', () => {
    expect(compareRanks('2', '3')).toBeLessThan(0);
    expect(compareRanks('2', 'A')).toBeLessThan(0);
  });

  it('returns zero for equal ranks', () => {
    expect(compareRanks('Q', 'Q')).toBe(0);
  });

  it('throws for a joker, since Batak is played without jokers', () => {
    expect(() => compareRanks('joker', 'A')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test -- ranking.test.ts`
Expected: FAIL — `packages/engine/src/games/batak/ranking.ts` does not exist yet (module not found).

- [ ] **Step 3: Implement the comparator**

Create `packages/engine/src/games/batak/ranking.ts`:

```ts
import { Rank } from '../../core/types';
import { createRankComparator } from '../../core/ranking';

export const BATAK_RANK_ORDER: Rank[] = [
  'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2',
];

export const compareRanks = createRankComparator(BATAK_RANK_ORDER);
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from repo root): `npm test -- ranking.test.ts`
Expected: PASS — all 5 new tests in `ranking.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/games/batak/ranking.ts packages/engine/src/games/batak/ranking.test.ts
git commit -m "Add Batak ace-high rank comparator"
```

---

### Task 2: Batak data model types

**Files:**
- Create: `packages/engine/src/games/batak/types.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId` from `packages/engine/src/rules/types.ts` (existing: `interface GameState { gameId: string; players: PlayerId[]; currentPlayerIndex: number; table: TableState; rngState: RngState; status: 'setup' | 'in-progress' | 'finished'; }`, `type PlayerId = string`); `Suit` from `packages/engine/src/core/types.ts` (existing: `type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'`).
- Produces: `BatakState`, `BatakMove`, `BatakSetupOptions` — the exact type names and shapes the upcoming Batak `RuleEngine` implementation (next sub-project) will import and implement against.

**Note on testing:** this file contains only type declarations, no runtime logic — the same pattern already used by `packages/engine/src/games/pisti/types.ts`, `packages/engine/src/rules/types.ts`, `packages/engine/src/ai/types.ts`, none of which have a corresponding `.test.ts` file. Following that precedent, this task is verified by a successful TypeScript compile and a full, unbroken test suite run rather than a new Jest test.

- [ ] **Step 1: Create the types file**

Create `packages/engine/src/games/batak/types.ts`:

```ts
import { GameState, PlayerId } from '../../rules/types';
import { Suit } from '../../core/types';

export interface BatakState extends GameState {
  phase: 'bidding' | 'trump-selection' | 'playing' | 'finished';
  bids: Record<PlayerId, number | 'pass' | null>;
  highestBid: number;
  contract: number | null;
  bidWinner: PlayerId | null;
  trumpSuit: Suit | null;
  trumpBroken: boolean;
  currentTrick: Array<{ playerId: PlayerId; cardId: string }>;
  trickLeader: PlayerId | null;
  tricksWon: Record<PlayerId, number>;
}

export type BatakMove =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'play'; cardId: string };

export interface BatakSetupOptions {
  players: [PlayerId, PlayerId, PlayerId, PlayerId];
}
```

- [ ] **Step 2: Verify it type-checks**

Run (from repo root): `npx tsc --noEmit --ignoreDeprecations 6.0 -p packages/engine/tsconfig.json`
Expected: no errors, exit code 0. (The `--ignoreDeprecations 6.0` flag works around a pre-existing deprecation warning in `packages/engine/tsconfig.json` unrelated to this task's changes — see the identical note in `docs/superpowers/plans/2026-07-07-pisti-state-model.md`.)

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npm test`
Expected: PASS — every existing suite (including Task 1's new `ranking.test.ts` cases) still passes; no new failures introduced by the new file.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/batak/types.ts
git commit -m "Add Batak GameState/Move/SetupOptions type declarations"
```

---

## Self-Review Notes

- **Spec coverage:** Sections 2 and 3 of the spec call for exactly two deliverables ahead of the rule-engine sub-project — the ace-high rank comparator (Section 3) and the `BatakState`/`BatakMove`/`BatakSetupOptions` type declarations (Section 2). Both are covered (Task 1, Task 2). The spec explicitly defers `RuleEngine`/`AIStrategy` implementation, UI, and tests beyond these — not included here, by design.
- **Type consistency:** `BatakState`/`BatakMove`/`BatakSetupOptions` field names (`phase`, `bids`, `highestBid`, `contract`, `bidWinner`, `trumpSuit`, `trumpBroken`, `currentTrick`, `trickLeader`, `tricksWon`, `players`) match the spec's Section 2 exactly. `compareRanks`'s signature and ace-high ordering match how Section 4's algorithm summary uses rank comparison for the mandatory-raise rule and trick-winner determination.
- **No placeholders:** every step has complete, runnable code and exact commands.

## Next Step

Brainstorm and plan the Batak `RuleEngine`/`AIStrategy` implementation sub-project, building on `BatakState`/`BatakMove`/`BatakSetupOptions` and `compareRanks` from this plan.
