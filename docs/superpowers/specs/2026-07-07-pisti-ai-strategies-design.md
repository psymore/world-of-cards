# Pişti: AI Strategies & Registration Design (Phase 2, Sub-Project 3)

**Status:** Approved
**Date:** 2026-07-07
**Scope:** Implementing `AIStrategy<PistiState, PistiMove>` for Easy/Medium/Hard difficulty, registering Pişti in the engine's game registry, and adding `simulateGames`-based card-conservation and Hard-vs-Easy win-rate tests. Builds directly on `packages/engine/src/games/pisti/rules.ts` (`pistiGame`, from the prior RuleEngine sub-project) and `packages/engine/src/games/pisti/types.ts`. Does not include the mobile UI/screen, which remains a separate future sub-project.

## Context

This is the third and final engine-side Pişti sub-project before UI work begins. It follows the pattern already established by the Phase 1 `cardDraftGame` fixture (`packages/engine/src/rules/__fixtures__/cardDraftGame.ai.ts`) and the shared, reusable AI utilities in `packages/engine/src/ai/` (`pickRandom`, `pickWeighted`, `minimaxChooseMove`) — this sub-project is largely a faithful application of that existing pattern to Pişti, not new architecture.

**Why AI before UI here:** the project's general per-game order (documented in `CLAUDE.md`) is rule engine → UI → AI, but this build deliberately did AI before UI so that `simulateGames`-based automated testing (which requires AI to drive play) is unlocked as early as possible, and so `registerGame` — which requires `aiStrategies` — can be satisfied without stubbing anything.

**Perfect-information design note (not new, restated for clarity):** Pişti's `PistiState` holds full information for both players (hand zones are `faceUp: true` in the data model, per the state-model spec's explicit design choice — visibility is a UI-layer concern, not an engine one). This means Hard AI can use direct minimax lookahead on the true game state, exactly like `cardDraftHardAI`, with no need for the Monte Carlo sampling that imperfect-information games (Hearts, Poker) will eventually require.

## 1. AI Strategies

Three new files under `packages/engine/src/games/pisti/ai/`, matching the architecture doc's prescribed per-game layout (`ai/{easy,medium,hard}.ts` — one file per difficulty), each exporting one `AIStrategy<PistiState, PistiMove>`:

**`ai/easy.ts` — `pistiEasyAI`:** pure uniform-random choice via the existing `pickRandom(legalMoves, rng)` utility. Identical pattern to `cardDraftEasyAI`. A legitimate "easy" difficulty on its own — a player who plays uniformly at random will still occasionally capture by chance, without ever seeking captures out.

**`ai/medium.ts` — `pistiMediumAI`:** for each legal move, computes the immediate points gained this turn — `pistiGame.calculateScore(pistiGame.performMove(state, move))[playerId] - pistiGame.calculateScore(state)[playerId]` — and picks the move with the maximum immediate gain. If multiple legal moves tie for the maximum (a common case when no move captures anything, since all non-capturing moves score a 0 delta), it breaks the tie via `pickRandom` over just the tied moves, giving light variation without needing separate randomness tuning.

**`ai/hard.ts` — `pistiHardAI`:** reuses the shared `minimaxChooseMove` utility exactly like `cardDraftHardAI`, with `ruleEngine: pistiGame`, `evaluate: (s) => calculateScore(s)[playerId] - <sum of opponent scores>`, and `maxDepth: 8` (matching the existing precedent's depth bound). Pişti's branching factor is small (≤4 legal moves per turn, since hand size stays at 4 throughout play), so this is computationally cheap (4^8 ≈ 65k worst-case nodes) — but per the project's standing performance-risk note (Phase 1 architecture doc's Risks section), this bound should still be profiled on a real device before being considered "done," not assumed safe purely from the node-count estimate. Depth can be raised later if profiling shows headroom and play feels too weak.

## 2. Registration

- **`packages/engine/src/registry/types.ts`** — add `'fishing'` to the `GameCategory` union (currently `'trick-taking' | 'patience' | 'betting' | 'draw-and-discard' | 'other'`), since Pişti's fishing/matching-capture mechanic (in the tradition of Scopa/Cassino) doesn't fit any existing bucket. A small, deliberate one-time addition to shared code — not a per-game change, and available for any future fishing-family game.
- **`packages/engine/src/games/pisti/index.ts`** (new) — builds `pistiDescriptor: GameDescriptor<PistiState, PistiMove>` (`id: 'pisti'`, `displayName: 'Pişti'`, `category: 'fishing'`, `minPlayers: 2`, `maxPlayers: 2`, `ruleEngine: pistiGame`, `aiStrategies: { easy: pistiEasyAI, medium: pistiMediumAI, hard: pistiHardAI }`) and calls `registerGame(pistiDescriptor)` as an import side effect, mirroring how `registerGame` is designed to be invoked (per-game, on import). No barrel file importing every registered game is created yet — with only one real game, that would be premature; it's added when a second game exists.

## 3. Testing

**Per-strategy unit tests** (`ai/easy.test.ts`, `ai/medium.test.ts`, `ai/hard.test.ts`), mirroring the existing `cardDraftGame.ai.test.ts` style — lightweight sanity checks, not exhaustive AI-quality proofs:
- Easy: always returns one of the given legal moves (checked across a few different RNG seeds).
- Medium: given a hand-crafted `PistiState` with one legal move that captures (positive score delta) and one that doesn't, picks the capturing move.
- Hard: the same hand-crafted scenario as Medium's test, confirming minimax also picks the capturing move — a minimal correctness check, since the shared `minimaxChooseMove` utility's own deeper search behavior is already covered by its existing tests in `packages/engine/src/ai/minimax.test.ts`.

**Registration test** (`packages/engine/src/games/pisti/index.test.ts`, new): imports the module and asserts `getGame('pisti')` returns a descriptor with the expected `id`/`category`/`minPlayers`/`maxPlayers`/`ruleEngine`/`aiStrategies` shape.

**Simulation tests** (`packages/engine/src/games/pisti/simulate.test.ts`, new), using the existing `simulateGames` utility from `packages/engine/src/testing/simulate.ts`:
- 500 easy-vs-easy games (`{ p1: pistiEasyAI, p2: pistiEasyAI }`), asserting all 500 complete without a card-conservation invariant violation (the utility throws internally on any violation, so simply completing without throwing is the assertion).
- 200 hard-vs-easy games (`{ hard: pistiHardAI, easy: pistiEasyAI }`, with `setupOptions.players: ['hard', 'easy']` so the AI-strategy keys line up with player ids), asserting `winCounts['hard']` is meaningfully greater than half — using the same `toBeGreaterThan(120)` threshold (out of 200) as the existing `cardDraftGame` precedent in `packages/engine/src/testing/simulate.test.ts`.

## Out of Scope (Deferred to a Later Sub-Project)

- The mobile UI/screen for Pişti, and the app-layer AI invocation glue (`InteractionManager.runAfterInteractions` + a "thinking" delay) — that's app-layer wiring that belongs with the UI sub-project, not this pure-engine one.
- A `packages/engine/src/games/index.ts` barrel importing every registered game — premature with only one real game; added when a second game exists.
- Actual on-device frame-timing profiling of the Hard AI's minimax search — flagged as something to do before calling Hard AI "done" for real play, but not a blocker for this engine-only sub-project (there's no UI yet to profile against).

## Next Step

Once the mobile UI sub-project exists, wire Pişti's AI into the app layer (`InteractionManager.runAfterInteractions` + thinking delay) and profile Hard AI's real frame timing on a mid-range device, per the standing Phase 1 performance-risk note.
