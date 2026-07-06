# Pişti State Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the shared `moveAllCards` core primitive and the Pişti `PistiState`/`PistiMove`/`PistiSetupOptions` type declarations defined in `docs/superpowers/specs/2026-07-07-pisti-rules-and-state-design.md`, so the next sub-project (the Pişti `RuleEngine`/`AIStrategy` implementation) has both the data shapes and the bulk-capture utility it needs already in place.

**Architecture:** One small addition to the existing shared `packages/engine/src/core/table.ts` module (a `moveAllCards` function alongside the existing `moveCard`), and one new file, `packages/engine/src/games/pisti/types.ts`, holding pure type declarations with no runtime logic — following the same pattern as `packages/engine/src/rules/types.ts` and `packages/engine/src/ai/types.ts`.

**Tech Stack:** TypeScript (strict mode), Jest (`ts-jest`) for the engine package's Node-environment test project.

## Global Constraints

- `packages/engine` has zero dependency on React/React Native/Expo — do not import anything from `apps/mobile` or add such a dependency.
- `GameState` (and anything extending it, like `PistiState`) must remain plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- Follow the existing `moveCard` error-message style (`` `functionName: unknown zone "${zoneId}"` ``) for consistency.

---

### Task 1: `moveAllCards` core primitive

**Files:**
- Modify: `packages/engine/src/core/table.ts`
- Test: `packages/engine/src/core/table.test.ts`

**Interfaces:**
- Consumes: existing `TableState`, `Zone` types from the same file; `createTable`/`createZone` test helpers already in `table.test.ts`.
- Produces: `moveAllCards(table: TableState, fromZoneId: string, toZoneId: string): TableState` — moves every card currently in `fromZoneId` to the end of `toZoneId`'s card array, preserving order, and empties `fromZoneId`. Throws if either zone doesn't exist. Later tasks (the Pişti rule engine) will call this to move an entire capture pile into a player's captured-cards zone.

- [ ] **Step 1: Write the failing tests**

Add these three `it` blocks inside the existing `describe('table operations', ...)` in `packages/engine/src/core/table.test.ts` (append after the last `it` block, before the closing `});`):

```ts
  it('moves all cards from one zone to another, preserving order', () => {
    const table = createTable([
      createZone('pile', true, [card('c1'), card('c2'), card('c3')]),
      createZone('captured', true),
    ]);
    const next = moveAllCards(table, 'pile', 'captured');
    expect(next.zones['pile'].cards).toEqual([]);
    expect(next.zones['captured'].cards.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('appends onto existing cards in the destination zone when moving all cards', () => {
    const table = createTable([
      createZone('pile', true, [card('c2')]),
      createZone('captured', true, [card('c1')]),
    ]);
    const next = moveAllCards(table, 'pile', 'captured');
    expect(next.zones['captured'].cards.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('throws when moving all cards and a zone does not exist', () => {
    const table = createTable([createZone('pile', true, [card('c1')])]);
    expect(() => moveAllCards(table, 'pile', 'nonexistent')).toThrow();
    expect(() => moveAllCards(table, 'nonexistent', 'pile')).toThrow();
  });
```

Also update the import at the top of the file to include the new function:

