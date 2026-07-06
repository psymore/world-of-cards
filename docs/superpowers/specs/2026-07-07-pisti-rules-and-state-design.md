# Pişti: Rules & State Design (Phase 2, Sub-Project 1)

**Status:** Approved
**Date:** 2026-07-07
**Scope:** The authoritative rules reference for Pişti as implemented in this app, plus the `GameState`/`Move` data model it will be built on. Does not include the `RuleEngine`/`AIStrategy` implementation, AI difficulty tiers, UI, or tests — those are separate sub-projects that follow this one, per the Phase 2 build order in `CLAUDE.md` (research rules → rules doc → game state design → rule engine → UI → AI → tests → simulate).

## Context

Pişti is the first real game built on the Phase 1 core architecture (`docs/superpowers/specs/2026-07-06-core-architecture-design.md`). This document fixes the game's rules and data shapes before any rule-engine code is written, so the implementation has a single unambiguous source of truth. Rules were confirmed against [GameRules.com's Pişti page](https://gamerules.com/rules/pisti/) and cross-checked scoring details via web search.

**Decisions made during brainstorming (not re-litigated here):**
- 2 players only for this build. A 4-player/2v2 team variant is a possible future phase, not built now; the design below doesn't specifically defend against a 4-player extension, but nothing here precludes one being added later.
- Single hand only. One deck dealt and played to exhaustion, score tallied, a winner declared. Real Pişti is often played as a multi-hand match to a target score (e.g. 151) — that meta-layer is explicitly out of scope and could be added later as an app/session-level feature without changing the rule engine.

## 1. Rules

**Deck & deal:** One standard 52-card deck (no jokers), shuffled with the seeded `RNG`. Deal 4 cards face-up to a shared center pile, 4 cards to each of the 2 players' hands, and the remaining 40 cards become a face-down stock.

**Deviation for determinism:** if any of the initial 4 center cards is a Jack, reshuffle the full deck and redeal from scratch, rather than the progressive "reveal cards one at a time until a non-Jack appears" some sources describe. Simpler to implement deterministically, and preserves the real rule's intent (a Jack should never be the pile's starting exposed card).

**Turns:** Players alternate playing exactly one card from hand onto the shared pile. Player 0 (the non-dealer, by convention) goes first. Whether a play captures the pile is fully automatic, not a separate decision the player makes:

- If the pile's current top card is a **Jack**, only another **Jack** can capture it. Any other played card is simply placed on top (the pile grows, the Jack stays buried but is no longer "top", so it loses its special protection once something is placed above it).
- Otherwise, a play **captures the entire pile** if the played card's rank matches the top card's rank, or if the played card is a Jack (Jacks capture anything).
- Otherwise, no capture happens — the card is placed on top of the pile.

Because the Jack-can-only-be-captured-by-Jack rule holds, a "lone Jack on the pile" can only ever be captured by another Jack — there is no case where a non-Jack card captures a lone Jack.

**Pişti bonus:** A capture that happens when the pile had **exactly 1 card** at the moment of capture earns a bonus:
- **10 points** — normal pişti (a non-Jack card capturing a lone non-Jack card of matching rank).
- **20 points** — "double pişti" (a lone Jack captured by another Jack).

No bonus is awarded for capturing a pile with 2+ cards, regardless of how it's captured.

**Redeals:** Whenever both players' hands become empty at the same time (this happens every 8 plays, since hands are dealt in lockstep and players alternate 1 card each), and the stock still has cards, deal 4 more cards to each hand (no more cards go to the center — only the initial deal does that). With a 52-card, 2-player game this divides evenly: 4 (center) + 4 + 4 (initial hands) + 5 × (4 + 4) (redeals) = 52. There is no partial-redeal case to handle for this configuration.

**End of hand:** Once the stock and both hands are empty, whoever made the **last successful capture** during the hand takes any cards still sitting on the pile. (If no capture ever happened during the entire hand — practically impossible but not provably impossible — those cards are simply left uncaptured and excluded from scoring.)

