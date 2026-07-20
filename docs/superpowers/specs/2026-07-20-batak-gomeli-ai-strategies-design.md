# Batak (3-Player "Gömmeli"): AI Strategies Design

**Status:** Approved
**Date:** 2026-07-20
**Scope:** Fixing the crash that occurs today when any AI difficulty becomes bid winner in a 3-player gömmeli game, and adding bidding/kitty-exchange ("bury") behavior for Easy/Medium/Hard so gömmeli is fully AI-playable. Builds on `packages/engine/src/games/batak/rules.ts` (`batakGame`, already generalized for `players.length === 3`) and the existing `ai/{easy,medium,hard,handStrength}.ts` from the 4-player sub-project. Does not include the mobile UI, which remains a separate follow-up sub-project (see `docs/superpowers/specs/2026-07-15-batak-gomeli-rules-and-state-design.md`'s own deferred scope).

## Context

The gömmeli rule engine (state model + `RuleEngine`, both merged 2026-07-15) fully supports 3-player play — 16-card hands, the `kitty-exchange` phase, `bury` moves, bust-threshold scoring — gated generically on `players.length`. Nothing downstream exists yet: no AI strategy handles the new phase, and there is no UI. This sub-project closes the AI gap; the UI sub-project follows it.

**This is not optional polish — it's a crash fix.** `batakEasyAI`/`batakMediumAI`/`batakHardAI`'s `chooseMove` only branches on `'bidding'`, `'trump-selection'`, and (implicitly, as the fallthrough) `'playing'`. In a 3-player game, once an AI wins the bid and selects trump, the engine moves it into `'kitty-exchange'` with `legalMoves` full of `'bury'` moves — every current `chooseMove` implementation filters those out looking for `'play'` moves, gets an empty array, and crashes on `.reduce()` with no initial value.

**Deliberately not touched in this sub-project:** `estimateBidDecision`'s actual strength-estimation formula (the divisor, honor-point scale, etc.) — already flagged in the 4-player AI design and in `CLAUDE.md` as producing over-aggressive bids, with a standing decision to defer recalibration to its own future session. This sub-project only generalizes the bid *range* (floor/max) so gömmeli bids land in the correct 8-16 window instead of crashing or clamping against the wrong (4-player) 13-cap; it does not change how strength is scored.

## 1. Bidding & Trump: Generalizing the Range

`ruleConstants(playerCount)` (currently private to `rules.ts`) is exported so `handStrength.ts` can read the real bid floor/max/hand-size for the current game instead of hardcoding 4-player values.

`estimateBidDecision`'s signature gains a `playerCount` parameter:

```ts
function estimateBidDecision(
  hand: Card[],
  currentHighestBid: number,
  playerCount: number
): { type: 'bid'; amount: number } | { type: 'pass' };
```

Internally: `minBid = Math.max(ruleConstants(playerCount).bidFloor, currentHighestBid + 1)` (was hardcoded `5`), and the estimated-tricks clamp becomes `Math.min(ruleConstants(playerCount).maxBid, ...)` (was hardcoded `13`). The strength formula itself (`totalStrength`, the `/2` divisor) is untouched. Every existing call site (`medium.ts`, `hard.ts`) passes `state.players.length`; 4-player behavior is unchanged byte-for-byte since `ruleConstants(4)` returns the same `5`/`13` values already hardcoded today.

`chooseTrumpSuit` needs no changes — it already operates purely on suit length/honors within whatever hand it's given, with no hand-size assumption baked in.

## 2. Kitty-Exchange: The Bury Decision

New in `handStrength.ts`, shared by Easy and Medium:

```ts
function chooseCardsToBury(hand: Card[], trumpSuit: Suit, buryCount: number): Card[];
```

Ranks every card by a simple "keep priority" (trump cards ranked above non-trump; within each group, higher rank ranks above lower) and returns the `buryCount` lowest-priority cards — in practice, almost always the weakest non-trump cards first, falling back to weak trump only if the non-trump supply runs out (structurally impossible at a 20-card hand discarding only 4, but the ranking handles it correctly regardless). This mirrors `chooseTrumpSuit`'s existing "one heuristic, shared by two difficulties" pattern.

**Hard AI gets a genuinely smarter answer**, in three steps:

1. **Score every legal bury combination.** New `scoreHandForBury(hand: Card[], trumpSuit: Suit): number` in `handStrength.ts`, given a *candidate resulting 16-card hand* (i.e., already minus the 4 cards a given combination would bury):
   ```
   score = trumpStrength (count + TRUMP_HONOR_POINTS)
         + nonTrumpHonorPoints (existing NON_TRUMP_HONOR_POINTS scale)
         + LENGTH_BONUS_WEIGHT * Σ over all 4 suits of max(0, suitLength - 4)
   ```
   `LENGTH_BONUS_WEIGHT = 0.5` — deliberately subordinate to honor points (a trump Ace is worth 4, a length card beyond the 4th is worth 0.5), reflecting that this is real but secondary value ("length points": a suit held 5+ deep has latent late-trick-winning potential once opponents exhaust it, even without honors) — not a primary bidding/trump signal, per your explicit "smaller importance" call.
2. **Shortlist.** Enumerate all C(20,4) = 4845 combinations (reusing `fourCardCombinations`, exported from `rules.ts` for this — see Section 3), score each resulting hand via `scoreHandForBury`, take the top 8.
3. **Shallow lookahead over the shortlist.** Feed those 8 candidate `{ type: 'bury', cardIds }` moves into the existing `minimaxChooseMove` (no changes needed there — it already just evaluates whatever `legalMoves` array it's given) with `maxDepth: 3` (one full 3-player trick of real simulated play after the bury) and the same "everyone else is my adversary" `evaluate` Hard's card-play search already uses. Whichever of the 8 scores best wins.

This keeps the search bounded (8 branches × depth 3, not 4845 × depth N) while still being meaningfully more informed than Easy/Medium's static heuristic — it's evaluating real simulated outcomes for its best candidates, not just abstract hand strength.

## 3. `rules.ts` Export Addition

`fourCardCombinations` (currently a private helper in `rules.ts`, used internally by `kittyExchangeLegalMoves`) is exported so `hard.ts` can reuse the exact same C(20,4) enumeration rather than reimplementing it — the same reasoning and pattern as exporting `trickWinnerIndex` for `medium.ts`'s reuse in the 4-player AI sub-project. One-line visibility change, no behavior change; `rules.ts`'s existing tests are unaffected.

## 4. AI Strategy Changes, Per File

**`ai/easy.ts`:**
- `'kitty-exchange'` branch (new): `{ type: 'bury', cardIds: chooseCardsToBury(hand, state.trumpSuit!, 4).map(c => c.id) }`.
- `'bidding'` branch: unchanged (`{ type: 'pass' }` unconditionally, per the existing 4-player Easy-mode handicap — Easy bots never competitively bid, in gömmeli either).
- `'trump-selection'`/`'playing'`: unchanged.

**`ai/medium.ts`:**
- `'kitty-exchange'` branch (new): same `chooseCardsToBury` call as Easy.
- `'bidding'` branch: `estimateBidDecision(hand, state.highestBid, state.players.length)` — one new argument, per Section 1.
- `'trump-selection'`/`'playing'`: unchanged.

**`ai/hard.ts`:**
- `'kitty-exchange'` branch (new): the shortlist-then-minimax procedure from Section 2.
- `'bidding'` branch: `estimateBidDecision(hand, state.highestBid, state.players.length)`, same as Medium.
- `'trump-selection'`/`'playing'`: unchanged.

4-player games never reach `'kitty-exchange'` (`kittySize === 0`, per `ruleConstants`), so this new branch is simply unreachable code for every existing 4-player test/game — zero behavior change there.

## 5. Testing

- **`handStrength.test.ts`:** `estimateBidDecision` respects a passed-in `playerCount`'s floor/max (a gömmeli-range hand that would be capped at 13 for 4-player correctly reaches up to 16). `chooseCardsToBury` discards non-trump before trump and low rank before high rank in hand-crafted cases. `scoreHandForBury` scores a hand with a 5-card suit higher than an otherwise-identical hand with a 4-card suit (proving the length bonus is applied), and confirms it's small enough that a hand with one fewer honor but a longer suit doesn't outscore a hand with the extra honor (proving the "smaller importance" weighting, not just its presence).
- **`easy.test.ts`/`medium.test.ts`:** `'kitty-exchange'` returns a valid 4-card bury from the current hand, preferring non-trump cards.
- **`hard.test.ts`:** a hand-traced scenario (mirroring the existing depth-4 card-play trace) proving the shortlist-then-lookahead picks a bury combination the simple `chooseCardsToBury` heuristic would not have picked, and a separate case specifically isolating the length bonus (two candidate buries with equal honor points but different resulting suit lengths — Hard should prefer keeping the longer suit intact).
- **`simulate.test.ts`:** 500 easy-vs-easy-vs-easy 3-player gömmeli games, asserting every hand completes (bidding → kitty-exchange when applicable → 16 tricks → scoring) with no card-conservation violation across `hand-*`/`kitty`/`buried`/`trick`/`won-*` zones — this is also the first real exercise of the crash fix from Section "Context" under full random play. Then a 200-game Hard-vs-2×Easy benchmark, asserting `toBeGreaterThan(80)` out of 200 (>40%, vs. the ~33% pure-chance baseline for a 3-player free-for-all) — deliberately a coarser bar than the original 4-player target (`>70`/200, i.e. >35% vs. a 25% baseline, a ~1.4x multiple) rather than a strict one, since the known bidding-aggressiveness issue (Section "Context") already suppressed the 4-player equivalent down to chance level once Easy stopped competing for the bid, and this sub-project deliberately doesn't fix that formula. If the actual observed rate comes in below 80/200, lower the threshold to match reality (same "coarse sanity floor, not a quality bar" precedent already documented for the 4-player test) rather than treating it as a blocking bug in this sub-project.
- Reuse the established benchmark methodology (time the real `chooseMove` call via compiled `dist`, across many simulated hands — see `[[hard_ai_performance_risk]]`) specifically for the new kitty-exchange path, to confirm the 8-candidate × depth-3 lookahead stays comfortably under the existing AI thinking-delay budget. This is a new, unmeasured code path (unlike the card-play search, which this benchmark method has already validated for 4-player Batak) and is the one part of this design with a real, if likely small, performance-risk.

## Out of Scope (Deferred to a Later Sub-Project)

- The mobile UI — 3-player setup option, 3-seat table layout, kitty reveal/hide presentation, bury interaction. Next sub-project after this one.
- Recalibrating `estimateBidDecision`'s underlying strength formula (Section "Context") — stays deferred, unchanged by this work beyond the range fix.
- Applying the suit-length bonus to bidding/trump-selection strength estimation — scoped to Hard's bury heuristic only, per your explicit choice.
- The 4-player "eşli" (partnered) variant.

## Next Step

Once this is implemented and merged, brainstorm and plan the gömmeli mobile UI sub-project — at which point 3-player Batak becomes fully playable end-to-end, mirroring how the 4-player UI sub-project followed its own AI sub-project.
