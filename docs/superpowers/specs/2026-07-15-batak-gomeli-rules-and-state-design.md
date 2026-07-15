# Batak (3-Player "Gömmeli" / Buried-Kitty): Rules & State Design

**Status:** Approved
**Date:** 2026-07-15
**Scope:** The authoritative rules reference for the 3-player "gömmeli" (buried-kitty) Batak variant, plus the diff to `BatakState`/`BatakMove`/`BatakSetupOptions` it will be built on. Does not include the `RuleEngine` implementation, AI adjustments, or UI — those are separate follow-up sub-projects, per the same incremental pattern the 4-player build used (rules doc → rule engine → AI → UI).

## Context

4-player individual Batak (`docs/superpowers/specs/2026-07-14-batak-rules-and-state-design.md`) is complete and merged. Per that spec's explicitly deferred scope, this sub-project adds the 3-player "gömmeli" variant — a 4-card buried kitty that the bid winner exchanges cards with after selecting trump. The 4-player "eşli" (partnered) variant remains deferred to its own future sub-project.

All rule values below (bid floor, forced-all-pass contract, bust threshold, kitty mechanics and visibility) were specified directly by the user, correcting/extending the 4-player baseline rather than drawn from web research.

**Decision made during brainstorming (not re-litigated here):** this variant extends the existing `batak` game (same `gameId`, same `RuleEngine`/registration) rather than becoming a new registered game — mirroring how Pişti's 4-player and partner modes were added to the same `pisti` id via generalized setup options, not new game entries. `BatakSetupOptions.players` becomes `PlayerId[]` (was a fixed 4-tuple), and every variant-specific rule below derives from `players.length === 3` vs. `4`.

## 1. Rules

**Deck & deal:** One standard 52-card deck. 4 cards are set aside face-down as the **kitty**; the remaining 48 are dealt **16 to each of the 3 players** (16 tricks this hand). Rank order unchanged (A high ... 2 low).

**Bidding (auction):** Same turn-based structure as 4-player (start at player index 0, bid strictly higher than current highest or pass, passing exits the auction for the hand). First bid must be **≥8**, maximum bid **16** (a bid of 16 claims every trick — the "Draw" analog, scaled to 16 tricks instead of 13; multi-hand-match rules for a 16-bid, like the 4-player "Draw" rule, remain out of scope of single-hand play). If all 3 players pass, the contract is forced to **7** and player 0 becomes bid winner (mirrors the 4-player forced-contract mechanic exactly, just with different constants).

**Trump selection:** The bid winner picks trump **before** the kitty exchange, based on their original 16-card hand — unchanged mechanically from 4-player, just earlier in the sequence relative to the new step below.

**Kitty exchange (new phase, gömmeli only):** Immediately after trump is selected:
1. The kitty's 4 cards move into the bidder's hand (20 cards total). This is revealed to every player, not just the bidder.
2. The bidder buries any 4 cards of their choosing back to a hidden pile. No restrictions on which cards may be buried. This discard is *not* revealed to the other players.

Hand returns to 16 cards; trick play then begins with the bidder leading.

**Note on visibility:** the `RuleEngine`/`AIStrategy` contracts are omniscient over `GameState` (no per-player state views exist anywhere in this codebase — see `packages/engine/src/rules/types.ts`), the same way opponent hands are already always fully present in state and simply not rendered face-up to the human player in the UI. "Revealed" vs. "hidden" here describes what the **UI** should show a human player who isn't the bidder; it is a UI-layer concern, not an engine-state concern, and is deferred to the future UI sub-project. The rules/state model captures which cards *were* the kitty (`kittyCardIds`, below) so a future UI has the information needed to honor this distinction.

**Trick play, trick winner:** Unchanged from 4-player — mandatory raise when following suit, trump can only be led once broken (or the leader holds only trump), highest trump (else highest led-suit card) wins the trick.

**Scoring:** Same shape as 4-player, with the universal "bust" threshold changed from *0 tricks* to **fewer than 2 tricks**:
- Bid winner: tricks won ≥ contract → score = tricks won. Tricks won < contract → score = `-contract`.
- Every other player: tricks won < 2 → score = `-contract`. Otherwise → score = tricks won.

