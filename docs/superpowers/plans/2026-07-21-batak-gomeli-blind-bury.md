# Batak Gömmeli Blind Bury Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change 3-player gömmeli Batak's kitty-exchange rule so the bidder must choose their 4 bury cards from their **original 16-card hand only** — never from the 4 cards they just picked up from the kitty. This is a real rule change (not a UI-only illusion): burying a kitty card must become illegal at the engine level, for both AI and human bidders. The mobile UI is updated to match: the human bidder's hand fan and bury-slots interaction only ever show/offer their original 16 cards until Confirm is pressed — the kitty stays completely unknown until the already-built staged reveal-then-collect animation actually delivers it.

**Architecture:** One new engine primitive, `buriableCards(state, playerId)` in `packages/engine/src/games/batak/rules.ts`, which returns the bidder's hand minus any cards whose id is in `state.kittyCardIds` (or the full hand, unfiltered, whenever `kittyCardIds` is null — i.e. every non-gömmeli case). This function becomes the single source of truth for "which cards can legally be buried," consumed by:
- `kittyExchangeLegalMoves` (the real rule fix — `validateMove`'s `'bury'` case already reuses `getLegalMoves`, so fixing enumeration alone fixes validation too)
- `batakEasyAI`/`batakMediumAI`'s `chooseCardsToBury` call site
- `batakHardAI`'s `fourCardCombinations` candidate-generation call site

The mobile UI needs exactly one change: `BatakTable.tsx`'s existing `kittyExchangeHiddenCardIds` computation (built in the prior UI sub-project to hide kitty cards from the human's hand fan *after* Confirm) is widened to also hide them for the entire kitty-exchange phase *before* Confirm, whenever the human is the bidder. No other file changes — the already-built staged bury→reveal→collect animation, `KittyPile`, `KittyExchangeCenter`, and `useBurySlots` all continue to work unchanged, since they already operate on `state.kittyCardIds` independently of what's buriable.

**Tech stack:** Same TypeScript engine (Jest, `packages/engine`) and React Native mobile UI (`apps/mobile`) as the rest of this project. No new dependencies.

**Pre-flight verification note:** every fixture and expected value in Tasks 1–3 below was verified by directly prototyping the fix and running it against the real engine/AI code in this session (not hand-derived/guessed) — the exact `console.log` output is quoted inline in each task so the implementer can cross-check their own test run against it.

## Global Constraints

- `buriableCards` must return the **full, unfiltered hand** whenever `state.kittyCardIds` is `null` — this is what keeps 4-player Standard Batak (where `kittyCardIds` is always `null`, since `ruleConstants(4).kittySize === 0` and the `'kitty-exchange'` phase is structurally unreachable) and Pişti completely untouched. Every existing 4-player Batak and Pişti test must remain byte-identical.
- No new automated **UI** tests (standing 2026-07-07 policy: default to none, ask before adding). The **engine** change (Tasks 1–3) is exactly the kind of core rule-engine/AI logic this project's testing policy always keeps test-covered by default — those tasks get new/updated tests as a normal part of the work, not an exception.
- Every task that touches `packages/engine` must leave the full engine test suite green, including the 3-player gömmeli `simulateGames` benchmark (`packages/engine/src/games/batak/simulate.test.ts`) — zero card-conservation violations, no illegal-move crashes.
- Do not touch the already-built staged animation components (`KittyPile`, `KittyExchangeCenter`, `KittyRevealCard`, `KittyCollectCard`, `useBurySlots`, the `pendingBury` state machine in `BatakScreen.tsx`) — none of them need to change for this fix. If a task's implementer believes one of them needs a change, that's a signal something was misunderstood — stop and escalate rather than editing those files.

---

### Task 1: Engine — `buriableCards` primitive + kitty-exchange bury-legality restriction

**Files:**
- Modify: `packages/engine/src/games/batak/rules.ts`
- Test: `packages/engine/src/games/batak/rules.test.ts`

**Interfaces:**
- Produces: `export function buriableCards(state: BatakState, playerId: PlayerId): Card[]` — consumed by Task 2 (`easy.ts`/`medium.ts`) and Task 3 (`hard.ts`).