```ts
import { createZone, createTable, moveCard, moveAllCards, dealToZones, allCards } from './table';
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from repo root): `npm test -- table.test.ts`
Expected: FAIL — `moveAllCards` is not exported from `./table` (TypeScript compile error surfaced through `ts-jest`).

- [ ] **Step 3: Implement `moveAllCards`**

Add this function to `packages/engine/src/core/table.ts`, directly after the existing `moveCard` function:

```ts
export function moveAllCards(table: TableState, fromZoneId: string, toZoneId: string): TableState {
  const fromZone = table.zones[fromZoneId];
  const toZone = table.zones[toZoneId];
  if (!fromZone || !toZone) {
    throw new Error(`moveAllCards: unknown zone "${!fromZone ? fromZoneId : toZoneId}"`);
  }
  return {
    zones: {
      ...table.zones,
      [fromZoneId]: { ...fromZone, cards: [] },
      [toZoneId]: { ...toZone, cards: [...toZone.cards, ...fromZone.cards] },
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from repo root): `npm test -- table.test.ts`
Expected: PASS — all tests in `table.test.ts`, including the 3 new ones.

- [ ] **Step 5: Export `moveAllCards` from the package root**

`packages/engine/src/index.ts` already has `export * from './core/table';` (line 4), so `moveAllCards` is automatically re-exported — no change needed there. Confirm this by checking the file still reads exactly:

```ts
export * from './core/types';
export * from './core/rng';
export * from './core/deck';
export * from './core/table';
export * from './core/ranking';
export * from './rules/types';
export * from './ai/types';
export * from './ai/weightedRandom';
export * from './ai/minimax';
export * from './registry/types';
export * from './registry/registry';
export * from './persistence/types';
export * from './statistics/types';
```

If it doesn't match, do not edit it in this task — flag the mismatch instead (this is an assertion, not expected to be true after this task's changes).

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/core/table.ts packages/engine/src/core/table.test.ts
git commit -m "Add moveAllCards core primitive for bulk zone-to-zone capture"
```

---

### Task 2: Pişti data model types

**Files:**
- Create: `packages/engine/src/games/pisti/types.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId` from `packages/engine/src/rules/types.ts` (existing: `interface GameState { gameId: string; players: PlayerId[]; currentPlayerIndex: number; table: TableState; rngState: RngState; status: 'setup' | 'in-progress' | 'finished'; }`, `type PlayerId = string`).
- Produces: `PistiState`, `PistiMove`, `PistiSetupOptions` — the exact type names and shapes the upcoming Pişti `RuleEngine` implementation (next sub-project) will import and implement against.

**Note on testing:** this file contains only type declarations, no runtime logic — the same pattern already used by `packages/engine/src/rules/types.ts`, `packages/engine/src/ai/types.ts`, `packages/engine/src/registry/types.ts`, and `packages/engine/src/persistence/types.ts`, none of which have a corresponding `.test.ts` file. Following that precedent, this task is verified by a successful TypeScript compile and a full, unbroken test suite run rather than a new Jest test.

- [ ] **Step 1: Create the types file**

Create `packages/engine/src/games/pisti/types.ts`:

```ts
import { GameState, PlayerId } from '../../rules/types';

export interface PistiState extends GameState {
  lastCapturedBy: PlayerId | null;
  pistiBonusPoints: Record<PlayerId, number>;
}

export type PistiMove = { type: 'play'; cardId: string };

export interface PistiSetupOptions {
  players: [PlayerId, PlayerId];
}
```

- [ ] **Step 2: Verify it type-checks**

Run (from repo root): `npx tsc --noEmit --ignoreDeprecations 6.0 -p packages/engine/tsconfig.json`
Expected: no errors, exit code 0. (The `--ignoreDeprecations 6.0` flag works around a pre-existing `moduleResolution=node10` deprecation warning in `packages/engine/tsconfig.json` that TypeScript ~6.0.3 treats as a hard error — this is unrelated to this task's changes and reproduces identically on `master` before this file is added, so it is not something to fix here.)

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npm test`
Expected: PASS — every existing suite (including Task 1's new `table.test.ts` cases) still passes; no new failures introduced by the new file.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/pisti/types.ts
git commit -m "Add Pişti GameState/Move/SetupOptions type declarations"
```

---

## Self-Review Notes

- **Spec coverage:** Section 3 of the spec calls for exactly two deliverables ahead of the rule-engine sub-project — the `moveAllCards` core primitive and the `PistiState`/`PistiMove`/`PistiSetupOptions` type declarations. Both are covered (Task 1, Task 2). The spec explicitly defers `RuleEngine`/`AIStrategy` implementation, UI, and tests beyond these — not included here, by design.
- **Type consistency:** `PistiState`/`PistiMove`/`PistiSetupOptions` field names (`lastCapturedBy`, `pistiBonusPoints`, `players`) match the spec's Section 2 exactly, and `moveAllCards`'s signature matches how Section 3's `performMove` description uses it (`moveAllCards(table, 'pile', captured-<player>)`).
- **No placeholders:** every step has complete, runnable code and exact commands.

## Next Step

Brainstorm and plan the Pişti `RuleEngine`/`AIStrategy` implementation sub-project, building on `PistiState`/`PistiMove`/`PistiSetupOptions` and `moveAllCards` from this plan.
