# Core Architecture Design (Phase 1)

**Status:** Approved
**Date:** 2026-07-06
**Scope:** The shared foundation (repo structure, Card Engine, Rule Engine, AI interface, navigation/registry, persistence, statistics, testing strategy) that every future game module builds on. Does not include any specific game's rules, AI, or UI — that begins in Phase 2 (Pişti).

## Context

World Cards is a long-term platform intended to eventually host 100+ traditional card games, offline-first at launch, with AI opponents, statistics, achievements, themes, and (later) online multiplayer plugged in without rewriting the app. This document captures the architectural decisions made during Phase 1 brainstorming, before any game-specific code is written.

A key amendment made at the start of this phase: **the game engine must be completely platform-agnostic.** No game logic may depend on React Native. The engine must be reusable from React Native, React Web, Electron, or a future desktop app without modification, with UI and business logic strictly separated. This requirement shapes every decision below.

## 1. Repo & Package Structure

An npm workspaces monorepo with two packages for now:

```
world-cards/
├── packages/
│   └── engine/                 # Pure TypeScript. Zero react/react-native dependencies.
│       ├── package.json
│       └── src/
│           ├── core/            # Card, Deck, Zone, shuffle, deal, RNG — no game-specific knowledge
│           ├── rules/           # Shared RuleEngine<TState, TMove> contract
│           ├── ai/              # Shared AIStrategy<TState, TMove> contract + reusable search utilities
│           ├── persistence/     # PersistenceAdapter interface only (no implementation)
│           ├── statistics/      # Pure stat-calculation functions
│           ├── registry/        # GameDescriptor type + registerGame()/getGames()
│           └── games/
│               ├── pisti/       # rules.ts, ai/{easy,medium,hard}.ts, types.ts
│               └── ...          # one folder per game, added over time
│
└── apps/
    └── mobile/                  # Expo app. The only place RN/Expo/Reanimated APIs are used.
        ├── package.json         # depends on packages/engine via workspace link
        └── src/
            ├── infrastructure/
            │   └── persistence/  # AsyncStorage adapter implementing PersistenceAdapter
            ├── navigation/        # RootNavigator, driven by the game registry
            ├── state/             # Zustand: one small global store + one per-session store
            ├── components/        # Reusable SVG card, table, shared UI primitives
            └── games/
                ├── pisti/         # Screen + game-specific components, registered in the screen map
                └── ...
```

**Rationale:** `packages/engine` physically cannot import `react-native` — it isn't even a dependency of that package, so the platform-agnostic requirement is enforced by the module system, not a lint rule someone can `eslint-disable` around.

Statistics, Achievements, and Persistence split along this same line: their calculation/business logic (pure) lives in `packages/engine`; their storage mechanism (platform-specific glue) lives in `apps/mobile`, behind an interface. The Animation System is **not** in `packages/engine` at all, since Reanimated is inherently React-Native-specific — shared choreography stays in the mobile app for now.

Only two packages exist today. A third package (e.g. a shared UI kit) is added only when a second consuming app actually exists — not preemptively.

## 2. Card Engine (`packages/engine/src/core/`)

Generic, game-agnostic primitives with zero knowledge of any specific game's rules.

```ts
interface Card { id: string; suit: Suit | null; rank: Rank; }

interface Zone { id: string; cards: Card[]; faceUp: boolean | 'top-only'; }
interface TableState { zones: Record<string, Zone>; }
```