- [ ] **Step 1: Add `buriableCards` and fix `kittyExchangeLegalMoves`**

In `packages/engine/src/games/batak/rules.ts`, change:

```ts
function kittyExchangeLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (playerId !== state.bidWinner) return [];
  const hand = state.table.zones[`hand-${playerId}`].cards;
  return fourCardCombinations(hand).map((combo) => ({
    type: 'bury' as const,
    cardIds: combo.map((c) => c.id) as [string, string, string, string],
  }));
}
```

to:

```ts
// The bidder can never legally bury one of the kitty cards they just picked up — burying is only
// ever a choice among the cards they originally held. Returns the full hand unfiltered when
// kittyCardIds is null (every non-gömmeli phase/variant, and any hand-crafted test state that
// doesn't set it), so this has no effect outside gömmeli's kitty-exchange phase.
export function buriableCards(state: BatakState, playerId: PlayerId): Card[] {
  const hand = state.table.zones[`hand-${playerId}`].cards;
  if (!state.kittyCardIds) return hand;
  const kittyIds = new Set(state.kittyCardIds);
  return hand.filter((c) => !kittyIds.has(c.id));
}

function kittyExchangeLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (playerId !== state.bidWinner) return [];
  const hand = buriableCards(state, playerId);
  return fourCardCombinations(hand).map((combo) => ({
    type: 'bury' as const,
    cardIds: combo.map((c) => c.id) as [string, string, string, string],
  }));
}
```

