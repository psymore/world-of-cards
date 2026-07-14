# Batak (4-Player Individual): AI Strategies & Registration Design

**Status:** Approved
**Date:** 2026-07-14
**Scope:** Implementing `AIStrategy<BatakState, BatakMove>` for Easy/Medium/Hard difficulty, registering Batak in the engine's game registry, and adding `simulateGames`-based card-conservation and Hard-vs-Easy win-rate tests. Builds directly on `packages/engine/src/games/batak/rules.ts` (`batakGame`, from the prior RuleEngine sub-project), `types.ts`, and `ranking.ts`. Does not include the mobile UI/screen, which remains a separate future sub-project.

## Context

This is the third engine-side Batak sub-project, following the same rules-doc → state-model → rule-engine → AI order Pişti used (per `CLAUDE.md`'s per-game build order, with AI still coming before UI so `simulateGames`-based testing and `registerGame` are unlocked as early as possible — `GameDescriptor.aiStrategies` is a required field).

**Why this sub-project is structurally different from Pişti's AI sub-project:** Pişti's AI only ever chose "which card to play," and its Hard AI ran full minimax across the whole remaining hand cheaply, because Pişti's legal-move branching factor never exceeds 4 (hand size is capped at 4 throughout play). Batak's `getLegalMoves` returns three structurally different kinds of decisions depending on `state.phase` — a bid amount (up to 10 choices) or pass, a trump suit (4 choices), or a card play (which can be a dozen-plus legal cards early in a trick when void). Full minimax across an entire hand starting from the bidding phase is computationally infeasible (bidding's branching factor alone makes even a shallow search explode), and — unlike Pişti, where every single card play could immediately capture and score — there is no meaningful "immediate score" signal to greedily chase during bidding, or during the first three players' turns within a trick, since `tricksWon` only updates when a trick's 4th card completes it.

Consequently, this design splits AI behavior along two axes that Pişti never needed: **decision phase** (bid/pass, trump selection, card play) and **search strategy** (heuristic vs. bounded minimax). Medium and Hard share identical bidding/trump-selection logic; they differ only in card-play sophistication.

**Perfect-information design note (same as Pişti, restated for clarity):** `BatakState` holds full information for all four players (hand zones are `faceUp: true`, per the state-model spec — visibility is a UI-layer concern, not an engine one). Hard AI's bounded minimax can therefore search the true game state directly, with no need for the Monte Carlo sampling that imperfect-information games (Hearts, Poker) will eventually require.

## 1. Shared Bid/Trump Heuristic

New file `packages/engine/src/games/batak/ai/handStrength.ts`, imported unchanged by both `ai/medium.ts` and `ai/hard.ts` — Hard AI's advantage over Medium is entirely in card-play quality, not bidding/trump judgment.

**This heuristic is a deliberate v1 approximation**, arrived at through worked examples during brainstorming (see the design conversation for the specific hand traces this was calibrated against). It is expected to need revisiting once the 3-player ("gömmeli") and "eşli" (partnered) variants are built, since hand evaluation in a partnered game genuinely differs (a partner's likely holdings matter). Not a concern for this 4-player-individual sub-project, but flagged here so a future session doesn't assume this formula is final.

**Honor point scale** (adapted from the standard Bridge "high card points" convention, A=4/K=3/Q=2/J=1), split into trump and non-trump values:
- **Trump-suit honors:** full value — A=4, K=3, Q=2, J=1. A trump honor can only be beaten by a higher trump, never by any non-trump card, so it's fully reliable.
- **Non-trump honors:** discounted — A=2, K=1, Q=0, J=0. Only the Ace of a non-trump suit is a reasonably reliable winner (it's the top of that suit); the King, Queen, and Jack can be beaten by a higher card of that suit or ruffed once trump is established, so they're worth little to nothing toward the estimate.

**Step 1 — choose the trump suit:** the suit with the most cards in hand, full stop. Length is the primary and only factor in *which suit* becomes trump — a longer suit with weaker cards still wins over a shorter suit with strong honors (confirmed against both Turkish-language Batak strategy sources and general trick-taking strategy: trump length lets you ruff and control play regardless of rank, and a short "strong" suit that isn't trump can simply be beaten by trump). Honor points within tied-length suits break the tie.

**Step 2 — estimate hand strength:** `totalStrength = (trump suit's card count + trump-suit honor points) + (non-trump honor points summed across the other three suits, using the discounted scale)`. Convert to an estimated trick count with `estimatedTricks = round(totalStrength / 2)`, clamped to `[0, 13]`. Divisor chosen so a typical ~4-card-best-suit, ~10-total-honor-point hand (roughly `4 + 2.5 + discounted remainder ≈ 8` strength) estimates ~4 tricks, in the right range to often fall just short of the 5-bid floor — matching the real game's expectation that most hands pass and only above-average hands open the bidding.

**Step 3 — decide bid or pass:** if the estimated trick count is `>= max(5, currentHighestBid + 1)` (i.e., clears the auction's current legal minimum), bid the estimated trick count (capped at 13); otherwise pass.

`handStrength.ts` exports two functions consumed by both `medium.ts` and `hard.ts`:
```ts
function chooseTrumpSuit(hand: Card[]): Suit;
function estimateBidDecision(hand: Card[], currentHighestBid: number): { type: 'bid'; amount: number } | { type: 'pass' };
```

## 2. AI Strategies

Three files under `packages/engine/src/games/batak/ai/`, one `AIStrategy<BatakState, BatakMove>` each, matching Pişti's `ai/{easy,medium,hard}.ts` layout — but unlike Pişti's single-purpose files, Medium's and Hard's `chooseMove` now branch on `state.phase` internally, since each difficulty must handle all three move-producing phases (`bidding`, `trump-selection`, `playing`) through one `AIStrategy.chooseMove` entry point.

**`ai/easy.ts` — `batakEasyAI`:** pure uniform-random choice via the existing `pickRandom(legalMoves, rng)` utility, regardless of phase. Identical pattern to `pistiEasyAI` — `pickRandom` doesn't care what shape `BatakMove` is, so no phase-branching is needed here at all.

**`ai/medium.ts` — `batakMediumAI`:**
- `phase === 'bidding'`: call `estimateBidDecision(hand, state.highestBid)` and return its result directly as the move. `estimateBidDecision`'s output shape already matches `BatakMove`'s `bid`/`pass` variants, and its minimum-bid check (`Math.max(5, highestBid + 1)`) is identical to the rule engine's own — the heuristic can never produce a move outside `legalMoves`.
- `phase === 'trump-selection'`: call `chooseTrumpSuit` on the player's hand (read from `state.table.zones['hand-<playerId>'].cards`) and return `{ type: 'selectTrump', suit }`.
- `phase === 'playing'`: "win cheaply if you can, otherwise dump low." For each legal move, simulate appending its card to the current trick (`[...state.table.zones['trick'].cards, card]`) and check via `trickWinnerIndex` (exported from `rules.ts` for this reuse — see Section 3) whether that candidate card would be the winner if the trick ended right now. Among legal moves that would currently win, pick the lowest-ranked one (win as cheaply as possible). If none would currently win (including the leading case, where nothing "currently wins" by definition since the trick is empty), pick the lowest-ranked legal move (dump/lead low).

**`ai/hard.ts` — `batakHardAI`:**
- `phase === 'bidding'` and `phase === 'trump-selection'`: identical to Medium — calls the exact same `estimateBidDecision`/`chooseTrumpSuit` functions. Hard AI does not out-bid or out-choose-trump Medium AI; its edge is entirely in card play.
- `phase === 'playing'`: `minimaxChooseMove` with `maxDepth: 4` (deep enough to fully read out the rest of the current trick — up to 4 remaining plays — but not beyond it, since Batak's card-play branching factor is far larger than Pişti's and searching multiple tricks ahead is not computationally justified without profiling), `evaluate: (s) => calculateScore(s)[playerId] - (sum of the other three players' scores)` — the same "everyone else is my adversary" simplification already used by Pişti's 4-player Hard AI evaluate function. `calculateScore` is safe to call mid-hand for this purpose: `tricksWon` updates incrementally as tricks resolve, so the evaluation is meaningful even before the hand finishes, exactly like Pişti's Hard AI relied on `calculateScore` working mid-search.

## 3. `rules.ts` Export Addition

`trickWinnerIndex` (currently a module-private helper in `packages/engine/src/games/batak/rules.ts`) needs to be exported so `ai/medium.ts` can reuse it for the "would this card currently win the trick" check, rather than reimplementing the same highest-trump-else-highest-led-suit resolution logic a second time in the AI layer (the exact kind of duplication this session's RuleEngine review cycles were repeatedly vigilant about). This is a one-line visibility change (`function` → `export function`), not a behavior change — `rules.ts`'s existing tests are unaffected.

## 4. Registration

- **`packages/engine/src/games/batak/index.ts`** (new) — builds `batakDescriptor: GameDescriptor<BatakState, BatakMove>` (`id: 'batak'`, `displayName: 'Batak'`, `category: 'trick-taking'` — already a valid `GameCategory` member, no registry change needed, unlike Pişti's one-time `'fishing'` addition — `minPlayers: 4`, `maxPlayers: 4`, `ruleEngine: batakGame`, `aiStrategies: { easy: batakEasyAI, medium: batakMediumAI, hard: batakHardAI }`) and calls `registerGame(batakDescriptor)` as an import side effect, mirroring Pişti's `index.ts` exactly.

## 5. Testing

**`ai/handStrength.test.ts`:** `chooseTrumpSuit` picks the longest suit (including the worked "5 weak spades beats 2-card A+J hearts" and "5 weak spades beats 4-card AKQJ hearts" cases from the design conversation, both resolving to spades purely on length), and breaks ties between equal-length suits by honor points. `estimateBidDecision` bids when the estimate clears the current minimum and passes when it doesn't; trump-suit honors score higher than the same ranks would in a non-trump suit (verifying the discount is actually applied, not just present in the spec prose).

**`ai/easy.test.ts`:** always returns one of the given legal moves, across a few RNG seeds and phases (bid, trump-selection, play).

**`ai/medium.test.ts`:** bidding/trump-selection delegate to the shared heuristic (same output as calling `handStrength.ts` directly on the same hand); card play picks a cheap winning card in a hand-crafted scenario where one legal card would win and a cheaper one exists among the winners, and dumps the lowest legal card when no legal card would currently win.

**`ai/hard.test.ts`:** bidding/trump-selection match Medium's choice on the same hand (proving the code path is genuinely shared, not just similarly-behaving); card play picks the trick-locally-optimal card in a hand-crafted scenario designed so a depth-4 search finds a non-obvious correct answer that a purely greedy one-ply heuristic would miss (mirroring how Pişti's Hard AI test distinguished itself from Medium's).

**`index.test.ts`:** imports the module and asserts `getGame('batak')` returns a descriptor with the expected `id`/`category`/`minPlayers`/`maxPlayers`/`ruleEngine`/`aiStrategies` shape.

**`simulate.test.ts`:** 500 easy-vs-easy-vs-easy-vs-easy games (`{ p1: batakEasyAI, p2: batakEasyAI, p3: batakEasyAI, p4: batakEasyAI }`), asserting all 500 complete a full 4-player hand (bidding through 13 tricks through scoring) without a card-conservation invariant violation. Then 200 mixed-strength games (`{ p1: batakHardAI, p2: batakEasyAI, p3: batakEasyAI, p4: batakEasyAI }`, `setupOptions.players: ['p1','p2','p3','p4']`), asserting `winCounts['p1']` is meaningfully above the 25% pure-chance baseline for a 4-player free-for-all — `toBeGreaterThan(70)` out of 200 (>35%), the 4-player analogue of Pişti's 120/200 (60%) threshold in its 2-player context.

## Out of Scope (Deferred to a Later Sub-Project)

- The mobile UI/screen for Batak, and the app-layer AI invocation glue (thinking delay, etc.) — app-layer wiring belongs with the UI sub-project.
- Actual on-device frame-timing profiling of Hard AI's bounded minimax search — expected to be cheap given the depth-4/current-trick-only bound, but not measured yet; reuse the benchmark methodology already established for Pişti's Hard AI (time the real `chooseMove` call via compiled `dist`, across many simulated hands) once this exists.
- The 3-player ("gömmeli") and "eşli" (partnered) variants, including whatever hand-strength heuristic adjustments they turn out to need (flagged in Section 1).
- Revisiting `handStrength.ts`'s specific point values/calibration divisor based on real play feel — this is a first, reasoned pass, not a tuned-and-validated formula.

## Next Step

Brainstorm and plan the Batak mobile UI sub-project, building on `batakGame` and the three `AIStrategy` implementations from this plan — at which point Batak becomes fully playable end-to-end, mirroring how Pişti's UI sub-project followed its own AI sub-project.