**Scoring** — for each player, summed from the cards in their captured pile plus their accumulated pişti bonus:
- 1 point per Ace captured.
- 1 point per Jack captured.
- 2 points for capturing the 2 of Clubs.
- 3 points for capturing the 10 of Diamonds.
- 3 points to whichever player captured strictly more cards overall (no bonus to either player if it's a 26–26 tie).
- Plus that player's accumulated pişti/double-pişti bonus points (10 or 20 per occurrence, accrued during play).

**Winner:** The player with the higher total score once the hand is finished (an array of player ids is returned to allow for a tie, per the shared `RuleEngine` contract's `determineWinner` shape).

## 2. Data Model

### Zones (`TableState.zones`)

| Zone id | faceUp | Contents |
|---|---|---|
| `stock` | `false` | Undealt cards |
| `pile` | `'top-only'` | The shared capture pile |
| `hand-<playerId>` (×2) | `true` | Each player's hand |
| `captured-<playerId>` (×2) | `true` | Cards each player has captured so far |

**Note on hand visibility:** `faceUp: true` on hand zones means the *data model* doesn't hide a player's hand from the other player/AI, even though a human player shouldn't see the AI's hand in the UI. This is consistent with the rest of the engine: `GameState` is always fully known to the pure functional core (so Hard AI lookahead can call `performMove` on hypothetical states without needing to simulate hidden information), and visibility is treated as a UI-layer rendering concern, not something the engine enforces.

### State

Extends the shared `GameState` (`packages/engine/src/rules/types.ts`) with two fields that can't be reconstructed after the fact purely from zone contents:

```ts
interface PistiState extends GameState {
  lastCapturedBy: PlayerId | null;
  pistiBonusPoints: Record<PlayerId, number>;
}
```

- `lastCapturedBy` is needed because, at end-of-hand, leftover pile cards go to whoever captured last — a fact not recoverable from the final zone contents alone.
- `pistiBonusPoints` is needed because the 10/20-point bonus depends on the pile's size *at the moment of capture*, which isn't recoverable from the final captured-zone contents either.

### Move

A single variant — capture outcome is automatic given the rules above, not a player choice:

```ts
type PistiMove = { type: 'play'; cardId: string };
```

### Setup options

```ts
interface PistiSetupOptions {
  players: [PlayerId, PlayerId];
}
```

## 3. Algorithm Summary

This section describes intended behavior at a conceptual level to guide the rule-engine sub-project; it is not implementation code.

**New shared core primitive required:** `moveAllCards(table, fromZoneId, toZoneId)` in `packages/engine/src/core/table.ts`, alongside the existing `moveCard`. Moves every card currently in one zone to another, preserving order. This is generic — any fishing-family capture game needs "take the whole pile" — so it belongs in shared core, not duplicated inside `games/pisti/`.

**`setup(options, rng)`:**
1. Shuffle a single 52-card deck.
2. Deal 4 cards to `pile`; if any is a Jack, reshuffle and retry.
3. Deal 4 cards to each `hand-<playerId>`.
4. Remainder becomes `stock`.
5. Initialize `lastCapturedBy: null`, `pistiBonusPoints: { [p0]: 0, [p1]: 0 }`, `status: 'in-progress'`, `currentPlayerIndex: 0`.

**`performMove(state, move)`:**
1. Move the played card from the current player's hand onto `pile`.
2. Using the pile's state *before* this play (top card and size), determine capture per the Section 1 rules.
3. If captured: `moveAllCards(table, 'pile', captured-<player>)`, set `lastCapturedBy` to the capturing player. If the pre-play pile size was exactly 1: add 20 points if that lone card was a Jack (only capturable by another Jack), or add 10 points if the played card's rank matched the lone card's rank (a non-Jack, same-rank capture) — a Jack capturing a lone non-Jack card via wildcard earns no bonus, per Section 1.
4. Advance `currentPlayerIndex` to the other player.
5. If both hands are now empty: redeal 4 cards to each from `stock` if any remain; otherwise, sweep any remaining `pile` cards to `captured-<lastCapturedBy>` and set `status: 'finished'`.

**`getLegalMoves(state, playerId)`:** One `{ type: 'play', cardId }` per card currently in `hand-<playerId>` — there is no additional legality constraint (any card in hand can always be played).

**`calculateScore(state)`:** Per player, sum the card-value bonuses (A/J = 1 pt each, 2♣ = 2 pts, 10♦ = 3 pts) found in `captured-<player>`, the 3-pt majority bonus (strict comparison of captured card counts, no bonus on a 26–26 tie), and that player's `pistiBonusPoints` entry.

**`determineWinner(state)`:** Returns `null` unless `gameOver(state)`; otherwise returns the player id(s) with the maximum score from `calculateScore`.

**`gameOver(state)`:** `state.status === 'finished'`.

## Out of Scope (Deferred to Later Sub-Projects)

- The actual `RuleEngine<PistiState, PistiMove>` and `AIStrategy` implementations (Easy/Medium/Hard).
- UI/screen for Pişti.
- Tests, including the `simulateGames` card-conservation checks and Hard-vs-Easy win-rate checks.
- Multi-hand match play to a target score, dealer rotation, and the 4-player/2v2 team variant.

## Next Step

Brainstorm and plan the `RuleEngine`/`AIStrategy` implementation sub-project against this spec.