(`validateMove`'s `'bury'` case already reuses `getLegalMoves(state, playerId)` as its source of truth — no change needed there, this fix alone also fixes validation.)

- [ ] **Step 2: Update `rules.test.ts`**

Change the existing test (currently asserts C(20,4)=4845, with no `kittyCardIds` set):

```ts
    it('returns exactly C(20,4) = 4845 combinations, each of 4 distinct cards from the hand', () => {
      const hand = twentyCards();
      const table = batakTable3({ 'hand-p1': hand });
      const state = makeState({
        table,
        players: PLAYERS3,
        phase: 'kitty-exchange',
        bidWinner: 'p1',
        currentPlayerIndex: 0,
      });
      const moves = batakGame.getLegalMoves(state, 'p1');
      expect(moves).toHaveLength(4845);
      for (const move of moves) {
        if (move.type !== 'bury') throw new Error('expected only bury moves');
        expect(new Set(move.cardIds).size).toBe(4);
        for (const id of move.cardIds) {
          expect(hand.some((c) => c.id === id)).toBe(true);
        }
      }
    });
```

to (real kittyCardIds set, expects the restricted C(16,4)=1820 — verified via direct execution: `console.log('C(16,4) combos count:', moves.length)` printed exactly `1820`):

```ts
    it('returns exactly C(16,4) = 1820 combinations, each of 4 distinct non-kitty cards from the hand', () => {
      const hand = twentyCards();
      const table = batakTable3({ 'hand-p1': hand });
      const state = makeState({
        table,
        players: PLAYERS3,
        phase: 'kitty-exchange',
        bidWinner: 'p1',
        currentPlayerIndex: 0,
        kittyCardIds: ['c16', 'c17', 'c18', 'c19'],
      });
      const moves = batakGame.getLegalMoves(state, 'p1');
      expect(moves).toHaveLength(1820);
      const kittyIds = new Set(['c16', 'c17', 'c18', 'c19']);
      for (const move of moves) {
        if (move.type !== 'bury') throw new Error('expected only bury moves');
        expect(new Set(move.cardIds).size).toBe(4);
        for (const id of move.cardIds) {
          expect(hand.some((c) => c.id === id)).toBe(true);
          expect(kittyIds.has(id)).toBe(false);
        }
      }
    });

    it('excludes every combination containing a kitty card, even alongside an otherwise-legal combo', () => {
      const hand = twentyCards();
      const table = batakTable3({ 'hand-p1': hand });
      const state = makeState({
        table,
        players: PLAYERS3,
        phase: 'kitty-exchange',
        bidWinner: 'p1',
        currentPlayerIndex: 0,
        kittyCardIds: ['c16', 'c17', 'c18', 'c19'],
      });
      const moves = batakGame.getLegalMoves(state, 'p1');
      // c0,c1,c2 are legal alongside a 4th non-kitty card (c3) but never alongside a kitty card —
      // a genuinely discriminating check, not just "no combo contains c16 anywhere in isolation".
      expect(moves).toContainEqual({ type: 'bury', cardIds: ['c0', 'c1', 'c2', 'c3'] });
      expect(moves.some((m) => m.type === 'bury' && m.cardIds.includes('c16'))).toBe(false);
      expect(moves.some((m) => m.type === 'bury' && m.cardIds.includes('c17'))).toBe(false);
      expect(moves.some((m) => m.type === 'bury' && m.cardIds.includes('c18'))).toBe(false);
      expect(moves.some((m) => m.type === 'bury' && m.cardIds.includes('c19'))).toBe(false);
    });

    it('falls back to allowing any 4 cards when kittyCardIds is null (keeps buriableCards total; this state should not occur in a real game)', () => {
      const hand = twentyCards();
      const table = batakTable3({ 'hand-p1': hand });
      const state = makeState({
        table,
        players: PLAYERS3,
        phase: 'kitty-exchange',
        bidWinner: 'p1',
        currentPlayerIndex: 0,
        kittyCardIds: null,
      });
      const moves = batakGame.getLegalMoves(state, 'p1');
      expect(moves).toHaveLength(4845);
    });
```

Leave the existing `'includes a specific known combination and excludes one containing a card not in hand'` test (right after the above, currently uses `['c0','c1','c2','c3']` with no `kittyCardIds` set) completely unchanged — `c0-c3` are non-kitty either way (the new kitty set here is `c16-c19`), so it stays correct and doesn't need touching.

Change the `validateMove — bury (3-player)` describe block's shared helper from:

```ts
    function kittyExchangeState() {
      const hand = twentyCards();
      const table = batakTable3({ 'hand-p1': hand });
      const state = makeState({
        table,
        players: PLAYERS3,
        phase: 'kitty-exchange' as const,
        bidWinner: 'p1',
        currentPlayerIndex: 0,
      });
      return { hand, state };
    }
```

to:

```ts
    function kittyExchangeState() {
      const hand = twentyCards();
      const table = batakTable3({ 'hand-p1': hand });
      const state = makeState({
        table,
        players: PLAYERS3,
        phase: 'kitty-exchange' as const,
        bidWinner: 'p1',
        currentPlayerIndex: 0,
        kittyCardIds: ['c16', 'c17', 'c18', 'c19'],
      });
      return { hand, state };
    }
```

(every existing test in this describe block uses `cardIds: ['c0'...'c3']` or similar non-kitty ids, so they all remain unaffected by this — verified: `c0-c3` are not in `['c16','c17','c18','c19']`). Add one new test in this same describe block, after the existing `'rejects a bury that repeats the same card id...'` test:

```ts
    it('rejects a bury naming one of the kitty cards', () => {
      const { state } = kittyExchangeState();
      expect(
        batakGame.validateMove(state, { type: 'bury', cardIds: ['c0', 'c1', 'c2', 'c16'] }, 'p1')
      ).toBe(false);
    });
```

Leave the `batakGame performMove — bury` describe block (the one test there, `'moves the 4 named cards to buried...'`) completely unchanged — it doesn't set `kittyCardIds` and doesn't exercise legality (that's `getLegalMoves`/`validateMove`'s job, already covered above); `performMove` itself trusts whatever move it's given.

- [ ] **Step 3: Run the tests**

Run: `npx jest packages/engine/src/games/batak/rules.test.ts --silent`
Expected: all tests pass, including the 3 new/changed ones above.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/batak/rules.ts packages/engine/src/games/batak/rules.test.ts
git commit -m "Restrict Batak gömmeli's kitty-exchange bury legality to exclude kitty cards"
```

---

### Task 2: Engine — Easy/Medium AI bury restriction

**Files:**
- Modify: `packages/engine/src/games/batak/ai/easy.ts`, `packages/engine/src/games/batak/ai/medium.ts`
- Test: `packages/engine/src/games/batak/ai/easy.test.ts`, `packages/engine/src/games/batak/ai/medium.test.ts`

**Interfaces:**
- Consumes: `buriableCards` (Task 1, `packages/engine/src/games/batak/rules.ts`).

- [ ] **Step 1: Fix `easy.ts`**

Change the import:

```ts
import { ruleConstants } from '../rules';
```

to:

```ts
import { ruleConstants, buriableCards } from '../rules';
```

Change the kitty-exchange branch:

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = chooseCardsToBury(hand, state.trumpSuit!, kittySize).map((c) => c.id) as [
        string,
        string,
        string,
        string,
      ];
      return { type: 'bury', cardIds };
    }
```

to:

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = chooseCardsToBury(buriableCards(state, playerId), state.trumpSuit!, kittySize).map(
        (c) => c.id
      ) as [string, string, string, string];
      return { type: 'bury', cardIds };
    }
