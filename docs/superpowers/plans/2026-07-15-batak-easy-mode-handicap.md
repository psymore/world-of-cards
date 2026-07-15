# Batak Easy Difficulty: No AI Bidding + Guaranteed Strong Human Hand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Batak's Easy difficulty, AI bots never competitively bid (the human always ends up with the contract), and the human's dealt hand is guaranteed to satisfy an honor + suit-concentration strength requirement.

**Architecture:** Two independent, additive changes to `packages/engine/src/games/batak/`: (1) `batakEasyAI`'s bidding branch becomes an unconditional pass, (2) `batakGame.setup()` gains an opt-in `guaranteeStrongHand` flag that reshuffles (using the same seeded `RNG`) until `players[0]`'s dealt hand satisfies a predicate, capped at a safety-valve retry limit. A one-line change in `apps/mobile/src/games/batak/BatakScreen.tsx` wires the flag to `difficulty === 'easy'`.

**Tech Stack:** TypeScript, Jest (`packages/engine`), no new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-batak-easy-mode-handicap-design.md` — this plan implements it exactly; do not deviate from the predicate/threshold values below.
- Honor requirement: `aces >= 2 || kings >= 3 || (aces >= 1 && kings >= 2)`.
- Suit-concentration requirement: some suit has `>= 5` cards in hand, OR some suit holds all four of `{A, Q, J, 10}`.
- Both requirements are AND'd together (`meetsEasyModeHandRequirements`).
- The "human" seat is always `state.players[0]` — this is the existing engine convention (already used by the forced-all-pass rule and by `apps/mobile/src/games/batak/BatakScreen.tsx`'s `[HUMAN_ID, ...AI_IDS]` ordering). Do not introduce a second way to identify the human seat.
- Retry cap for the reshuffle loop: `10_000` attempts, as a safety valve only — if hit, `setup()` proceeds with the last shuffle rather than throwing or hanging.
- No new mobile UI tests (standing 2026-07-07 testing policy in `CLAUDE.md`) — `packages/engine` (`RuleEngine`, AI) stays test-covered by default.
- Medium/Hard AI and Easy's trump-selection/card-play logic are unaffected — only Easy's bidding branch changes.

---

### Task 1: Guaranteed strong opening hand for Easy mode (`packages/engine`)

**Files:**
- Modify: `packages/engine/src/games/batak/types.ts`
- Modify: `packages/engine/src/games/batak/rules.ts`
- Test: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Consumes: existing `shuffle`/`createDeck` (`../../core/deck`), `dealToZones` (`../../core/table`), `RNG` (`../../core/rng`), `Card`/`Suit`/`Rank` (`../../core/types`), existing `SUITS` const and `ruleConstants()` in `rules.ts`.
- Produces: `BatakSetupOptions.guaranteeStrongHand?: boolean` (new field). `batakGame.setup()` behavior when the flag is `true`: `state.players[0]`'s hand always satisfies the honor + suit-concentration predicate. No new exports — the predicate helpers stay private to `rules.ts` (matching how `biddingLegalMoves`/`playingLegalMoves` are already private).

- [ ] **Step 1: Write the failing tests**

Append to the end of `packages/engine/src/games/batak/rules.test.ts` (the file currently ends at line 968 with the `validateMove during play` describe block's closing `});` — add this immediately after it):

```ts

