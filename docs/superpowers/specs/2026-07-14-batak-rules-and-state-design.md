# Batak (4-Player Individual): Rules & State Design

**Status:** Approved
**Date:** 2026-07-14
**Scope:** The authoritative rules reference for 4-player individual Batak as implemented in this app, plus the `GameState`/`Move` data model it will be built on. Does not include the `RuleEngine`/`AIStrategy` implementation, AI difficulty tiers, UI, or tests — those are separate sub-projects that follow this one, per the same research → rules doc → state design → rule engine → UI → AI → tests → simulate order used for Pişti.

## Context

Batak is the next game in the build order, inserted ahead of Klondike Solitaire at the user's explicit direction (Batak is not on the original roadmap list — Spades, its closer relative, is). The user asked for three variants: 3-player, 4-player individual (free-for-all), and 4-player "eşli" (partnered). Per the incremental pattern Pişti itself followed in practice (2-player first, then 4-player free-for-all added later, then partner mode added later still — each its own dated spec/plan), this spec covers **4-player individual only**. The 3-player "gömmeli" (buried-kitty) variant and eşli partnership are deliberately deferred to their own follow-up sub-projects once this vertical slice (rules → engine → AI → UI → tests) is fully working end-to-end.

Turkish Batak rules vary meaningfully by app/region (bid minimums, whether trump is hidden, exact scoring formulas). Initial research drew on [GameRules.com's Batak page](https://gamerules.com/rules/batak/), [pagat.com's Turkey card games overview](https://www.pagat.com/national/turkey.html), and [Çiftokey's İhaleli Batak rules](https://www.ciftokey.com/kurallar-ihaleli-batak.htm), but the final ruleset below — especially bidding minimums, the forced-contract-on-all-pass value, and the scoring formula — was corrected and confirmed directly by the user against their own knowledge of the game, and that direct confirmation is the authoritative source where it differs from the web research.

**Decisions made during brainstorming (not re-litigated here):**
- 4 players only for this build. 3-player (kitty) and eşli (partnership) are explicitly out of scope, to be added as separate future sub-projects.
- Single hand only. One deal, one auction, one round of trick-taking, score computed, a winner declared. Real Batak is played as a multi-hand match to a cumulative target score (the user mentioned 101 as an example target); that meta-layer — along with the bid-13 ("Draw") instant-match-win rule, which only makes sense in that context — is explicitly deferred to a future match-layer sub-project. This hand's result reports tricks won and per-hand score as normal; nothing special happens for a 13-trick sweep in this scope.
- No hidden trump ("gizli koz"). Trump is always chosen openly by the bid winner. Hidden trump is a real, documented variant, deliberately deferred.

## 1. Rules

**Deck & deal:** One standard 52-card deck (no jokers), shuffled with the seeded `RNG`. 13 cards dealt to each of the 4 players. Rank order within a suit: A (high) > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2 (low).

**Bidding (auction):** Turn-based, starting with player index 0 (seating order, per `players` array order). Each player in turn either bids an integer strictly higher than the current highest bid (first bid must be ≥ 5, maximum 13 — a bid of 13 is called "Draw") or passes. Once a player passes, they are out of the auction for the rest of this hand and get no further turns in it. The auction ends when exactly one un-passed player remains; that player becomes the **bid winner**, and their bid becomes the **contract**. If all 4 players pass (only possible if player 0 passes on their very first turn, since once anyone bids there is always at least one active bidder left when the others pass), the contract is forced to **4** and player 0 becomes the bid winner.

**Trump selection:** The bid winner openly picks one of the 4 suits as trump.

**Trick play:** The bid winner leads the first trick; thereafter, whoever won the previous trick leads the next. A player must follow the led suit if able, and — while following suit — must play a card **higher** than the current highest card of that suit already in the trick, if they hold one (mandatory raise; this is a genuine Batak-specific rule, distinct from Spades/Bridge which don't require overtaking). If a player is void in the led suit, they may play trump freely, or discard any other card — but a trump card may only be **led** once trump has been "broken" (played earlier in the hand as a non-lead card) or the leader's hand contains only trump cards.

**Trick winner:** The highest trump card played wins the trick if any trump was played; otherwise the highest card of the led suit wins. The trick's cards go to the winner's won-pile, and the winner leads the next trick.

**Scoring** (computed once, at the end of the single hand — no ×10 multiplier; raw trick counts):
- Bid winner: tricks won ≥ contract → score = tricks won (the actual count, which can exceed the contract). Tricks won < contract → score = `-contract`.
- Every other player: tricks won = 0 → score = `-contract` (a universal "bust" rule — every player must win at least one trick, not just the bidder). Otherwise → score = tricks won.

**Winner:** The player(s) with the highest score once the hand is finished (an array to allow a tie, per the shared `RuleEngine` contract's `determineWinner` shape).

## 2. Data Model

### Zones (`TableState.zones`)

| Zone id | faceUp | Contents |
|---|---|---|
| `hand-<playerId>` (×4) | `true` | Each player's hand |
| `trick` | `true` | Cards played so far in the current in-progress trick |
| `won-<playerId>` (×4) | `true` | Cards from tricks each player has won so far |

No `stock` zone: the entire deck is dealt upfront, and there is no draw pile or redeal.

**Note on `currentTrick` vs. the `trick` zone:** a `Zone` (`packages/engine/src/core/table.ts`) has no per-card player metadata, only an ordered `Card[]`. Trick-winner determination and the mandatory-raise rule both need to know *who* played *which* card, in order — that can't be recovered from the `trick` zone's contents alone, so it's tracked as an explicit state field (`currentTrick`, below), mirroring how Pişti's `lastCapturedBy`/`pistiBonusPoints` captured facts not recoverable from zone contents.

### State

Extends the shared `GameState` (`packages/engine/src/rules/types.ts`):

```ts
interface BatakState extends GameState {
  phase: 'bidding' | 'trump-selection' | 'playing' | 'finished';
  bids: Record<PlayerId, number | 'pass' | null>; // null = hasn't acted this auction yet
  highestBid: number;
  contract: number | null;       // finalized once bidding ends
  bidWinner: PlayerId | null;
  trumpSuit: Suit | null;
  trumpBroken: boolean;
  currentTrick: Array<{ playerId: PlayerId; cardId: string }>;
  trickLeader: PlayerId | null;
  tricksWon: Record<PlayerId, number>;
}
```

### Move

```ts
type BatakMove =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'play'; cardId: string };
```

### Setup options

```ts
interface BatakSetupOptions {
  players: [PlayerId, PlayerId, PlayerId, PlayerId];
}
```

## 3. Rank Comparison

Batak needs "is rank X higher than rank Y" for both the mandatory-raise rule and trick-winner determination. `packages/engine/src/core/ranking.ts` already has exactly this, as a generic, unused-until-now Phase 1 primitive: `createRankComparator(order: Rank[]): (a: Rank, b: Rank) => number`. No new shared core primitive is needed — `games/batak/` just calls `createRankComparator` with an explicit ace-high rank order array (`['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']`).

## 4. Algorithm Summary

This section describes intended behavior at a conceptual level to guide the rule-engine sub-project; it is not implementation code.

**`setup(options, rng)`:**
1. Shuffle a single 52-card deck (`createDeck`, no jokers).
2. Deal 13 cards to each `hand-<playerId>`.
3. Initialize `phase: 'bidding'`, `bids` all `null`, `highestBid: 0`, `contract: null`, `bidWinner: null`, `trumpSuit: null`, `trumpBroken: false`, `currentTrick: []`, `trickLeader: null`, `tricksWon: { ...0 for each player }`, `status: 'in-progress'`, `currentPlayerIndex: 0`.

**`getLegalMoves(state, playerId)`** branches on `phase`:
- `'bidding'`: only for the current active (not-yet-passed) player — `{ type: 'pass' }`, plus one `{ type: 'bid', amount }` per integer in `[max(5, highestBid + 1), 13]`.
- `'trump-selection'`: only for `bidWinner` — one `{ type: 'selectTrump', suit }` per suit.
- `'playing'`: for the current player —
  - If leading (`currentTrick` is empty): all hand cards, excluding trump-suit cards unless `trumpBroken` is `true` or the hand contains only trump cards.
  - If following and holding cards of the led suit: cards of that suit ranked higher than the trick's current-highest led-suit card, if any such cards exist (mandatory raise); otherwise, all cards of the led suit.
  - If void in the led suit and holding no trump: any card in hand.
  - If void in the led suit and holding trump: trump only (mandatory trump); if any trump has already been played to the trick, trump ranked higher than the trick's current-highest trump, if any such trump exists (mandatory overtrump/rise), otherwise any trump in hand. **Corrected 2026-07-16** — the original version of this doc said "any card in hand" when void in the led suit, which omitted the mandatory-trump/overtrump rule; fixed directly in `playingLegalMoves` (`packages/engine/src/games/batak/rules.ts`) per explicit user correction, mirroring the same "trace to a specific game rule" correction pattern as the bidding/scoring rules noted at the top of this doc.

**`performMove(state, move)`:**
1. `bid`/`pass`: record the choice in `bids` (and `highestBid` if a bid), advance `currentPlayerIndex` to the next active (non-passed) player. After recording, if exactly one active bidder remains: finalize `contract`/`bidWinner` from that player's last bid, set `phase: 'trump-selection'`. If zero remain (everyone passed): set `contract: 4`, `bidWinner: players[0]`, `phase: 'trump-selection'`.
2. `selectTrump`: set `trumpSuit`, `phase: 'playing'`, `trickLeader` and `currentPlayerIndex` to the bid winner.
3. `play`: move the card from hand to the `trick` zone, append `{ playerId, cardId }` to `currentTrick`. If the card is trump-suited, set `trumpBroken: true`. Advance `currentPlayerIndex` to the next seat. Once `currentTrick.length === 4`: determine the winner (highest trump if any was played, else highest card of the led suit), `moveAllCards(table, 'trick', 'won-<winner>')`, increment `tricksWon[winner]`, set `trickLeader`/`currentPlayerIndex` to the winner, clear `currentTrick`. If all hands are now empty (13 tricks completed): set `phase: 'finished'`, `status: 'finished'`.

**`calculateScore(state)`:** Per the Section 1 formula — bid winner scores actual tricks won if ≥ contract else `-contract`; every other player scores actual tricks won, or `-contract` if they took zero tricks.

**`determineWinner(state)`:** Returns `null` unless `gameOver(state)`; otherwise the player id(s) with the maximum score from `calculateScore`.

**`gameOver(state)`:** `state.status === 'finished'`.

## Out of Scope (Deferred to Later Sub-Projects)

- The actual `RuleEngine<BatakState, BatakMove>` and `AIStrategy` implementations (Easy/Medium/Hard).
- UI/screen for Batak.
- Tests, including the `simulateGames` card-conservation checks and AI win-rate checks.
- Multi-hand match play to a target score, the bid-13 ("Draw") instant-match-win rule, dealer rotation.
- The 3-player "gömmeli" (buried-kitty) variant.
- The 4-player "eşli" (partnered) variant, including partner-hand reveal.
- Hidden trump ("gizli koz").

## Next Step

Brainstorm and plan the `RuleEngine`/`AIStrategy` implementation sub-project against this spec.