```

- [ ] **Step 2: Fix `medium.ts`**

Change the import:

```ts
import { trickWinnerIndex, ruleConstants } from '../rules';
```

to:

```ts
import { trickWinnerIndex, ruleConstants, buriableCards } from '../rules';
```

Change the kitty-exchange branch (identical shape to `easy.ts`'s, above):

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = chooseCardsToBury(hand, state.trumpSuit!, kittySize).map((c) => c.id) as [
        string,
        string,
        string,
        string,
      ];
      return { type: 'bury', cardIds };
    }
```

to:

```ts
    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = chooseCardsToBury(buriableCards(state, playerId), state.trumpSuit!, kittySize).map(
        (c) => c.id
      ) as [string, string, string, string];
      return { type: 'bury', cardIds };
    }
```

- [ ] **Step 3: Replace `easy.test.ts`'s kitty-exchange bury test**

The existing test's fixture makes the kitty cards themselves the ones the AI would naively choose to bury, which is exactly what this fix now forbids — it needs a bigger hand so there's a real, separate non-kitty candidate pool. Change (this is the last `it` in the file, immediately followed by the closing `});` of the outer `describe`):

```ts
  it('discards a valid 4-card bury during kitty-exchange for a 3-player gömmeli game, preferring non-trump cards', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('nt1', '2', 'hearts'),
        card('nt2', '5', 'diamonds'),
        card('nt3', '9', 'clubs'),
        card('nt4', 'K', 'clubs'),
        card('trump1', '3', 'spades'),
        card('trump2', 'A', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['nt1', 'nt2', 'nt3', 'nt4'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.slice().sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt4'].sort());
    }
  });
});
```

to (verified via direct execution — `console.log('EASY MOVE:', ...)` printed exactly `{"type":"bury","cardIds":["nt1","nt5","nt2","nt3"]}`, and `legalMoves count (should be C(7,4)=35)` printed exactly `35`):

```ts
  it('discards a valid 4-card bury during kitty-exchange for a 3-player gömmeli game, preferring non-trump cards and never burying a kitty card', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('nt1', '2', 'hearts'),
        card('nt2', '5', 'diamonds'),
        card('nt3', '9', 'clubs'),
        card('nt4', 'K', 'clubs'),
        card('nt5', '4', 'diamonds'),
        card('trump1', '3', 'spades'),
        card('trump2', 'A', 'spades'),
        card('kitty1', '2', 'clubs'),
        card('kitty2', '3', 'clubs'),
        card('kitty3', '4', 'clubs'),
        card('kitty4', '5', 'clubs'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['kitty1', 'kitty2', 'kitty3', 'kitty4'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    expect(legalMoves).toHaveLength(35); // C(7,4) — 7 non-kitty cards remain buriable
    const move = batakEasyAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      // The 4 lowest-ranked non-trump cards among the 7 non-kitty candidates (nt1=2, nt5=4, nt2=5,
      // nt3=9 — nt4=K and both trump cards are not among the 4 lowest, so they're kept).
      expect(move.cardIds.slice().sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt5'].sort());
      expect(move.cardIds.some((id) => id.startsWith('kitty'))).toBe(false);
    }
  });
});
```

