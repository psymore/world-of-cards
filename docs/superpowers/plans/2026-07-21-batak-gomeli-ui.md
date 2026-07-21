# Batak Gömmeli Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 3-player "gömmeli" Batak playable end-to-end from the mobile app — a variant picker on setup, 2-opponent seating, the full kitty-exchange phase (permanent kitty pile, bury-slots card placement, staged bury-then-reveal-then-collect sequence), for both a human and an AI bidder.

**Architecture:** The engine side (rules, state, all 3 AI difficulties) is already complete and merged — this plan is UI-only. `BatakSetupView` gains a variant picker; `BatakScreen` becomes variant-aware and gains a new `pendingBury` staged-commit state machine (parallel to its existing `pendingPlay`/`gatheringTrick`); `BatakTable` gains a permanent kitty-pile display, a new `useBurySlots` hook + bury-slot placement UI, and wiring for the 3-stage bury animation, reusing the existing `GatherCard`/`TravelCard` components wherever their existing contracts fit and adding one new small component (`KittyRevealCard`) for the one animation shape neither covers (an in-place flip that holds visible, no travel, no fade-out).

**Tech Stack:** TypeScript, React Native (Expo), Animated API (`useNativeDriver: true` throughout, matching every existing animation in this codebase), Jest (no new tests planned — see Global Constraints).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md` — read it before starting; every task below implements a specific section of it.
- **No new automated tests** — per the standing 2026-07-07 mobile-UI testing policy and this spec's own Testing section. Existing tests must keep passing unmodified; do not delete or weaken any existing test to make this work compile.
- **No proactive screenshot/visual verification** — per the user's 2026-07-17 standing direction. Verify via typecheck + the existing test suite; the user will check the live behavior themselves via Expo Fast Refresh.
- **One deliberate, documented deviation from the spec's literal wording**: the spec's Section 4 performance-requirements bullet says slot positions are "measured once via `onLayout`." This plan instead reuses the existing fixed, direction-based `REVEAL_ORIGIN_OFFSETS` convention (`apps/mobile/src/table/seating.ts`, already used by every other travel/reveal animation in both Batak and Pişti) for all three animation legs (hand→slot, bury→pile, pile→hand) — a static constant is strictly cheaper than a one-time `onLayout` measurement (zero measurement calls instead of one), and this is the exact same "fixed offset per direction, deliberately not measured" tradeoff this codebase has already made for every prior directional card animation (see `seating.ts`'s own comment on `REVEAL_ORIGIN_OFFSETS`). No onLayout-based slot measurement is implemented in this plan.
- **4-player Standard Batak must be completely unaffected.** Every task must leave existing 4-player behavior byte-identical — verified by running the existing test suite after each task, not just the file(s) touched.
- **Do not touch the Batak bidding-AI miscalibration, the eşli variant, or native on-device verification** — all explicitly out of scope per the spec.

---

## Task 1: Export `ruleConstants`/`RuleConstants` from the batak package index; widen `minPlayers`

**Files:**
- Modify: `packages/engine/src/games/batak/index.ts`

**Interfaces:**
- Produces: `ruleConstants(playerCount: number): RuleConstants` and the `RuleConstants` type, both now importable via `@world-cards/engine/games/batak` (previously only importable from the internal `./rules` path, unreachable from `apps/mobile`).

- [ ] **Step 1: Add the re-export**

In `packages/engine/src/games/batak/index.ts`, change:

```ts
export * from './types';
export { compareRanks } from './ranking';
export { trickWinnerIndex } from './rules';
```

to:

```ts
export * from './types';
export { compareRanks } from './ranking';
export { trickWinnerIndex, ruleConstants } from './rules';
export type { RuleConstants } from './rules';
```

- [ ] **Step 2: Widen `minPlayers`**

In the same file, change:

```ts
export const batakDescriptor: GameDescriptor<BatakState, BatakMove> = {
  id: 'batak',
  displayName: 'Batak',
  category: 'trick-taking',
  minPlayers: 4,
  maxPlayers: 4,
```

to:

```ts
export const batakDescriptor: GameDescriptor<BatakState, BatakMove> = {
  id: 'batak',
  displayName: 'Batak',
  category: 'trick-taking',
  minPlayers: 3,
  maxPlayers: 4,
```

- [ ] **Step 3: Typecheck and run the existing suite**

Run: `npx tsc -p packages/engine/tsconfig.json --noEmit`
Expected: no new errors.

Run: `npx jest packages/engine/src/games/batak --silent`
Expected: all suites pass unchanged (this is a pure visibility/metadata change).

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/games/batak/index.ts
git commit -m "Export ruleConstants from the batak package index; widen minPlayers to 3 for gömmeli"
```

---

## Task 2: `BatakSetupView` variant picker

**Files:**
- Create: `apps/mobile/src/games/batak/batakVariant.ts`
- Modify: `apps/mobile/src/games/batak/BatakSetupView.tsx`

**Interfaces:**
- Produces: `export type BatakVariant = 'standard' | 'gomeli';` — consumed by Task 3.
- Produces: `BatakSetupViewProps.onStart` signature changes from `(difficulty: Difficulty) => void` to `(difficulty: Difficulty, variant: BatakVariant) => void` — Task 3's `BatakScreen` must update its `startGame` call site to match.

- [ ] **Step 1: Create the shared variant type**

Create `apps/mobile/src/games/batak/batakVariant.ts`:

```ts
// 3-player "gömmeli" is the only 3-player Batak variant that exists (no other 3-player ruleset
// is implemented), so this is a straight binary choice rather than a separate player-count
// control — picking 'gomeli' always means 3 total players (human + 2 AI).
export type BatakVariant = 'standard' | 'gomeli';
```

- [ ] **Step 2: Add the variant picker to `BatakSetupView`**

Replace the full contents of `apps/mobile/src/games/batak/BatakSetupView.tsx` with:

```tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Difficulty } from '@world-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';
import type { BatakVariant } from './batakVariant';

export interface BatakSetupViewProps {
  defaultDifficulty: Difficulty;
  onStart: (difficulty: Difficulty, variant: BatakVariant) => void;
  onBack: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const VARIANTS: { value: BatakVariant; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: '4 players' },
  { value: 'gomeli', label: 'Gömmeli', description: '3 players, buried kitty' },
];

export function BatakSetupView({ defaultDifficulty, onStart, onBack }: BatakSetupViewProps) {
  const [variant, setVariant] = useState<BatakVariant>('standard');

  function handlePress(value: Difficulty) {
    useSettingsStore.getState().setDefaultDifficulty(value);
    onStart(value, variant);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Batak</Text>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Choose a variant</Text>
      {VARIANTS.map(({ value, label, description }) => (
        <Pressable
          key={value}
          onPress={() => setVariant(value)}
          style={[styles.option, value === variant && styles.optionDefault]}
          testID={`batak-variant-${value}`}
        >
          <Text style={styles.optionText}>{label}</Text>
          <Text style={styles.variantDescription}>{description}</Text>
        </Pressable>
      ))}

      <Text style={styles.title}>Choose a difficulty</Text>
      {DIFFICULTIES.map(({ value, label }) => (
        <Pressable
          key={value}
          onPress={() => handlePress(value)}
          style={[styles.option, value === defaultDifficulty && styles.optionDefault]}
        >
          <Text style={styles.optionText}>{label}</Text>
          {value === defaultDifficulty && <Text style={styles.defaultBadge}>Last played</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#12121f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  backLink: { fontSize: 15, fontWeight: '600', color: '#cbb98a' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 16, marginTop: 8, textAlign: 'center', color: '#f5f0e6' },
  option: {
    backgroundColor: '#1e1e33',
    borderWidth: 1,
    borderColor: 'rgba(244, 197, 66, 0.35)',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#f4c542', backgroundColor: 'rgba(244, 197, 66, 0.14)' },
  optionText: { fontSize: 18, color: '#eee' },
  variantDescription: { fontSize: 13, color: '#cbb98a', marginTop: 2 },
  defaultBadge: { fontSize: 12, color: '#f4c542', marginTop: 2 },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: new errors at `BatakScreen.tsx`'s existing `<BatakSetupView onStart={startGame} ... />` call site and its `startGame` definition — expected at this point, fixed in Task 3. Confirm the errors are scoped to `BatakScreen.tsx` only.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/batakVariant.ts apps/mobile/src/games/batak/BatakSetupView.tsx
git commit -m "Add Standard/Gömmeli variant picker to BatakSetupView"
```

---

## Task 3: `BatakScreen` variant-aware wiring + `isTrickCompleting` generalization

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`

**Interfaces:**
- Consumes: `BatakVariant` (Task 2), `BatakSetupViewProps.onStart` new signature (Task 2).
- Produces: `BatakScreen`'s internal `ActiveGame` now receives `aiIds`/`playerNames` instead of module-level constants — Task 5/7/9 read `opponentPlayerIds.length` (already passed to `BatakTable` as `opponentPlayerIds={aiIds}`) to detect gömmeli mode; no new prop is needed on `BatakTable` for "is this gömmeli" — 2 vs. 3 entries in `opponentPlayerIds` is the single source of truth, consistent with how seating (Task 4) already dispatches purely on `opponentPlayerIds.length`.

- [ ] **Step 1: Add variant-keyed AI id/name maps and thread `variant` through session state**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, change the imports and top-level constants:

```ts
import React, { useEffect, useRef, useState } from 'react';
import type { Difficulty, PlayerId, RNG } from '@world-cards/engine';
import { createRng } from '@world-cards/engine';
import { batakDescriptor, BatakState, BatakMove, trickWinnerIndex } from '@world-cards/engine/games/batak';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { useReducedMotion } from '../../components/useReducedMotion';
import { useAITurn } from '../../hooks/useAITurn';
import { useDealSequence } from '../../hooks/useDealSequence';
import { CARD_TRAVEL_DURATION_MS } from '../../table/travelAnimation';
import { BatakSetupView } from './BatakSetupView';
import { BatakTable, PendingBatakPlay, GatheringTrick } from './BatakTable';
import { BatakSettingsModal } from './BatakSettingsModal';
import type { BatakVariant } from './batakVariant';

const HUMAN_ID: PlayerId = 'human';

const AI_IDS_BY_VARIANT: Record<BatakVariant, PlayerId[]> = {
  standard: ['ai-1', 'ai-2', 'ai-3'],
  gomeli: ['ai-1', 'ai-2'],
};

const PLAYER_NAMES_BY_VARIANT: Record<BatakVariant, Record<PlayerId, string>> = {
  standard: {
    [HUMAN_ID]: 'You',
    'ai-1': 'AI 1',
    'ai-2': 'AI 2',
    'ai-3': 'AI 3',
  },
  gomeli: {
    [HUMAN_ID]: 'You',
    'ai-1': 'AI 1',
    'ai-2': 'AI 2',
  },
};
```

(Remove the old module-level `const AI_IDS: PlayerId[] = [...]` and `const PLAYER_NAMES: Record<PlayerId, string> = {...}` entirely — replaced by the two maps above.)

- [ ] **Step 2: Update `BatakSession`, `startGame`, and `BatakScreen`**

Change:

```ts
interface BatakSession {
  difficulty: Difficulty;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
}

export function BatakScreen({ onExitToHome }: BatakScreenProps) {
  const [session, setSession] = useState<BatakSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty) {
    const rng = createRng(Date.now());
    const initialState = batakDescriptor.ruleEngine.setup(
      { players: [HUMAN_ID, ...AI_IDS], guaranteeStrongHand: difficulty === 'easy' },
      rng
    );
    const useSessionStore = createGameSessionStore(batakDescriptor.ruleEngine, initialState);
    setSession({ difficulty, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <BatakSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} onBack={onExitToHome} />;
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() => startGame(session.difficulty)}
      onBackHome={onExitToHome}
    />
  );
}
```

to:

```ts
interface BatakSession {
  difficulty: Difficulty;
  variant: BatakVariant;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
}

export function BatakScreen({ onExitToHome }: BatakScreenProps) {
  const [session, setSession] = useState<BatakSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty, variant: BatakVariant) {
    const rng = createRng(Date.now());
    const aiIds = AI_IDS_BY_VARIANT[variant];
    const initialState = batakDescriptor.ruleEngine.setup(
      { players: [HUMAN_ID, ...aiIds], guaranteeStrongHand: difficulty === 'easy' },
      rng
    );
    const useSessionStore = createGameSessionStore(batakDescriptor.ruleEngine, initialState);
    setSession({ difficulty, variant, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <BatakSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} onBack={onExitToHome} />;
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      variant={session.variant}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() => startGame(session.difficulty, session.variant)}
      onBackHome={onExitToHome}
    />
  );
}
```

- [ ] **Step 3: Update `ActiveGameProps`/`ActiveGame` to use the variant-keyed maps**

Change:

```ts
interface ActiveGameProps {
  difficulty: Difficulty;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({ difficulty, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
```

to:

```ts
interface ActiveGameProps {
  difficulty: Difficulty;
  variant: BatakVariant;
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<BatakState, BatakMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({ difficulty, variant, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const aiIds = AI_IDS_BY_VARIANT[variant];
  const playerNames = PLAYER_NAMES_BY_VARIANT[variant];
```

Then, further down in the same function, replace every use of the old module-level `AI_IDS`/`PLAYER_NAMES` with the new locals `aiIds`/`playerNames`:

- `useAITurn({ ..., aiPlayerIds: AI_IDS, ... })` → `useAITurn({ ..., aiPlayerIds: aiIds, ... })`
- `<BatakTable ... opponentPlayerIds={AI_IDS} playerNames={PLAYER_NAMES} ... />` → `<BatakTable ... opponentPlayerIds={aiIds} playerNames={playerNames} ... />`
- `<GameResultModal ... playerNames={PLAYER_NAMES} ... />` → `<GameResultModal ... playerNames={playerNames} ... />`

- [ ] **Step 4: Generalize `isTrickCompleting`**

Change:

```ts
      const isTrickCompleting = state.currentTrick.length === 3;
```

to:

```ts
      // Generalized from the old hardcoded `=== 3` (which only worked for the fixed 4-player
      // game): a trick completes once every player but the current one has already played.
      const isTrickCompleting = state.currentTrick.length === state.players.length - 1;
```

- [ ] **Step 5: Typecheck and run the full mobile suite**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors (the two errors flagged at the end of Task 2 are now gone).

Run: `npx jest apps/mobile --silent`
Expected: all suites pass unchanged — no existing test constructs `BatakScreen`/`BatakSetupView` with the old 1-argument `onStart` signature (confirm this by reading the test failure list if anything fails; if a test does call the old signature, update only its call site to pass a variant, e.g. `'standard'`, without changing what it asserts).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "Make BatakScreen variant-aware (Gömmeli AI ids/names) and generalize isTrickCompleting"
```

---

## Task 4: `assignSeats` 2-opponent branch (left/right)

**Files:**
- Modify: `apps/mobile/src/table/seating.ts`

**Interfaces:**
- Produces: `assignSeats(opponentPlayerIds: string[]): Seat[]` now also handles `opponentPlayerIds.length === 2`, returning `[{position:'left',...}, {position:'right',...}]` with no `'top'` entry. Every other input length's behavior is unchanged.

- [ ] **Step 1: Add the branch**

In `apps/mobile/src/table/seating.ts`, change:

```ts
// 1 opponent sits across the table (top); 3 sit left/top/right around the human, who is
// always at the bottom. Turn order (state.players, human first) proceeds counter-clockwise —
// bottom → right → top → left → bottom — so the first opponent in turn order sits on the
// right, not the left. Any other count falls back to seating everyone across the top.
export function assignSeats(opponentPlayerIds: string[]): Seat[] {
  if (opponentPlayerIds.length === 3) {
    const [right, top, left] = opponentPlayerIds;
    return [
      { position: "left", playerId: left },
      { position: "top", playerId: top },
      { position: "right", playerId: right },
    ];
  }
  return opponentPlayerIds.map(playerId => ({
    position: "top" as const,
    playerId,
  }));
}
```

to:

```ts
// 1 opponent sits across the table (top); 3 sit left/top/right around the human, who is
// always at the bottom. Turn order (state.players, human first) proceeds counter-clockwise —
// bottom → right → top → left → bottom — so the first opponent in turn order sits on the
// right, not the left. 2 opponents (Batak gömmeli) drop the top seat entirely and sit
// left/right, matching a real 3-handed table where every seat can see every other — same
// counter-clockwise turn order with 'top' simply removed from the sequence: bottom → right →
// left → bottom. Any other count falls back to seating everyone across the top.
export function assignSeats(opponentPlayerIds: string[]): Seat[] {
  if (opponentPlayerIds.length === 3) {
    const [right, top, left] = opponentPlayerIds;
    return [
      { position: "left", playerId: left },
      { position: "top", playerId: top },
      { position: "right", playerId: right },
    ];
  }
  if (opponentPlayerIds.length === 2) {
    const [right, left] = opponentPlayerIds;
    return [
      { position: "left", playerId: left },
      { position: "right", playerId: right },
    ];
  }
  return opponentPlayerIds.map(playerId => ({
    position: "top" as const,
    playerId,
  }));
}
```

- [ ] **Step 2: Typecheck and run the full mobile suite**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors.

Run: `npx jest apps/mobile --silent`
Expected: all suites pass unchanged (existing tests only ever call `assignSeats` with 1 or 3 opponents; this is a pure addition).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/table/seating.ts
git commit -m "Add 2-opponent (left/right) seat assignment for Batak gömmeli"
```

---

## Task 5: Permanent kitty pile

**Files:**
- Create: `apps/mobile/src/games/batak/table/KittyPile.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `BatakState` (engine, unchanged), `PlayingCard`/`CARD_DIMS` (`@world-cards/ui`, unchanged).
- Produces: `export function kittyPileCards(state: BatakState): Card[]` and `export function KittyPile({ cards }: { cards: Card[] })` — Task 9 reuses `kittyPileCards` to derive the same 4 cards for the reveal/collect animation legs.

- [ ] **Step 1: Create `KittyPile.tsx`**

Create `apps/mobile/src/games/batak/table/KittyPile.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { BatakState } from '@world-cards/engine/games/batak';
import { PlayingCard, CARD_DIMS } from '@world-cards/ui';

// The 4-card kitty is dealt face-down into a real 'kitty' zone as part of the initial deal
// (packages/engine/src/games/batak/rules.ts:52,180) and sits there untouched through bidding
// and trump-selection. The moment trump is selected, that same move atomically merges the
// kitty into the bidder's hand and empties the 'kitty' zone (rules.ts:290-291) — so once
// state.phase is 'kitty-exchange', the zone itself is already empty. This function keeps
// returning the same 4 cards throughout the whole kitty-exchange phase (looked up via
// kittyCardIds, which the engine never clears) so the pile visually holds still while the
// staged bury animation runs; once the bury commits and phase becomes 'playing', this
// correctly returns [] — those 4 cards are gone from the table view for good (either buried,
// hidden forever, or now just an ordinary part of the bidder's hand).
export function kittyPileCards(state: BatakState): Card[] {
  if (state.phase === 'kitty-exchange' && state.kittyCardIds && state.bidWinner) {
    const bidderHand = state.table.zones[`hand-${state.bidWinner}`].cards;
    return state.kittyCardIds
      .map((id) => bidderHand.find((c) => c.id === id))
      .filter((c): c is Card => c != null);
  }
  const kittyZone = state.table.zones['kitty'];
  return kittyZone ? kittyZone.cards : [];
}

const PILE_OVERLAP_PX = Math.round(CARD_DIMS.small.height * 0.85);

export function KittyPile({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.pile} testID="kitty-pile">
      {cards.map((card, i) => (
        <View key={card.id} style={i === 0 ? undefined : { marginTop: -PILE_OVERLAP_PX }}>
          <PlayingCard card={card} faceDown size="small" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pile: { alignItems: 'center', justifyContent: 'center', minHeight: 56 },
});
```

- [ ] **Step 2: Render it at the vacant top slot in `BatakTable`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, add the import:

```ts
import { KittyPile, kittyPileCards } from './table/KittyPile';
```

Then change:

```tsx
      <OpponentSeatGroup
        position="top"
        seats={seats}
        renderSeat={(seat) => (
          <OpponentSeat seat={seat} state={state} playerNames={playerNames} pendingPlay={pendingPlay} />
        )}
      />
```

to:

```tsx
      <OpponentSeatGroup
        position="top"
        seats={seats}
        renderSeat={(seat) => (
          <OpponentSeat seat={seat} state={state} playerNames={playerNames} pendingPlay={pendingPlay} />
        )}
      />
      {opponentPlayerIds.length === 2 && <KittyPile cards={kittyPileCards(state)} />}
```

(This renders in the same top slot `OpponentSeatGroup` would otherwise occupy — which is empty for a 2-opponent table per Task 4's seating, so there is no visual conflict with any seat.)

- [ ] **Step 3: Typecheck and run the full mobile suite**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors.

Run: `npx jest apps/mobile --silent`
Expected: all suites pass unchanged (4-player games have `opponentPlayerIds.length === 3`, so `KittyPile` never renders there; `kittyPileCards` for a 4-player state hits the `state.table.zones['kitty']` branch, which is `undefined` for 4-player games per `rules.ts:52`, returning `[]`).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/table/KittyPile.tsx apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Render the permanent face-down kitty pile for Batak gömmeli"
```

---

## Task 6: `useBurySlots` hook

**Files:**
- Create: `apps/mobile/src/games/batak/table/useBurySlots.ts`

**Interfaces:**
- Produces: `export function useBurySlots(slotCount: number, onConfirm: (cardIds: string[]) => void)`, returning `{ slotCardIds: (string | null)[]; placedCardIds: string[]; isPlaced: (cardId: string) => boolean; toggleCard: (cardId: string) => void; canConfirm: boolean; confirm: () => void; clear: () => void }` — consumed by Task 7.

- [ ] **Step 1: Create the hook**

Create `apps/mobile/src/games/batak/table/useBurySlots.ts`:

```ts
import { useCallback, useState } from 'react';

export interface UseBurySlotsResult {
  // Fixed-length array (length === slotCount); null means that slot is empty.
  slotCardIds: (string | null)[];
  // Convenience view of slotCardIds with the nulls removed, in slot order.
  placedCardIds: string[];
  isPlaced: (cardId: string) => boolean;
  // A single tap toggles a card: if it's already in a slot, it returns to the hand; otherwise
  // it's placed in the next open slot (a no-op if every slot is already full).
  toggleCard: (cardId: string) => void;
  canConfirm: boolean;
  confirm: () => void;
  clear: () => void;
}

// Tracks which cards the human has placed into the kitty-exchange bury slots — a different
// contract than components/useCardSelection.ts's single tap-to-select-then-tap-to-play state,
// so this is a separate hook rather than an overload of that one (see
// docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md Section 5).
export function useBurySlots(slotCount: number, onConfirm: (cardIds: string[]) => void): UseBurySlotsResult {
  const [slotCardIds, setSlotCardIds] = useState<(string | null)[]>(() => Array(slotCount).fill(null));

  const isPlaced = useCallback((cardId: string) => slotCardIds.includes(cardId), [slotCardIds]);

  const toggleCard = useCallback((cardId: string) => {
    setSlotCardIds((prev) => {
      const placedIndex = prev.indexOf(cardId);
      if (placedIndex !== -1) {
        const next = [...prev];
        next[placedIndex] = null;
        return next;
      }
      const openIndex = prev.indexOf(null);
      if (openIndex === -1) return prev;
      const next = [...prev];
      next[openIndex] = cardId;
      return next;
    });
  }, []);

  const clear = useCallback(() => setSlotCardIds(Array(slotCount).fill(null)), [slotCount]);

  const placedCardIds = slotCardIds.filter((id): id is string => id != null);
  const canConfirm = placedCardIds.length === slotCount;

  const confirm = useCallback(() => {
    if (placedCardIds.length === slotCount) onConfirm(placedCardIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedCardIds, slotCount, onConfirm]);

  return { slotCardIds, placedCardIds, isPlaced, toggleCard, canConfirm, confirm, clear };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors (this file has no consumers yet, so nothing else changes).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/table/useBurySlots.ts
git commit -m "Add useBurySlots hook for the kitty-exchange bury-slot placement interaction"
```

---

## Task 7: `BurySlots` + `KittyExchangeCenter` — real hand↔slot travel, status message, Confirm

This is the task that makes the pre-Confirm interaction real: tapping a hand card must visibly
travel into a slot (not just disappear/reappear), and tapping a placed card must visibly travel
back to the hand — both reusing this codebase's existing animation primitives rather than
snapping. The hand→slot leg reuses `TravelCard` unchanged (rendered inside the slot itself, its
existing "renders at rest, flies in from `originOffset`" contract is exactly right). The
slot→hand leg needs one small, targeted extension to `HumanHandFan.tsx`'s `AnimatedFanCard`,
because that component's existing "first render → snap straight to slot, no animation" branch
was written for the initial deal (where nothing should animate in) and would otherwise make a
returning card snap instead of travel.

**Files:**
- Create: `apps/mobile/src/games/batak/table/BurySlots.tsx`
- Create: `apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx`
- Modify: `apps/mobile/src/games/batak/table/HumanHandFan.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `useBurySlots` (Task 6), `TravelCard` (existing, `apps/mobile/src/table/TravelCard.tsx`), `BatakState`/`BatakMove`/`Card` (engine), `centerPanelStyles` (existing).
- Produces: `HandSlot` gains an optional `enterFromOffset?: { x: number; y: number } | null` field (default behavior unchanged when omitted/null — every existing caller, including Pişti's own use of the same fan-geometry helpers, is unaffected since this field is new and optional). `BatakTable` gains a new `onBury: (cardIds: [string, string, string, string]) => void` prop (mirroring `onPlayCard`) — consumed by Task 8.

- [ ] **Step 1: Extend `HandSlot` and `AnimatedFanCard`'s mount branch in `HumanHandFan.tsx`**

Change:

```ts
export interface HandSlot {
  card: Card;
  row: 'top' | 'bottom';
  indexInRow: number;
  rowCount: number;
}
```

to:

```ts
export interface HandSlot {
  card: Card;
  row: 'top' | 'bottom';
  indexInRow: number;
  rowCount: number;
  // Non-null only for a card returning to the hand from a Batak gömmeli bury slot — makes its
  // very first render (in this component instance's lifetime — it was unmounted while placed in
  // a slot, so this genuinely is a fresh mount) animate in from this offset using the exact same
  // reposition timing/easing every other hand reflow already uses, instead of the initial-deal
  // behavior of snapping straight to its slot with no animation.
  enterFromOffset?: { x: number; y: number } | null;
}
```

Change `AnimatedFanCard`'s mount effect:

```ts
  useEffect(() => {
    if (!mounted.current) {
      // First render for this card (the initial deal): jump straight to its slot — nothing to
      // reflow from, and EntranceCard supplies the deal's own fade/scale/rise flourish.
      mounted.current = true;
      return;
    }
    if (reducedMotion) {
      x.setValue(targetX);
      y.setValue(targetY);
      return;
    }
    Animated.parallel([
      Animated.timing(x, {
        toValue: targetX,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: targetY,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [targetX, targetY, reducedMotion, x, y]);
```

to:

```ts
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (slot.enterFromOffset && !reducedMotion) {
        // A card returning from a bury slot: start offset from its true target and animate in,
        // reusing the exact same reposition timing/easing as an ordinary reflow.
        x.setValue(targetX + slot.enterFromOffset.x);
        y.setValue(targetY + slot.enterFromOffset.y);
        Animated.parallel([
          Animated.timing(x, {
            toValue: targetX,
            duration: HAND_CARD_REPOSITION_DURATION_MS,
            easing: HAND_CARD_REPOSITION_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(y, {
            toValue: targetY,
            duration: HAND_CARD_REPOSITION_DURATION_MS,
            easing: HAND_CARD_REPOSITION_EASING,
            useNativeDriver: true,
          }),
        ]).start();
      }
      // Plain first render for a genuinely new card (the initial deal, or reducedMotion): jump
      // straight to its slot — EntranceCard supplies the deal's own fade/scale/rise flourish.
      return;
    }
    if (reducedMotion) {
      x.setValue(targetX);
      y.setValue(targetY);
      return;
    }
    Animated.parallel([
      Animated.timing(x, {
        toValue: targetX,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: targetY,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, targetY, reducedMotion, x, y]);
```

- [ ] **Step 2: Create `BurySlots.tsx`**

Create `apps/mobile/src/games/batak/table/BurySlots.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard } from '@world-cards/ui';
import { TravelCard } from '../../../table/TravelCard';

const BURY_SLOT_SIZE = 56;
// The bury slots render in the table's center panel — roughly halfway between the human's hand
// (bottom) and the vacant top slot, a smaller vertical travel distance than the ~195px
// REVEAL_ORIGIN_OFFSETS.bottom other animations use for a full hand<->seat trip. First-pass
// value; tune once running live.
const HAND_TO_SLOT_OFFSET = { x: 0, y: 140 };

export function BurySlots({
  slotCardIds,
  cardsById,
  onTapCard,
}: {
  slotCardIds: (string | null)[];
  cardsById: Map<string, Card>;
  onTapCard: (cardId: string) => void;
}) {
  return (
    <View style={styles.slotRow} testID="bury-slots">
      {slotCardIds.map((cardId, i) => {
        const card = cardId ? cardsById.get(cardId) : undefined;
        return (
          <View key={i} style={[styles.slot, card && styles.slotFilled]}>
            {card && (
              <TravelCard originOffset={HAND_TO_SLOT_OFFSET} resetKey={card.id}>
                <Pressable onPress={() => onTapCard(card.id)} accessibilityRole="button">
                  <PlayingCard card={card} size="small" />
                </Pressable>
              </TravelCard>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  slotRow: { flexDirection: 'row', gap: 10 },
  slot: {
    width: BURY_SLOT_SIZE,
    height: BURY_SLOT_SIZE,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slotFilled: { backgroundColor: 'rgba(0, 0, 0, 0.15)', borderColor: 'rgba(255, 255, 255, 0.45)' },
});
```

- [ ] **Step 3: Create `KittyExchangeCenter.tsx`**

Create `apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { BatakState } from '@world-cards/engine/games/batak';
import { centerPanelStyles } from './centerPanelStyles';
import { BurySlots } from './BurySlots';

export function KittyExchangeCenter({
  state,
  playerNames,
  humanPlayerId,
  slotCardIds,
  cardsById,
  onTapSlotCard,
  canConfirm,
  onConfirm,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
  humanPlayerId: string;
  slotCardIds: (string | null)[];
  cardsById: Map<string, Card>;
  onTapSlotCard: (cardId: string) => void;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  const isHumanBidder = state.bidWinner === humanPlayerId;
  const statusText = isHumanBidder
    ? 'Choose four cards to bury.'
    : `${playerNames[state.bidWinner ?? ''] ?? state.bidWinner} is choosing four cards to bury…`;

  return (
    <View style={centerPanelStyles.centerPanel}>
      <Text style={centerPanelStyles.centerHeading}>{statusText}</Text>
      {isHumanBidder && (
        <>
          <BurySlots slotCardIds={slotCardIds} cardsById={cardsById} onTapCard={onTapSlotCard} />
          <Pressable
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}>
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  confirmButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#f4c542',
  },
  confirmButtonDisabled: { backgroundColor: 'rgba(244, 197, 66, 0.35)' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#12121f' },
});
```

- [ ] **Step 4: Wire `useBurySlots`, the return-travel tracking, and hand-tap routing into `BatakTable`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, add imports:

```ts
import { useBurySlots } from './table/useBurySlots';
import { KittyExchangeCenter } from './table/KittyExchangeCenter';
```

Add `onBury` to `BatakTableProps`:

```ts
export interface BatakTableProps {
  state: BatakState;
  humanPlayerId: string;
  // Exactly 3 entries for Standard Batak; 2 for gömmeli (see seating.ts's 2-opponent branch).
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void;
  // Human's confirmed 4-card bury during 'kitty-exchange' — separate from onMove for the same
  // reason onPlayCard is: BatakScreen stages this into a multi-step animation before it actually
  // reaches performMove, exactly like onPlayCard's trick-completion staging.
  onBury: (cardIds: [string, string, string, string]) => void;
  pendingPlay?: PendingBatakPlay | null;
  gatheringTrick?: GatheringTrick | null;
  dealPhase: BatakDealPhase;
}
```

Inside the `BatakTable` function, after the existing `useCardSelection` block:

```ts
  const { selectedCardId, selectCard, clearSelection } = useCardSelection(playWithMeasuredOrigin);
  useEffect(() => {
    if (!isHumanInteractive) clearSelection();
  }, [isHumanInteractive, clearSelection]);
```

add:

```ts
  const isHumanBidderInKittyExchange = state.phase === 'kitty-exchange' && state.bidWinner === humanPlayerId;
  const burySlots = useBurySlots(4, (cardIds) => onBury(cardIds as [string, string, string, string]));
  useEffect(() => {
    if (!isHumanBidderInKittyExchange) burySlots.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHumanBidderInKittyExchange]);

  // Cards currently animating back into the hand after being tapped out of a bury slot — read
  // once by HandSlot.enterFromOffset (Step 1) and left in place afterward (harmless: once a
  // card's own AnimatedFanCard instance has mounted, its `mounted` ref guards against ever
  // reading this again for that same mount).
  const RETURN_TO_HAND_OFFSET = { x: 0, y: -140 };
  const [returningCardIds, setReturningCardIds] = useState<Set<string>>(new Set());

  // During kitty-exchange, a single tap places/returns a card in a bury slot instead of the
  // normal tap-to-select-then-tap-to-play flow — every remaining hand card is individually legal
  // to bury (there's no per-card legality the way there is for 'play'), so legalCardIds is
  // overridden to "everything currently in hand" for this phase specifically (computed below,
  // once humanHand is available).
  function handleBurySlotTap(cardId: string) {
    const wasPlaced = burySlots.isPlaced(cardId);
    burySlots.toggleCard(cardId);
    if (wasPlaced) {
      setReturningCardIds((prev) => new Set(prev).add(cardId));
    }
  }
  const activeSelectedCardId = isHumanBidderInKittyExchange ? null : selectedCardId;
  const activeSelectCard = isHumanBidderInKittyExchange ? handleBurySlotTap : selectCard;
```

Change the `humanHand` computation from:

```ts
  const isPendingHuman = pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanGatheringCardId = gatheringTrick?.entries.find((entry) => entry.playerId === humanPlayerId)?.card.id;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) => !(isPendingHuman && card.id === pendingPlay!.card.id) && card.id !== humanGatheringCardId,
  );
```

to:

```ts
  const isPendingHuman = pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanGatheringCardId = gatheringTrick?.entries.find((entry) => entry.playerId === humanPlayerId)?.card.id;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) =>
      !(isPendingHuman && card.id === pendingPlay!.card.id) &&
      card.id !== humanGatheringCardId &&
      !burySlots.isPlaced(card.id),
  );
```

Then, right after `handLayerRef`/`topRow`/`bottomRow`/`handSlots` are computed, attach `enterFromOffset` and clear consumed entries:

```ts
  const handSlots: HandSlot[] = [
    ...topRow.map((card, i): HandSlot => ({
      card,
      row: 'top',
      indexInRow: i,
      rowCount: topRow.length,
      enterFromOffset: returningCardIds.has(card.id) ? RETURN_TO_HAND_OFFSET : null,
    })),
    ...bottomRow.map((card, i): HandSlot => ({
      card,
      row: 'bottom',
      indexInRow: i,
      rowCount: bottomRow.length,
      enterFromOffset: returningCardIds.has(card.id) ? RETURN_TO_HAND_OFFSET : null,
    })),
  ];
  useEffect(() => {
    if (returningCardIds.size > 0) setReturningCardIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handSlots.map((s) => s.card.id).join(',')]);
```

(Replace the existing `const handSlots: HandSlot[] = [...topRow.map(...), ...bottomRow.map(...)];` block with the above — it's the same mapping, just with the new field added to each entry, plus the one-shot cleanup effect immediately after.)

Add `legalCardIds`'s override — change:

```ts
  const legalCardIds = new Set(
    legalMoves.filter((m): m is Extract<BatakMove, { type: 'play' }> => m.type === 'play').map((m) => m.cardId),
  );
```

to:

```ts
  const legalCardIds = isHumanBidderInKittyExchange
    ? new Set(humanHand.map((c) => c.id))
    : new Set(legalMoves.filter((m): m is Extract<BatakMove, { type: 'play' }> => m.type === 'play').map((m) => m.cardId));
```

Update `HumanHandFan`'s props:

```tsx
        <HumanHandFan
          slots={handSlots}
          legalCardIds={legalCardIds}
          isHumanInteractive={isHumanInteractive}
          selectedCardId={activeSelectedCardId}
          selectCard={activeSelectCard}
          playEntrance={dealPhase === 'revealing'}
          registerCardRef={registerHandCardRef}
        />
```

Finally, add the `KittyExchangeCenter` branch to the phase switch (alongside the existing `BiddingCenter`/`TrumpWaitingCenter`/`TrickCenter` branches):

```tsx
        {state.phase === 'bidding' && <BiddingCenter state={state} playerNames={playerNames} />}
        {state.phase === 'trump-selection' && state.bidWinner !== humanPlayerId && (
          <TrumpWaitingCenter state={state} playerNames={playerNames} />
        )}
        {state.phase === 'kitty-exchange' && (
          <KittyExchangeCenter
            state={state}
            playerNames={playerNames}
            humanPlayerId={humanPlayerId}
            slotCardIds={burySlots.slotCardIds}
            cardsById={new Map(state.table.zones[`hand-${humanPlayerId}`].cards.map((c) => [c.id, c]))}
            onTapSlotCard={handleBurySlotTap}
            canConfirm={burySlots.canConfirm}
            onConfirm={burySlots.confirm}
          />
        )}
        {state.phase === 'playing' && (
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: a new error at `BatakScreen.tsx`'s `<BatakTable ... />` call site (missing the now-required `onBury` prop) — expected at this point, fixed in Task 8. Confirm no other new errors.

- [ ] **Step 6: Run the full mobile suite**

Run: `npx jest apps/mobile --silent`
Expected: all suites pass unchanged (the `HandSlot.enterFromOffset` field is optional and every existing caller of `HumanHandFan`/`AnimatedFanCard` omits it, so `slot.enterFromOffset` is `undefined` there — the new branch inside the mount effect is simply never taken for Standard Batak or any existing test).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/games/batak/table/BurySlots.tsx apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx apps/mobile/src/games/batak/table/HumanHandFan.tsx apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Add real hand<->slot travel animation for Batak gömmeli's bury-slot placement"
```

---

## Task 8: `pendingBury` staged sequence in `BatakScreen`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`

**Interfaces:**
- Consumes: `onBury` (Task 7, the human's confirmed bury), `useAITurn`'s existing `onMove(move, playerId)` callback (the AI's chosen bury move — Easy/Medium/Hard all already return `{ type: 'bury', cardIds }` for this phase).
- Produces: `export interface PendingBury { playerId: string; cardIds: [string, string, string, string]; stage: 'burying' | 'revealing' | 'collecting' }` (exported from `BatakScreen.tsx`, re-exported the same way `PendingBatakPlay`/`GatheringTrick` already are from `BatakTable.tsx` — see Step 3), passed to `BatakTable` as a new `pendingBury` prop — consumed by Task 9.

- [ ] **Step 1: Add the timing constants and `PendingBury` type**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, alongside the existing `TRICK_COMPLETION_PAUSE_MS`/`PLAY_TRAVEL_DELAY_MS` constants, add:

```ts
export interface PendingBury {
  playerId: PlayerId;
  cardIds: [string, string, string, string];
  stage: 'burying' | 'revealing' | 'collecting';
}

// The 3 legs of the staged bury-then-reveal sequence (see
// docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md Section 4). First-pass values;
// KITTY_REVEAL_HOLD_MS is the one the spec calls out explicitly (bump to 4000 if 3500 reads as
// too short once it's running) — the two travel durations are ordinary first-pass animation
// timing, tunable like every other duration in this file.
const BURY_TRAVEL_MS = 500;
const KITTY_REVEAL_HOLD_MS = 3500;
const KITTY_COLLECT_MS = 500;
```

- [ ] **Step 2: Add `pendingBury` state and the `'bury'` branch in `commitMove`**

In `ActiveGame`, alongside the existing `pendingPlay`/`gatheringTrick` state and refs:

```ts
  const [pendingPlay, setPendingPlay] = useState<PendingBatakPlay | null>(null);
  const [gatheringTrick, setGatheringTrick] = useState<GatheringTrick | null>(null);
  const [pendingBury, setPendingBury] = useState<PendingBury | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gatherTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Update the cleanup effect:

```ts
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      if (gatherTimeoutRef.current) clearTimeout(gatherTimeoutRef.current);
      if (buryTimeoutRef.current) clearTimeout(buryTimeoutRef.current);
    };
  }, []);
```

In `commitMove`, add a new branch immediately after the function signature (before the existing `if (move.type === 'play')` branch — order doesn't matter between them, but placing it first keeps the two staged-move branches adjacent):

```ts
  function commitMove(move: BatakMove, playerId: PlayerId, originOffset?: { x: number; y: number }) {
    if (move.type === 'bury') {
      setPendingBury({ playerId, cardIds: move.cardIds, stage: 'burying' });
      buryTimeoutRef.current = setTimeout(() => {
        setPendingBury((prev) => (prev ? { ...prev, stage: 'revealing' } : prev));
        buryTimeoutRef.current = setTimeout(() => {
          setPendingBury((prev) => (prev ? { ...prev, stage: 'collecting' } : prev));
          buryTimeoutRef.current = setTimeout(() => {
            performMove(move);
            setPendingBury(null);
          }, KITTY_COLLECT_MS);
        }, KITTY_REVEAL_HOLD_MS);
      }, BURY_TRAVEL_MS);
      return;
    }
    // Every card play now gets staged (not just the trick-completing 4th) so the new play-travel
    // animation has something to animate from for every play; bid/pass/selectTrump still commit
    // instantly since engine state already reflects them visibly with nothing to bridge.
    if (move.type === 'play') {
```

(The rest of the existing `commitMove` body — the `'play'` branch and the final `performMove(move);` fallback for bid/pass/selectTrump — is unchanged.)

- [ ] **Step 3: Add a human `onBury` handler and pass `pendingBury` to `BatakTable`**

Alongside the existing `handleHumanPlayCard`:

```ts
  function handleHumanPlayCard(cardId: string, originOffset?: { x: number; y: number }) {
    commitMove({ type: 'play', cardId }, HUMAN_ID, originOffset);
  }

  function handleHumanBury(cardIds: [string, string, string, string]) {
    commitMove({ type: 'bury', cardIds }, HUMAN_ID);
  }
```

Update the `<BatakTable ... />` JSX:

```tsx
      <BatakTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
        legalMoves={legalMoves}
        onMove={handleHumanMove}
        onPlayCard={handleHumanPlayCard}
        onBury={handleHumanBury}
        pendingPlay={pendingPlay}
        gatheringTrick={gatheringTrick}
        pendingBury={pendingBury}
        dealPhase={dealPhase}
      />
```

Also update `legalMoves`'s pending-state guard so no legal moves are computed while a bury is staging (mirroring how it already excludes `pendingPlay`/`gatheringTrick`):

```ts
  const legalMoves =
    state.players[state.currentPlayerIndex] === HUMAN_ID &&
    pendingPlay == null &&
    gatheringTrick == null &&
    pendingBury == null
      ? batakDescriptor.ruleEngine.getLegalMoves(state, HUMAN_ID)
      : [];
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: a new error at `BatakTable.tsx`'s prop type (no `pendingBury` prop declared yet) — expected at this point, fixed in Task 9. Confirm no other new errors (the `onBury` prop from Task 7 is now satisfied).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "Add pendingBury staged bury-then-reveal-then-collect sequence to BatakScreen"
```

---

## Task 9: `KittyRevealCard`/`KittyCollectCard` + wiring the 3 staged visuals and hand-filtering

**Files:**
- Create: `apps/mobile/src/table/KittyRevealCard.tsx`
- Modify: `apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `PendingBury` (Task 8), `kittyPileCards` (Task 5), `GatherCard`/`resolveRevealOrigin`/`revealOriginOffset` (existing, unchanged), `CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING` (existing, `apps/mobile/src/table/travelAnimation.ts`).
- Produces: `export function KittyRevealCard({ card }: { card: Card })` — an in-place flip (face-down → face-up, holds visible, no fade) for the reveal-hold stage; `export function KittyCollectCard({ card, destinationOffset }: { card: Card; destinationOffset: { x: number; y: number } })` — a fly-and-fade (no flip) toward `destinationOffset` for the collect stage. `KittyExchangeCenter` gains a `pendingBury` prop and renders the 'burying' leg (cards flying away from the center panel, where they actually started); `BatakTable.tsx` gains a `pendingBury` prop and renders the 'revealing'/'collecting' legs at the vacant top slot.

**Why the sequence's 3 legs render in 2 different places:** the buried cards visually start at the bury slots (the center panel) and end at the pile (the vacant top slot) — so `'burying'` must render in the center panel (`KittyExchangeCenter`, Step 3), using `GatherCard` exactly as it already works elsewhere (render at rest, fly OUT to `destinationOffset`, flip face-down, fade out). The reveal then happens in place at the pile, and the collect leg starts there too (traveling out toward the bidder) — so `'revealing'`/`'collecting'` both belong with the pile itself (`BatakTable`'s `KittyExchangeStagedPile`, Step 5), not the center panel.

**A note on why neither existing component fits the collect stage:** `TravelCard`'s contract is "renders at rest wherever the caller places it, flies in FROM `originOffset`" — rendering it at the pile's own position would make the card land AT the pile, the opposite of "leaving the pile toward the bidder." `GatherCard` does fly outward correctly, but it always flips face-down mid-flight (built for a trick card leaving the table face-up-to-be-hidden) — wrong here, since these cards are already revealed face-up and must stay that way while merging into the bidder's hand. `KittyCollectCard` is `GatherCard` minus the flip: fly toward `destinationOffset`, fade out over the last third, no rotation at all.

- [ ] **Step 1: Create `KittyRevealCard.tsx`** (holding both new components — both are small, Batak-gömmeli-specific, and used together)

Create `apps/mobile/src/table/KittyRevealCard.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard } from '@world-cards/ui';
import { useReducedMotion } from '../components/useReducedMotion';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from './travelAnimation';

// An in-place face-down -> face-up flip that holds fully visible once complete — distinct from
// GatherCard (which flips WHILE flying out and fades to fully transparent at the end, correct
// for "this card is leaving the table" but wrong here, where the whole point is that the
// revealed card stays visible for the human to read). Used only for Batak gömmeli's
// kitty-exchange reveal stage (BatakTable's staged pile, while pendingBury.stage === 'revealing').
export function KittyRevealCard({ card }: { card: Card }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [reducedMotion]);

  const frontRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const backRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontOpacity = progress.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });
  const backOpacity = progress.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });

  return (
    <Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          backfaceVisibility: 'hidden',
          opacity: frontOpacity,
          transform: [{ perspective: 800 }, { rotateY: frontRotate }],
        }}>
        <PlayingCard card={card} size="small" />
      </Animated.View>
      <Animated.View
        style={{
          backfaceVisibility: 'hidden',
          opacity: backOpacity,
          transform: [{ perspective: 800 }, { rotateY: backRotate }],
        }}>
        <PlayingCard card={card} faceDown size="small" />
      </Animated.View>
    </Animated.View>
  );
}

// Flies a face-up card from its rendered position toward destinationOffset and fades out over
// the last third — the "collecting" leg of the kitty-exchange sequence, once the reveal hold is
// over. Deliberately GatherCard's exact shape minus the flip (see this task's note on why
// GatherCard itself doesn't fit): these cards are already face-up from the reveal stage and must
// stay that way while merging into the bidder's hand (or, for an AI bidder, simply disappearing
// toward their seat — opponent hands render only a badge, per the 2026-07-18
// turn-indicator-simplification pass).
export function KittyCollectCard({
  card,
  destinationOffset,
}: {
  card: Card;
  destinationOffset: { x: number; y: number };
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [reducedMotion]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, destinationOffset.x] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, destinationOffset.y] });
  const opacity = progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View style={{ transform: [{ translateX }, { translateY }], opacity }}>
      <PlayingCard card={card} size="small" />
    </Animated.View>
  );
}
```

- [ ] **Step 2: Add `pendingBury` to `BatakTableProps` and derive the hidden-card-id set**

In `apps/mobile/src/games/batak/BatakTable.tsx`, add the import:

```ts
import { KittyRevealCard, KittyCollectCard } from '../../table/KittyRevealCard';
import { revealOriginOffset } from '../../table/seating';
import type { PendingBury } from './BatakScreen';
```

(`resolveRevealOrigin`/`Seat` are already imported in this file from Step 2's earlier work — no change needed there.)

Add `pendingBury` to the props interface:

```ts
  pendingPlay?: PendingBatakPlay | null;
  gatheringTrick?: GatheringTrick | null;
  pendingBury?: PendingBury | null;
  dealPhase: BatakDealPhase;
```

and to the destructured function parameters:

```ts
export function BatakTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  legalMoves,
  onMove,
  onPlayCard,
  onBury,
  pendingPlay,
  gatheringTrick,
  pendingBury,
  dealPhase,
}: BatakTableProps) {
```

By this point (after Task 7), `humanHand` already reads:

```ts
  const isPendingHuman = pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanGatheringCardId = gatheringTrick?.entries.find((entry) => entry.playerId === humanPlayerId)?.card.id;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) =>
      !(isPendingHuman && card.id === pendingPlay!.card.id) &&
      card.id !== humanGatheringCardId &&
      !burySlots.isPlaced(card.id),
  );
```

Change it to add the kitty-exchange hidden-card-id set:

```ts
  const isPendingHuman = pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanGatheringCardId = gatheringTrick?.entries.find((entry) => entry.playerId === humanPlayerId)?.card.id;
  // While the human's own bury is staging, both the just-buried cards (hidden forever once
  // committed) and — once the reveal stage starts — the original kitty cards are shown instead
  // by the staged pile visuals (Step 3 below), so they're filtered out of the ordinary hand
  // render for the same reason a pending play/gathering card already is above. The two id sets
  // can overlap (the human may have chosen to bury some of the actual kitty cards) — a Set
  // naturally dedupes that.
  const kittyExchangeHiddenCardIds = new Set<string>();
  if (pendingBury && pendingBury.playerId === humanPlayerId) {
    pendingBury.cardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
    if (pendingBury.stage !== 'burying' && state.kittyCardIds) {
      state.kittyCardIds.forEach((id) => kittyExchangeHiddenCardIds.add(id));
    }
  }
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) =>
      !(isPendingHuman && card.id === pendingPlay!.card.id) &&
      card.id !== humanGatheringCardId &&
      !burySlots.isPlaced(card.id) &&
      !kittyExchangeHiddenCardIds.has(card.id),
  );
```

Also disable hand interactivity while a bury is staging. Change:

```ts
  const isHumanInteractive = isHumanTurn && pendingPlay == null && gatheringTrick == null;
```

to:

```ts
  const isHumanInteractive =
    isHumanTurn && pendingPlay == null && gatheringTrick == null && pendingBury == null;
```

- [ ] **Step 3: Retrofit `KittyExchangeCenter.tsx` for the 'burying' stage**

The 'burying' leg (buried cards flying away) must render starting from the *center panel* — that's
literally where they just were, sitting in the bury slots — not from the vacant top slot (which is
where they're *headed*, and where the reveal/collect legs correctly happen instead). This is the
one place `GatherCard` is used exactly as-is: rendered at rest in the center panel, it flies out to
`destinationOffset` and flips face-down along the way, fading out — precisely "these cards are
leaving the table into the pile."

In `apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx`, add the imports:

```ts
import { GatherCard } from '../../../table/GatherCard';
import { revealOriginOffset } from '../../../table/seating';
import type { PendingBury } from '../BatakScreen';
```

Add `pendingBury` to the props and branch on it before the normal status/slots layout. Change:

```tsx
export function KittyExchangeCenter({
  state,
  playerNames,
  humanPlayerId,
  slotCardIds,
  cardsById,
  onTapSlotCard,
  canConfirm,
  onConfirm,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
  humanPlayerId: string;
  slotCardIds: (string | null)[];
  cardsById: Map<string, Card>;
  onTapSlotCard: (cardId: string) => void;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  const isHumanBidder = state.bidWinner === humanPlayerId;
  const statusText = isHumanBidder
    ? 'Choose four cards to bury.'
    : `${playerNames[state.bidWinner ?? ''] ?? state.bidWinner} is choosing four cards to bury…`;

  return (
    <View style={centerPanelStyles.centerPanel}>
      <Text style={centerPanelStyles.centerHeading}>{statusText}</Text>
      {isHumanBidder && (
        <>
          <BurySlots slotCardIds={slotCardIds} cardsById={cardsById} onTapCard={onTapSlotCard} />
          <Pressable
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}>
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
```

to:

```tsx
export function KittyExchangeCenter({
  state,
  playerNames,
  humanPlayerId,
  slotCardIds,
  cardsById,
  onTapSlotCard,
  canConfirm,
  onConfirm,
  pendingBury,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
  humanPlayerId: string;
  slotCardIds: (string | null)[];
  cardsById: Map<string, Card>;
  onTapSlotCard: (cardId: string) => void;
  canConfirm: boolean;
  onConfirm: () => void;
  pendingBury?: PendingBury | null;
}) {
  const isHumanBidder = state.bidWinner === humanPlayerId;
  const statusText = isHumanBidder
    ? 'Choose four cards to bury.'
    : `${playerNames[state.bidWinner ?? ''] ?? state.bidWinner} is choosing four cards to bury…`;

  if (pendingBury && pendingBury.stage === 'burying') {
    const buriedCards = pendingBury.cardIds
      .map((id) => state.table.zones[`hand-${pendingBury.playerId}`].cards.find((c) => c.id === id))
      .filter((c): c is Card => c != null);
    return (
      <View style={centerPanelStyles.centerPanel}>
        <Text style={centerPanelStyles.centerHeading}>{statusText}</Text>
        <View style={styles.buryFlightRow} testID="kitty-burying">
          {buriedCards.map((card) => (
            <GatherCard key={card.id} card={card} destinationOffset={revealOriginOffset('top')} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={centerPanelStyles.centerPanel}>
      <Text style={centerPanelStyles.centerHeading}>{statusText}</Text>
      {isHumanBidder && !pendingBury && (
        <>
          <BurySlots slotCardIds={slotCardIds} cardsById={cardsById} onTapCard={onTapSlotCard} />
          <Pressable
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}>
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
```

(Note the `!pendingBury` added to the human-bidder branch's condition too: once Confirm has been
pressed, `pendingBury` becomes non-null and the slots/Confirm UI must stop rendering immediately,
regardless of which of the 3 stages is currently active — `'revealing'`/`'collecting'` show
nothing extra here at all, since those two legs render entirely at the vacant top slot instead,
per Step 5 below.)

Add the one new style, alongside the existing `confirmButton`/`confirmButtonDisabled`/`confirmText`:

```ts
const styles = StyleSheet.create({
  buryFlightRow: { flexDirection: 'row', gap: 10, minHeight: 56 },
  confirmButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#f4c542',
  },
  confirmButtonDisabled: { backgroundColor: 'rgba(244, 197, 66, 0.35)' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#12121f' },
});
```

- [ ] **Step 4: Pass `pendingBury` into `KittyExchangeCenter`'s call site**

In `apps/mobile/src/games/batak/BatakTable.tsx`, change:

```tsx
        {state.phase === 'kitty-exchange' && (
          <KittyExchangeCenter
            state={state}
            playerNames={playerNames}
            humanPlayerId={humanPlayerId}
            slotCardIds={burySlots.slotCardIds}
            cardsById={new Map(state.table.zones[`hand-${humanPlayerId}`].cards.map((c) => [c.id, c]))}
            onTapSlotCard={handleBurySlotTap}
            canConfirm={burySlots.canConfirm}
            onConfirm={burySlots.confirm}
          />
        )}
```

to:

```tsx
        {state.phase === 'kitty-exchange' && (
          <KittyExchangeCenter
            state={state}
            playerNames={playerNames}
            humanPlayerId={humanPlayerId}
            slotCardIds={burySlots.slotCardIds}
            cardsById={new Map(state.table.zones[`hand-${humanPlayerId}`].cards.map((c) => [c.id, c]))}
            onTapSlotCard={handleBurySlotTap}
            canConfirm={burySlots.canConfirm}
            onConfirm={burySlots.confirm}
            pendingBury={pendingBury}
          />
        )}
```

- [ ] **Step 5: Render the 'revealing'/'collecting' stages at the vacant top slot**

Change the `KittyPile` render line from Task 5:

```tsx
      {opponentPlayerIds.length === 2 && <KittyPile cards={kittyPileCards(state)} />}
```

to:

```tsx
      {opponentPlayerIds.length === 2 && (
        <KittyExchangeStagedPile
          state={state}
          pendingBury={pendingBury}
          humanPlayerId={humanPlayerId}
          seats={seats}
        />
      )}
```

Then add the new `KittyExchangeStagedPile` component in the same file, right above the `BatakTable` function itself:

```tsx
// Renders the vacant top slot across the kitty-exchange sequence (see
// docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md Section 4): the untouched
// face-down pile before anything is staging, and while the 'burying' leg is in progress (that
// leg's own flying-away cards render in the center panel instead — see KittyExchangeCenter, Step
// 3 above — since that's literally where they started; nothing at the pile itself changes until
// they'd actually arrive); the original kitty cards flipping face-up and holding during
// 'revealing' (KittyRevealCard); and those same cards flying out toward wherever the bidder
// actually is — the human's hand (bottom) or the bidding AI's own seat (left/right) — during
// 'collecting' (KittyCollectCard).
function KittyExchangeStagedPile({
  state,
  pendingBury,
  humanPlayerId,
  seats,
}: {
  state: BatakState;
  pendingBury?: PendingBury | null;
  humanPlayerId: string;
  seats: Seat[];
}) {
  if (!pendingBury || pendingBury.stage === 'burying') {
    return <KittyPile cards={kittyPileCards(state)} />;
  }

  const kittyCards = kittyPileCards(state);

  if (pendingBury.stage === 'revealing') {
    return (
      <View style={styles.pile} testID="kitty-pile-revealing">
        {kittyCards.map((card) => (
          <KittyRevealCard key={card.id} card={card} />
        ))}
      </View>
    );
  }

  // 'collecting'
  const destinationOffset =
    pendingBury.playerId === humanPlayerId
      ? revealOriginOffset('bottom')
      : revealOriginOffset(resolveRevealOrigin(pendingBury.playerId, humanPlayerId, seats));
  return (
    <View style={styles.pile} testID="kitty-pile-collecting">
      {kittyCards.map((card) => (
        <KittyCollectCard key={card.id} card={card} destinationOffset={destinationOffset} />
      ))}
    </View>
  );
}
```

`KittyExchangeStagedPile` references `styles.pile`, which doesn't exist yet in `BatakTable.tsx`'s own `StyleSheet.create` block at the bottom of the file (it's a different, local `styles.pile` than the one already defined inside `KittyPile.tsx` — that one isn't exported and isn't reused here). Add it alongside the existing `handArea`/`opponentArea` entries:

```ts
const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 4,
  },
  pile: { alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  handArea: {
    minHeight: 300,
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    gap: 4,
  },
});
```

(This is the existing `styles` object with one new `pile` entry added — do not duplicate the other keys. `seats` is already computed earlier in `BatakTable` via `const seats = assignSeats(opponentPlayerIds);` — no new computation needed, just pass the existing local into the new component.)

- [ ] **Step 6: Typecheck and run the full mobile suite**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors — this was the last missing piece (`pendingBury` prop now exists on `BatakTable`).

Run: `npx jest apps/mobile --silent`
Expected: all suites pass unchanged.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/table/KittyRevealCard.tsx apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Wire the 3-stage bury-then-reveal-then-collect animation and hand-filtering for Batak gömmeli"
```

---

## Task 10: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck across both packages**

Run: `npx tsc -p packages/engine/tsconfig.json --noEmit`
Expected: no errors.

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 2: Full monorepo test suite**

Run: `npx jest --silent`
Expected: all suites pass (this sub-project adds no new automated tests, per the standing policy — every existing suite, including every Batak/Pişti mobile test, must still pass unmodified).

- [ ] **Step 3: Confirm the commit log**

Run: `git log --oneline -9`
Expected: exactly the 9 commits from this plan, in order, nothing else mixed in.

- [ ] **Step 4: Note for the user**

No proactive screenshot/visual verification is performed in this plan (per the standing 2026-07-17 direction). Before considering this feature "done," the user should try it live via Expo Fast Refresh: start a Gömmeli game, verify the kitty pile appears at the vacant top slot from deal onward, win a bid as the human, place 4 cards in the bury slots, confirm, and watch the bury → reveal (~3.5s hold) → collect sequence — then try the same with an AI bidder to confirm the equivalent staged sequence runs without a slot UI.
