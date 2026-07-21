# Setup-Options Typing & Shared Hand-Area Constants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the `RuleEngine.setup(options: unknown)` type-safety gap with a proper `TOptions` generic, extract the one remaining live tuple-cast duplication in Batak's bury logic into a shared helper, and centralize the small set of genuinely-duplicated hand-area layout constants between Pişti's and Batak's table files.

**Architecture:** Three independent, low-risk refactors bundled into one branch since each is small and mechanical: (1) add a third generic parameter `TOptions = unknown` to `RuleEngine`/`GameDescriptor`, defaulted so every existing 2-argument usage keeps compiling unchanged, then wire both real games' `setup()` to use it instead of an internal unchecked cast; (2) extract a `toBuryCardIds` helper in Batak's `rules.ts` for the `combo.map(c => c.id) as [string,string,string,string]` pattern duplicated across `rules.ts` and all 3 AI difficulty files; (3) extract the 4 genuinely-identical hand-area magic numbers (not the layout *formulas*, which stay independently written per game) from `PistiTable.tsx`/`BatakTable.tsx` into a new shared `packages/ui/src/handAreaLayout.ts` module.

**Tech Stack:** TypeScript generics (packages/engine), React Native (apps/mobile), no new dependencies.

## Global Constraints

- No behavior change anywhere in this plan — every task is a pure type-safety or DRY refactor. If any task's change would alter runtime output, stop and report it rather than proceeding.
- No new automated tests for the `apps/mobile` UI changes (Tasks 9-10), per this project's standing 2026-07-07 testing policy. The `packages/engine` changes (Tasks 1-6) are exempt from that policy — engine code stays test-covered by default — but these are pure type-safety/DRY refactors with existing test coverage already exercising the changed code paths; no task in this plan asks for new engine tests either, only re-running the existing suite to confirm nothing broke.
- Every generic default must make prior 2-argument usages (`RuleEngine<TState, TMove>`, `GameDescriptor<TState, TMove>`) continue to compile with no changes required at those call sites.
- Read this investigation's findings before starting if anything below is unclear: this plan was written directly from a live codebase investigation (no separate spec doc), verified against the actual current file contents on `master`.

---

## Task 1: Add `TOptions` generic to `RuleEngine` and `GameDescriptor`