- [ ] **Step 4: Replace `medium.test.ts`'s kitty-exchange bury test**

Same fixture and reasoning as Step 3 (Medium reuses the identical `chooseCardsToBury` heuristic for its bury choice — verified via direct execution to produce the exact same result: `console.log('MEDIUM MOVE:', ...)` also printed `{"type":"bury","cardIds":["nt1","nt5","nt2","nt3"]}`). Change (this test sits between the existing bid-floor tests in the file — replace only this one `it` block, leave the `'uses the 3-player gömmeli bid floor...'` test immediately after it untouched):

```ts
  it('discards a valid bury during kitty-exchange for a 3-player gömmeli game, preferring non-trump cards', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('nt1', '2', 'hearts'),
        card('nt2', '5', 'diamonds'),
        card('nt3', '9', 'clubs'),
        card('nt4', 'K', 'clubs'),
        card('trump1', '3', 'spades'),
        card('trump2', 'A', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['nt1', 'nt2', 'nt3', 'nt4'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.slice().sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt4'].sort());
    }
  });
```

to:

```ts
  it('discards a valid bury during kitty-exchange for a 3-player gömmeli game, preferring non-trump cards and never burying a kitty card', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('nt1', '2', 'hearts'),
        card('nt2', '5', 'diamonds'),
        card('nt3', '9', 'clubs'),
        card('nt4', 'K', 'clubs'),
        card('nt5', '4', 'diamonds'),
        card('trump1', '3', 'spades'),
        card('trump2', 'A', 'spades'),
        card('kitty1', '2', 'clubs'),
        card('kitty2', '3', 'clubs'),
        card('kitty3', '4', 'clubs'),
        card('kitty4', '5', 'clubs'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['kitty1', 'kitty2', 'kitty3', 'kitty4'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    expect(legalMoves).toHaveLength(35); // C(7,4) — 7 non-kitty cards remain buriable
    const move = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.slice().sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt5'].sort());
      expect(move.cardIds.some((id) => id.startsWith('kitty'))).toBe(false);
    }
  });
```

- [ ] **Step 5: Run the tests**

Run: `npx jest packages/engine/src/games/batak/ai/easy.test.ts packages/engine/src/games/batak/ai/medium.test.ts --silent`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/ai/easy.ts packages/engine/src/games/batak/ai/medium.ts packages/engine/src/games/batak/ai/easy.test.ts packages/engine/src/games/batak/ai/medium.test.ts
git commit -m "Make Easy/Medium Batak AI respect the gömmeli blind-bury restriction"
```

---

### Task 3: Engine — Hard AI bury restriction

**Files:**
- Modify: `packages/engine/src/games/batak/ai/hard.ts`
- Test: `packages/engine/src/games/batak/ai/hard.test.ts`

**Interfaces:**
- Consumes: `buriableCards` (Task 1).

- [ ] **Step 1: Fix `hard.ts`**

Change the import:

```ts
import { batakGame, fourCardCombinations } from '../rules';
```

to:

```ts
import { batakGame, buriableCards, fourCardCombinations } from '../rules';
```

Change the candidate-generation line inside the `'kitty-exchange'` branch:

```ts
      const scoredCombos = fourCardCombinations(hand)
```

to:

```ts
      const scoredCombos = fourCardCombinations(buriableCards(state, playerId))
