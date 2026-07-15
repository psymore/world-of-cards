# Batak Easy Difficulty: No AI Bidding + Guaranteed Strong Human Hand — Design

**Status:** Approved
**Date:** 2026-07-15
**Scope:** `packages/engine/src/games/batak/` (rule engine `setup()`, Easy AI) and a one-line wiring change in `apps/mobile/src/games/batak/BatakScreen.tsx`. Applies only to the 4-player free-for-all mode (the only Batak mode with a mobile UI today); written generically enough to also work for the 3-player gömmeli rule engine whenever its UI is built, but that wiring is out of scope here.

## Context

Two related requests, both aimed at making Easy difficulty genuinely easier and more learnable for a new player:

1. **Bug follow-up:** immediately prior to this spec, `batakEasyAI`'s bidding was changed from uniformly-random (any legal bid amount) to hand-strength-driven (`estimateBidDecision`, shared with Medium). The user now wants to go further for Easy specifically: bots should never competitively bid at all — the human should always be the one who ends up with the contract.
2. **New request:** on Easy difficulty, guarantee the human's opening hand is strong enough to comfortably win the bid and play the hand, via two AND'd requirements on the dealt 13-card hand:
   - **Honor requirement:** 2+ Aces, OR 3+ Kings, OR (1+ Ace AND 2+ Kings).
   - **Suit-concentration requirement:** some suit with 5+ cards in hand, OR some suit where all four of {A, Q, J, 10} are held.

Both apply only when playing against Easy bots. Medium/Hard games are unaffected by either change.

## 1. Bots Never Bid (Easy Only)

`batakEasyAI.chooseMove`'s `'bidding'` phase branch changes from `estimateBidDecision(hand, state.highestBid)` to an unconditional `{ type: 'pass' }`, regardless of hand or `state.highestBid`. Trump-selection (`chooseTrumpSuit`) and card-play (lowest-legal-card) branches are unchanged.

**Consequence, confirmed with the user:** the existing forced-all-pass rule (`rules.ts`) already assigns the contract to `state.players[0]` when every player passes, at the phase's `forcedContract` value (4 for 4-player). Since the mobile app always seats the human at `players[0]` (`BatakScreen.tsx`'s `HUMAN_ID` is placed first in the `players` array passed to `setup()`), this means: even if the human also passes, they are still forced into the contract rather than a bot ever picking it up. No new code is needed for this — it falls out of existing behavior. The practical effect is that in Easy mode, the human always ends up as `bidWinner`, whether by their own bid or by the forced-all-pass fallback.

## 2. Guaranteed Strong Opening Hand

### Option and target player

New optional field on `BatakSetupOptions`:

```ts
export interface BatakSetupOptions {
  players: PlayerId[];
  guaranteeStrongHand?: boolean;
}
```

