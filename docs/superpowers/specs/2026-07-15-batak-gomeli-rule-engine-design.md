# Batak (3-Player "Gömmeli"): RuleEngine Implementation Design

**Status:** Approved
**Date:** 2026-07-15
**Scope:** Implementing the diff described in `docs/superpowers/specs/2026-07-15-batak-gomeli-rules-and-state-design.md` against the existing `batakGame: RuleEngine<BatakState, BatakMove>` (`packages/engine/src/games/batak/rules.ts`, `types.ts`). Does not include AI-strategy adjustments, UI, or `simulateGames`-based simulation testing extended to 3-player games — those remain separate future sub-projects, per the Batak build order.

## Context

Same small-scope shape as the 4-player rule-engine sub-project: the rules-and-state-design spec already fixes intended behavior (its Section 4, "Algorithm Summary," diffs `setup`/`getLegalMoves`/`performMove`/`calculateScore` against the current implementation). This document fixes the one thing that spec left open — the `bury` legal-move enumeration approach — plus `validateMove`'s new `'bury'` case and the test-coverage plan, so the implementation plan has nothing left to improvise.

**Decision made during brainstorming (not re-litigated here):** `getLegalMoves` for `'kitty-exchange'` returns the full enumeration of all C(20,4) = 4,845 possible 4-card bury combinations from the bidder's post-kitty-pickup hand, exactly mirroring how `'play'` legality already works (`validateMove` delegates via `.some(...)`). This is a one-time cost per hand (the phase is entered once, not once per trick), not a hot loop, and requires zero changes to `batakEasyAI` (`pickRandom(legalMoves, rng)` continues to work unmodified across every phase, including this new one). Medium/Hard AI will need bespoke bury heuristics regardless of this choice — that's real domain logic belonging to the AI sub-project, not something this enumeration decision avoids or creates.

## 1. File Structure

No new files. This sub-project modifies the existing, already-implemented pair in place:

- `packages/engine/src/games/batak/rules.ts` — extends `batakGame`'s seven contract functions with the 3-player diff (derived constants, `kitty`/`buried` zones, the `'kitty-exchange'` phase, the `'bury'` move).
- `packages/engine/src/games/batak/rules.test.ts` — new test cases added alongside the existing 4-player ones (see Section 3). Existing 4-player tests must keep passing unmodified — this is a generalization, not a rewrite, same discipline the 4-player-to-Pişti precedent (2-player → 4-player free-for-all) already established for this codebase.

