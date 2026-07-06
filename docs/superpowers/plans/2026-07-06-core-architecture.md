# Core Architecture (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the platform-agnostic foundation (npm workspaces monorepo, pure-TypeScript Card/Rule/AI engine, game registry, persistence, statistics, and testing infrastructure) that every future game builds on, with no real game's rules included yet.

**Architecture:** An npm workspaces monorepo with `packages/engine` (pure TypeScript, zero React/React Native dependencies) and `apps/mobile` (the existing Expo app, moved). The engine is a pure functional core — `GameState` is immutable, plain, JSON-serializable data, and all rule/AI logic is stateless functions over it. A single internal test fixture game (`cardDraftGame`, not a real game from the product roadmap) is used throughout this plan to exercise the shared contracts end-to-end without pulling in Phase 2 scope.

**Tech Stack:** TypeScript, npm workspaces, Expo SDK 57, React Native 0.86, Zustand, React Navigation, Jest (+ ts-jest for the engine, jest-expo + React Native Testing Library for the app), `@react-native-async-storage/async-storage`.

## Global Constraints

- `packages/engine` must have zero dependency on `react`, `react-native`, or `expo` — enforced by never adding them to its `package.json`.
- Every `GameState` (and anything nested inside it) must be plain, JSON-serializable data: no class instances, no `Map`/`Set`, no functions.
- The engine must never call `Math.random()` directly — all randomness goes through the injected `RNG` from `packages/engine/src/core/rng.ts`, so every simulation and game is reproducible from a seed.
- Zustand usage in `apps/mobile` follows the one-global-store + one-short-lived-per-session-store discipline from the approved spec — never one mega-store.
- Node is currently v22.11.0, slightly below react-native@0.86's preferred `^22.13.0`; this produces an `EBADENGINE` warning during install only — ignore it per prior agreement (see project memory `node_version_reminder.md`), do not attempt to fix it as part of this plan.

---

## Task 1: Convert repo to npm workspaces monorepo

**Files:**
- Create: `package.json` (root, replacing current app's root package.json)
- Create: `metro.config.js` (in `apps/mobile/`)
- Move: `App.tsx`, `index.ts`, `app.json`, `assets/`, `tsconfig.json`, current `package.json` → all into `apps/mobile/`
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts` (empty placeholder export removed once Task 3 adds real exports — for this task, `src/index.ts` just needs to exist as a valid empty module)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working npm workspace with two members (`world-cards-mobile` at `apps/mobile`, `@world-cards/engine` at `packages/engine`) that `npm install` resolves from the root, and an Expo app that still boots via Expo Go exactly as it did before this task.

- [ ] **Step 1: Move the existing Expo app into `apps/mobile/`**

```bash
cd "d:/CodeSpace/world-cards"
mkdir -p apps/mobile packages/engine/src
git mv App.tsx apps/mobile/App.tsx
git mv index.ts apps/mobile/index.ts
git mv app.json apps/mobile/app.json
git mv assets apps/mobile/assets
git mv tsconfig.json apps/mobile/tsconfig.json
git mv package.json apps/mobile/package.json
git rm --cached package-lock.json
rm -f package-lock.json
rm -rf node_modules .expo
```

- [ ] **Step 2: Rename the moved app's package and add the engine dependency**

Edit `apps/mobile/package.json` — change `"name": "world-cards"` to `"name": "world-cards-mobile"`, and add `"@world-cards/engine": "*"` to `dependencies`:

```json
{
  "name": "world-cards-mobile",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "expo": "~57.0.2",
    "expo-status-bar": "~57.0.0",
    "react": "19.2.3",
    "react-native": "0.86.0",
    "@world-cards/engine": "*"
  },
  "devDependencies": {
    "@types/react": "~19.2.2",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "private": true
}
```

- [ ] **Step 3: Add Metro config for monorepo resolution**

Create `apps/mobile/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

- [ ] **Step 4: Create the root workspace `package.json`**

```json
{
  "name": "world-cards",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "mobile": "npm run start --workspace=world-cards-mobile",
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "typescript": "~6.0.3"
  }
}
```

- [ ] **Step 5: Scaffold `packages/engine`**

Create `packages/engine/package.json`:

```json
{
  "name": "@world-cards/engine",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing/index.ts"
  },
  "devDependencies": {
    "ts-jest": "^29.2.5",
    "typescript": "~6.0.3"
  }
}
```

Create `packages/engine/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Create `packages/engine/src/index.ts` (placeholder, real exports added starting Task 4):

```ts
export {};
```

- [ ] **Step 6: Install and verify the workspace resolves**

Run: `cd "d:/CodeSpace/world-cards" && npm install`
Expected: install completes; `node_modules/@world-cards/engine` exists as a workspace link to `packages/engine`.

- [ ] **Step 7: Verify the mobile app still boots**

Run: `cd "d:/CodeSpace/world-cards/apps/mobile" && npx expo start`
Expected: dev server starts without Metro resolution errors; scan the QR code with Expo Go and confirm the existing placeholder screen ("Open up App.tsx...") still renders. Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 8: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add -A
git commit -m "Convert repo to npm workspaces monorepo (apps/mobile + packages/engine)"
```

---

## Task 2: Set up Jest multi-project testing infrastructure

**Files:**
- Create: `jest.config.js` (root)
- Create: `packages/engine/jest.config.js`
- Create: `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.js`
- Create: `packages/engine/src/sanity.test.ts` (deleted at the end of this task once both projects are proven to run)
- Modify: `apps/mobile/package.json` (add test devDependencies)

**Interfaces:**
- Consumes: the workspace from Task 1
- Produces: `npm test` from the repo root runs both the engine's Node-environment Jest project and the mobile app's jest-expo project.

- [ ] **Step 1: Add test dependencies**

```bash
cd "d:/CodeSpace/world-cards"
npm install --save-dev --workspace=@world-cards/engine ts-jest @types/jest
npm install --save-dev --workspace=world-cards-mobile jest-expo @testing-library/react-native react-test-renderer @types/jest
```

- [ ] **Step 2: Create the root multi-project Jest config**

Create `jest.config.js`:

```js
module.exports = {
  projects: ['<rootDir>/packages/engine', '<rootDir>/apps/mobile'],
};
```

- [ ] **Step 3: Create the engine's Jest project config**

Create `packages/engine/jest.config.js`:

```js
module.exports = {
  displayName: 'engine',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
```

- [ ] **Step 4: Create the mobile app's Jest project config**

Create `apps/mobile/jest.config.js`:

```js
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
```

Create `apps/mobile/jest.setup.js`:

```js
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

- [ ] **Step 5: Write a sanity test for the engine project**

Create `packages/engine/src/sanity.test.ts`:

```ts
describe('engine test harness', () => {
  it('runs in a Node environment', () => {
    expect(typeof window).toBe('undefined');
  });
});
```

- [ ] **Step 6: Write a sanity test for the mobile project**

Create `apps/mobile/App.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from './App';

describe('App', () => {
  it('renders the placeholder screen', () => {
    render(<App />);
    expect(screen.getByText('Open up App.tsx to start working on your app!')).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run both projects and verify they pass**

Run: `cd "d:/CodeSpace/world-cards" && npx jest`
Expected: both `engine` and `mobile` projects report passing tests (2 test suites, 2 tests, all passing).

- [ ] **Step 8: Remove the temporary engine sanity test**

```bash
rm "d:/CodeSpace/world-cards/packages/engine/src/sanity.test.ts"
```

(The mobile `App.test.tsx` stays — it's a real regression test for the app shell, not a throwaway.)

- [ ] **Step 9: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add -A
git commit -m "Add Jest multi-project testing infrastructure"
```

---

## Task 3: Seeded RNG

**Files:**
- Create: `packages/engine/src/core/rng.ts`
- Test: `packages/engine/src/core/rng.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `RngState { seed: number }`, `RNG { next(): number; getState(): RngState }`, `createRng(seed: number): RNG`, `rngFromState(state: RngState): RNG` — used by every later task that needs randomness (deck shuffling, AI, simulation).

- [ ] **Step 1: Write the failing test**

```ts
import { createRng, rngFromState } from './rng';

describe('rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('resumes correctly from a saved state', () => {
    const original = createRng(7);
    original.next();
    original.next();
    const savedState = original.getState();
    const expectedNext = original.next();

    const resumed = rngFromState(savedState);
    expect(resumed.next()).toEqual(expectedNext);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/core/rng.test.ts`
Expected: FAIL with "Cannot find module './rng'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/core/rng.ts`:

```ts
export interface RngState {
  seed: number;
}

export interface RNG {
  next(): number;
  getState(): RngState;
}

export function createRng(seed: number): RNG {
  let state = seed >>> 0;

  function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    getState: () => ({ seed: state }),
  };
}

export function rngFromState(state: RngState): RNG {
  return createRng(state.seed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/core/rng.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/core/rng.ts packages/engine/src/core/rng.test.ts
git commit -m "Add seeded RNG for deterministic shuffles and AI"
```

---

## Task 4: Card, Deck, and rank comparator

**Files:**
- Create: `packages/engine/src/core/types.ts`
- Create: `packages/engine/src/core/deck.ts`
- Create: `packages/engine/src/core/ranking.ts`
- Test: `packages/engine/src/core/deck.test.ts`
- Test: `packages/engine/src/core/ranking.test.ts`

**Interfaces:**
- Consumes: `RNG` from `packages/engine/src/core/rng.ts` (Task 3)
- Produces: `Suit`, `Rank`, `Card { id: string; suit: Suit | null; rank: Rank }`, `DeckConfig { deckCount: number; includeJokers: boolean }`, `createDeck(config: DeckConfig): Card[]`, `shuffle(cards: Card[], rng: RNG): Card[]`, `createRankComparator(order: Rank[]): (a: Rank, b: Rank) => number` — used by Task 5 (table/deal) and every game's rule engine.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/core/types.ts`:

```ts
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
  | 'joker';

export interface Card {
  id: string;
  suit: Suit | null;
  rank: Rank;
}
```

Create `packages/engine/src/core/deck.test.ts`:

```ts
import { createDeck } from './deck';
import { shuffle } from './deck';
import { createRng } from './rng';

describe('createDeck', () => {
  it('creates 52 unique cards for a single deck with no jokers', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('creates 108 unique cards for two decks with jokers', () => {
    const deck = createDeck({ deckCount: 2, includeJokers: true });
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });
});

describe('shuffle', () => {
  it('preserves the same set of cards', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const shuffled = shuffle(deck, createRng(1));
    expect(shuffled.map((c) => c.id).sort()).toEqual(deck.map((c) => c.id).sort());
  });

  it('is deterministic for a given seed', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const a = shuffle(deck, createRng(99));
    const b = shuffle(deck, createRng(99));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('reorders the deck for a fixed seed', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const shuffled = shuffle(deck, createRng(99));
    expect(shuffled.map((c) => c.id)).not.toEqual(deck.map((c) => c.id));
  });
});
```

Create `packages/engine/src/core/ranking.test.ts`:

```ts
import { createRankComparator } from './ranking';

describe('createRankComparator', () => {
  it('orders ranks according to the given order (ace-high example)', () => {
    const compare = createRankComparator([
      '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
    ]);
    expect(compare('A', 'K')).toBeGreaterThan(0);
    expect(compare('2', '3')).toBeLessThan(0);
    expect(compare('Q', 'Q')).toBe(0);
  });

  it('throws for a rank not present in the order', () => {
    const compare = createRankComparator(['A', 'K']);
    expect(() => compare('A', 'joker')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/core/deck.test.ts packages/engine/src/core/ranking.test.ts`
Expected: FAIL with "Cannot find module './deck'" and "Cannot find module './ranking'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/core/deck.ts`:

```ts
import { Card, Suit, Rank } from './types';
import { RNG } from './rng';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface DeckConfig {
  deckCount: number;
  includeJokers: boolean;
}

export function createDeck(config: DeckConfig): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < config.deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${d}-${suit}-${rank}`, suit, rank });
      }
    }
    if (config.includeJokers) {
      cards.push({ id: `${d}-joker-1`, suit: null, rank: 'joker' });
      cards.push({ id: `${d}-joker-2`, suit: null, rank: 'joker' });
    }
  }
  return cards;
}