describe('setup with guaranteeStrongHand', () => {
  const HIGH_RANKS: Card['rank'][] = ['A', 'Q', 'J', '10'];
  const HAND_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

  function meetsHonorRequirement(hand: Card[]): boolean {
    const aces = hand.filter((c) => c.rank === 'A').length;
    const kings = hand.filter((c) => c.rank === 'K').length;
    return aces >= 2 || kings >= 3 || (aces >= 1 && kings >= 2);
  }

  function meetsSuitConcentrationRequirement(hand: Card[]): boolean {
    return HAND_SUITS.some((suit) => {
      const cardsInSuit = hand.filter((c) => c.suit === suit);
      if (cardsInSuit.length >= 5) return true;
      return HIGH_RANKS.every((rank) => cardsInSuit.some((c) => c.rank === rank));
    });
  }

  it('the predicate is non-trivial: some seeds fail it without guaranteeStrongHand', () => {
    let anyFailed = false;
    for (let seed = 1; seed <= 50; seed++) {
      const state = batakGame.setup({ players: PLAYERS }, createRng(seed));
      const hand = state.table.zones['hand-p1'].cards;
      if (!(meetsHonorRequirement(hand) && meetsSuitConcentrationRequirement(hand))) {
        anyFailed = true;
        break;
      }
    }
    expect(anyFailed).toBe(true);
  });

  it("guarantees p1's hand satisfies the honor + suit-concentration requirements across many seeds", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = batakGame.setup({ players: PLAYERS, guaranteeStrongHand: true }, createRng(seed));
      const hand = state.table.zones['hand-p1'].cards;
      expect(meetsHonorRequirement(hand)).toBe(true);
      expect(meetsSuitConcentrationRequirement(hand)).toBe(true);
    }
  });

  it('still deals exactly 52 unique cards across all zones with no duplicates or drops', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = batakGame.setup({ players: PLAYERS, guaranteeStrongHand: true }, createRng(seed));
      const allDealt = Object.values(state.table.zones).flatMap((z) => z.cards);
      expect(allDealt).toHaveLength(52);
      expect(new Set(allDealt.map((c) => c.id)).size).toBe(52);
    }
  });

  it('leaves setup() unchanged when guaranteeStrongHand is omitted, for a fixed seed', () => {
    const withoutFlag = batakGame.setup({ players: PLAYERS }, createRng(7));
    const withFlagFalse = batakGame.setup({ players: PLAYERS, guaranteeStrongHand: false }, createRng(7));
    expect(withFlagFalse).toEqual(withoutFlag);
  });
});
```

No new imports are needed — `Card`, `Suit`, `createRng`, `batakGame`, and `PLAYERS` are already imported/declared earlier in this file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && npx jest src/games/batak/rules.test.ts -t "guaranteeStrongHand"`

