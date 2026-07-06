# Pişti: RuleEngine Implementation Design (Phase 2, Sub-Project 2)

**Status:** Approved
**Date:** 2026-07-07
**Scope:** Implementing the `RuleEngine<PistiState, PistiMove>` contract for Pişti, with unit test coverage, building directly on `docs/superpowers/specs/2026-07-07-pisti-rules-and-state-design.md` (the rules and data-model spec) and the `moveAllCards`/`PistiState`/`PistiMove`/`PistiSetupOptions` foundation already implemented in `packages/engine/src/core/table.ts` and `packages/engine/src/games/pisti/types.ts`. Does not include AI strategies, UI, or `simulateGames`-based simulation/win-rate testing — those remain separate future sub-projects, per the Phase 2 build order in `CLAUDE.md`.

## Context

This is a small, tightly-scoped sub-project: nearly all of the actual game behavior was already decided in the prior rules-and-state-design spec (its Section 3, "Algorithm Summary," describes `setup`/`performMove`/`getLegalMoves`/`calculateScore`/`determineWinner`/`gameOver` at a conceptual level). This document's job is narrower — it fixes the concrete file structure, the exported symbol, `validateMove`'s semantics (the one contract function the prior spec didn't cover), and the test-coverage plan, so the implementation plan has nothing left to improvise.

## 1. File Structure

- `packages/engine/src/games/pisti/rules.ts` — exports `pistiGame: RuleEngine<PistiState, PistiMove>`, implementing all seven contract functions per the state-model spec's Section 3. The exported name follows the existing `cardDraftGame` fixture's `<gameId>Game` naming convention.
- `packages/engine/src/games/pisti/rules.test.ts` — unit tests, written test-first (TDD), colocated with `rules.ts` per this codebase's established pattern (every rules file has its own test file, e.g. `cardDraftGame.ts` + `cardDraftGame.test.ts`).

No other files change. In particular, `packages/engine/src/games/pisti/types.ts` (already implemented) is consumed as-is, unmodified.

## 2. `validateMove` Semantics

The state-model spec's Section 3 didn't specify `validateMove`, since it wasn't needed to fix the data model. This sub-project fixes it now, mirroring the existing `cardDraftGame` fixture's pattern exactly:

```
validateMove(state, move, playerId):
  if state.status !== 'in-progress': return false
  if state.players[state.currentPlayerIndex] !== playerId: return false
  return state.table.zones[`hand-${playerId}`].cards.some(c => c.id === move.cardId)
```

`performMove` does **not** re-validate — it trusts the caller (the same trust relationship the `cardDraftGame` fixture has with its own `performMove`). If `performMove` is called with an invalid `cardId`, the underlying `moveCard` call throws naturally (it already throws when a card isn't found in the source zone), so there's no silent bad-state risk from skipping a redundant check.

## 3. Test Coverage Plan

`rules.test.ts` covers, at the unit level (constructing specific `PistiState` values directly and calling individual `RuleEngine` functions — no AI, no multi-game simulation):

- **`setup`**: deals 4 cards to `pile`, 4 to each `hand-<playerId>`, remaining 40 to `stock`; reshuffles and retries if any of the initial 4 `pile` cards is a Jack; initializes `lastCapturedBy: null`, `pistiBonusPoints` at zero for both players, `status: 'in-progress'`, `currentPlayerIndex: 0`.
- **`performMove` capture logic** (the core rules from Section 1 of the prior spec): a non-Jack match capturing a 2+ card pile (no bonus); a Jack capturing a non-Jack top card; a Jack failing to be captured by a non-Jack card (placed instead); a non-matching, non-Jack play placed without capturing; the pişti bonus (10 pts, lone non-Jack card captured by matching rank); the double-pişti bonus (20 pts, lone Jack captured by another Jack).
- **`performMove` flow control**: `currentPlayerIndex` advances correctly after every move; a redeal (4 cards to each hand from `stock`) triggers exactly when both hands are empty and `stock` is non-empty; `status` becomes `'finished'` and any remaining `pile` cards sweep to `captured-<lastCapturedBy>` when both `stock` and both hands are empty.
- **`getLegalMoves`**: returns one `{ type: 'play', cardId }` per card in the given player's hand; returns an empty array for the player who isn't current.
- **`calculateScore`**: each card-value bonus (1 pt per Ace, 1 pt per Jack, 2 pts for 2♣, 3 pts for 10♦) counted correctly from `captured-<player>`; the 3-pt majority bonus awarded correctly, including the no-bonus 26–26 tie case; `pistiBonusPoints` included in the total.
- **`determineWinner`**: returns `null` when `gameOver` is false; returns the correct player id(s) once finished, including a tie (array with both players).
- **`gameOver`**: `true` only when `status === 'finished'`.

## Out of Scope (Deferred to Later Sub-Projects)

Unchanged from the original state-model spec, restated for clarity:

- `registerGame(...)` registration in the engine registry. `GameDescriptor.aiStrategies` (`packages/engine/src/registry/types.ts`) is a required field, so Pişti cannot be registered until `AIStrategy` implementations exist for all three difficulties. Pişti's rule engine will be fully correct and unit-tested by the end of this sub-project, but not yet reachable through the game registry or the mobile app.
- `AIStrategy` implementations (Easy/Medium/Hard) and the Pişti screen/UI.
- `simulateGames`-based card-conservation and Hard-vs-Easy win-rate testing — these require an `AIStrategy` to auto-play a full game and therefore belong to the AI sub-project, not this one.
- Multi-hand match play, dealer rotation, the 4-player/2v2 variant — unchanged from the original spec's deferral.

## Next Step

Brainstorm and plan the Pişti `AIStrategy` (Easy/Medium/Hard) sub-project, building on `pistiGame` from this plan — at which point `registerGame` and `simulateGames`-based testing both become possible.