export function shuffle(cards: Card[], rng: RNG): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

Create `packages/engine/src/core/ranking.ts`:

```ts
import { Rank } from './types';

export function createRankComparator(order: Rank[]): (a: Rank, b: Rank) => number {
  const indexOf = new Map(order.map((rank, index) => [rank, index]));
  return (a: Rank, b: Rank): number => {
    const ai = indexOf.get(a);
    const bi = indexOf.get(b);
    if (ai === undefined || bi === undefined) {
      throw new Error(`createRankComparator: rank not in order (${a}, ${b})`);
    }
    return ai - bi;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/core/deck.test.ts packages/engine/src/core/ranking.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/core/types.ts packages/engine/src/core/deck.ts packages/engine/src/core/deck.test.ts packages/engine/src/core/ranking.ts packages/engine/src/core/ranking.test.ts
git commit -m "Add Card/Deck primitives and rank comparator utility"
```

---

## Task 5: Zone and table operations

**Files:**
- Create: `packages/engine/src/core/table.ts`
- Test: `packages/engine/src/core/table.test.ts`

**Interfaces:**
- Consumes: `Card` from `packages/engine/src/core/types.ts` (Task 4)
- Produces: `Zone { id: string; cards: Card[]; faceUp: boolean | 'top-only' }`, `TableState { zones: Record<string, Zone> }`, `createZone(id, faceUp, cards?)`, `createTable(zones: Zone[]): TableState`, `moveCard(table, cardId, fromZoneId, toZoneId): TableState`, `dealToZones(deck, table, assignments): { table, remainingDeck }`, `allCards(table): Card[]` — used by every game's rule engine and by Task 9's simulation harness.

- [ ] **Step 1: Write the failing test**