```

(Leave every other line in this branch — including `const resultingHand = hand.filter((c) => !buriedIds.has(c.id));`, which correctly still uses the full `hand` — unchanged: the resulting hand after a bury always still contains the kitty cards, since they can never be among the buried ones.)

- [ ] **Step 2: Replace both of `hard.test.ts`'s kitty-exchange bury tests**

Both existing tests use a 5-card hand where 4 of the 5 cards are themselves marked as the kitty (leaving only 1 non-kitty card — impossible to bury 4 from that). Both need a larger hand with 4 *separate*, inert kitty cards added, so the real 5-candidate decision space (`keepHeart`, `keepSpade`, `filler1`, `filler2`, `filler3`) is preserved unchanged from before. **Every value below was verified by directly running this exact fixture against the real `batakHardAI`/`batakEasyAI`/`batakMediumAI`/`rules.ts` code in this session** — this is not a derived/guessed prediction.

Change:

```ts
  it('discards a valid bury during kitty-exchange for a 3-player gömmeli game', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('keepHeart', 'A', 'hearts'),
        card('keepSpade', '2', 'spades'),
        card('filler1', '2', 'clubs'),
        card('filler2', '3', 'diamonds'),
        card('filler3', '4', 'diamonds'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['filler1', 'filler2', 'filler3', 'keepSpade'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
  });
```

to:

```ts
  it('discards a valid bury during kitty-exchange for a 3-player gömmeli game, never burying a kitty card', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('keepHeart', 'A', 'hearts'),
        card('keepSpade', '2', 'spades'),
        card('filler1', '2', 'clubs'),
        card('filler2', '3', 'diamonds'),
        card('filler3', '4', 'diamonds'),
        card('kitty1', '5', 'clubs'),
        card('kitty2', '6', 'clubs'),
        card('kitty3', '7', 'clubs'),
        card('kitty4', '8', 'clubs'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['kitty1', 'kitty2', 'kitty3', 'kitty4'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    expect(legalMoves).toHaveLength(5); // C(5,4) — 5 non-kitty cards remain buriable
    const move = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.some((id) => id.startsWith('kitty'))).toBe(false);
    }
  });