**Files:**
- Modify: `packages/engine/src/rules/types.ts`
- Modify: `packages/engine/src/registry/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `RuleEngine<TState extends GameState, TMove, TOptions = unknown>` with `setup(options: TOptions, rng: RNG): TState`. `GameDescriptor<TState extends GameState = GameState, TMove = unknown, TOptions = unknown>` with `ruleEngine: RuleEngine<TState, TMove, TOptions>`. Tasks 2-6 consume these.

- [ ] **Step 1: Add the generic to `RuleEngine`**

In `packages/engine/src/rules/types.ts`, replace:

```ts
export interface RuleEngine<TState extends GameState, TMove> {
  setup(options: unknown, rng: import('../core/rng').RNG): TState;
```

with:

```ts
export interface RuleEngine<TState extends GameState, TMove, TOptions = unknown> {
  setup(options: TOptions, rng: import('../core/rng').RNG): TState;
```

- [ ] **Step 2: Add the generic to `GameDescriptor`**

In `packages/engine/src/registry/types.ts`, replace:

```ts
export interface GameDescriptor<TState extends GameState = GameState, TMove = unknown> {
  id: string;
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  ruleEngine: RuleEngine<TState, TMove>;
  aiStrategies: Record<Difficulty, AIStrategy<TState, TMove>>;
}
```

with:

```ts
export interface GameDescriptor<TState extends GameState = GameState, TMove = unknown, TOptions = unknown> {
  id: string;
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  ruleEngine: RuleEngine<TState, TMove, TOptions>;
  aiStrategies: Record<Difficulty, AIStrategy<TState, TMove>>;
}
```

- [ ] **Step 3: Typecheck the whole workspace**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json && npx tsc --noEmit -p packages/ui/tsconfig.json`

Expected: no errors. Every existing 2-argument `RuleEngine<X, Y>`/`GameDescriptor<X, Y>` usage (in `packages/engine/src/registry/registry.ts`'s `GameDescriptor<any, any>`, `apps/mobile/src/hooks/useAITurn.ts`, `apps/mobile/src/state/createGameSessionStore.ts`, and their test files) must still compile unchanged, since `TOptions` defaults to `unknown` when omitted.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/rules/types.ts packages/engine/src/registry/types.ts
git commit -m "Add optional TOptions generic to RuleEngine and GameDescriptor"
```

---

## Task 2: Wire Pişti's `setup()` to the typed options

**Files:**
- Modify: `packages/engine/src/games/pisti/rules.ts`

**Interfaces:**
- Consumes: `RuleEngine<TState, TMove, TOptions>` (Task 1), the existing `PistiSetupOptions` type (`packages/engine/src/games/pisti/types.ts`, unchanged).
- Produces: `pistiGame: RuleEngine<PistiState, PistiMove, PistiSetupOptions>`. Later tasks don't depend on this directly, but Task 7 (simulate.ts) relies on the pattern this establishes.

- [ ] **Step 1: Remove the unchecked cast, type `setup` directly**

In `packages/engine/src/games/pisti/rules.ts`, replace:

```ts
export const pistiGame: RuleEngine<PistiState, PistiMove> = {
  setup(options: unknown, rng: RNG): PistiState {
    const opts = options as PistiSetupOptions;
    const { players } = opts;
```

with:

```ts
export const pistiGame: RuleEngine<PistiState, PistiMove, PistiSetupOptions> = {
  setup(options: PistiSetupOptions, rng: RNG): PistiState {
    const { players } = options;
```

Then, later in the same function's `return` block, replace:

```ts
      teams: opts.teams ?? null,
```

with:

```ts
      teams: options.teams ?? null,
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Run Pişti's engine tests**

Run: `npx jest packages/engine/src/games/pisti --silent`
Expected: all tests still pass (no behavior change — same runtime value, just typed instead of cast).

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/pisti/rules.ts
git commit -m "Type pistiGame's setup() options via RuleEngine's new TOptions generic"
```

---

## Task 3: Wire Batak's `setup()` to the typed options

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts`

**Interfaces:**
- Consumes: `RuleEngine<TState, TMove, TOptions>` (Task 1), the existing `BatakSetupOptions` type (`packages/engine/src/games/batak/types.ts`, unchanged).
- Produces: `batakGame: RuleEngine<BatakState, BatakMove, BatakSetupOptions>`.

- [ ] **Step 1: Remove the unchecked cast, type `setup` directly**

In `packages/engine/src/games/batak/rules.ts`, replace:

```ts
export const batakGame: RuleEngine<BatakState, BatakMove> = {
  setup(options: unknown, rng: RNG): BatakState {
    const opts = options as BatakSetupOptions;
    const { players, guaranteeStrongHand } = opts;
    const { handSize, kittySize } = ruleConstants(players.length);
```

with:

```ts
export const batakGame: RuleEngine<BatakState, BatakMove, BatakSetupOptions> = {
  setup(options: BatakSetupOptions, rng: RNG): BatakState {
    const { players, guaranteeStrongHand } = options;
    const { handSize, kittySize } = ruleConstants(players.length);
```

(There are no other references to the removed `opts` local anywhere else in this function — verified directly against the current file.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Run Batak's engine tests**

Run: `npx jest packages/engine/src/games/batak --silent`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts
git commit -m "Type batakGame's setup() options via RuleEngine's new TOptions generic"
```

---

## Task 4: Extract `toBuryCardIds` and use it in all 4 duplicated call sites

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts`
- Modify: `packages/engine/src/games/batak/ai/easy.ts`
- Modify: `packages/engine/src/games/batak/ai/medium.ts`
- Modify: `packages/engine/src/games/batak/ai/hard.ts`

**Interfaces:**
- Consumes: `Card` type (already imported in `rules.ts` from `'../../core/types'`).
- Produces: `toBuryCardIds(cards: Card[]): [string, string, string, string]`, exported from `packages/engine/src/games/batak/rules.ts`. Consumed by `easy.ts`/`medium.ts`/`hard.ts`, all three of which already import from `'../rules'`.

This is a pure syntactic extraction — do not generalize the tuple length beyond exactly 4 (Batak's kitty size is fixed at 4 everywhere this cast appears; a variable-length version is out of scope and was explicitly not requested).

- [ ] **Step 1: Add the helper in `rules.ts` and use it in `kittyExchangeLegalMoves`**

In `packages/engine/src/games/batak/rules.ts`, replace:

```ts
function kittyExchangeLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (playerId !== state.bidWinner) return [];
  const hand = buriableCards(state, playerId);
  return fourCardCombinations(hand).map((combo) => ({
    type: 'bury' as const,
    cardIds: combo.map((c) => c.id) as [string, string, string, string],
  }));
}
```

with:

```ts
// The 4-card bury/tuple-cast pattern below is duplicated across this function and all 3 AI
// difficulty files (easy.ts, medium.ts, hard.ts) — centralized here since they already import
// from this module. Not generalized to a variable tuple length: Batak's kitty size is fixed at 4
// everywhere this is called.
export function toBuryCardIds(cards: Card[]): [string, string, string, string] {
  return cards.map((c) => c.id) as [string, string, string, string];
}

function kittyExchangeLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (playerId !== state.bidWinner) return [];
  const hand = buriableCards(state, playerId);
  return fourCardCombinations(hand).map((combo) => ({
    type: 'bury' as const,
    cardIds: toBuryCardIds(combo),
  }));
}
```

- [ ] **Step 2: Use it in `easy.ts`**

In `packages/engine/src/games/batak/ai/easy.ts`, replace:

```ts
import { ruleConstants, buriableCards } from '../rules';
```

with:

```ts
import { ruleConstants, buriableCards, toBuryCardIds } from '../rules';
```

Then replace:

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = chooseCardsToBury(buriableCards(state, playerId), state.trumpSuit!, kittySize).map(
        (c) => c.id
      ) as [string, string, string, string];
      return { type: 'bury', cardIds };
    }
```

with:

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = toBuryCardIds(chooseCardsToBury(buriableCards(state, playerId), state.trumpSuit!, kittySize));
      return { type: 'bury', cardIds };
    }
```

- [ ] **Step 3: Use it in `medium.ts`**

In `packages/engine/src/games/batak/ai/medium.ts`, replace:

```ts
import { trickWinnerIndex, ruleConstants, buriableCards } from '../rules';
```

with:

```ts
import { trickWinnerIndex, ruleConstants, buriableCards, toBuryCardIds } from '../rules';
```

Then replace:

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = chooseCardsToBury(buriableCards(state, playerId), state.trumpSuit!, kittySize).map(
        (c) => c.id
      ) as [string, string, string, string];
      return { type: 'bury', cardIds };
    }
```

with:

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = toBuryCardIds(chooseCardsToBury(buriableCards(state, playerId), state.trumpSuit!, kittySize));
      return { type: 'bury', cardIds };
    }
```

- [ ] **Step 4: Use it in `hard.ts`**

In `packages/engine/src/games/batak/ai/hard.ts`, replace:

```ts
import { batakGame, buriableCards, fourCardCombinations } from '../rules';
```

with:

```ts
import { batakGame, buriableCards, fourCardCombinations, toBuryCardIds } from '../rules';
```

Then replace:

```ts
      const shortlist: BatakMove[] = scoredCombos.slice(0, BURY_SHORTLIST_SIZE).map(({ combo }) => ({
        type: 'bury',
        cardIds: combo.map((c) => c.id) as [string, string, string, string],
      }));
```

with:

```ts
      const shortlist: BatakMove[] = scoredCombos.slice(0, BURY_SHORTLIST_SIZE).map(({ combo }) => ({
        type: 'bury',
        cardIds: toBuryCardIds(combo),
      }));
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Run Batak's full engine test suite**

Run: `npx jest packages/engine/src/games/batak --silent`
Expected: all tests still pass, including `rules.test.ts`'s kitty-exchange legal-move tests and all 3 AI difficulty test files' kitty-exchange bury tests — none of these should need edits, since `toBuryCardIds`'s output is byte-identical to the inline cast it replaces.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/ai/easy.ts packages/engine/src/games/batak/ai/medium.ts packages/engine/src/games/batak/ai/hard.ts
git commit -m "Extract toBuryCardIds, deduplicating the 4-card tuple cast across rules.ts and all 3 AI difficulties"
```

---

## Task 5: Wire the `cardDraftGame` test fixture to the typed options

**Files:**
- Modify: `packages/engine/src/rules/__fixtures__/cardDraftGame.ts`

**Interfaces:**
- Consumes: `RuleEngine<TState, TMove, TOptions>` (Task 1), the existing `CardDraftSetupOptions` type (defined in this same file).
- Produces: `cardDraftGame: RuleEngine<CardDraftState, CardDraftMove, CardDraftSetupOptions>`.

This fixture exists specifically to prove the shared engine contracts work end-to-end (see CLAUDE.md: "Validated end-to-end against an internal test-only fixture game") — keeping it demonstrating the same `TOptions` pattern as the two real games matters for that purpose, not just consistency.

- [ ] **Step 1: Remove the unchecked cast, type `setup` directly**

In `packages/engine/src/rules/__fixtures__/cardDraftGame.ts`, replace:

```ts
export const cardDraftGame: RuleEngine<CardDraftState, CardDraftMove> = {
  setup(options: unknown, rng: RNG): CardDraftState {
    const opts = options as CardDraftSetupOptions;
    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const zoneIds = ['row', ...opts.players.map((p) => `hand-${p}`)];
    const emptyTable = createTable(zoneIds.map((id) => createZone(id, true)));
    const { table } = dealToZones(deck, emptyTable, [{ zoneId: 'row', count: opts.rowSize }]);
    return {
      gameId: 'card-draft-fixture',
      players: opts.players,
```

with:

```ts
export const cardDraftGame: RuleEngine<CardDraftState, CardDraftMove, CardDraftSetupOptions> = {
  setup(options: CardDraftSetupOptions, rng: RNG): CardDraftState {
    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const zoneIds = ['row', ...options.players.map((p) => `hand-${p}`)];
    const emptyTable = createTable(zoneIds.map((id) => createZone(id, true)));
    const { table } = dealToZones(deck, emptyTable, [{ zoneId: 'row', count: options.rowSize }]);
    return {
      gameId: 'card-draft-fixture',
      players: options.players,
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Run the fixture's tests**

Run: `npx jest packages/engine/src/rules/__fixtures__ --silent`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/rules/__fixtures__/cardDraftGame.ts
git commit -m "Type cardDraftGame's setup() options via RuleEngine's new TOptions generic"
```

---

## Task 6: Thread `TOptions` through `simulateGames`

**Files:**
- Modify: `packages/engine/src/testing/simulate.ts`

**Interfaces:**
- Consumes: `RuleEngine<TState, TMove, TOptions>` (Task 1). Relies on `pistiGame`/`batakGame` already being typed `RuleEngine<..., ..., PistiSetupOptions | BatakSetupOptions>` (Tasks 2-3) so real callers get inference, not just a type-check pass-through.
- Produces: `SimulateGamesOptions<TState extends GameState, TMove, TOptions = unknown>` with `setupOptions: TOptions`.

- [ ] **Step 1: Add the generic to `SimulateGamesOptions` and `simulateGames`**

In `packages/engine/src/testing/simulate.ts`, replace:

```ts
export interface SimulateGamesOptions<TState extends GameState, TMove> {
  ruleEngine: RuleEngine<TState, TMove>;
  setupOptions: unknown;
  aiStrategies: Record<PlayerId, AIStrategy<TState, TMove>>;
  count: number;
  seedStart: number;
  maxMoves?: number;
}
```

with:

```ts
export interface SimulateGamesOptions<TState extends GameState, TMove, TOptions = unknown> {
  ruleEngine: RuleEngine<TState, TMove, TOptions>;
  setupOptions: TOptions;
  aiStrategies: Record<PlayerId, AIStrategy<TState, TMove>>;
  count: number;
  seedStart: number;
  maxMoves?: number;
}
```

Then replace:

```ts
export function simulateGames<TState extends GameState, TMove>(
  options: SimulateGamesOptions<TState, TMove>
): SimulateGamesResult<TState> {
```

with:

```ts
export function simulateGames<TState extends GameState, TMove, TOptions = unknown>(
  options: SimulateGamesOptions<TState, TMove, TOptions>
): SimulateGamesResult<TState> {
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json`
Expected: no errors. Every `simulateGames({ ruleEngine: pistiGame, setupOptions, ... })` / `simulateGames({ ruleEngine: batakGame, setupOptions, ... })` call site in `packages/engine/src/games/pisti/simulate.test.ts` and `packages/engine/src/games/batak/simulate.test.ts` already passes a pre-typed `const setupOptions: PistiSetupOptions = {...}` / `const setupOptions: BatakSetupOptions = {...}` local, which now type-checks against the inferred `TOptions` (from the `ruleEngine` property) instead of the old unchecked `unknown` — no test file edits needed.

- [ ] **Step 3: Run both games' simulation benchmarks**

Run: `npx jest packages/engine/src/games/pisti/simulate.test.ts packages/engine/src/games/batak/simulate.test.ts --silent`
Expected: all tests still pass (these are slower, ~10s each — this is intentionally the one place in this plan that re-runs them, since Task 6 is the only task that touches code they exercise through type inference alone).

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/testing/simulate.ts
git commit -m "Thread TOptions through simulateGames' setupOptions"
```

---

## Task 7: Full engine regression pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full engine typecheck**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json`
Expected: no errors.

- [ ] **Step 2: Full engine test suite**

Run: `npx jest packages/engine --silent`
Expected: every suite passes, same total suite/test count as on `master` before this branch (no test files were added or removed by Tasks 1-6, only production code was retyped/refactored).

---

## Task 8: Create the shared hand-area layout constants module

**Files:**
- Create: `packages/ui/src/handAreaLayout.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: 4 exported constants — `CONTAINER_BOTTOM_PADDING`, `HAND_BADGE_HEIGHT`, `HAND_FRAME_REVEAL_MARGIN`, `HAND_FRAME_BOTTOM_OVERSHOOT` (all `number`). Tasks 9-10 consume these.

This module holds only the 4 magic numbers that are byte-identical between Pişti's and Batak's table files today. It deliberately does NOT include each file's own layout *formula* (`HAND_CONTENT_HEIGHT`, `HAND_AREA_TOP_INSET`, the peak-distance calculation) — those differ per game (different `HAND_AREA_HEIGHT`, Batak has an extra `HAND_AREA_CONTENT_GAP` term) and must stay independently written in each table file, matching this codebase's established per-game-table-independence precedent. It also does NOT include `HUMAN_CARD_HEIGHT` (`= CARD_DIMS.normal.height`) — that's a one-line alias of the already-shared `CARD_DIMS`, not real duplication.

- [ ] **Step 1: Create the new file**

Create `packages/ui/src/handAreaLayout.ts`:

```ts
// Layout constants shared by every game's human-hand-area positioning math (currently Pişti's
// PistiTable.tsx and Batak's BatakTable.tsx). Each file's own formula for its content height,
// top inset, and hand-row peak distance stays independently written per game — they genuinely
// differ (different HAND_AREA_HEIGHT, Batak has an extra content-gap term) — only the raw
// magic-number inputs that happened to be identical across both files are centralized here.

// Matches each table's own styles.container.paddingVertical.
export const CONTAINER_BOTTOM_PADDING = 12;
// Approx rendered height of PlayerBadge at normal size.
export const HAND_BADGE_HEIGHT = 34;
// Peak-aligning HandFrame exactly to the hand row's own top edge hides its gold trim behind the
// cards (they render in front, same height) — this extra margin lifts the frame's peak above the
// row instead, so the trim clears the cards and stays visible.
export const HAND_FRAME_REVEAL_MARGIN = 14;
// HandFrame's bottom edge sits this far below the screen's true bottom edge (rather than landing
// exactly flush) so it's guaranteed to fully cover the bottom regardless of small per-device
// rounding/safe-area differences — the overshoot itself is never visible, it's off-screen.
export const HAND_FRAME_BOTTOM_OVERSHOOT = 16;
```

- [ ] **Step 2: Export from the package's public entry point**

In `packages/ui/src/index.ts`, append after the existing `woodPalette` export block (after the closing `} from './woodPalette';` line):

```ts
export {
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from './handAreaLayout';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/handAreaLayout.ts packages/ui/src/index.ts
git commit -m "Add shared handAreaLayout module for the 4 hand-area constants duplicated across games"
```

---

## Task 9: Consume the shared constants in `PistiTable.tsx`

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`

**Interfaces:**
- Consumes: `CONTAINER_BOTTOM_PADDING`, `HAND_BADGE_HEIGHT`, `HAND_FRAME_REVEAL_MARGIN`, `HAND_FRAME_BOTTOM_OVERSHOOT` from `@world-cards/ui` (Task 8).
- Produces: nothing new for later tasks.

The names are unchanged (only their declaration moves), so every downstream formula line in this file that already references these names (`HAND_CONTENT_HEIGHT`, `HAND_AREA_TOP_INSET`, `HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM`, the `handFramePeakTarget`/`handFrameBottomOffset`/`handFrameHeight` computation further down in the component) needs no edits at all.

- [ ] **Step 1: Add the 4 names to the existing `@world-cards/ui` import**

In `apps/mobile/src/games/pisti/PistiTable.tsx`, replace:

```ts
import { PlayingCard, TableFelt, HandFrame, HAND_FRAME_PEAK_FRACTION, CARD_DIMS } from '@world-cards/ui';
```

with:

```ts
import {
  PlayingCard,
  TableFelt,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from '@world-cards/ui';
```

- [ ] **Step 2: Remove the 4 now-duplicated local declarations**

In the same file, replace:

```ts
const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;
const CONTAINER_BOTTOM_PADDING = 12; // matches styles.container.paddingVertical
const HAND_AREA_HEIGHT = 177; // matches styles.handArea.minHeight
const HAND_BADGE_HEIGHT = 34; // approx rendered height of PlayerBadge at normal size
const HAND_CONTENT_HEIGHT = HAND_BADGE_HEIGHT + HUMAN_CARD_HEIGHT;
const HAND_AREA_TOP_INSET = (HAND_AREA_HEIGHT - HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit,
// since absolute positioning ignores the container's own paddingVertical) up to the hand row's
// top edge.
const HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING + HAND_AREA_HEIGHT - HAND_AREA_TOP_INSET - HAND_BADGE_HEIGHT;
// Peak-aligning the frame exactly to the hand row's own top edge hides the frame's gold trim
// behind the cards (they render in front, same height). This extra margin lifts the frame's peak
// above the row instead, so the trim clears the cards and stays visible.
const HAND_FRAME_REVEAL_MARGIN = 14;
// The frame's bottom edge sits this far below the screen's true bottom edge (rather than landing
// exactly flush) so it's guaranteed to fully cover the bottom regardless of small per-device
// rounding/safe-area differences — the overshoot itself is never visible, it's off-screen.
const HAND_FRAME_BOTTOM_OVERSHOOT = 16;
```

with:

```ts
const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;
const HAND_AREA_HEIGHT = 177; // matches styles.handArea.minHeight
const HAND_CONTENT_HEIGHT = HAND_BADGE_HEIGHT + HUMAN_CARD_HEIGHT;
const HAND_AREA_TOP_INSET = (HAND_AREA_HEIGHT - HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit,
// since absolute positioning ignores the container's own paddingVertical) up to the hand row's
// top edge.
const HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING + HAND_AREA_HEIGHT - HAND_AREA_TOP_INSET - HAND_BADGE_HEIGHT;
```

(`CONTAINER_BOTTOM_PADDING`, `HAND_BADGE_HEIGHT`, `HAND_FRAME_REVEAL_MARGIN`, and `HAND_FRAME_BOTTOM_OVERSHOOT` are now imported instead of declared locally — their doc comments moved to `handAreaLayout.ts` in Task 8, so they're not repeated here.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Run Pişti's mobile test suite**

Run: `npx jest apps/mobile/src/games/pisti --silent`
Expected: all tests still pass — this is a pure constant-relocation with identical values, no rendered-output change.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "Consume shared handAreaLayout constants in PistiTable"
```

---

## Task 10: Consume the shared constants in `BatakTable.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `CONTAINER_BOTTOM_PADDING`, `HAND_BADGE_HEIGHT`, `HAND_FRAME_REVEAL_MARGIN`, `HAND_FRAME_BOTTOM_OVERSHOOT` from `@world-cards/ui` (Task 8).
- Produces: nothing new for later tasks.

Same shape as Task 9 — names unchanged, only the declaration moves, so this file's own `HAND_AREA_CONTENT_GAP` (Batak-only, unaffected) and downstream formula lines need no edits.

- [ ] **Step 1: Add the 4 names to the existing `@world-cards/ui` import**

In `apps/mobile/src/games/batak/BatakTable.tsx`, replace:

```ts
import { TableFelt, HandFrame, HAND_FRAME_PEAK_FRACTION, CARD_DIMS } from '@world-cards/ui';
```

with:

```ts
import {
  TableFelt,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from '@world-cards/ui';
```

- [ ] **Step 2: Remove the 4 now-duplicated local declarations**

In the same file, replace:

```ts
const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;

// First-pass constants for positioning HandFrame behind the two-row hand, derived from this
// file's own layout below (not measured on a real device — tune these if the frame's arch peak
// doesn't line up with the top row's peak once visually checked).
const CONTAINER_BOTTOM_PADDING = 12; // matches styles.container.paddingVertical
const HAND_AREA_HEIGHT = 300; // matches styles.handArea.minHeight
const HAND_BADGE_HEIGHT = 34; // approx rendered height of PlayerBadge at normal size
const HAND_AREA_CONTENT_GAP = 4; // matches styles.handArea.gap
// Content centered inside handArea: badge + gap + the two-row fan (top row's full height, plus
// the bottom row's additional visible height once the overlap above is applied).
const HAND_CONTENT_HEIGHT =
  HAND_BADGE_HEIGHT + HAND_AREA_CONTENT_GAP + HUMAN_CARD_HEIGHT + (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);
const HAND_AREA_TOP_INSET = (HAND_AREA_HEIGHT - HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit,
// since absolute positioning ignores the container's own paddingVertical) up to the top row's
// peak — its center card's top edge, where curveOffsetY is 0.
const TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING + HAND_AREA_HEIGHT - HAND_AREA_TOP_INSET - HAND_BADGE_HEIGHT - HAND_AREA_CONTENT_GAP;
// Peak-aligning the frame exactly to the top row's own top edge hides the frame's gold trim
// behind the cards (they render in front, same height). This extra margin lifts the frame's
// peak above the top row instead, so the trim clears the cards and stays visible.
const HAND_FRAME_REVEAL_MARGIN = 14;
// The frame's bottom edge sits this far below the screen's true bottom edge (rather than landing
// exactly flush) so it's guaranteed to fully cover the bottom regardless of small per-device
// rounding/safe-area differences — the overshoot itself is never visible, it's off-screen.
const HAND_FRAME_BOTTOM_OVERSHOOT = 16;
```

with:

```ts
const HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;

// First-pass constants for positioning HandFrame behind the two-row hand, derived from this
// file's own layout below (not measured on a real device — tune these if the frame's arch peak
// doesn't line up with the top row's peak once visually checked).
const HAND_AREA_HEIGHT = 300; // matches styles.handArea.minHeight
const HAND_AREA_CONTENT_GAP = 4; // matches styles.handArea.gap
// Content centered inside handArea: badge + gap + the two-row fan (top row's full height, plus
// the bottom row's additional visible height once the overlap above is applied).
const HAND_CONTENT_HEIGHT =
  HAND_BADGE_HEIGHT + HAND_AREA_CONTENT_GAP + HUMAN_CARD_HEIGHT + (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);
const HAND_AREA_TOP_INSET = (HAND_AREA_HEIGHT - HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit,
// since absolute positioning ignores the container's own paddingVertical) up to the top row's
// peak — its center card's top edge, where curveOffsetY is 0.
const TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING + HAND_AREA_HEIGHT - HAND_AREA_TOP_INSET - HAND_BADGE_HEIGHT - HAND_AREA_CONTENT_GAP;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Run Batak's mobile test suite**

Run: `npx jest apps/mobile/src/games/batak --silent`
Expected: all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Consume shared handAreaLayout constants in BatakTable"
```

---

## Task 11: Full monorepo regression pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full workspace typecheck**

Run: `npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p packages/ui/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors in any package.

- [ ] **Step 2: Full monorepo test suite**

Run: `npm test`
Expected: every suite passes, same total suite/test count as on `master` before this branch.

- [ ] **Step 3: Report for the user**

This plan makes no visual or behavioral change anywhere, so no live verification is needed beyond the automated suite above (unlike UI-visible work, there's nothing to eyeball in Expo).

---

## Self-Review Notes

- **Coverage:** Target A (RuleEngine typing) is Tasks 1-3, 5-6 (cardDraftGame and simulate.ts included for full "across the options-passing chain" coverage per the original CLAUDE.md note's own wording). Target C (bury-cardIds dedup) is Task 4. Target B (shared hand-area constants) is Tasks 8-10. The originally-identified wood-palette duplication (Target B's third item) is *not* a task here — verified during investigation that it was already resolved in an earlier session (commit `7da14b5`, `packages/ui/src/woodPalette.ts`).
- **Placeholder scan:** no TBD/TODO markers; every step shows complete, real code, copied from the actual current file contents (verified against `master`, not assumed).
- **Type consistency:** `TOptions` is spelled identically across `RuleEngine`, `GameDescriptor`, and `SimulateGamesOptions`/`simulateGames`. `toBuryCardIds(cards: Card[]): [string, string, string, string]` is called with matching argument shape at all 4 sites (Task 4). The 4 shared constant names (`CONTAINER_BOTTOM_PADDING`, `HAND_BADGE_HEIGHT`, `HAND_FRAME_REVEAL_MARGIN`, `HAND_FRAME_BOTTOM_OVERSHOOT`) are identical between Task 8's export and Tasks 9-10's imports.