Expected: the `"guarantees p1's hand satisfies..."` test FAILS (the flag doesn't exist yet, so `setup()` ignores it and most seeds won't naturally satisfy the AND'd predicate). The other three tests in this new `describe` block are expected to PASS already (they don't depend on the new behavior — `"the predicate is non-trivial"` checks the *unflagged* path, `"still deals exactly 52..."` and `"leaves setup() unchanged..."` hold regardless, since TypeScript's `options: unknown` parameter means passing the extra property compiles fine even before `BatakSetupOptions` is updated).

- [ ] **Step 3: Write the minimal implementation**

In `packages/engine/src/games/batak/types.ts`, change:

```ts
export interface BatakSetupOptions {
  players: PlayerId[];
}
```

to:

```ts
export interface BatakSetupOptions {
  players: PlayerId[];
  guaranteeStrongHand?: boolean;
}
```

In `packages/engine/src/games/batak/rules.ts`, change the import line:

```ts
import { Card, Suit } from '../../core/types';
```

to:

```ts
import { Card, Suit, Rank } from '../../core/types';
```

Then, immediately after the existing `const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];` line (and before `interface RuleConstants`), add:

```ts
const HIGH_RANKS: Rank[] = ['A', 'Q', 'J', '10'];
const MAX_STRONG_HAND_DEAL_ATTEMPTS = 10_000;

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

Then, in `setup()`, change:

```ts
  setup(options: unknown, rng: RNG): BatakState {
    const opts = options as BatakSetupOptions;
    const { players } = opts;
    const { handSize, kittySize } = ruleConstants(players.length);

    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const { table } = dealToZones(deck, makeEmptyTable(players), [
```

to:

```ts
  setup(options: unknown, rng: RNG): BatakState {
    const opts = options as BatakSetupOptions;
    const { players, guaranteeStrongHand } = opts;
    const { handSize, kittySize } = ruleConstants(players.length);

    let deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    if (guaranteeStrongHand) {
      let attempts = 0;
      while (
        !meetsEasyModeHandRequirements(deck.slice(0, handSize)) &&
        attempts < MAX_STRONG_HAND_DEAL_ATTEMPTS
      ) {
        deck = shuffle(deck, rng);
        attempts++;
      }
    }
    const { table } = dealToZones(deck, makeEmptyTable(players), [
```

(The rest of `setup()` — the `dealToZones` call's second argument onward, and the returned `BatakState` object — is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && npx jest src/games/batak/rules.test.ts`

Expected: PASS, full file (all pre-existing tests plus the new `describe('setup with guaranteeStrongHand', ...)` block).

- [ ] **Step 5: Run the full engine suite and typecheck**

Run: `cd packages/engine && npx jest && npx tsc --noEmit`

Expected: all engine test suites pass. `tsc --noEmit` may still report the three pre-existing `kittyCardIds` errors in `ai/easy.test.ts`/`ai/hard.test.ts`/`ai/medium.test.ts` (a known, unrelated pre-existing issue on `master` — confirmed via `git stash` earlier in this project) — no *new* errors should appear.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/types.ts packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Guarantee a strong opening hand for the human on Batak Easy difficulty

Adds an opt-in BatakSetupOptions.guaranteeStrongHand flag: when set,
setup() reshuffles (reusing the same seeded RNG) until players[0]'s
dealt hand satisfies an honor-card + suit-concentration requirement,
capped at a safety-valve retry limit. Off by default, so existing
callers are unaffected."
```

---

### Task 2: Easy AI never bids

**Files:**
- Modify: `packages/engine/src/games/batak/ai/easy.ts`
- Test: `packages/engine/src/games/batak/ai/easy.test.ts`

**Interfaces:**
- Consumes: existing `AIStrategy<BatakState, BatakMove>` (`../../../ai/types`), `pickRandom` (`../../../ai/weightedRandom`), `compareRanks` (`../ranking`), `chooseTrumpSuit` (`./handStrength`).
- Produces: `batakEasyAI.chooseMove` returns `{ type: 'pass' }` unconditionally whenever `state.phase === 'bidding'`. Trump-selection and card-play branches are unchanged from their current implementation.

- [ ] **Step 1: Replace the now-incorrect bidding tests with a failing test**

In `packages/engine/src/games/batak/ai/easy.test.ts`, remove these two tests in their entirety (they assert the old hand-strength-based bidding behavior, which this task removes):

```ts
  it('passes on a weak hand regardless of rng, instead of gambling on a random legal bid', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('a', '2', 'clubs'),
        card('b', '3', 'clubs'),
        card('c', '4', 'diamonds'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table, phase: 'bidding' });
    for (let seed = 1; seed <= 20; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(move).toEqual({ type: 'pass' });
    }
  });

  it('bids the hand-strength estimate on a strong hand regardless of rng, instead of a random legal amount', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('a', 'A', 'spades'),
        card('b', 'K', 'spades'),
        card('c', 'Q', 'spades'),
        card('d', 'J', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table, phase: 'bidding' });
    for (let seed = 1; seed <= 20; seed++) {
      const legalMoves = batakGame.getLegalMoves(state, 'p1');
      const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
      expect(move).toEqual({ type: 'bid', amount: 7 });
    }
  });
```

In their place, add this single test:

```ts
  it('always passes during bidding, regardless of hand strength or the current highest bid', () => {
    const strongHand: Card[] = [
      card('a', 'A', 'spades'),
      card('b', 'K', 'spades'),
      card('c', 'Q', 'spades'),
      card('d', 'J', 'spades'),
    ];
    const table = createTable([
      createZone('hand-p1', true, strongHand),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    for (const highestBid of [0, 5, 8, 12]) {
      const state = makeState({ table, phase: 'bidding', highestBid });
      for (let seed = 1; seed <= 10; seed++) {
        const legalMoves = batakGame.getLegalMoves(state, 'p1');
        const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(seed));
        expect(move).toEqual({ type: 'pass' });
      }
    }
  });
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `cd packages/engine && npx jest src/games/batak/ai/easy.test.ts -t "always passes during bidding"`

Expected: FAIL — with `highestBid: 12`, `estimateBidDecision` (current implementation) will choose `{ type: 'bid', amount: 13 }` for this strong hand (13 clears the `minBid` of 13), not `{ type: 'pass' }`.

- [ ] **Step 3: Write the minimal implementation**

In `packages/engine/src/games/batak/ai/easy.ts`, change:

```ts
import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { BatakState, BatakMove } from '../types';
import { compareRanks } from '../ranking';
import { chooseTrumpSuit, estimateBidDecision } from './handStrength';

type PlayMove = Extract<BatakMove, { type: 'play' }>;

export const batakEasyAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'easy',
  chooseMove(state, playerId, legalMoves, rng) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return estimateBidDecision(hand, state.highestBid);
    }
```

to:

```ts
import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { BatakState, BatakMove } from '../types';
import { compareRanks } from '../ranking';
import { chooseTrumpSuit } from './handStrength';

type PlayMove = Extract<BatakMove, { type: 'play' }>;

export const batakEasyAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'easy',
  chooseMove(state, playerId, legalMoves, rng) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return { type: 'pass' };
    }
```

(Everything else in the file — the `trump-selection` branch and the card-play logic below it — is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && npx jest src/games/batak/ai/easy.test.ts`

Expected: PASS, full file.

- [ ] **Step 5: Run the full batak test suite (including simulateGames)**

Run: `cd packages/engine && npx jest src/games/batak`

Expected: PASS, including `simulate.test.ts`'s two existing tests — the 500-game easy-vs-easy-vs-easy-vs-easy invariant run, and the Hard-vs-3xEasy win-rate assertion (`hardWins > 70` out of 200). Since Easy still plays its lowest legal card and just never bids, Hard should still win comfortably; if this assertion unexpectedly fails, stop and re-examine rather than loosening the threshold — that would indicate a real behavior change worth understanding first (see `superpowers:systematic-debugging` if so).

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/ai/easy.ts packages/engine/src/games/batak/ai/easy.test.ts
git commit -m "Make Easy AI always pass during Batak bidding

Easy bots no longer bid at all, so the human always ends up with the
contract (either by winning their own bid uncontested, or via the
existing forced-all-pass-to-players[0] rule if the human also
passes). Trump-selection and card-play are unchanged."
```

---

### Task 3: Wire guaranteeStrongHand to Easy difficulty in the mobile app

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`

**Interfaces:**
- Consumes: `BatakSetupOptions.guaranteeStrongHand` (from Task 1), the existing `difficulty: Difficulty` value already in scope inside `startGame(difficulty)`.
- Produces: nothing new consumed by later tasks — this is the final integration point.

- [ ] **Step 1: Update the setup() call**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, inside `startGame(difficulty)`, change:

```ts
    const initialState = batakDescriptor.ruleEngine.setup({ players: [HUMAN_ID, ...AI_IDS] }, rng);
```

to:

```ts
    const initialState = batakDescriptor.ruleEngine.setup(
      { players: [HUMAN_ID, ...AI_IDS], guaranteeStrongHand: difficulty === 'easy' },
      rng
    );
```

- [ ] **Step 2: Typecheck the mobile app**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: no new errors introduced by this change (the `BatakSetupOptions` type from Task 1 already declares `guaranteeStrongHand` as optional, so this is a type-safe addition).

- [ ] **Step 3: Run the full mobile test suite**

Run: `cd apps/mobile && npx jest`

Expected: PASS — no existing test asserts on the exact `setup()` call arguments in `BatakScreen.tsx`, so this change should not affect any existing test.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "Rig the Batak deal toward the human on Easy difficulty

Wires the new guaranteeStrongHand setup flag to difficulty === 'easy',
so an Easy game always deals the human a strong opening hand. Medium
and Hard games are unaffected."
```

---

## Final Verification

After all three tasks are complete:

- [ ] Run `cd packages/engine && npx jest && npx tsc --noEmit` — full engine suite passes, no new typecheck errors.
- [ ] Run `cd apps/mobile && npx jest && npx tsc --noEmit` — full mobile suite passes, no new typecheck errors.
- [ ] Manually reason through (or, if device/browser access is available that session, actually play) one Easy-difficulty Batak game: confirm the human's opening hand satisfies the strength requirement, confirm all three bots pass on every bidding round, and confirm the human ends up as `bidWinner` every time (including if the human themselves chooses to pass, via the forced-all-pass fallback).