(The bust threshold is redundant for the bid winner specifically — contract is always ≥8, comfortably above the 2-trick bust line, so a bidder failing the bust check always also fails their contract and gets the same `-contract` result either way. Stated once as a shared, derived constant rather than duplicated per-role, same as the 4-player spec's "universal" framing.)

**Winner:** Unchanged — player(s) with the highest score, ties allowed.

## 2. Derived Constants

Everything variant-specific reduces to `players.length`, mirroring how Pişti's team/seat logic already derives from player count rather than branching on an explicit mode flag:

| Constant | 4-player | 3-player (gömmeli) |
|---|---|---|
| Hand size / tricks per hand | 13 | 16 |
| Kitty size | 0 | 4 |
| Bid floor | 5 | 8 |
| Max bid | 13 | 16 |
| Forced-all-pass contract | 4 | 7 |
| Bust threshold (tricks) | <1 (i.e. 0) | <2 |

## 3. Data Model

### Zones (`TableState.zones`)

Adds two zones, present only when `players.length === 3`:

| Zone id | faceUp | Contents |
|---|---|---|
| `kitty` | `false` | The 4 buried-kitty cards, from setup until the trump→kitty-exchange transition moves them into the bidder's hand |
| `buried` | `false` | The bidder's 4 discarded cards, from the `bury` move until the hand ends |

All existing zones (`hand-<playerId>`, `trick`, `won-<playerId>`) are unchanged, just instantiated per-player over a 3-element `players` array instead of 4.

### State

Diff against the existing `BatakState` (`packages/engine/src/games/batak/types.ts`):

```ts
interface BatakState extends GameState {
  phase: 'bidding' | 'trump-selection' | 'kitty-exchange' | 'playing' | 'finished'; // + 'kitty-exchange'
  // ...all existing fields unchanged (bids, highestBid, contract, bidWinner, trumpSuit,
  // trumpBroken, currentTrick, trickLeader, tricksWon)...
  kittyCardIds: string[] | null; // new — snapshot of the 4 kitty card ids, set at the trump→kitty-exchange
                                  // transition; null for 4-player games and before that transition
}
```

`'kitty-exchange'` and `kittyCardIds` are simply unused (`null`/never entered) in 4-player games — no new branching is needed in the existing 4-player-only code paths beyond the derived-constants table above.

### Move

Adds one variant:

```ts
type BatakMove =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'bury'; cardIds: [string, string, string, string] } // new
  | { type: 'play'; cardId: string };
```

### Setup options

```ts
interface BatakSetupOptions {
  players: PlayerId[]; // was [PlayerId, PlayerId, PlayerId, PlayerId] — now 3 or 4 elements
}
```

## 4. Algorithm Summary (Diff Against the 4-Player Implementation)

Describes intended behavior to guide the future rule-engine sub-project; not implementation code. References `packages/engine/src/games/batak/rules.ts` as it exists today.

**`makeEmptyTable` / `setup`:**
- When `players.length === 3`: also create a `kitty` zone and a `buried` zone. Deal 16 cards to each `hand-<playerId>` (not 13) and 4 cards to `kitty`, from the same single shuffled 52-card deck.
- All bid-floor/max-bid/forced-contract magic numbers (currently hardcoded `5`, `13`, `4` in `biddingLegalMoves`, `validateMove`'s `'bid'` case, and the all-passed branch of `performMove`) become lookups against the Section 2 table, keyed on `players.length`.
- `kittyCardIds: null` added to initial state.

**`getLegalMoves`** gains a `'kitty-exchange'` branch: only for `state.bidWinner`, exactly one legal move per possible 4-card combination of their current (20-card) hand — `{ type: 'bury', cardIds: [...] }`. (Implementation note for the future rule-engine sub-project: enumerating all C(20,4) = 4845 combinations as literal legal-move objects is likely the wrong approach for `getLegalMoves`'s existing consumers, e.g. AI/simulation; validating the move shape directly in `validateMove` — 4 distinct card ids, all present in the bidder's hand — instead of exhaustive enumeration is worth considering, to be resolved when that sub-project is planned.)

**`performMove`:**
- `selectTrump`, when `players.length === 3`: after setting `trumpSuit`, additionally move all of `kitty`'s cards into `hand-<bidWinner>` (`moveAllCards`), set `kittyCardIds` to the ids of the cards that were just moved, and set `phase: 'kitty-exchange'` instead of `'playing'`. `trickLeader`/`currentPlayerIndex` are *not* yet set to the bidder here (trick play hasn't started).
- New `bury` case: move the 4 named cards from `hand-<bidWinner>` to `buried` (4 individual `moveCard` calls, or a small helper), set `phase: 'playing'`, `trickLeader` and `currentPlayerIndex` to the bidder — this replaces the role `selectTrump`'s tail currently plays in the 4-player flow.
- `selectTrump`, when `players.length === 4`: unchanged (goes straight to `'playing'`, sets `trickLeader`/`currentPlayerIndex` to the bidder, exactly as today).
- Trick-taking (`'play'` case) and the hand-empty → `'finished'` check are otherwise unchanged — `buried` and any residual `kittyCardIds` are simply never touched again once play starts.

**`calculateScore`:** The non-bidder branch's `tricks === 0 ? -contract : tricks` becomes `tricks < bustThreshold ? -contract : tricks`, where `bustThreshold` is looked up from Section 2 (`1` for 4-player — identical behavior to today — `2` for 3-player gömmeli).

**`determineWinner`, `gameOver`:** Unchanged.

## Out of Scope (Deferred to Later Sub-Projects)

- The actual `RuleEngine` changes implementing this diff (including resolving the `getLegalMoves`-for-`bury` enumeration question raised in Section 4), and any AI-strategy adjustments (bidding/kitty-exchange decisions for Easy/Medium/Hard).
- UI for the 3-seat table, kitty reveal/hide presentation, and the bury interaction.
- Tests, including `simulateGames` card-conservation checks extended to cover `kitty`/`buried` zones.
- The 4-player "eşli" (partnered) variant.
- Multi-hand match play, the bid-16 ("Draw") instant-match-win rule, dealer rotation — same deferred status as in the 4-player spec.

## Next Step

Brainstorm and plan the `RuleEngine` implementation sub-project against this spec (including resolving the `bury` legal-move-enumeration question flagged in Section 4).
