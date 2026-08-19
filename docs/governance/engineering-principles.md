# Engineering Principles

**Owner:** Project owner. **Scope:** repo-wide, applies to `packages/engine`, `packages/ui`, `apps/mobile`, and `apps/playground` alike. **Load when:** about to write code, tests, or make a structural decision.

These are permanent, stable engineering conventions — not a changelog, not a current-bug list, not a roadmap. If a convention here stops applying, this file is edited to say so directly; it does not accumulate a history of how the rule changed over time (see `docs/domains/<domain>/decisions.md` for that kind of reasoning, and git history for exactly what changed).

---

## 1. The engine is a pure functional core

`packages/engine` has zero dependency on React, React Native, or Expo. No game's rules or AI may import from `react`/`react-native`/`expo`, enforced simply by never adding them to `packages/engine/package.json`.

- No classes, no internal mutable state. Every `GameState` (and anything nested inside it) is plain, JSON-serializable data — no class instances, no `Map`/`Set`, no functions.
- No `Math.random()` anywhere in the engine. All randomness goes through the seeded `RNG` in `packages/engine/src/core/rng.ts`, so every simulation and every game is reproducible from a seed.
- Rule/AI logic is stateless functions over immutable state — a move produces a new state, it never mutates the one it was given.

This is a structural requirement, not a style preference: it's what makes the engine reusable from React Native, React Web, Electron, or a future desktop app without modification, and what makes `simulateGames`-based testing (hundreds of simulated games, byte-for-byte reproducible) possible at all.

## 2. Adding a new game touches exactly two folders

A new game is `packages/engine/src/games/<id>/` (rules + AI) and `apps/mobile/src/games/<id>/` (screen), registered via `registerGame`. No other shared or shell code should need editing to add a game.

This convention is what makes scaling toward the project's 100+-game horizon tractable — each game is additive, not a change to shared plumbing.

## 3. State management: one small global store, one per-session store

Zustand usage in `apps/mobile` follows a one-global-store (settings) + one-short-lived-per-game-session-store (via `createGameSessionStore`) discipline. Never one mega-store covering unrelated concerns.

## 4. Testing policy (supersedes the general TDD default until revisited)

As of 2026-07-07, writing tests up front adds too much time to this project's pace for most work. The default is to **not** write new tests proactively, especially for mobile UI components/screens — ask before adding one.

**The one standing exception:** the engine core — the Card Engine, `RuleEngine`/`AIStrategy` implementations, and `simulateGames`-based invariant checks — stays test-covered by default, since correctness there is load-bearing for every game built on top of it. Every game should get simulation tests via `@world-of-cards/engine/testing`'s `simulateGames`, asserting card-conservation invariants over hundreds of simulated games.

This policy is about not writing *new* tests proactively — existing tests still get run for regression-checking as a matter of course.

## 5. Cross-app package sharing: `packages/engine` and `packages/ui` are shared; app code is not

`apps/playground` and `apps/mobile` both consume `packages/engine` (pure TS) and `packages/ui` (`PlayingCard`, `TableFelt`, `TableWoodCorners`, `SuitIcon`, etc.). Neither app ever imports from the other, in development or production — this isolation is deliberate and load-bearing, not incidental. See `docs/domains/ui-visual-system/overview.md` for the full rationale and the process guardrail that goes with it.

Playground-only dependencies (file/image pickers, sliders) are only ever added to `apps/playground/package.json`, never to `apps/mobile/package.json` or `packages/ui/package.json`.

## 6. Each new game follows the same build pipeline

Research rules → write a rules doc → design the game-state model → build the `RuleEngine` → build Easy/Medium/Hard AI → build the mobile UI → write tests → run `simulateGames` across hundreds of simulated games → done, then move to the next game. Games are built in this fixed pipeline order, not UI-first or ad hoc — see `docs/status/roadmap.md` for the current build order this pipeline is applied to.

## 7. Multi-project Jest, one test strategy per runtime

`packages/engine` runs on plain Node (`ts-jest`); `apps/mobile` runs on `jest-expo` + React Native Testing Library. Every game's rule engine and AI strategy gets `simulateGames`-based invariant testing (per Principle 4) regardless of which runtime it targets.
