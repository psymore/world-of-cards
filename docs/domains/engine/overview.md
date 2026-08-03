# Engine — Overview

**Owner:** whoever maintains the shared engine contracts. **Load:** when touching `packages/engine`.

`packages/engine` is a pure-TypeScript package with zero dependency on React, React Native, or Expo — see `docs/governance/engineering-principles.md` §1 for the stable rules this implies. It is the shared foundation every game builds on.

## Stable architectural shape

- **`core/`** — `Card`, `Deck`, `Zone`, shuffle/deal, and the seeded `RNG` (`core/rng.ts`). No game-specific knowledge lives here.
- **`rules/`** — the shared `RuleEngine<TState, TMove>` contract every game's rules implement.
- **`ai/`** — the shared `AIStrategy<TState, TMove>` contract, plus reusable search utilities (`minimax.ts`'s `minimaxChooseMove`, `weightedRandom.ts`).
- **`persistence/`** — a `PersistenceAdapter` interface only; the actual implementation (`AsyncStorage`-backed) lives in `apps/mobile/src/infrastructure/persistence/`.
- **`statistics/`** — pure stat-calculation functions.
- **`registry/`** — `GameDescriptor` type + `registerGame()`/`getGame()`, the mechanism that lets each game's `apps/mobile` screen and engine module be added without editing shared/shell code.
- **`testing/`** — `simulateGames`, the reusable test harness every game's `RuleEngine`/`AIStrategy` gets exercised through (hundreds of simulated games, asserting card-conservation invariants).

Each game lives at `packages/engine/src/games/<id>/` (rules + AI), registered via `registerGame` — see `docs/governance/engineering-principles.md` §2.

## Testing convention: watch for "find the extreme element" bugs

A recurring review finding across trick-taking game engines (first surfaced three separate times during Batak's `RuleEngine` review cycles): any `.reduce(...)`/`Math.max`-style "find the highest/best/winning X among several" computation — the winning card in a trick, the highest bid, the best move among several candidates — is a specific risk if it's only ever tested against a collection with a single relevant element. A single-candidate test can't distinguish "picked correctly" from "picked by position" (first, or last).

This generalized cleanly on the very next sub-project (Batak's AI strategies) once reviewers were briefed to check for it explicitly, with zero fix cycles needed — worth treating as a standing review-brief item for every future trick-taking game (Hearts, Spades, Gin Rummy are all still on the roadmap), not a one-off retro note. When testing this shape of logic, deliberately include a case with 2+ candidates where the correct answer sits in a non-first, non-last position, and prove the test actually catches the bug via mutation testing (temporarily break the logic the wrong way, confirm the new test fails, revert, confirm it passes) rather than just asserting the fix looks right.

This is a durable engineering guideline, not a historical bug report — it stays here (not in `known-issues.md`) because it remains true and useful regardless of whether any specific instance of it has ever recurred.

## AI performance methodology

When implementing Hard AI (minimax/search-based) for a new game, benchmark the actual `chooseMove` call against the compiled engine (`npx tsc` then a plain Node script requiring `dist/`) across many simulated hands, and look at p95/max timing, not just the mean — not just a live device profile, which may not be available. This is how Pişti's Hard AI (`minimaxChooseMove` at depth 8) was cleared as a non-issue (mean 0.39ms, p95 0.92ms across 720 real decisions) without a live device to test on. Reuse this method for every future Hard AI, especially games with a larger move-branching factor than Pişti's capped-at-4 hands (Hearts, Spades, Gin Rummy, Texas Hold'em) — don't skip it just because an earlier game's numbers looked safe.