- `Card.id` is a unique identifier per physical card (not derived from suit+rank), so multi-deck games don't collide and animations can key on a stable id.
- Zones are a generic, dynamically-keyed map rather than fixed fields like "draw pile / discard pile / hand" — necessary because different games have wildly different zone topologies (Solitaire's 7 tableau columns + 4 foundations + stock + waste vs. Hearts' 4 hands + a trick pile vs. Poker's hands + community cards + pot).
- Core operations are pure functions over this shape: `createDeck(config, rng)`, `shuffle(cards, rng)`, `moveCard(table, cardId, fromZoneId, toZoneId)`, `deal(deck, assignments)`.
- Trump/rank comparison is exposed as generic, configurable comparator utilities; deciding how to *use* them is entirely up to each game's rule engine.
- **Determinism**: shuffle takes an injected `RNG` (seeded PRNG), never `Math.random()` directly, so simulations and bug reports are reproducible.

**Hard rule**: `GameState` (and everything inside it) must be plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions. This makes persistence nearly free, makes test assertions trivial (deep-equal), and gives undo for free in games that need it (every `performMove` returns a new immutable state, so the app layer can keep a stack of previous states and pop it).

## 3. Rule Engine (`packages/engine/src/rules/` + `packages/engine/src/games/<game>/`)

The engine holds **no mutable state of its own** — it is a pure functional core. Each game implements this contract, generic over its own state and move types:

```ts
interface GameState {
  gameId: string;
  players: PlayerId[];
  currentPlayerIndex: number;
  table: TableState;
  rngState: RngState;
  status: 'setup' | 'in-progress' | 'finished';
}

interface RuleEngine<TState extends GameState, TMove> {
  setup(options: SetupOptions, rng: RNG): TState;
  validateMove(state: TState, move: TMove, playerId: PlayerId): boolean;
  performMove(state: TState, move: TMove): TState;
  getLegalMoves(state: TState, playerId: PlayerId): TMove[];
  calculateScore(state: TState): ScoreBoard;
  determineWinner(state: TState): PlayerId[] | null;
  gameOver(state: TState): boolean;
}
```

`getLegalMoves` is an addition beyond the six functions in the original brief: both the AI and the UI (highlighting playable cards) need to answer "what moves are legal right now," so this factors out logic every game needs anyway rather than duplicating it in two places.

Each game defines its own `Move` union (Pişti: `play` / `capture`; Solitaire: `moveCard` / `drawStock`; Poker: `bet` / `fold` / `call`) — the shared contract only fixes these seven function signatures, not the shape of the data flowing through them.

**Why a pure functional core over stateful engine classes or a Zustand-based engine:** it makes "simulate hundreds of games" trivial (call `performMove` in a loop, no UI, no mocking), makes determinism straightforward (seed the RNG explicitly rather than hiding it in engine state), and — critically — it is what makes Hard AI lookahead search possible without cloning or side-effect risk (see Section 4). It also keeps the engine's state-library choice out of the picture entirely: the engine has zero dependency on Zustand or any other state library, so swapping the app layer's state management later touches only app-layer wiring code, never engine or game code.

## 4. AI Interface (`packages/engine/src/ai/` + `packages/engine/src/games/<game>/ai/`)

```ts
interface AIStrategy<TState extends GameState, TMove> {
  difficulty: 'easy' | 'medium' | 'hard';
  chooseMove(state: TState, playerId: PlayerId, legalMoves: TMove[], rng: RNG): TMove;
}
```

Each game implements three strategies, registered alongside its rules. The three tiers map to genuinely different techniques:

- **Easy** — weighted-random pick from `legalMoves` (mostly random, occasionally the obviously-correct move), using the injected `RNG` for reproducibility.
- **Medium** — a per-game heuristic scoring function ranks `legalMoves` (card value, immediate points/capture gained) and picks the best, with light randomness to avoid feeling robotic.
- **Hard** — lookahead search: minimax/alpha-beta for perfect-information games, Monte Carlo rollouts for imperfect-information games (Hearts, Poker). Because the engine is a pure functional core, Hard AI can call `performMove` repeatedly on hypothetical states to explore future branches with zero risk of corrupting real game state, and discard a branch simply by not keeping its result.

`packages/engine/src/ai/` also holds generic, reusable search utilities (a generic alpha-beta search, a rollout helper) parameterized by each game's own `performMove` / `getLegalMoves` / evaluation function, so minimax/Monte Carlo isn't reimplemented from scratch per game.

**Performance handling (app layer, not engine):** Hard AI search could take a noticeable amount of time for complex games. The app layer invokes AI moves via `InteractionManager.runAfterInteractions` plus a small deliberate "thinking" delay, which both improves UX (an instant AI move feels robotic) and absorbs real computation latency. This is a flagged ongoing risk, not a solved problem — see the Risks section below.

## 5. Navigation & Game Registry

Goal: adding game N+1 should only ever mean adding new files, never editing shared shell/navigation code.

Two-part registry, split along the engine/app boundary:

- **Engine-level descriptor** (`packages/engine/src/registry/`, pure data): `{ id, displayName, category, minPlayers, maxPlayers, ruleEngine, aiStrategies }`. Each game module calls `registerGame(descriptor)`.
- **App-level screen map** (`apps/mobile/src/games/registry.ts`): `Record<gameId, ScreenComponent>` — RN-specific (JSX), so it lives in the app, keyed by the same `id`.

**React Navigation** structure: a `RootNavigator` stack with `Home` (game library, rendered by iterating the engine registry — new games appear automatically), `Game` (resolves the screen component from the app-level map via the `gameId` route param), and non-game-specific screens (`Settings`, later `Statistics`/`Achievements`).

Each game's `Screen` is genuinely custom (a Solitaire tableau looks nothing like a Poker table), but common chrome — pause/exit menu, header, and a shared `GameResultModal` driven generically by `calculateScore()` / `determineWinner()` output — is a shared layout wrapper every `Screen` renders inside, written once rather than per game.

**Adding a new game = exactly two additions**: a rules/AI module in `packages/engine/src/games/<id>/`, and a `Screen` in `apps/mobile/src/games/<id>/`. No file outside those two new folders is touched.

## 6. State Management

Zustand, per the original tech stack, with one required discipline: **never one global mega-store.**

- A small **global store** for cross-cutting app state: settings, cached stats/achievements summaries.
- A short-lived **per-session store**, created when the user enters a game and discarded when they leave it, holding the current `GameState` and dispatching to the engine's pure functions (`set(engine.performMove(get().state, move))`).

This keeps memory flat regardless of how many games exist in the library, since only the currently-played game's state exists in memory at any time. Zustand was evaluated against Redux Toolkit, MobX, and plain Context — selected for smallest bundle size (~1.1–3.5kB vs. 15–23kB for alternatives), selector-based re-renders (avoiding Context-style cascades), and because its minimal `set()` API pairs directly with the pure functional core (no reducer/action ceremony needed). Zustand governs discrete, per-move business state only; per-frame animation values are handled entirely by Reanimated on the UI thread — the two are complementary, not competing, and this split is what actually protects the 60fps target.

Because the engine has no dependency on Zustand, swapping state libraries later is a low-risk, app-layer-only change if it's ever needed.

## 7. Persistence & Statistics

Persistence follows the same interface/implementation split as everything else.

**Interface** (`packages/engine/src/persistence/`):

```ts
interface PersistenceAdapter {
  save(key: string, data: unknown): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
}
```

**Adapter** (`apps/mobile/src/infrastructure/persistence/`): AsyncStorage-backed for v1 — simple, zero native config, works in Expo Go. Because `GameState` is already required to be plain JSON-serializable data, persistence is just "stringify whatever the pure functions produced" — no ORM, no custom serializers.

**Key namespacing convention**:
- `save:<gameId>` — in-progress `GameState` blob, for resume.
- `settings` — single global object (theme, sound, default AI difficulty).
- `stats:<gameId>` — aggregate stats per game (games played, wins, high score), updated incrementally.
- `achievements:<gameId>` (later, same pattern, no redesign needed).

**Statistics logic** (`packages/engine/src/statistics/`) is pure functions — `recordGameResult(currentStats, gameResult): UpdatedStats`. The app loads current stats through the adapter, calls this pure function, writes the result back.

This stays adequate well past 100 games because stats are maintained as running aggregates rather than raw event logs requiring ad-hoc queries. If a future feature (cross-game leaderboards, arbitrary analytics) genuinely needs relational queries, swapping to `expo-sqlite` is isolated to the adapter — the engine's statistics logic is untouched since it never embeds storage-specific query code.

## 8. Testing Strategy

**Runner:** Jest, as a multi-project config across the monorepo — a fast Node-environment project for `packages/engine` (no RN, no mocking needed, tests run in milliseconds), and a `jest-expo` project for `apps/mobile` using React Native Testing Library for component-level smoke tests.

**Where coverage concentrates:** because the entire rule/AI layer is pure functions, the overwhelming majority of test coverage lives in `packages/engine` — input/output tests with no setup/teardown.

**Simulation harness** (answers the "simulate hundreds of games" requirement directly): a shared, reusable utility —

```ts
simulateGames(ruleEngine, aiStrategies, { count: 500, seedStart })
```

— which for each seed calls `setup()`, then loops `getLegalMoves → AI chooses → performMove` until `gameOver()`, asserting invariants after every move: total card count across all zones stays constant, no card `id` ever appears in two zones at once, current-player index always valid. This card-conservation check is generic enough to write once (in the engine's shared test utilities) and reuse for every game.

**AI quality signal, not just correctness:** simulate Hard-vs-Easy matches over hundreds of games and assert Hard wins meaningfully more than 50% of the time — an automatable check that difficulty tiers behave as designed, not just that they don't crash.

**Out of scope for v1:** E2E testing (Detox/Maestro) — not warranted before a single game exists; revisit once several games are built and cross-game regressions become a real risk.

## Risks

- **Hard AI performance.** Search-heavy AI (deep lookahead, many Monte Carlo rollouts) risks janking the JS thread, since React Native has no easy Web Worker equivalent without adding native complexity. Mitigation path is pre-agreed: bound search depth/rollout count first; only reach for a background-thread solution as a last resort, and treat that as its own isolated architectural change when it happens. This must be profiled on a real mid-range Android device during each game's Hard AI implementation, not assumed solved by this design.
- **Node version.** The dev machine's Node (v22.11.0) is slightly below react-native@0.86's preferred engine range (`^22.13.0`). Currently only an `EBADENGINE` warning with no functional impact; deferred, not a blocker.

## Out of Scope (Deliberately Deferred)

Per the project's future-expansion list, none of the following are designed or implemented now, though the above architecture is intended to accommodate them later without rewrites: friend multiplayer, WebSockets, matchmaking, rankings/ELO, achievements UI, daily challenges, statistics synchronization, cloud save, themes, seasonal events. A third monorepo package (e.g. shared UI kit) is deferred until a second consuming app actually exists.

## Next Step

Phase 2: implement this foundation, then build the first game (Pişti) end-to-end against it as a validating vertical slice.
