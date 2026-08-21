# Pis Yedili: Rules & State Design

**Status:** Approved
**Date:** 2026-08-21
**Scope:** The authoritative rules reference for Pis Yedili as implemented in this app, plus the `GameState`/`Move` data model it will be built on. Does not include the `RuleEngine`/`AIStrategy` implementation, AI difficulty tiers, UI, or tests — those are separate sub-projects that follow this one, per the same research → rules doc → state design → rule engine → AI → UI → tests → simulate order used for Pişti and Batak.

## Context

Pis Yedili ("Dirty Sevens") is next in the build order per `docs/status/roadmap.md` (Pişti → Batak → **Pis Yedili** → Klondike Solitaire → ...). Its brainstorming had previously been paused mid-flow, before rules-sourcing was decided, when a UI review pass took priority. This spec resumes and completes that brainstorming.

Unlike Batak (whose rules, while variable by region, are at least documented in multiple places), Pis Yedili has **no single written ruleset** — a Turkish forum thread on the game states this outright ("pis yedilinin yazılmış bir kuralı yok"), and even the draw penalty for playing a seven is disputed among players (2 vs. 3 cards, with or without stacking). Initial research drew on multiple Turkish-language sources ([sabah.com.tr](https://www.sabah.com.tr/yasam/pis-yedili-nasil-oynanir-pis-yedili-kurallari-neler-kac-deste-ve-en-az-kaç-kisi-oynanir-k1-6183022), [posta.com.tr](https://www.posta.com.tr/yasam/pratik-bilgiler/pis-yedili-nasil-oynanir-pis-yedili-oyun-kurallari-nelerdir-2647116), [donanimhaber forum thread on lesser-known rules](https://forum.donanimhaber.com/pis-yedili-iskambil-bilinmeyen-kurallar-dizisi--145333663), [realokey.com](https://realokey.com/blog/pis-yedili-nasil-oynanir-oyun-kurallari-ve-taktikleri/)), which agreed on the core shedding-game shape but left several mechanics ambiguous or undocumented. The user asked for research-driven proposals rather than dictating rules themselves, and approved the synthesized ruleset and the resulting state/move design below, including the parts explicitly flagged as inventions where sources were silent.

**Decisions made during brainstorming (not re-litigated here):**
- 2–4 players, free-for-all only. No partnership/team mode — no source describes teams for this game, and it keeps scope tight for a first build (matches Pişti's original 2-player-first, then-expand pattern).
- Single 52-card deck (no jokers), regardless of player count. Multi-deck variants for 5+ players are a real house-rule but explicitly out of scope.
- Single hand only. First player to empty their hand wins; no cumulative scoring across hands, no points-based scoring at all (this game has no scoring formula in any source — it's win/lose by hand-emptying, unlike Batak).
- AI difficulty tiers: Easy = random legal move (`weightedRandom`-style), Medium = heuristics (hold 7s/Jacks defensively, prefer rank-matches that conserve suit diversity), Hard = minimax-style lookahead via `packages/engine/src/ai/minimax.ts`, matching the Pişti/Batak pattern. Actual AI implementation is a later sub-project; noted here only to record the decision.
- "Tek" (last-card declaration) has no described penalty for failing to declare it in any source, unlike Uno's "catch" mechanic — modeled as a **UI-only signal**, not an engine rule (see State section).
- Stock-pile reshuffle-when-empty is **not** in any source but is necessary for playability given "players may draw as many cards as they want" — flagged as an original addition, approved by the user alongside the rest of the design.

## 1. Rules

**Deck & deal:** One standard 52-card deck (no jokers), shuffled with the seeded `RNG`. 7 cards dealt to each of 2–4 players. Remaining cards form a face-down `stock` (draw pile). No card ranking/order matters beyond matching suit or rank — there is no trick-taking or card "beats" relationship in this game.

**Determining the starting player:** After dealing, scan all hands for clubs (♣, *sinek*). If any player holds one, whoever holds the lowest club starts. If nobody was dealt a club (common at 2 players, where only 14 of 52 cards are dealt), player 0 (seating order) starts by default.

**Opening the game:** The starting player's first move must be playing a club. If they don't already hold one (the player-0 fallback case, or in principle any case where their one club later leaves their hand before their turn — not otherwise possible before their first move), they must draw from `stock`, repeatedly, on their own turn, until they hold a club — turn does not rotate to other players during this: the sourced rule describes a single designated player drawing until they get the required card, not other players taking turns to help.

**Turn play (once the game is open):** Play proceeds player-array order (counterclockwise, matching the existing engine convention of `currentPlayerIndex` incrementing through `players`). A player must play a card matching the discard pile's active suit or rank, or:
- **Jack (Vale):** wild — always playable regardless of the active suit/rank, and requires declaring the next suit to match (`declaredSuit`). Skips the next player's turn.
- **Seven:** the "dirty" card — always playable regardless of match, and forces the next player to draw 2 cards. Consecutive sevens stack: each stacked seven adds 2 to the total the next non-seven-playing player must eventually draw.
- No other rank (8, King, Ace, etc.) has any special effect in any source consulted — a real finding, not a research gap.

A player with no legal `play` may instead `draw` from `stock` any number of times in succession (choosing after each draw whether to draw again, play, or — once truly unable — pass). A player facing an active seven-penalty (`pendingDraw > 0`) may instead play a seven of their own to add to and pass on the penalty, rather than drawing.

**"Tek" declaration:** when a player's hand drops to exactly one card, they must announce "tek." No source describes any rule consequence for failing to announce it (no equivalent of Uno's "catch" penalty) — so this is UI-only (see State section), not an engine-level rule.

**Winning:** the first player to empty their hand wins the game. No scoring beyond win/lose — this game has no points formula in any source.

## 2. Data Model

### Zones (`TableState.zones`)

| Zone id | faceUp | Contents |
|---|---|---|
| `hand-<playerId>` (×2–4) | `true` | Each player's hand |
| `discard` | `true` | Cards played so far, in play order (last = current top/active card) — starts **empty** |
| `stock` | `false` | Face-down draw pile |

**Note on `discard` starting empty:** unlike a typical Crazy-Eights-style game that flips one card face-up to start, Pis Yedili's opening move *is* the first discard — the starting player plays a club as their literal first move, which becomes `discard`'s first (and, at that point, only) card. There is no separate "flip a starter card" setup step.

### State

Extends the shared `GameState` (`packages/engine/src/rules/types.ts`):

```ts
interface PisYedeliState extends GameState {
  activeSuit: Suit | null;  // suit that must be matched next; null only before the game opens (discard empty)
  pendingDraw: number;      // cards the current player owes from stacked 7s; 0 = no penalty active
}
```

`activeSuit` is set to the actual suit of whatever card lands in `discard`, except when that card is a Jack — in which case it's set to the Jack's `declaredSuit` instead. Active *rank* matching doesn't need a state field: it's always just the rank of `discard`'s last card, directly readable from the zone.

No field is needed for "has the game opened yet" (derivable from `discard.cards.length === 0`) or for "tek" (UI-only, derived from `hand-<playerId>.cards.length === 1` directly by the mobile screen, not tracked in engine state at all).

### Move

```ts
type PisYedeliMove =
  | { type: 'play'; cardId: string; declaredSuit?: Suit } // declaredSuit required iff cardId is a Jack
  | { type: 'draw' }  // draws exactly one card from stock; does not by itself end the turn
  | { type: 'pass' }  // ends the turn with no play; only legal with no legal `play` and pendingDraw === 0
```

### Setup options

```ts
interface PisYedeliSetupOptions {
  players: PlayerId[]; // 2-4
}
```

## 3. Algorithm Summary

This section describes intended behavior at a conceptual level to guide the rule-engine sub-project; it is not implementation code.

**`setup(options, rng)`:**
1. Shuffle a single 52-card deck (`createDeck`, no jokers).
2. Deal 7 cards to each `hand-<playerId>`; remaining cards to `stock`. `discard` starts empty.
3. Scan hands for clubs; if any exist, find the lowest and set `currentPlayerIndex` to that player's seat. Otherwise `currentPlayerIndex: 0`.
4. Initialize `activeSuit: null`, `pendingDraw: 0`, `status: 'in-progress'`.

**`getLegalMoves(state, playerId)`** — only for the current player (`players[currentPlayerIndex]`); empty for everyone else:
- If `discard` is empty (game not yet opened): `{ type: 'play', cardId }` for each club in hand, if any; otherwise only `{ type: 'draw' }`. No `pass`.
- Else if `pendingDraw > 0`: `{ type: 'play', cardId }` for each seven in hand (stacking), plus `{ type: 'draw' }`. No `pass` (a player facing a penalty always has the option to draw it down).
- Else: `{ type: 'play', cardId }` for each card matching `activeSuit` or `discard`'s top rank, plus every Jack in hand (each expanded to one candidate move per possible `declaredSuit`), plus every seven in hand; plus `{ type: 'draw' }` always available (voluntary draw); plus `{ type: 'pass' }` only if no `play` move exists above.

**`performMove(state, move)`:**
1. `play`: move the card from the current player's hand to `discard`. Set `activeSuit` to the card's own suit, or to `declaredSuit` if the card is a Jack. If the card is a seven, add 2 to `pendingDraw`; otherwise if `pendingDraw > 0` (only reachable via a stacking seven-play, since sevens are the only legal play while a penalty is active) leave it as just modified. Advance `currentPlayerIndex`: by 2 (skip one) if the card was a Jack, by 1 otherwise. If the hand just emptied: `status: 'finished'`, record the winner.
2. `draw`: if `stock` is empty, reshuffle all of `discard` except its current top card back into `stock` (via the seeded `RNG`), leaving just the top card in `discard`. Move one card from `stock` to the current player's hand. If `pendingDraw > 0`, decrement it by 1. Turn does **not** advance — the same player continues (draw again, then play, or pass once no penalty remains and no legal play exists).
3. `pass`: advance `currentPlayerIndex` by 1. No other state change.

**`calculateScore(state)`:** Not applicable — this game has no points formula. Returns `0` for every player except the winner (kept only to satisfy the shared `RuleEngine` contract's shape).

**`determineWinner(state)`:** Returns `null` unless `gameOver(state)`; otherwise a single-element array holding the player whose hand emptied (no ties are possible in this game, but the shared `RuleEngine` contract's `PlayerId[] | null` shape is kept for consistency with every other game).

**`gameOver(state)`:** `state.status === 'finished'`.

## Out of Scope (Deferred to Later Sub-Projects)

- The actual `RuleEngine<PisYedeliState, PisYedeliMove>` implementation.
- AI strategies (Easy/Medium/Hard) — decisions recorded above, implementation deferred.
- UI/screen for Pis Yedili, including the "tek" badge.
- Tests, including `simulateGames` card-conservation checks.
- Partnership/team mode.
- Multi-deck variants for 5+ players.

## Next Step

Brainstorm and plan the `RuleEngine` implementation sub-project against this spec.