`types.ts` also changes (the `BatakState`/`BatakMove`/`BatakSetupOptions` diff is already fully specified in the rules-and-state-design spec's Section 3 — no new decisions needed here).

## 2. Derived Constants Helper

A small internal helper in `rules.ts`, not exported, computes the Section-2-table values from `players.length`:

```ts
function ruleConstants(playerCount: number) {
  return playerCount === 3
    ? { handSize: 16, kittySize: 4, bidFloor: 8, maxBid: 16, forcedContract: 7, bustThreshold: 2 }
    : { handSize: 13, kittySize: 0, bidFloor: 5, maxBid: 13, forcedContract: 4, bustThreshold: 1 };
}
```

Every currently-hardcoded `5`, `13`, `4`, and the non-bidder `tricks === 0` bust check in `biddingLegalMoves`, `validateMove`'s `'bid'` case, `performMove`'s all-passed branch, and `calculateScore` reads from this helper instead. (Kept as a simple binary ternary on player count rather than a lookup table, since only two configurations exist today — revisit if a third ever shows up.)

## 3. `validateMove` Semantics (New `'bury'` Case)

```
case 'bury':
  return state.phase === 'kitty-exchange'
    && playerId === state.bidWinner
    && batakGame.getLegalMoves(state, playerId)
         .some(m => m.type === 'bury' && sameCards(m.cardIds, move.cardIds))
```

`sameCards` compares two 4-element id arrays order-insensitively (a small local helper — `cardIds` is a set of 4 cards to bury, not a sequence). All other `validateMove` cases (`bid`/`pass`/`selectTrump`/`play`) are unchanged in shape, just reading `bidFloor`/`maxBid` from `ruleConstants` instead of literal `5`/`13`.

`performMove` continues not to re-validate (same trust relationship as today) — an invalid `bury` (e.g. a card id not in the bidder's hand) would throw naturally inside the `moveCard` calls, same failure mode `'play'` already has.

## 4. Test Coverage Plan

`rules.test.ts` gains, alongside the existing (untouched) 4-player cases:

- **`setup` (3-player):** deals 16 cards to each of 3 `hand-<playerId>` and 4 to `kitty`; all other initial fields match the 4-player shape plus `kittyCardIds: null`.
- **Derived constants take effect:** bidding in a 3-player game rejects a first bid below 8 and accepts 8; rejects a bid above 16; all-3-pass forces `contract: 7`, `bidWinner: players[0]`. (Mirrors the existing 4-player bidding tests one-for-one with the new constants — a genuinely discriminating test, not a copy that happens to pass both ways, per the trick-taking test-gap pattern from the RuleEngine sub-project: assert the 3-player numbers specifically, e.g. a bid of 7 must be rejected as too low, not just "some floor exists.")
- **Trump-selection → kitty-exchange transition (3-player only):** selecting trump moves all 4 `kitty` cards into the bidder's hand (20 cards total), sets `kittyCardIds` to exactly those 4 card ids, sets `phase: 'kitty-exchange'` — and, contrasted directly against the 4-player case in the same test file, confirms a 4-player game's `selectTrump` still goes straight to `'playing'` with `kittyCardIds` staying `null`.
- **`getLegalMoves` during `'kitty-exchange'`:** returns moves only for `bidWinner` (empty for every other player, including one who might currently share `currentPlayerIndex` incidentally — assert by `playerId`, not just count); the returned set's size is exactly C(20,4) = 4845; every returned move's 4 card ids are distinct and present in the bidder's actual hand; spot-check a specific known combination is present and a combination containing a card *not* in hand is absent.
- **`bury`:** performing a legal bury moves exactly those 4 cards from the bidder's hand to `buried` (hand back to 16, `buried` now holds 4), sets `phase: 'playing'`, sets `trickLeader`/`currentPlayerIndex` to the bidder; a bury naming a card the bidder doesn't hold is rejected by `validateMove`; a bury naming fewer/more than 4 distinct cards is rejected.
- **Trick play unaffected:** an existing mandatory-raise/trump-broken/trick-winner test re-run against a 3-player table (16-card hands) to confirm none of that logic silently assumed 4 players — pick at least one multi-candidate scenario per the already-established test-gap pattern, not a trivial single-candidate one.
- **`calculateScore` bust threshold:** a non-bidder with exactly 1 trick scores `-contract` (new — was legal/`1` in 4-player); a non-bidder with exactly 2 tricks scores `2` (crosses the new threshold correctly); a non-bidder with 0 tricks still scores `-contract` (unchanged edge); the existing 4-player 0-trick-bust test is re-asserted untouched to confirm `bustThreshold` reading 4-player's `1` didn't regress it.
- **Full-hand integration (3-player):** a hand-traced sequence — bid, trump, kitty-exchange, bury, all 16 tricks — reaching `phase: 'finished'`/`status: 'finished'` with `determineWinner` returning the correct player(s), verifying `buried` and the unused 4 kitty-origin-but-then-buried cards never resurface in any hand/trick/won zone (a real card-conservation check at the unit level, ahead of the full `simulateGames` version the AI sub-project will add).

## Out of Scope (Deferred to Later Sub-Projects)

- `AIStrategy` adjustments: Easy needs no changes (confirmed above); Medium/Hard need bury/bidding heuristics recalibrated for the 8–16 bid range and kitty exchange — deferred to the AI sub-project, mirroring how the 4-player AI sub-project followed its own rule-engine sub-project.
- UI: 3-seat table layout, kitty-reveal presentation (visible-to-all incoming vs. hidden bidder discard), the bury interaction.
- `simulateGames`-based card-conservation and win-rate testing for 3-player games — requires an `AIStrategy`, same dependency the 4-player build had.
- The 4-player "eşli" (partnered) variant; multi-hand match play; the bid-16 "Draw" instant-match-win rule — unchanged deferrals from the rules-and-state-design spec.

## Next Step

Write the implementation plan for this design (extending `packages/engine/src/games/batak/rules.ts`/`rules.test.ts` in place), then execute it.