```

Change the second test:

```ts
  it('picks the bury that wins the first trick over one that loses it, where the naive chooseCardsToBury heuristic keeps the losing (weak-trump) card instead', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('keepHeart', 'A', 'hearts'),
        card('keepSpade', '2', 'spades'),
        card('filler1', '2', 'clubs'),
        card('filler2', '3', 'diamonds'),
        card('filler3', '4', 'diamonds'),
      ]),
      createZone('hand-p2', true, [card('p2spade', '3', 'spades'), card('p2heart', '5', 'hearts')]),
      createZone('hand-p3', true, [card('p3club', '6', 'clubs')]),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['filler1', 'filler2', 'filler3', 'keepSpade'],
    });
    // If p1 leads keepSpade (2 of spades): p2 holds a higher spade (3) and must follow suit with
    // it (mandatory raise), beating p1 outright. If p1 leads keepHeart (Ace of hearts) instead:
    // p2 has no hearts and must play their only heart... they don't have one, so they're void in
    // hearts; p2 holds a spade (trump) but no trump has been played in this trick yet, so p2's
    // only heart... p2 has no heart at all (their hand is [3 spades, 5 hearts] - they DO hold a
    // heart, 5 of hearts) - p2 must follow suit with their only heart (5), which loses to the Ace.
    // p3 has no hearts and no spades, so p3 plays their only card (6 of clubs), irrelevant.
    // Only keeping keepHeart wins the resulting trick.
    const hand = state.table.zones['hand-p1'].cards;
    const naiveBuried = chooseCardsToBury(hand, 'spades', 4).map((c) => c.id);
    expect(naiveBuried.slice().sort()).toEqual(['filler1', 'filler2', 'filler3', 'keepHeart'].sort()); // naive heuristic keeps keepSpade - the losing card

    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const move = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.slice().sort()).toEqual(['filler1', 'filler2', 'filler3', 'keepSpade'].sort());
    }
  });
});
```

to (the p2/p3 hands and the whole trick-outcome trace are **completely unchanged** — only p1's hand gains the 4 inert kitty clubs, and `naiveBuried` is now computed over `buriableCards`, not the raw `hand`, so the "naive" comparison point is itself still a fair, non-kitty-including baseline):

```ts
  it('picks the bury that wins the first trick over one that loses it, where the naive chooseCardsToBury heuristic keeps the losing (weak-trump) card instead, never burying a kitty card', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('keepHeart', 'A', 'hearts'),
        card('keepSpade', '2', 'spades'),
        card('filler1', '2', 'clubs'),
        card('filler2', '3', 'diamonds'),
        card('filler3', '4', 'diamonds'),
        card('kitty1', '5', 'clubs'),
        card('kitty2', '6', 'clubs'),
        card('kitty3', '7', 'clubs'),
        card('kitty4', '8', 'clubs'),
      ]),
      createZone('hand-p2', true, [card('p2spade', '3', 'spades'), card('p2heart', '5', 'hearts')]),
      createZone('hand-p3', true, [card('p3club', '9', 'clubs')]),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['kitty1', 'kitty2', 'kitty3', 'kitty4'],
    });
    // Same trick-outcome logic as before this fix, just among 5 non-kitty candidates instead of 5
    // total cards: if p1 leads keepSpade (2♠), p2 holds a higher spade (3♠) and must follow suit
    // with it (mandatory raise), beating p1 outright. If p1 leads keepHeart (A♥) instead, p2 is
    // forced to follow with their only heart (5♥), which loses to the Ace; p3 has neither hearts
    // nor spades and plays their only card (9♣), irrelevant. Only keeping keepHeart wins the trick
    // — verified: the naive heuristic (lowest-non-trump-first, ignoring winnability) keeps
    // keepSpade instead, the losing card.
    const buriable = buriableCards(state, 'p1');
    const naiveBuried = chooseCardsToBury(buriable, 'spades', 4).map((c) => c.id);
    expect(naiveBuried.slice().sort()).toEqual(['filler1', 'filler2', 'filler3', 'keepHeart'].sort()); // naive heuristic keeps keepSpade - the losing card

    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    expect(legalMoves).toHaveLength(5); // C(5,4) — 5 non-kitty cards remain buriable
    const move = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      // Verified via direct execution: HARD MOVE = {"type":"bury","cardIds":["keepSpade","filler1","filler2","filler3"]}
      expect(move.cardIds.slice().sort()).toEqual(['filler1', 'filler2', 'filler3', 'keepSpade'].sort());
      expect(move.cardIds.some((id) => id.startsWith('kitty'))).toBe(false);
    }
  });
});
```

`hard.test.ts` already imports `batakGame` from `'../rules'` in its own line — add `buriableCards` to that same existing import rather than creating a second one from the same module. Change:

```ts
import { batakGame } from '../rules';
```

to:

```ts
import { batakGame, buriableCards } from '../rules';
```

- [ ] **Step 3: Run the tests**

Run: `npx jest packages/engine/src/games/batak/ai/hard.test.ts --silent`
Expected: all tests pass, including the 2 changed ones above.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/batak/ai/hard.ts packages/engine/src/games/batak/ai/hard.test.ts
git commit -m "Make Hard Batak AI respect the gömmeli blind-bury restriction"
```

---

### Task 4: Engine — full re-verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full engine test suite**