When `true`, `setup()` guarantees `state.players[0]`'s dealt hand satisfies the predicate below. There is no separate "which player" option — `players[0]` is already the engine's existing convention for "the human seat" (it's also who the forced-all-pass rule targets), so reusing it keeps the convention in one place rather than introducing a second, potentially-inconsistent notion of "the human." When omitted or `false`, `setup()`'s behavior is byte-for-byte unchanged from today.

### Predicate

```ts
const HIGH_RANKS: Rank[] = ['A', 'Q', 'J', '10'];

function meetsHonorRequirement(hand: Card[]): boolean {
  const aces = hand.filter((c) => c.rank === 'A').length;
  const kings = hand.filter((c) => c.rank === 'K').length;
  return aces >= 2 || kings >= 3 || (aces >= 1 && kings >= 2);
}

function meetsSuitConcentrationRequirement(hand: Card[]): boolean {
  return SUITS.some((suit) => {
    const cardsInSuit = hand.filter((c) => c.suit === suit);
    if (cardsInSuit.length >= 5) return true;
    return HIGH_RANKS.every((rank) => cardsInSuit.some((c) => c.rank === rank));
  });
}

function meetsEasyModeHandRequirements(hand: Card[]): boolean {
  return meetsHonorRequirement(hand) && meetsSuitConcentrationRequirement(hand);
}
```

Both checks run against the human's actual dealt hand — there is no manual card assignment, so a single card can naturally count toward both requirements at once (e.g., an Ace that's also part of its suit's A/Q/J/10 set). These are private helpers in `rules.ts`, next to `setup()`, matching how `biddingLegalMoves`/`playingLegalMoves` are already organized in that file.

### Algorithm: reshuffle until it qualifies

`setup()`'s dealing step becomes a loop:

```ts
const { handSize, kittySize } = ruleConstants(players.length);
let deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);

if (opts.guaranteeStrongHand) {
  let attempts = 0;
  while (!meetsEasyModeHandRequirements(deck.slice(0, handSize)) && attempts < MAX_DEAL_ATTEMPTS) {
    deck = shuffle(deck, rng);
    attempts++;
  }
}

const { table } = dealToZones(deck, makeEmptyTable(players), [...]);
```

`deck.slice(0, handSize)` is exactly what `players[0]` will receive — confirmed from `dealToZones`'s implementation (`core/table.ts`), which deals sequentially from the front of the deck in assignment-array order, and `players[0]`'s hand zone is always the first assignment. This means the check can run before `dealToZones` is even called, with no need to build (and rebuild) the table each attempt.

`MAX_DEAL_ATTEMPTS = 10_000` is a safety valve, not a tuned value — a rough probability estimate puts the honor requirement around 35–45% of random hands and the suit-concentration requirement around 65–70%, so the joint (AND'd) predicate should typically succeed within single-digit attempts. If the cap is somehow hit, `setup()` proceeds with the last shuffle rather than hanging or throwing — this is expected to never actually happen in practice, but a real game must not infinite-loop or crash on a freak seed.

Each reshuffle reuses the same `RNG` (calling `shuffle` again advances its internal state), so retries stay fully deterministic given a seed, and no new RNG primitive is needed.

### Why reshuffle-until-qualifying over hand-construction

Rejected alternative: directly constructing a hand from qualifying cards (pick 2 Aces, pick a 5-card suit, fill the rest randomly). This was rejected because it reuses none of the existing, already-tested dealing/shuffle code, risks introducing a card-conservation bug in new bookkeeping logic, and produces a hand that is "designed" rather than a genuinely possible random deal (thin difference in practice, but reshuffling is simpler and carries less risk for the same result).

## 3. Wiring

`BatakScreen.tsx`'s `startGame(difficulty)` passes `guaranteeStrongHand: difficulty === 'easy'` alongside the existing `players` field in the `setup()` options object. No other mobile-layer changes.

## Testing

Per the standing testing policy, engine-core (`RuleEngine`, AI) stays test-covered by default:

- `rules.test.ts`: `setup({ players, guaranteeStrongHand: true }, rng)` produces a `players[0]` hand satisfying `meetsEasyModeHandRequirements`, across many seeds (including seeds that would *not* qualify without retrying, to prove the loop is actually doing something, not just testing seeds that happen to pass on the first try). A card-conservation check (exactly 52 unique cards across all zones, no duplicates/drops) across the same seeds, since this is new code that reshuffles. A confirmation that `guaranteeStrongHand: false`/omitted produces identical output to today's `setup()` for a fixed seed (regression guard on the default path).
- `easy.test.ts`: replace the two hand-strength-based bidding tests added in the prior fix (they no longer reflect Easy's behavior) with a single test asserting `batakEasyAI` always returns `{ type: 'pass' }` during bidding, across both a weak hand and a very strong hand, and regardless of `state.highestBid`.

No new mobile UI tests (per the standing 2026-07-07 policy) — the `BatakScreen.tsx` change is a one-line option pass-through with no new branching logic to verify beyond typecheck.

## Out of Scope

- The 3-player gömmeli variant's UI/AI wiring (doesn't exist yet). The predicate and retry loop are written generically against `handSize`/`players[0]`, so they'll work unmodified whenever gömmeli's UI is built, but hooking it up is a future sub-project.
- Any change to Medium/Hard AI bidding, or to Easy AI's card-play logic (unchanged from the prior fix: always plays its lowest legal card).
- Tuning the honor/suit-concentration thresholds based on actual playtesting — these are taken directly from the user's stated requirements.
- A more sophisticated "easy" experience beyond bidding/deal (e.g., bots deliberately playing worse during tricks) — not requested.

## Next Step

Write the implementation plan for this design.