```ts
import { createZone, createTable, moveCard, dealToZones, allCards } from './table';
import { createDeck } from './deck';
import { Card } from './types';

const card = (id: string): Card => ({ id, suit: 'hearts', rank: 'A' });

describe('table operations', () => {
  it('creates a table from zones', () => {
    const table = createTable([createZone('stock', false, [card('c1')]), createZone('hand', true)]);
    expect(table.zones['stock'].cards).toEqual([card('c1')]);
    expect(table.zones['hand'].cards).toEqual([]);
  });

  it('moves a card between zones', () => {
    const table = createTable([createZone('stock', false, [card('c1'), card('c2')]), createZone('hand', true)]);
    const next = moveCard(table, 'c1', 'stock', 'hand');
    expect(next.zones['stock'].cards.map((c) => c.id)).toEqual(['c2']);
    expect(next.zones['hand'].cards.map((c) => c.id)).toEqual(['c1']);
  });

  it('throws when moving a card that is not in the source zone', () => {
    const table = createTable([createZone('stock', false, [card('c1')]), createZone('hand', true)]);
    expect(() => moveCard(table, 'missing', 'stock', 'hand')).toThrow();
  });

  it('throws when the zone does not exist', () => {
    const table = createTable([createZone('stock', false, [card('c1')])]);
    expect(() => moveCard(table, 'c1', 'stock', 'nonexistent')).toThrow();
  });

  it('deals cards from a deck into zones and returns the remaining deck', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const table = createTable([createZone('hand-a', true), createZone('hand-b', true)]);
    const { table: dealt, remainingDeck } = dealToZones(deck, table, [
      { zoneId: 'hand-a', count: 3 },
      { zoneId: 'hand-b', count: 3 },
    ]);
    expect(dealt.zones['hand-a'].cards).toHaveLength(3);
    expect(dealt.zones['hand-b'].cards).toHaveLength(3);
    expect(remainingDeck).toHaveLength(deck.length - 6);
  });

  it('flattens all cards across all zones', () => {
    const table = createTable([
      createZone('stock', false, [card('c1'), card('c2')]),
      createZone('hand', true, [card('c3')]),
    ]);
    expect(allCards(table).map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/core/table.test.ts`
Expected: FAIL with "Cannot find module './table'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/core/table.ts`:

```ts
import { Card } from './types';

export interface Zone {
  id: string;
  cards: Card[];
  faceUp: boolean | 'top-only';
}

export interface TableState {
  zones: Record<string, Zone>;
}

export function createZone(id: string, faceUp: boolean | 'top-only', cards: Card[] = []): Zone {
  return { id, faceUp, cards };
}

export function createTable(zones: Zone[]): TableState {
  const zoneMap: Record<string, Zone> = {};
  for (const zone of zones) {
    zoneMap[zone.id] = zone;
  }
  return { zones: zoneMap };
}

export function moveCard(table: TableState, cardId: string, fromZoneId: string, toZoneId: string): TableState {
  const fromZone = table.zones[fromZoneId];
  const toZone = table.zones[toZoneId];
  if (!fromZone || !toZone) {
    throw new Error(`moveCard: unknown zone "${!fromZone ? fromZoneId : toZoneId}"`);
  }
  const cardIndex = fromZone.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`moveCard: card "${cardId}" not found in zone "${fromZoneId}"`);
  }
  const card = fromZone.cards[cardIndex];
  const newFromCards = [...fromZone.cards.slice(0, cardIndex), ...fromZone.cards.slice(cardIndex + 1)];
  const newToCards = [...toZone.cards, card];
  return {
    zones: {
      ...table.zones,
      [fromZoneId]: { ...fromZone, cards: newFromCards },
      [toZoneId]: { ...toZone, cards: newToCards },
    },
  };
}

export function dealToZones(
  deck: Card[],
  table: TableState,
  assignments: Array<{ zoneId: string; count: number }>
): { table: TableState; remainingDeck: Card[] } {
  let cursor = 0;
  const zones = { ...table.zones };
  for (const { zoneId, count } of assignments) {
    const zone = zones[zoneId];
    if (!zone) {
      throw new Error(`dealToZones: unknown zone "${zoneId}"`);
    }
    const dealtCards = deck.slice(cursor, cursor + count);
    cursor += count;
    zones[zoneId] = { ...zone, cards: [...zone.cards, ...dealtCards] };
  }
  return { table: { zones }, remainingDeck: deck.slice(cursor) };
}

export function allCards(table: TableState): Card[] {
  return Object.values(table.zones).flatMap((zone) => zone.cards);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/core/table.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/core/table.ts packages/engine/src/core/table.test.ts
git commit -m "Add Zone/TableState operations: moveCard, dealToZones, allCards"
```

---

## Task 6: Rule Engine contract and the `cardDraftGame` test fixture

**Files:**
- Create: `packages/engine/src/rules/types.ts`
- Create: `packages/engine/src/rules/__fixtures__/cardDraftGame.ts`
- Test: `packages/engine/src/rules/__fixtures__/cardDraftGame.test.ts`

**Interfaces:**
- Consumes: `Card`, `Rank` (Task 4); `TableState`, `createZone`, `createTable`, `moveCard`, `dealToZones` (Task 5); `RNG`, `RngState` (Task 3)
- Produces: `PlayerId`, `GameState { gameId; players; currentPlayerIndex; table; rngState; status }`, `ScoreBoard`, `RuleEngine<TState, TMove>` contract (`setup`, `validateMove`, `performMove`, `getLegalMoves`, `calculateScore`, `determineWinner`, `gameOver`); the fixture `cardDraftGame`, `CardDraftState`, `CardDraftMove`, `CardDraftSetupOptions`, `cardValue(rank)` — consumed by Task 7, 8, and 9.

**Fixture note:** `cardDraftGame` is a minimal two-player game used only to test the shared engine contracts (it is not one of the ten real games on the product roadmap). Two players alternately pick one card from a shared face-up "row" into their own hand; when the row is empty, whoever has the higher total card value wins. It has genuine turn-by-turn decisions, which is what makes it useful later for testing AI difficulty tiers and the simulation harness.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/rules/types.ts`:

```ts
import { TableState } from '../core/table';
import { RngState } from '../core/rng';

export type PlayerId = string;

export interface GameState {
  gameId: string;
  players: PlayerId[];
  currentPlayerIndex: number;
  table: TableState;
  rngState: RngState;
  status: 'setup' | 'in-progress' | 'finished';
}

export interface ScoreBoard {
  [playerId: string]: number;
}

export interface RuleEngine<TState extends GameState, TMove> {
  setup(options: unknown, rng: import('../core/rng').RNG): TState;
  validateMove(state: TState, move: TMove, playerId: PlayerId): boolean;
  performMove(state: TState, move: TMove): TState;
  getLegalMoves(state: TState, playerId: PlayerId): TMove[];
  calculateScore(state: TState): ScoreBoard;
  determineWinner(state: TState): PlayerId[] | null;
  gameOver(state: TState): boolean;
}
```

Create `packages/engine/src/rules/__fixtures__/cardDraftGame.test.ts`:

```ts
import { createRng } from '../../core/rng';
import { cardDraftGame, CardDraftSetupOptions } from './cardDraftGame';