Run: `npx jest packages/engine --silent`
Expected: every suite passes, including `packages/engine/src/games/batak/simulate.test.ts` (the 500-game 3-player gömmeli `simulateGames` benchmark) and every 4-player Batak / Pişti test, all byte-identical to before Tasks 1–3 (per this plan's Global Constraints — `kittyCardIds` stays `null` for 4-player, so `buriableCards` is a no-op there).

- [ ] **Step 2: Confirm no illegal-move crashes under simulation**

The `simulate.test.ts` run above already exercises hundreds of full 3-player gömmeli games end-to-end (bidding → kitty-exchange → full hand) via all 3 AI difficulties' real `chooseMove` calls — if any AI strategy still proposed a now-illegal kitty-card bury, `performMove`/`validateMove` would produce a card-conservation violation or an assertion failure inside that test, not a silent pass. A clean pass here is the confirmation needed; no separate script required.

- [ ] **Step 3: No commit** (verification-only task — nothing to commit if everything passes; if something fails, escalate rather than guessing a fix).

---

### Task 5: Mobile UI — hide kitty cards from the human's hand/bury-slots for the whole kitty-exchange phase

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `isHumanBidderInKittyExchange` (already exists in this file), `state.kittyCardIds` (engine field, already exists).
- No new props, no new exports — this is a pure internal-logic change to one existing computation.

- [ ] **Step 1: Widen `kittyExchangeHiddenCardIds` to hide kitty cards for the whole phase**

In `apps/mobile/src/games/batak/BatakTable.tsx`, change:

```ts
  const kittyExchangeHiddenCardIds = new Set<string>();
  if (pendingBury && pendingBury.playerId === humanPlayerId) {
    pendingBury.cardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
    if (pendingBury.stage !== 'burying' && state.kittyCardIds) {
      state.kittyCardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
    }
  }
```

to:

```ts
  const kittyExchangeHiddenCardIds = new Set<string>();
  if (isHumanBidderInKittyExchange && state.kittyCardIds) {
    // The bidder chooses their bury from their ORIGINAL cards only (see rules.ts's
    // buriableCards) — the 4 kitty cards they just picked up (already merged into state via
    // selectTrump; the engine is always fully omniscient, same as every opponent hand) stay
    // hidden from the ordinary hand render for the entire kitty-exchange phase, not just once the
    // reveal animation starts. isHumanBidderInKittyExchange stays true through every stage of
    // pendingBury too (state.phase only advances to 'playing' once the staged sequence's final
    // performMove commits), so this single unconditional check already covers the old
    // "only once stage !== 'burying'" case below — that nested check is now provably redundant
    // and removed. Kitty cards become visible again only once the staged sequence actually
    // delivers them (pendingBury clears and phase advances, at which point
    // isHumanBidderInKittyExchange is false).
    state.kittyCardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
  }
  if (pendingBury && pendingBury.playerId === humanPlayerId) {
    pendingBury.cardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
  }
```

No other line in this file needs to change: `legalCardIds`'s existing `isHumanBidderInKittyExchange ? new Set(humanHand.map((c) => c.id)) : ...` override already derives from `humanHand`, which already excludes `kittyExchangeHiddenCardIds` — so once `humanHand` correctly excludes kitty cards, `legalCardIds` automatically does too, with no separate change needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors (this is a same-shape, same-type internal logic change — no prop/interface changes).

- [ ] **Step 3: Run the mobile test suite**

Run: `npx jest apps/mobile --silent`
Expected: all suites pass unchanged (no new test files, per the standing UI-testing policy; nothing in the existing suite asserts on this specific internal computation's exact contents).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Hide gömmeli's kitty cards from the human bidder's hand until the bury is confirmed"
```

---

### Task 6: Final full-monorepo verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck across both packages**

Run: `npx tsc -p packages/engine/tsconfig.json --noEmit`
Expected: no errors.

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 2: Full monorepo test suite**

Run: `npx jest --silent`
Expected: all suites pass (this plan adds/updates engine tests only — Task 5's UI change adds no new tests, per the standing policy — so this is a superset re-check of Tasks 1–5's individual runs, catching any cross-package interaction).

- [ ] **Step 3: Confirm the commit log**

Run: `git log --oneline -6`
Expected: exactly the 5 commits from this plan (Tasks 1, 2, 3, 5 each commit; Task 4 and 6 are verification-only), in order, nothing else mixed in.

- [ ] **Step 4: Note for the user**

No proactive screenshot/visual verification is performed in this plan (per the standing 2026-07-17 direction). Before considering this "done," the user should try it live via Expo Fast Refresh: start a Gömmeli game, win the bid as the human, confirm the hand fan and bury-slots interaction show **only 16 cards** (never a 20-card hand, never a kitty card as a bury option), choose 4 and Confirm, and watch the existing bury→reveal(~3.5s)→collect sequence deliver the kitty into the hand (now 16 again) exactly as before. Also worth trying: winning the bid as an AI bidder, confirming the same restriction holds (no behavioral difference is expected there since the AI already never had a UI to violate, but the engine-level fix now also formally guarantees it).
