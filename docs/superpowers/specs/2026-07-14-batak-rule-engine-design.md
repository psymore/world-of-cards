# Batak (4-Player Individual): RuleEngine Implementation Design

**Status:** Approved
**Date:** 2026-07-14
**Scope:** Implementing the `RuleEngine<BatakState, BatakMove>` contract for 4-player individual Batak, with unit test coverage, building directly on `docs/superpowers/specs/2026-07-14-batak-rules-and-state-design.md` (the rules and data-model spec) and the `compareRanks`/`BatakState`/`BatakMove`/`BatakSetupOptions` foundation already implemented in `packages/engine/src/games/batak/ranking.ts` and `packages/engine/src/games/batak/types.ts`. Does not include AI strategies, UI, or `simulateGames`-based simulation/win-rate testing — those remain separate future sub-projects, per the Batak build order in `CLAUDE.md`.

## Context

This is a small, tightly-scoped sub-project: nearly all of the actual game behavior was already decided in the prior rules-and-state-design spec (its Section 4, "Algorithm Summary," describes `setup`/`getLegalMoves`/`performMove`/`calculateScore`/`determineWinner`/`gameOver` at a conceptual level). This document's job is narrower — it fixes the concrete file structure, `validateMove`'s semantics (the one contract function the prior spec didn't cover), and the test-coverage plan, so the implementation plan has nothing left to improvise.

## 1. File Structure

- `packages/engine/src/games/batak/rules.ts` — exports `batakGame: RuleEngine<BatakState, BatakMove>`, implementing all seven contract functions per the state-model spec's Section 4. The exported name follows the existing `pistiGame`/`cardDraftGame` `<gameId>Game` naming convention.
- `packages/engine/src/games/batak/rules.test.ts` — unit tests, written test-first (TDD), colocated with `rules.ts` per this codebase's established pattern (every rules file has its own test file).

No other files change. In particular, `packages/engine/src/games/batak/types.ts` and `ranking.ts` (already implemented) are consumed as-is, unmodified.

## 2. `validateMove` Semantics

The state-model spec's Section 4 didn't specify `validateMove`. This sub-project fixes it now. Unlike Pişti — where legality was a one-line "is this card in your hand" check, independent of `getLegalMoves` — Batak's `play` legality is genuinely non-trivial (mandatory raise, trump-broken-to-lead), so `validateMove` reuses `getLegalMoves` as the single source of truth for that case rather than duplicating the logic:

```
validateMove(state, move, playerId):
  if state.status !== 'in-progress': return false
  if state.players[state.currentPlayerIndex] !== playerId: return false

  switch (move.type):
    case 'bid':
      return state.phase === 'bidding'
        && state.bids[playerId] !== 'pass'
        && move.amount >= max(5, state.highestBid + 1)
        && move.amount <= 13

    case 'pass':
      return state.phase === 'bidding'
        && state.bids[playerId] !== 'pass'

    case 'selectTrump':
      return state.phase === 'trump-selection'
        && playerId === state.bidWinner

    case 'play':
      return state.phase === 'playing'
        && getLegalMoves(state, playerId).some(m => m.type === 'play' && m.cardId === move.cardId)
```

`performMove` does **not** re-validate — it trusts the caller (the same trust relationship `pistiGame`'s `performMove` has with its own caller). If `performMove` is called with an invalid `cardId` for a `'play'` move, the underlying `moveCard` call throws naturally, so there's no silent bad-state risk from skipping a redundant check.

## 3. Test Coverage Plan

`rules.test.ts` covers, at the unit level (constructing specific `BatakState` values directly and calling individual `RuleEngine` functions — no AI, no multi-game simulation):

- **`setup`**: deals 13 cards to each `hand-<playerId>`; initializes `phase: 'bidding'`, `bids` all `null`, `highestBid: 0`, `contract: null`, `bidWinner: null`, `trumpSuit: null`, `trumpBroken: false`, `currentTrick: []`, `trickLeader: null`, `tricksWon` at zero for all 4 players, `status: 'in-progress'`, `currentPlayerIndex: 0`.
- **Bidding state machine**: a player raising the bid updates `highestBid`/`bids`; a pass removes a player from future turns without ending the auction while 2+ active bidders remain; the auction closes (moves to `phase: 'trump-selection'`, sets `contract`/`bidWinner`) the moment exactly one active bidder remains; the forced-contract case — every player passes, including player 0 on the very first turn — sets `contract: 4` and `bidWinner: players[0]`; `getLegalMoves` during bidding offers exactly the integers from `max(5, highestBid+1)` to 13 plus `pass`, and offers nothing to an already-passed player.
- **Trump selection**: only `bidWinner` has legal moves (one `selectTrump` per suit); selecting trump sets `phase: 'playing'` and `trickLeader`/`currentPlayerIndex` to the bid winner.
- **`getLegalMoves` during play — the three branches**: leading with `trumpBroken: false` and a non-trump card in hand excludes all trump cards; leading with `trumpBroken: true` includes trump; leading with an all-trump hand includes trump even with `trumpBroken: false`; following the led suit with a higher card available in hand restricts legal moves to only cards beating the trick's current-highest led-suit card (mandatory raise); following the led suit with no higher card available offers all led-suit cards; being void in the led suit offers every card in hand, including trump.
- **Trick resolution**: highest trump played wins over any non-trump card, regardless of who led; with no trump played, the highest card of the led suit wins; playing a trump card sets `trumpBroken: true` (and stays `true` for the rest of the hand); the 4th card completing a trick sweeps `trick` → `won-<winner>`, increments `tricksWon[winner]`, sets the winner as `trickLeader`/`currentPlayerIndex`, and clears `currentTrick`; the 13th trick completing sets `phase`/`status: 'finished'`.
- **`calculateScore`**: bid winner scores their actual tricks won when `>= contract`; bid winner scores `-contract` when tricks won `< contract` (including exactly 0); a non-bidder scores their actual tricks won when `> 0`; a non-bidder scores `-contract` (not their own bid — there isn't one) when tricks won `=== 0`.
- **`determineWinner`**: returns `null` when `gameOver` is false; returns the correct single player id once finished; returns multiple ids on a genuine score tie.
- **`gameOver`**: `true` only when `status === 'finished'`.

## Out of Scope (Deferred to Later Sub-Projects)

Unchanged from the original state-model spec, restated for clarity:

- `registerGame(...)` registration in the engine registry. `GameDescriptor.aiStrategies` (`packages/engine/src/registry/types.ts`) is a required field, so Batak cannot be registered until `AIStrategy` implementations exist for all three difficulties. Batak's rule engine will be fully correct and unit-tested by the end of this sub-project, but not yet reachable through the game registry or the mobile app.
- `AIStrategy` implementations (Easy/Medium/Hard) and the Batak screen/UI.
- `simulateGames`-based card-conservation and AI win-rate testing — these require an `AIStrategy` to auto-play a full game and therefore belong to the AI sub-project, not this one.
- Multi-hand match play, the bid-13 ("Draw") instant-match-win rule, hidden trump, the 3-player and eşli variants — unchanged from the original spec's deferral.

## Next Step

Brainstorm and plan the Batak `AIStrategy` (Easy/Medium/Hard) sub-project, building on `batakGame` from this plan — at which point `registerGame` and `simulateGames`-based testing both become possible.