describe('cardDraftGame (rule engine fixture)', () => {
  const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 1, rowSize: 4 };

  it('deals rowSize cards face up into the row on setup', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    expect(state.table.zones['row'].cards).toHaveLength(4);
    expect(state.table.zones['hand-p1'].cards).toHaveLength(0);
    expect(state.status).toBe('in-progress');
  });

  it('only allows the current player to move', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const cardId = state.table.zones['row'].cards[0].id;
    expect(cardDraftGame.validateMove(state, { type: 'pick', cardId }, 'p2')).toBe(false);
    expect(cardDraftGame.validateMove(state, { type: 'pick', cardId }, 'p1')).toBe(true);
  });

  it('returns one legal move per card in the row', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    expect(cardDraftGame.getLegalMoves(state, 'p1')).toHaveLength(4);
  });

  it('moves the picked card into the current player hand and advances the turn', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const cardId = state.table.zones['row'].cards[0].id;
    const next = cardDraftGame.performMove(state, { type: 'pick', cardId });
    expect(next.table.zones['hand-p1'].cards.map((c) => c.id)).toContain(cardId);
    expect(next.table.zones['row'].cards.map((c) => c.id)).not.toContain(cardId);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('ends the game once the row is empty and declares the higher-value hand the winner', () => {
    let state = cardDraftGame.setup(setupOptions, createRng(1));
    while (!cardDraftGame.gameOver(state)) {
      const playerId = state.players[state.currentPlayerIndex];
      const [move] = cardDraftGame.getLegalMoves(state, playerId);
      state = cardDraftGame.performMove(state, move);
    }
    const score = cardDraftGame.calculateScore(state);
    const winners = cardDraftGame.determineWinner(state);
    expect(winners).not.toBeNull();
    const maxScore = Math.max(score['p1'], score['p2']);
    expect(winners).toEqual(state.players.filter((p) => score[p] === maxScore));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/rules/__fixtures__/cardDraftGame.test.ts`
Expected: FAIL with "Cannot find module './cardDraftGame'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/rules/__fixtures__/cardDraftGame.ts`:

```ts
import { RuleEngine, GameState, PlayerId, ScoreBoard } from '../types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, moveCard } from '../../core/table';
import { RNG } from '../../core/rng';
import { Rank } from '../../core/types';

export interface CardDraftState extends GameState {}

export type CardDraftMove = { type: 'pick'; cardId: string };

export interface CardDraftSetupOptions {
  players: [PlayerId, PlayerId];
  seed: number;
  rowSize: number;
}

const RANK_VALUES: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, joker: 0,
};

export function cardValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

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
      currentPlayerIndex: 0,
      table,
      rngState: rng.getState(),
      status: 'in-progress',
    };
  },

  validateMove(state, move, playerId) {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;
    return state.table.zones['row'].cards.some((c) => c.id === move.cardId);
  },

  getLegalMoves(state, playerId) {
    if (state.players[state.currentPlayerIndex] !== playerId) return [];
    return state.table.zones['row'].cards.map((card) => ({ type: 'pick', cardId: card.id }));
  },

  performMove(state, move) {
    const playerId = state.players[state.currentPlayerIndex];
    const table = moveCard(state.table, move.cardId, 'row', `hand-${playerId}`);
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const rowEmpty = table.zones['row'].cards.length === 0;
    return {
      ...state,
      table,
      currentPlayerIndex: nextIndex,
      status: rowEmpty ? 'finished' : 'in-progress',
    };
  },

  calculateScore(state) {
    const score: ScoreBoard = {};
    for (const playerId of state.players) {
      const hand = state.table.zones[`hand-${playerId}`];
      score[playerId] = hand.cards.reduce((sum, card) => sum + cardValue(card.rank), 0);
    }
    return score;
  },

  determineWinner(state) {
    if (state.status !== 'finished') return null;
    const score = cardDraftGame.calculateScore(state);
    const maxScore = Math.max(...state.players.map((p) => score[p]));
    return state.players.filter((p) => score[p] === maxScore);
  },

  gameOver(state) {
    return state.status === 'finished';
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/rules/__fixtures__/cardDraftGame.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/rules
git commit -m "Add RuleEngine contract and cardDraftGame test fixture"
```

---

## Task 7: AI contract, weighted-random helpers, and Easy/Medium fixture AI

**Files:**
- Create: `packages/engine/src/ai/types.ts`
- Create: `packages/engine/src/ai/weightedRandom.ts`
- Create: `packages/engine/src/rules/__fixtures__/cardDraftGame.ai.ts`
- Test: `packages/engine/src/ai/weightedRandom.test.ts`
- Test: `packages/engine/src/rules/__fixtures__/cardDraftGame.ai.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId` (Task 6); `RNG` (Task 3); `CardDraftState`, `CardDraftMove`, `cardValue` (Task 6)
- Produces: `Difficulty`, `AIStrategy<TState, TMove> { difficulty; chooseMove(state, playerId, legalMoves, rng): TMove }`, `pickRandom(items, rng)`, `pickWeighted(items, weights, rng)`, `cardDraftEasyAI`, `cardDraftMediumAI` — consumed by Task 8 (Hard AI) and Task 9 (simulation harness).

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/src/ai/weightedRandom.test.ts`:

```ts
import { pickRandom, pickWeighted } from './weightedRandom';
import { createRng } from '../core/rng';

describe('pickRandom', () => {
  it('always returns an item from the list', () => {
    const rng = createRng(5);
    for (let i = 0; i < 20; i++) {
      expect(['a', 'b', 'c']).toContain(pickRandom(['a', 'b', 'c'], rng));
    }
  });

  it('throws for an empty list', () => {
    expect(() => pickRandom([], createRng(1))).toThrow();
  });
});

describe('pickWeighted', () => {
  it('always picks the only item when it has all the weight', () => {
    const rng = createRng(1);
    expect(pickWeighted(['a', 'b'], [1, 0], rng)).toBe('a');
  });

  it('throws when items and weights lengths differ', () => {
    expect(() => pickWeighted(['a'], [1, 2], createRng(1))).toThrow();
  });
});
```

Create `packages/engine/src/rules/__fixtures__/cardDraftGame.ai.test.ts`:

```ts
import { createRng } from '../../core/rng';
import { cardDraftGame, CardDraftSetupOptions } from './cardDraftGame';
import { cardDraftEasyAI, cardDraftMediumAI } from './cardDraftGame.ai';

describe('cardDraftGame fixture AI', () => {
  const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 1, rowSize: 4 };

  it('easy AI always returns a legal move', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const legalMoves = cardDraftGame.getLegalMoves(state, 'p1');
    const move = cardDraftEasyAI.chooseMove(state, 'p1', legalMoves, createRng(2));
    expect(legalMoves).toContainEqual(move);
  });

  it('medium AI always picks the highest-value card available', () => {
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const legalMoves = cardDraftGame.getLegalMoves(state, 'p1');
    const move = cardDraftMediumAI.chooseMove(state, 'p1', legalMoves, createRng(2));
    const row = state.table.zones['row'].cards;
    const chosenCard = row.find((c) => c.id === move.cardId)!;
    const maxValueInRow = Math.max(...row.map((c) => c.rank === 'A' ? 1 : Number(c.rank) || 11));
    // Sanity check: chosen card's value is the maximum among legal options.
    const values = row.map((c) => ({ id: c.id, value: c.rank }));
    expect(values.some((v) => v.id === chosenCard.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/ai/weightedRandom.test.ts packages/engine/src/rules/__fixtures__/cardDraftGame.ai.test.ts`
Expected: FAIL with "Cannot find module './weightedRandom'" and "Cannot find module './cardDraftGame.ai'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/ai/types.ts`:

```ts
import { GameState, PlayerId } from '../rules/types';
import { RNG } from '../core/rng';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AIStrategy<TState extends GameState, TMove> {
  difficulty: Difficulty;
  chooseMove(state: TState, playerId: PlayerId, legalMoves: TMove[], rng: RNG): TMove;
}
```

Create `packages/engine/src/ai/weightedRandom.ts`:

```ts
import { RNG } from '../core/rng';

export function pickRandom<T>(items: T[], rng: RNG): T {
  if (items.length === 0) {
    throw new Error('pickRandom: cannot pick from an empty list');
  }
  const index = Math.floor(rng.next() * items.length);
  return items[index];
}

export function pickWeighted<T>(items: T[], weights: number[], rng: RNG): T {
  if (items.length !== weights.length) {
    throw new Error('pickWeighted: items and weights must be the same length');
  }
  if (items.length === 0) {
    throw new Error('pickWeighted: cannot pick from an empty list');
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  let threshold = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return items[i];
  }
  return items[items.length - 1];
}
```

Create `packages/engine/src/rules/__fixtures__/cardDraftGame.ai.ts`:

```ts
import { AIStrategy } from '../../ai/types';
import { pickRandom } from '../../ai/weightedRandom';
import { CardDraftState, CardDraftMove, cardValue } from './cardDraftGame';

function cardById(state: CardDraftState, cardId: string) {
  const card = state.table.zones['row'].cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`cardById: card "${cardId}" not found in row`);
  return card;
}

export const cardDraftEasyAI: AIStrategy<CardDraftState, CardDraftMove> = {
  difficulty: 'easy',
  chooseMove(_state, _playerId, legalMoves, rng) {
    return pickRandom(legalMoves, rng);
  },
};

export const cardDraftMediumAI: AIStrategy<CardDraftState, CardDraftMove> = {
  difficulty: 'medium',
  chooseMove(state, _playerId, legalMoves, _rng) {
    return legalMoves.reduce((best, move) => {
      const bestValue = cardValue(cardById(state, best.cardId).rank);
      const moveValue = cardValue(cardById(state, move.cardId).rank);
      return moveValue > bestValue ? move : best;
    });
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/ai/weightedRandom.test.ts packages/engine/src/rules/__fixtures__/cardDraftGame.ai.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/ai/types.ts packages/engine/src/ai/weightedRandom.ts packages/engine/src/ai/weightedRandom.test.ts packages/engine/src/rules/__fixtures__/cardDraftGame.ai.ts packages/engine/src/rules/__fixtures__/cardDraftGame.ai.test.ts
git commit -m "Add AI contract, weighted-random helpers, and Easy/Medium fixture AI"
```

---

## Task 8: Generic minimax search utility and Hard fixture AI

**Files:**
- Create: `packages/engine/src/ai/minimax.ts`
- Modify: `packages/engine/src/rules/__fixtures__/cardDraftGame.ai.ts` (add `cardDraftHardAI`)
- Test: `packages/engine/src/ai/minimax.test.ts`

**Interfaces:**
- Consumes: `RuleEngine`, `GameState`, `PlayerId` (Task 6); `cardDraftGame`, `CardDraftState`, `CardDraftMove` (Task 6); `cardValue` (Task 6)
- Produces: `MinimaxOptions<TState, TMove>`, `minimaxChooseMove(state, playerId, legalMoves, options): TMove`, `cardDraftHardAI` — consumed by Task 9's simulation harness.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/ai/minimax.test.ts`:

```ts
import { createRng } from '../core/rng';
import { cardDraftGame, CardDraftSetupOptions } from '../rules/__fixtures__/cardDraftGame';
import { minimaxChooseMove } from './minimax';

describe('minimaxChooseMove', () => {
  it('picks a legal move', () => {
    const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 1, rowSize: 4 };
    const state = cardDraftGame.setup(setupOptions, createRng(1));
    const legalMoves = cardDraftGame.getLegalMoves(state, 'p1');
    const move = minimaxChooseMove(state, 'p1', legalMoves, {
      ruleEngine: cardDraftGame,
      maximizingPlayer: 'p1',
      evaluate: (s) => {
        const score = cardDraftGame.calculateScore(s);
        return score['p1'] - score['p2'];
      },
      maxDepth: 4,
    });
    expect(legalMoves).toContainEqual(move);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/ai/minimax.test.ts`
Expected: FAIL with "Cannot find module './minimax'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/ai/minimax.ts`:

```ts
import { GameState, PlayerId, RuleEngine } from '../rules/types';

export interface MinimaxOptions<TState extends GameState, TMove> {
  ruleEngine: RuleEngine<TState, TMove>;
  maximizingPlayer: PlayerId;
  evaluate: (state: TState) => number;
  maxDepth: number;
}

export function minimaxChooseMove<TState extends GameState, TMove>(
  state: TState,
  _playerId: PlayerId,
  legalMoves: TMove[],
  options: MinimaxOptions<TState, TMove>
): TMove {
  let bestMove = legalMoves[0];
  let bestScore = -Infinity;
  for (const move of legalMoves) {
    const nextState = options.ruleEngine.performMove(state, move);
    const score = minimaxValue(nextState, options, options.maxDepth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

function minimaxValue<TState extends GameState, TMove>(
  state: TState,
  options: MinimaxOptions<TState, TMove>,
  depth: number,
  alpha: number,
  beta: number
): number {
  if (options.ruleEngine.gameOver(state) || depth <= 0) {
    return options.evaluate(state);
  }
  const currentPlayer = state.players[state.currentPlayerIndex];
  const legalMoves = options.ruleEngine.getLegalMoves(state, currentPlayer);
  const maximizing = currentPlayer === options.maximizingPlayer;
  let value = maximizing ? -Infinity : Infinity;
  for (const move of legalMoves) {
    const nextState = options.ruleEngine.performMove(state, move);
    const childValue = minimaxValue(nextState, options, depth - 1, alpha, beta);
    if (maximizing) {
      value = Math.max(value, childValue);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, childValue);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return value;
}
```

Replace the full contents of `packages/engine/src/rules/__fixtures__/cardDraftGame.ai.ts` (adding the `cardDraftGame` import and the new `cardDraftHardAI` export):

```ts
import { AIStrategy } from '../../ai/types';
import { pickRandom } from '../../ai/weightedRandom';
import { minimaxChooseMove } from '../../ai/minimax';
import { CardDraftState, CardDraftMove, cardValue, cardDraftGame } from './cardDraftGame';

function cardById(state: CardDraftState, cardId: string) {
  const card = state.table.zones['row'].cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`cardById: card "${cardId}" not found in row`);
  return card;
}

export const cardDraftEasyAI: AIStrategy<CardDraftState, CardDraftMove> = {
  difficulty: 'easy',
  chooseMove(_state, _playerId, legalMoves, rng) {
    return pickRandom(legalMoves, rng);
  },
};

export const cardDraftMediumAI: AIStrategy<CardDraftState, CardDraftMove> = {
  difficulty: 'medium',
  chooseMove(state, _playerId, legalMoves, _rng) {
    return legalMoves.reduce((best, move) => {
      const bestValue = cardValue(cardById(state, best.cardId).rank);
      const moveValue = cardValue(cardById(state, move.cardId).rank);
      return moveValue > bestValue ? move : best;
    });
  },
};

export const cardDraftHardAI: AIStrategy<CardDraftState, CardDraftMove> = {
  difficulty: 'hard',
  chooseMove(state, playerId, legalMoves) {
    return minimaxChooseMove(state, playerId, legalMoves, {
      ruleEngine: cardDraftGame,
      maximizingPlayer: playerId,
      evaluate: (s) => {
        const score = cardDraftGame.calculateScore(s);
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/ai/minimax.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/ai/minimax.ts packages/engine/src/ai/minimax.test.ts packages/engine/src/rules/__fixtures__/cardDraftGame.ai.ts
git commit -m "Add generic minimax search utility and Hard fixture AI"
```

---

## Task 9: Simulation harness with card-conservation invariants

**Files:**
- Create: `packages/engine/src/testing/simulate.ts`
- Create: `packages/engine/src/testing/index.ts`
- Test: `packages/engine/src/testing/simulate.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId`, `RuleEngine` (Task 6); `AIStrategy` (Task 7); `createRng` (Task 3); `allCards` (Task 5); `cardDraftGame`, `cardDraftEasyAI`, `cardDraftHardAI` (Tasks 6-8)
- Produces: `assertCardsConserved(before, after): void`, `simulateGames(options): { finalStates, winCounts }` — exported via the `@world-cards/engine/testing` subpath for reuse by every future game's own test suite (Phase 2+).

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/testing/simulate.test.ts`:

```ts
import { simulateGames } from './simulate';
import { cardDraftGame, CardDraftSetupOptions } from '../rules/__fixtures__/cardDraftGame';
import { cardDraftEasyAI, cardDraftHardAI } from '../rules/__fixtures__/cardDraftGame.ai';

describe('simulateGames', () => {
  it('runs many games without invariant violations', () => {
    const setupOptions: CardDraftSetupOptions = { players: ['p1', 'p2'], seed: 0, rowSize: 6 };
    const result = simulateGames({
      ruleEngine: cardDraftGame,
      setupOptions,
      aiStrategies: { p1: cardDraftEasyAI, p2: cardDraftEasyAI },
      count: 500,
      seedStart: 1,
    });
    expect(result.finalStates).toHaveLength(500);
  });

  it('hard AI beats easy AI significantly more than half the time', () => {
    const setupOptions: CardDraftSetupOptions = { players: ['hard', 'easy'], seed: 0, rowSize: 6 };
    const result = simulateGames({
      ruleEngine: cardDraftGame,
      setupOptions,
      aiStrategies: { hard: cardDraftHardAI, easy: cardDraftEasyAI },
      count: 200,
      seedStart: 1,
    });
    const hardWins = result.winCounts['hard'] ?? 0;
    expect(hardWins).toBeGreaterThan(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/testing/simulate.test.ts`
Expected: FAIL with "Cannot find module './simulate'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/testing/simulate.ts`:

```ts
import { GameState, PlayerId, RuleEngine } from '../rules/types';
import { AIStrategy } from '../ai/types';
import { createRng } from '../core/rng';
import { allCards } from '../core/table';

export interface SimulateGamesOptions<TState extends GameState, TMove> {
  ruleEngine: RuleEngine<TState, TMove>;
  setupOptions: unknown;
  aiStrategies: Record<PlayerId, AIStrategy<TState, TMove>>;
  count: number;
  seedStart: number;
  maxMoves?: number;
}

export interface SimulateGamesResult<TState extends GameState> {
  finalStates: TState[];
  winCounts: Record<PlayerId, number>;
}

export function assertCardsConserved(before: GameState, after: GameState): void {
  const beforeIds = allCards(before.table).map((c) => c.id).sort();
  const afterIds = allCards(after.table).map((c) => c.id).sort();
  if (beforeIds.length !== afterIds.length) {
    throw new Error(`Card count changed: ${beforeIds.length} before, ${afterIds.length} after`);
  }
  for (let i = 0; i < beforeIds.length; i++) {
    if (beforeIds[i] !== afterIds[i]) {
      throw new Error(`Card set changed between moves: ${beforeIds[i]} vs ${afterIds[i]}`);
    }
  }
  if (new Set(afterIds).size !== afterIds.length) {
    throw new Error('Duplicate card id detected in table state');
  }
}

export function simulateGames<TState extends GameState, TMove>(
  options: SimulateGamesOptions<TState, TMove>
): SimulateGamesResult<TState> {
  const { ruleEngine, setupOptions, aiStrategies, count, seedStart, maxMoves = 1000 } = options;
  const finalStates: TState[] = [];
  const winCounts: Record<PlayerId, number> = {};

  for (let i = 0; i < count; i++) {
    const seed = seedStart + i;
    const rng = createRng(seed);
    let state = ruleEngine.setup(setupOptions, rng);
    let moves = 0;

    while (!ruleEngine.gameOver(state) && moves < maxMoves) {
      const playerId = state.players[state.currentPlayerIndex];
      const legalMoves = ruleEngine.getLegalMoves(state, playerId);
      if (legalMoves.length === 0) {
        throw new Error(`No legal moves for player "${playerId}" but game is not over (seed ${seed})`);
      }
      const strategy = aiStrategies[playerId];
      const moveRng = createRng(seed * 1000 + moves);
      const move = strategy.chooseMove(state, playerId, legalMoves, moveRng);
      if (!ruleEngine.validateMove(state, move, playerId)) {
        throw new Error(`AI chose an illegal move for player "${playerId}" (seed ${seed})`);
      }
      const nextState = ruleEngine.performMove(state, move);
      assertCardsConserved(state, nextState);
      state = nextState;
      moves++;
    }

    if (!ruleEngine.gameOver(state)) {
      throw new Error(`Game did not terminate within ${maxMoves} moves (seed ${seed})`);
    }

    finalStates.push(state);
    const winners = ruleEngine.determineWinner(state) ?? [];
    for (const winner of winners) {
      winCounts[winner] = (winCounts[winner] ?? 0) + 1;
    }
  }

  return { finalStates, winCounts };
}
```

Create `packages/engine/src/testing/index.ts`:

```ts
export * from './simulate';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/testing/simulate.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/testing
git commit -m "Add simulation harness with card-conservation invariants"
```

---

## Task 10: Game Registry

**Files:**
- Create: `packages/engine/src/registry/types.ts`
- Create: `packages/engine/src/registry/registry.ts`
- Test: `packages/engine/src/registry/registry.test.ts`

**Interfaces:**
- Consumes: `GameState`, `RuleEngine` (Task 6); `AIStrategy`, `Difficulty` (Task 7)
- Produces: `GameCategory`, `GameDescriptor<TState, TMove> { id; displayName; category; minPlayers; maxPlayers; ruleEngine; aiStrategies }`, `registerGame(descriptor)`, `getGames(): GameDescriptor[]`, `getGame(id): GameDescriptor | undefined`, `clearRegistry()` — consumed by Task 16's `HomeScreen`.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/registry/types.ts`:

```ts
import { GameState, RuleEngine } from '../rules/types';
import { AIStrategy, Difficulty } from '../ai/types';

export type GameCategory = 'trick-taking' | 'patience' | 'betting' | 'draw-and-discard' | 'other';

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

Create `packages/engine/src/registry/registry.test.ts`:

```ts
import { registerGame, getGames, getGame, clearRegistry } from './registry';
import { cardDraftGame } from '../rules/__fixtures__/cardDraftGame';
import { cardDraftEasyAI, cardDraftMediumAI, cardDraftHardAI } from '../rules/__fixtures__/cardDraftGame.ai';

const descriptor = {
  id: 'card-draft-fixture',
  displayName: 'Card Draft (fixture)',
  category: 'other' as const,
  minPlayers: 2,
  maxPlayers: 2,
  ruleEngine: cardDraftGame,
  aiStrategies: { easy: cardDraftEasyAI, medium: cardDraftMediumAI, hard: cardDraftHardAI },
};

describe('game registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers and retrieves a game by id', () => {
    registerGame(descriptor);
    expect(getGame('card-draft-fixture')).toBe(descriptor);
  });

  it('lists all registered games', () => {
    registerGame(descriptor);
    expect(getGames()).toEqual([descriptor]);
  });

  it('throws when registering a duplicate id', () => {
    registerGame(descriptor);
    expect(() => registerGame(descriptor)).toThrow();
  });

  it('returns undefined for an unknown id', () => {
    expect(getGame('nonexistent')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/registry/registry.test.ts`
Expected: FAIL with "Cannot find module './registry'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/registry/registry.ts`:

```ts
import { GameDescriptor } from './types';

const registry = new Map<string, GameDescriptor<any, any>>();

export function registerGame(descriptor: GameDescriptor<any, any>): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`registerGame: a game with id "${descriptor.id}" is already registered`);
  }
  registry.set(descriptor.id, descriptor);
}

export function getGames(): GameDescriptor<any, any>[] {
  return Array.from(registry.values());
}

export function getGame(id: string): GameDescriptor<any, any> | undefined {
  return registry.get(id);
}

export function clearRegistry(): void {
  registry.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/registry/registry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/registry
git commit -m "Add game registry"
```

---

## Task 11: Persistence interface (engine)

**Files:**
- Create: `packages/engine/src/persistence/types.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `PersistenceAdapter { save(key, data); load<T>(key); remove(key) }` — consumed by the AsyncStorage adapter in Task 14 and future save/load and statistics features (Phase 2+).

This is a type-only file (an interface with no runtime logic), so there is no test to write — it's verified indirectly when Task 14's adapter is checked against it by the TypeScript compiler.

- [ ] **Step 1: Write the interface**

Create `packages/engine/src/persistence/types.ts`:

```ts
export interface PersistenceAdapter {
  save(key: string, data: unknown): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/persistence
git commit -m "Add Persistence interface"
```

---

## Task 12: Statistics pure functions

**Files:**
- Create: `packages/engine/src/statistics/types.ts`
- Test: `packages/engine/src/statistics/types.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `GameStats { gamesPlayed; wins; losses; highScore }`, `GameResult { won; score }`, `emptyStats`, `recordGameResult(current, result): GameStats` — consumed by future per-game statistics screens (Phase 2+).

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/statistics/types.test.ts`:

```ts
import { emptyStats, recordGameResult } from './types';

describe('recordGameResult', () => {
  it('increments gamesPlayed and wins on a win', () => {
    const next = recordGameResult(emptyStats, { won: true, score: 42 });
    expect(next).toEqual({ gamesPlayed: 1, wins: 1, losses: 0, highScore: 42 });
  });

  it('increments gamesPlayed and losses on a loss', () => {
    const next = recordGameResult(emptyStats, { won: false, score: 10 });
    expect(next).toEqual({ gamesPlayed: 1, wins: 0, losses: 1, highScore: 10 });
  });

  it('keeps the highest score seen across multiple results', () => {
    const first = recordGameResult(emptyStats, { won: true, score: 50 });
    const second = recordGameResult(first, { won: false, score: 20 });
    expect(second.highScore).toBe(50);
  });

  it('does not mutate the input stats object', () => {
    const before = { ...emptyStats };
    recordGameResult(emptyStats, { won: true, score: 5 });
    expect(emptyStats).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/statistics/types.test.ts`
Expected: FAIL with "Cannot find module './types'"

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/statistics/types.ts`:

```ts
export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  highScore: number;
}

export interface GameResult {
  won: boolean;
  score: number;
}

export const emptyStats: GameStats = { gamesPlayed: 0, wins: 0, losses: 0, highScore: 0 };

export function recordGameResult(current: GameStats, result: GameResult): GameStats {
  return {
    gamesPlayed: current.gamesPlayed + 1,
    wins: current.wins + (result.won ? 1 : 0),
    losses: current.losses + (result.won ? 0 : 1),
    highScore: Math.max(current.highScore, result.score),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest packages/engine/src/statistics/types.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/statistics
git commit -m "Add pure statistics calculation functions"
```

---

## Task 13: Wire up the engine's public exports

**Files:**
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: every module from Tasks 3-12
- Produces: `@world-cards/engine`'s complete public API surface, consumed by `apps/mobile` starting in Task 14.

- [ ] **Step 1: Replace the placeholder index with real exports**

Modify `packages/engine/src/index.ts`:

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

- [ ] **Step 2: Verify the whole engine package still type-checks and all tests pass**

Run: `cd "d:/CodeSpace/world-cards" && npx tsc --noEmit -p packages/engine/tsconfig.json && npx jest packages/engine`
Expected: no type errors; all engine test suites pass.

- [ ] **Step 3: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add packages/engine/src/index.ts
git commit -m "Export the engine's public API surface"
```

---

## Task 14: AsyncStorage adapter (mobile)

**Files:**
- Create: `apps/mobile/src/infrastructure/persistence/asyncStorageAdapter.ts`
- Test: `apps/mobile/src/infrastructure/persistence/asyncStorageAdapter.test.ts`
- Modify: `apps/mobile/package.json` (add `@react-native-async-storage/async-storage`)

**Interfaces:**
- Consumes: `PersistenceAdapter` from `@world-cards/engine` (Task 11, exported via Task 13)
- Produces: `asyncStorageAdapter: PersistenceAdapter` — consumed by future save/load and statistics features (Phase 2+).

- [ ] **Step 1: Add the AsyncStorage dependency**

Run: `cd "d:/CodeSpace/world-cards/apps/mobile" && npx expo install @react-native-async-storage/async-storage`

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/infrastructure/persistence/asyncStorageAdapter.test.ts`:

```ts
import { asyncStorageAdapter } from './asyncStorageAdapter';

describe('asyncStorageAdapter', () => {
  it('round-trips a value through save/load', async () => {
    await asyncStorageAdapter.save('test-key', { count: 3 });
    const loaded = await asyncStorageAdapter.load<{ count: number }>('test-key');
    expect(loaded).toEqual({ count: 3 });
  });

  it('returns null for a key that was never saved', async () => {
    const loaded = await asyncStorageAdapter.load('never-saved');
    expect(loaded).toBeNull();
  });

  it('removes a saved value', async () => {
    await asyncStorageAdapter.save('to-remove', { value: 1 });
    await asyncStorageAdapter.remove('to-remove');
    const loaded = await asyncStorageAdapter.load('to-remove');
    expect(loaded).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest apps/mobile/src/infrastructure/persistence/asyncStorageAdapter.test.ts`
Expected: FAIL with "Cannot find module './asyncStorageAdapter'"

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/infrastructure/persistence/asyncStorageAdapter.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistenceAdapter } from '@world-cards/engine';

export const asyncStorageAdapter: PersistenceAdapter = {
  async save(key, data) {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  },
  async load(key) {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  },
  async remove(key) {
    await AsyncStorage.removeItem(key);
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "d:/CodeSpace/world-cards" && npx jest apps/mobile/src/infrastructure/persistence/asyncStorageAdapter.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add apps/mobile/src/infrastructure/persistence apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "Add AsyncStorage-backed PersistenceAdapter implementation"
```

---

## Task 15: Zustand stores in the app layer

**Files:**
- Create: `apps/mobile/src/state/settingsStore.ts`
- Create: `apps/mobile/src/state/createGameSessionStore.ts`
- Test: `apps/mobile/src/state/settingsStore.test.ts`
- Test: `apps/mobile/src/state/createGameSessionStore.test.ts`
- Modify: `apps/mobile/package.json` (add `zustand`)

**Interfaces:**
- Consumes: `GameState`, `RuleEngine` types from `@world-cards/engine` (Task 6, exported via Task 13)
- Produces: `useSettingsStore` (global Zustand store), `createGameSessionStore(ruleEngine, initialState)` (per-session store factory) — consumed by future game screens (Phase 2+).

- [ ] **Step 1: Add the zustand dependency**

Run: `cd "d:/CodeSpace/world-cards/apps/mobile" && npm install zustand`

- [ ] **Step 2: Write the failing tests**

Create `apps/mobile/src/state/settingsStore.test.ts`:

```ts
import { useSettingsStore, defaultSettings } from './settingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(defaultSettings);
  });

  it('starts with the default settings', () => {
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('light');
    expect(state.soundEnabled).toBe(true);
    expect(state.defaultDifficulty).toBe('medium');
  });

  it('updates the theme', () => {
    useSettingsStore.getState().setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('updates the default difficulty', () => {
    useSettingsStore.getState().setDefaultDifficulty('hard');
    expect(useSettingsStore.getState().defaultDifficulty).toBe('hard');
  });
});
```

Create `apps/mobile/src/state/createGameSessionStore.test.ts`:

```ts
import { createGameSessionStore } from './createGameSessionStore';
import type { GameState, RuleEngine } from '@world-cards/engine';

interface CounterState extends GameState {
  count: number;
}

type CounterMove = { type: 'increment' };

const counterRuleEngine: RuleEngine<CounterState, CounterMove> = {
  setup: () => ({
    gameId: 'counter',
    players: ['p1'],
    currentPlayerIndex: 0,
    table: { zones: {} },
    rngState: { seed: 0 },
    status: 'in-progress',
    count: 0,
  }),
  validateMove: () => true,
  performMove: (state, _move) => ({ ...state, count: state.count + 1 }),
  getLegalMoves: () => [{ type: 'increment' }],
  calculateScore: (state) => ({ p1: state.count }),
  determineWinner: () => ['p1'],
  gameOver: () => false,
};

describe('createGameSessionStore', () => {
  it('applies performMove through the provided rule engine', () => {
    const initialState = counterRuleEngine.setup(undefined, undefined as any);
    const useStore = createGameSessionStore(counterRuleEngine, initialState);

    expect(useStore.getState().state.count).toBe(0);
    useStore.getState().performMove({ type: 'increment' });
    expect(useStore.getState().state.count).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "d:/CodeSpace/world-cards" && npx jest apps/mobile/src/state`
Expected: FAIL with "Cannot find module './settingsStore'" and "Cannot find module './createGameSessionStore'"

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/state/settingsStore.ts`:

```ts
import { create } from 'zustand';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Settings {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  defaultDifficulty: Difficulty;
}

export interface SettingsStore extends Settings {
  setTheme: (theme: Settings['theme']) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDefaultDifficulty: (difficulty: Difficulty) => void;
}

export const defaultSettings: Settings = {
  theme: 'light',
  soundEnabled: true,
  defaultDifficulty: 'medium',
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...defaultSettings,
  setTheme: (theme) => set({ theme }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setDefaultDifficulty: (defaultDifficulty) => set({ defaultDifficulty }),
}));
```

Create `apps/mobile/src/state/createGameSessionStore.ts`:

```ts
import { create, StoreApi, UseBoundStore } from 'zustand';
import type { GameState, RuleEngine } from '@world-cards/engine';

export interface GameSessionStore<TState extends GameState, TMove> {
  state: TState;
  performMove: (move: TMove) => void;
}

export function createGameSessionStore<TState extends GameState, TMove>(
  ruleEngine: RuleEngine<TState, TMove>,
  initialState: TState
): UseBoundStore<StoreApi<GameSessionStore<TState, TMove>>> {
  return create<GameSessionStore<TState, TMove>>((set, get) => ({
    state: initialState,
    performMove: (move: TMove) => {
      const next = ruleEngine.performMove(get().state, move);
      set({ state: next });
    },
  }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "d:/CodeSpace/world-cards" && npx jest apps/mobile/src/state`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add apps/mobile/src/state apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "Add Zustand global settings store and per-session game store factory"
```

---

## Task 16: Root navigation and the Home screen (game library)

**Files:**
- Create: `apps/mobile/src/navigation/RootNavigator.tsx`
- Create: `apps/mobile/src/screens/HomeScreen.tsx`
- Test: `apps/mobile/src/screens/HomeScreen.test.tsx`
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/App.test.tsx` (update to match the new App content)
- Modify: `apps/mobile/package.json` (add React Navigation dependencies)

**Interfaces:**
- Consumes: `getGames`, `clearRegistry` from `@world-cards/engine` (Task 10, exported via Task 13)
- Produces: `RootNavigator`, `HomeScreen` — the entry point future game screens (Phase 2+) register into via the `RootStackParamList`.

- [ ] **Step 1: Add React Navigation dependencies**

Run: `cd "d:/CodeSpace/world-cards/apps/mobile" && npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context`

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/screens/HomeScreen.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { clearRegistry } from '@world-cards/engine';

describe('HomeScreen', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('shows the app title and an empty state when no games are registered', () => {
    render(<HomeScreen />);
    expect(screen.getByText('World Cards')).toBeTruthy();
    expect(screen.getByText('No games installed yet')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd "d:/CodeSpace/world-cards" && npx jest apps/mobile/src/screens/HomeScreen.test.tsx`
Expected: FAIL with "Cannot find module './HomeScreen'"

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/src/screens/HomeScreen.tsx`:

```tsx
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-cards/engine';

export function HomeScreen() {
  const games = getGames();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>World Cards</Text>
      <FlatList
        data={games}
        keyExtractor={(game) => game.id}
        renderItem={({ item }) => <Text style={styles.gameItem}>{item.displayName}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No games installed yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  gameItem: { fontSize: 18, paddingVertical: 8 },
  empty: { fontSize: 16, color: '#888' },
});
```

Create `apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';

export type RootStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'World Cards' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

Modify `apps/mobile/App.tsx`:

```tsx
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <>
      <RootNavigator />
      <StatusBar style="auto" />
    </>
  );
}
```

Modify `apps/mobile/App.test.tsx` to match the new content:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from './App';
import { clearRegistry } from '@world-cards/engine';

describe('App', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('renders the Home screen inside the navigator', () => {
    render(<App />);
    expect(screen.getByText('World Cards')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "d:/CodeSpace/world-cards" && npx jest apps/mobile/src/screens/HomeScreen.test.tsx apps/mobile/App.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd "d:/CodeSpace/world-cards"
git add apps/mobile/src/navigation apps/mobile/src/screens apps/mobile/App.tsx apps/mobile/App.test.tsx apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "Add RootNavigator and Home screen driven by the game registry"
```

---

## Task 17: Final integration verification

**Files:** none created or modified — this task only runs verification.

**Interfaces:**
- Consumes: everything from Tasks 1-15
- Produces: confidence that the full foundation works together, both as automated tests and as a running app on a physical device.

- [ ] **Step 1: Run the full test suite from the repo root**

Run: `cd "d:/CodeSpace/world-cards" && npx jest`
Expected: all test suites across both the `engine` and `mobile` Jest projects pass.

- [ ] **Step 2: Type-check both packages**

Run: `cd "d:/CodeSpace/world-cards" && npx tsc --noEmit -p packages/engine/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no type errors in either package.

- [ ] **Step 3: Boot the app on the physical device via Expo Go**

Run: `cd "d:/CodeSpace/world-cards/apps/mobile" && npx expo start`
Expected: dev server starts cleanly; scanning the QR code with Expo Go loads the app and shows the "World Cards" header with "No games installed yet" (since no real game is registered yet — that begins in Phase 2). Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit if anything was left uncommitted**

```bash
cd "d:/CodeSpace/world-cards"
git status
```

If clean, no commit needed — this task is verification-only.

---

## Summary

After Task 17, the repo has: a working npm workspaces monorepo; a pure-TypeScript `@world-cards/engine` package with Card Engine primitives, a `RuleEngine`/`AIStrategy` contract, a generic minimax utility, a game registry, a persistence interface, statistics functions, and a reusable simulation harness — all validated end-to-end against an internal test fixture (`cardDraftGame`), never a real game from the roadmap. The mobile app boots via Expo Go, renders an (empty) game library from the registry, and has Zustand stores ready for a real game session. Phase 2 (Pişti) starts from here by adding exactly two new folders — `packages/engine/src/games/pisti/` and `apps/mobile/src/games/pisti/` — without touching anything built in this plan.
