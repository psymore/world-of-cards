# Batak Deal Sequence, Hand Visibility, Sorting & Two-Row Fan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 4-player Batak mobile table a shuffle/cut/pause deal animation, fix the pre-existing gap where the human's hand was invisible during bidding/trump-selection, and replace the flat single-row scrollable hand with a sorted, two-row curved fan — per `docs/superpowers/specs/2026-07-15-batak-deal-sequence-and-hand-ui-design.md`.

**Architecture:** Task 1 fixes hand display (sorting, two-row fan geometry, visible from right after dealing through every phase) — a complete, shippable improvement on its own, with no animated deal sequence yet (hands just appear immediately). Task 2 layers the animated deal sequence on top (`DealAnimationOverlay` + a `dealPhase` state machine in `BatakScreen.tsx`), which also drives a staggered entrance animation for the human's hand once revealed. Task 3 is manual visual verification (no subagent — requires visual judgment).

**Tech Stack:** TypeScript, React Native (Expo), plain RN `Animated` (not Reanimated, matching every other animation in this codebase), Jest/ts-jest (no new tests — see Global Constraints).

## Global Constraints

- No engine (`packages/engine`) behavior changes. The only engine touch is exporting one already-implemented pure function (`compareRanks`) from the existing `batak` subpath — additive, no behavior change.
- Suit display order is fixed: Hearts → Spades → Diamonds → Clubs, **not** trump-relative. Rank order within a suit is A (high) → 2 (low), via the existing `compareRanks` from `packages/engine/src/games/batak/ranking.ts`.
- Two-row fan and sorting apply to the **human's hand only**. Opponents keep their existing face-down single-row fan (top)/vertical stack (sides), unchanged — do not touch `OpponentSeat`.
- Row split always rebalances: `top = Math.ceil(count / 2)`, `bottom = count - top` (13 → 7/6, 10 → 5/5, 7 → 4/3).
- Overlap is 16% of card width. Human hand cards render at `PlayingCard`'s `'small'` size (54×78px) — `'normal'` (84px) does not fit two rows of 7 within a typical 360dp-wide phone screen without horizontal scrolling, which defeats the point of a two-row layout that's meant to avoid scrolling.
- Per this project's standing testing policy (2026-07-07, `CLAUDE.md`): **no new tests are written for this plan.** This is UI/animation/layout work with no engine changes. Verification is `npx tsc --noEmit -p apps/mobile` (must stay clean after every task) plus the Task 3 manual visual check.
- Deal sequence timing: scatter shuffle ~1000ms, cut ~700ms, additional pause 1200ms (within the user's stated 1000-1500ms range), then reveal. Total ~2900ms before a hand is playable.
- Reduced motion (`useReducedMotion()` from `apps/mobile/src/components/useReducedMotion.ts`): when true, skip the `'shuffling'`/`'cutting'` phases entirely — go straight to `'revealing'` (no overlay ever mounts, no card entrance animation plays; cards simply appear in final position).
- `SelectableCard` (`apps/mobile/src/components/SelectableCard.tsx`) is a shared component used by every future game's hand UI (per its own history) — any change to it must be purely additive (new optional prop, default preserves current behavior for existing callers, i.e. Pişti).

---

### Task 1: Sorted, two-row human hand — visible from bidding onward

**Files:**
- Modify: `packages/engine/src/games/batak/index.ts`
- Modify: `apps/mobile/src/table/seating.ts`
- Modify: `apps/mobile/src/components/SelectableCard.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: existing `fanRotationDeg(index, count): number`, `fanCurveY(index, count): number` from `seating.ts` (unchanged). Existing `SelectableCardProps`/`SelectableCard` (unchanged behavior for existing callers). Existing `Card`, `Suit` types from `@world-of-cards/engine`.
- Produces: `compareRanks` now importable from `@world-of-cards/engine/games/batak`. `splitTwoRows(count: number): [number, number]` and `overlapMarginPx(cardWidth: number, overlapPercent: number): number` from `seating.ts`, consumed only by `BatakTable.tsx` in this task. `SelectableCard` gains an optional `curveOffsetY?: number` prop, consumed only by `BatakTable.tsx`'s new `HandRow` in this task (Pişti's existing usage is unaffected, since it never passes this prop).

- [ ] **Step 1: Export `compareRanks` from the `batak` engine subpath**

In `packages/engine/src/games/batak/index.ts`, add one line after the existing `export * from './types';`:

```ts
export { compareRanks } from './ranking';
```

- [ ] **Step 2: Add two-row fan geometry helpers to `seating.ts`**

In `apps/mobile/src/table/seating.ts`, add after the existing `SIDE_CARD_STYLES` export at the end of the file:

```ts
// The human's own hand (Batak, and any future game with a large face-up hand) splits into two
// rows once it can't read cleanly as one — always rebalanced as the hand shrinks, rather than
// keeping one row's size fixed, so the fan stays visually centered and full-looking at every
// hand size.
export function splitTwoRows(count: number): [number, number] {
  const top = Math.ceil(count / 2);
  return [top, count - top];
}

// Converts a percentage-based overlap (the natural way to describe "cards overlap by X%") into
// the negative marginLeft pixel value consumers actually apply, given the specific card width
// they're rendering at — kept generic here (not hardcoded to one PlayingCard size) since seating.ts
// has no PlayingCard/RN dependency.
export function overlapMarginPx(cardWidth: number, overlapPercent: number): number {
  return -Math.round(cardWidth * (overlapPercent / 100));
}
```

- [ ] **Step 3: Add `curveOffsetY` to `SelectableCard`**

In `apps/mobile/src/components/SelectableCard.tsx`, modify `SelectableCardProps` (add one field after `liftDistance`):

```ts
export interface SelectableCardProps extends PlayingCardProps {
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  rotateDeg?: number;
  marginLeft?: number;
  liftDistance?: number;
  curveOffsetY?: number;
}
```

Modify the `SelectableCard` function signature and its returned `Animated.View`'s style (destructure the new prop with a default of `0`, and combine it with the existing animated `lift` value):

```ts
export function SelectableCard({
  selected = false,
  disabled,
  onPress,
  rotateDeg = 0,
  marginLeft,
  liftDistance = DEFAULT_LIFT_DISTANCE,
  curveOffsetY = 0,
  ...cardProps
}: SelectableCardProps) {
  const lift = useRef(new Animated.Value(selected ? -liftDistance : 0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (selected || reducedMotion) {
      lift.setValue(selected ? -liftDistance : 0);
    } else {
      Animated.timing(lift, {
        toValue: 0,
        duration: LIFT_ANIM_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [selected, liftDistance, lift, reducedMotion]);

  return (
    <Animated.View
      style={{
        marginLeft,
        transform: [{ rotate: `${rotateDeg}deg` }, { translateY: Animated.add(lift, curveOffsetY) }],
      }}
    >
      <Pressable disabled={disabled} onPress={onPress}>
        <PlayingCard {...cardProps} highlighted={selected} />
      </Pressable>
    </Animated.View>
  );
}
```

(Only the `transform` line and the new destructured prop change from the current file — everything else in this function is unchanged.)

- [ ] **Step 4: Sort, split, and render the human hand as a two-row fan in `BatakTable.tsx`**

In `apps/mobile/src/games/batak/BatakTable.tsx`, update the import lines at the top of the file:

```tsx
import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Card, Suit } from '@world-of-cards/engine';
import type { BatakState, BatakMove } from '@world-of-cards/engine/games/batak';
import { compareRanks } from '@world-of-cards/engine/games/batak';
import { PlayingCard, SuitIcon, TableFelt, TableWoodCorners, glowShadow } from '@world-of-cards/ui';
import { SelectableCard } from '../../components/SelectableCard';
import { useCardSelection } from '../../components/useCardSelection';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  overlapMarginPx,
  splitTwoRows,
  OPPONENT_CARD_OVERLAP,
  SIDE_CARD_STYLES,
  HUMAN_HAND_OVERLAP_PERCENT,
} from '../../table/seating';
import type { Seat, SeatPosition } from '../../table/seating';
```

Wait — `HUMAN_HAND_OVERLAP_PERCENT` doesn't exist yet as a named export; Step 2 only added `splitTwoRows`/`overlapMarginPx`. Add it too, in `seating.ts` right next to `overlapMarginPx` from Step 2:

```ts
export const HUMAN_HAND_OVERLAP_PERCENT = 16;
```

Back in `BatakTable.tsx`, add a new constant and `sortHandForDisplay` helper near the top of the file, after the existing `suitColor` function:

```tsx
const HUMAN_CARD_WIDTH = 54; // matches PlayingCard's 'small' size width
const HUMAN_HAND_MARGIN = overlapMarginPx(HUMAN_CARD_WIDTH, HUMAN_HAND_OVERLAP_PERCENT);
const HAND_SUIT_ORDER: Suit[] = ['hearts', 'spades', 'diamonds', 'clubs'];

function sortHandForDisplay(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = HAND_SUIT_ORDER.indexOf(a.suit) - HAND_SUIT_ORDER.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return compareRanks(b.rank, a.rank); // descending within suit: A high ... 2 low
  });
}
```

Add a new `HandRow` component, after the existing `BidControls` function and before `export function BatakTable`:

```tsx
function HandRow({
  cards,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
}) {
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <View key={card.id} style={!interactive && styles.disabledCard}>
            <SelectableCard
              card={card}
              size="small"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length)}
              curveOffsetY={fanCurveY(i, cards.length)}
              marginLeft={i > 0 ? HUMAN_HAND_MARGIN : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}
```

Inside `export function BatakTable(...)`, replace this existing block:

```tsx
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const legalCardIds = new Set(
    legalMoves.filter((m): m is Extract<BatakMove, { type: 'play' }> => m.type === 'play').map((m) => m.cardId)
  );
```

with:

```tsx
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const sortedHand = sortHandForDisplay(humanHand);
  const [topRowCount] = splitTwoRows(sortedHand.length);
  const topRow = sortedHand.slice(0, topRowCount);
  const bottomRow = sortedHand.slice(topRowCount);
  const legalCardIds = new Set(
    legalMoves.filter((m): m is Extract<BatakMove, { type: 'play' }> => m.type === 'play').map((m) => m.cardId)
  );
```

Replace the existing `handArea` block:

```tsx
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        {state.phase === 'bidding' && isHumanInteractive && <BidControls legalMoves={legalMoves} onMove={onMove} />}
        {state.phase === 'playing' && (
          <ScrollView horizontal contentContainerStyle={styles.handRow} testID="human-hand">
            {humanHand.map((card) => {
              const interactive = isHumanInteractive && legalCardIds.has(card.id);
              return (
                <View key={card.id} style={!interactive && styles.disabledCard}>
                  <SelectableCard
                    card={card}
                    selected={selectedCardId === card.id}
                    disabled={!interactive}
                    onPress={() => selectCard(card.id)}
                  />
                </View>
              );
            })}
          </ScrollView>
        )}
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? 'You'}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
      </View>
```

with:

```tsx
      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handFan} testID="human-hand">
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
          />
          <HandRow
            cards={bottomRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
          />
        </View>
        {state.phase === 'bidding' && isHumanInteractive && <BidControls legalMoves={legalMoves} onMove={onMove} />}
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? 'You'}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
      </View>
```

Finally, update `styles` at the bottom of the file: change `handArea`'s `minHeight` (two rows plus bid controls plus badge need more vertical room than the old single row) and replace the now-unused `handRow` style with `handFan`/`handFanRow`:

```ts
  handArea: { minHeight: 260, justifyContent: 'center', borderRadius: 12, paddingVertical: 4, gap: 4 },
```

(replaces the existing `handArea: { minHeight: 177, justifyContent: 'center', borderRadius: 12, paddingVertical: 4 },` line)

```ts
  handFan: { alignItems: 'center', gap: 6 },
  handFanRow: { flexDirection: 'row', justifyContent: 'center' },
```

(replaces the existing `handRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12 },` line — `handRow` is no longer referenced anywhere)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile`
Expected: PASS, no errors. (`ScrollView` remains used elsewhere in this file by `BidControls`, so its import stays valid even though the hand row no longer uses it.)

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/games/batak/index.ts apps/mobile/src/table/seating.ts apps/mobile/src/components/SelectableCard.tsx apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Sort and fan the human Batak hand into two rows, visible from bidding onward"
```

---

### Task 2: Shuffle/cut deal animation + hand entrance

**Files:**
- Create: `apps/mobile/src/games/batak/DealAnimationOverlay.tsx`
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`

**Interfaces:**
- Consumes: `useReducedMotion()` from `apps/mobile/src/components/useReducedMotion.ts`. `HandRow`, `sortHandForDisplay`, `splitTwoRows` from Task 1 (unchanged signatures).
- Produces: `DealAnimationOverlay` (new component, `{ phase: 'shuffling' | 'cutting' }` props). `BatakTableProps` gains a required `dealPhase: 'shuffling' | 'cutting' | 'revealing'` field, consumed by `BatakScreen.tsx` in this task.

- [ ] **Step 1: Create `DealAnimationOverlay.tsx`**

Create `apps/mobile/src/games/batak/DealAnimationOverlay.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export interface DealAnimationOverlayProps {
  phase: 'shuffling' | 'cutting';
}

// A generic, decorative shuffle-then-cut animation shown over the table while a new hand is
// being dealt — deliberately not tied to the real 52 cards (see the design spec's "Visual
// treatment" section): four navy/gold card-back rectangles that wiggle-and-resettle during
// 'shuffling', then two packets swap vertical order during 'cutting'. Unlike TableFelt/
// CardBackPattern (which use AbsoluteOverlay's pointerEvents:'none' since they're purely
// decorative backgrounds), this overlay must actually block interaction with the table
// underneath while a deal is in progress, so it renders its own absolute-fill View instead of
// reusing AbsoluteOverlay.
export function DealAnimationOverlay({ phase }: DealAnimationOverlayProps) {
  const wiggle = useRef(new Animated.Value(0)).current;
  const cut = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'shuffling') {
      wiggle.setValue(0);
      Animated.timing(wiggle, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    }
  }, [phase, wiggle]);

  useEffect(() => {
    if (phase === 'cutting') {
      cut.setValue(0);
      Animated.timing(cut, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    }
  }, [phase, cut]);

  const wiggleTranslate = wiggle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -14, 0],
  });
  const wiggleRotate = wiggle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-8deg', '0deg'],
  });

  const cutTopTranslate = cut.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -30, 14] });
  const cutBottomTranslate = cut.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 6, -14] });

  return (
    <View style={styles.overlay}>
      {phase === 'shuffling' && (
        <Animated.View
          style={[
            styles.cardBack,
            { transform: [{ translateX: wiggleTranslate }, { rotate: wiggleRotate }] },
          ]}
        />
      )}
      {phase === 'shuffling' && (
        <Animated.View
          style={[
            styles.cardBack,
            styles.cardBackOffset,
            {
              transform: [
                { translateX: Animated.multiply(wiggleTranslate, -1) },
                { rotate: wiggle.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '8deg', '0deg'] }) },
              ],
            },
          ]}
        />
      )}
      {phase === 'cutting' && (
        <>
          <Animated.View style={[styles.cardBack, { transform: [{ translateY: cutTopTranslate }] }]} />
          <Animated.View
            style={[styles.cardBack, styles.cardBackOffset, { transform: [{ translateY: cutBottomTranslate }] }]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 102, 35, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardBack: {
    position: 'absolute',
    width: 46,
    height: 66,
    borderRadius: 6,
    backgroundColor: '#1c2451',
    borderWidth: 1.5,
    borderColor: '#ffd966',
  },
  cardBackOffset: { marginTop: -4 },
});
```

- [ ] **Step 2: Add `dealPhase` prop to `BatakTable`, render the overlay, and trigger hand entrance**

In `apps/mobile/src/games/batak/BatakTable.tsx`, add the import:

```tsx
import { DealAnimationOverlay } from './DealAnimationOverlay';
```

Add `dealPhase` to `BatakTableProps` (after `pendingPlay`):

```tsx
export type BatakDealPhase = 'shuffling' | 'cutting' | 'revealing';

export interface BatakTableProps {
  state: BatakState;
  humanPlayerId: string;
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
  pendingPlay?: PendingBatakPlay | null;
  dealPhase: BatakDealPhase;
}
```

(`BatakDealPhase` is exported here, not redeclared in `BatakScreen.tsx` — see Step 3.)

Add `dealPhase` to the destructured props of `export function BatakTable(...)`:

```tsx
export function BatakTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  legalMoves,
  onMove,
  pendingPlay,
  dealPhase,
}: BatakTableProps) {
```

At the end of `BatakTable`'s JSX, as the last child of the outer `<View style={styles.container}>` (after the closing tag of the existing `handArea` View, still inside `container`), add:

```tsx
      {dealPhase !== 'revealing' && <DealAnimationOverlay phase={dealPhase} />}
```

Give `HandRow` an entrance animation, triggered once when `dealPhase` first becomes `'revealing'`. Modify `HandRow`'s signature and body:

```tsx
function HandRow({
  cards,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
}) {
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <EntranceCard key={card.id} index={i} playEntrance={playEntrance}>
            <View style={!interactive && styles.disabledCard}>
              <SelectableCard
                card={card}
                size="small"
                selected={selectedCardId === card.id}
                disabled={!interactive}
                onPress={() => selectCard(card.id)}
                rotateDeg={fanRotationDeg(i, cards.length)}
                curveOffsetY={fanCurveY(i, cards.length)}
                marginLeft={i > 0 ? HUMAN_HAND_MARGIN : undefined}
              />
            </View>
          </EntranceCard>
        );
      })}
    </View>
  );
}

// Plays a one-shot fade+scale+rise entrance the first time `playEntrance` becomes true (the
// moment the deal sequence reaches 'revealing'), then stays static — re-renders after that
// (card removed by a play, selection state changing) must not replay it, hence the `played` ref.
function EntranceCard({
  index,
  playEntrance,
  children,
}: {
  index: number;
  playEntrance: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(playEntrance ? 1 : 0)).current;
  const played = useRef(playEntrance);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (playEntrance && !played.current) {
      played.current = true;
      if (reducedMotion) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 350,
        delay: index * 40,
        useNativeDriver: true,
      }).start();
    }
  }, [playEntrance, index, progress, reducedMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
```

Add the two new imports this requires at the top of the file (`Animated`, `useRef` from React, and the hook):

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
```

(replaces the existing `import React, { useEffect } from 'react';` and `import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';` lines)

```tsx
import { useReducedMotion } from '../../components/useReducedMotion';
```

(new import, added alongside the existing `useCardSelection`/`PlayerAvatar` imports)

Update both `<HandRow ... />` call sites inside `BatakTable` (from Task 1) to pass `playEntrance={dealPhase === 'revealing'}`:

```tsx
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === 'revealing'}
          />
          <HandRow
            cards={bottomRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === 'revealing'}
          />
```

- [ ] **Step 3: Drive `dealPhase` from `BatakScreen.tsx`**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, add imports:

```tsx
import { useReducedMotion } from '../../components/useReducedMotion';
```

Also add `BatakDealPhase` to the existing `BatakTable` import line (which currently reads `import { BatakTable, PendingBatakPlay } from './BatakTable';`):

```tsx
import { BatakTable, BatakDealPhase, PendingBatakPlay } from './BatakTable';
```

Add these constants near the existing `TRICK_COMPLETION_PAUSE_MS`:

```tsx
const SHUFFLE_MS = 1000;
const CUT_MS = 700;
const DEAL_PAUSE_MS = 1200;
```

Add a small hook, right after the constants and before `BatakScreenProps`:

```tsx
// Runs once per ActiveGame mount (i.e. once per hand — a fresh mount happens on every
// startGame call, both the initial game and every "Play Again", via BatakScreen's
// key={sessionKey}), so no extra reset logic is needed here: a new hand always gets a fresh
// deal sequence for free.
function useDealSequence(): BatakDealPhase {
  const reducedMotion = useReducedMotion();
  const [dealPhase, setDealPhase] = useState<BatakDealPhase>(reducedMotion ? 'revealing' : 'shuffling');

  useEffect(() => {
    if (reducedMotion) {
      setDealPhase('revealing');
      return;
    }
    setDealPhase('shuffling');
    const toCutting = setTimeout(() => setDealPhase('cutting'), SHUFFLE_MS);
    const toRevealing = setTimeout(() => setDealPhase('revealing'), SHUFFLE_MS + CUT_MS + DEAL_PAUSE_MS);
    return () => {
      clearTimeout(toCutting);
      clearTimeout(toRevealing);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once per mount
  }, []);

  return dealPhase;
}
```

Inside `ActiveGame`, add the hook call and pass `dealPhase` to `BatakTable`:

```tsx
function ActiveGame({ difficulty, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const [pendingPlay, setPendingPlay] = useState<PendingBatakPlay | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealPhase = useDealSequence();
```

(this is the existing function's opening lines, with the one new line added — everything else in `ActiveGame` is unchanged except the `<BatakTable ... />` call below)

Update the `<BatakTable ... />` call to pass the new prop:

```tsx
      <BatakTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={AI_IDS}
        playerNames={PLAYER_NAMES}
        legalMoves={legalMoves}
        onMove={handleHumanMove}
        pendingPlay={pendingPlay}
        dealPhase={dealPhase}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile`
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/DealAnimationOverlay.tsx apps/mobile/src/games/batak/BatakTable.tsx apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "Add shuffle/cut deal animation and hand entrance for Batak"
```

---

### Task 3: Manual visual verification

Not a subagent task — requires visual judgment on rendered output. Use the existing browser/Playwright workflow (`expo start --web` + `playwright-core` against the sandbox's system Chrome) if available in this environment; if it isn't, say so explicitly rather than claiming visual verification happened.

- [ ] **Step 1: Start the web dev server and load Batak**

Run: `npx expo start --web` (from `apps/mobile`), navigate to Home → Batak → pick a difficulty → start a game.

- [ ] **Step 2: Verify the deal sequence**

Confirm: on game start, the shuffle-then-cut overlay plays and blocks interaction with the table underneath; after it clears (~2.9s), the human's hand appears with a staggered fly-in; no console errors during the sequence.

- [ ] **Step 3: Verify hand sorting and layout**

Confirm: the human's 13 cards read as two rows (7 top / 6 bottom), sorted Hearts → Spades → Diamonds → Clubs, each suit's cards descending A→2, no visible gap where a missing suit would be (if the dealt hand happens to lack a suit — may need a couple of restarts to observe), and the curved fan/overlap looks consistent with the existing opponent fan's visual language.

- [ ] **Step 4: Verify hand visibility during bidding and trump-selection**

Confirm: the sorted two-row hand is visible (and non-interactively dimmed — cards don't respond to taps) throughout the bidding phase and trump-selection phase, not just once play starts. Bid buttons and the hand coexist on screen during bidding.

- [ ] **Step 5: Verify the row rebalances as the hand shrinks**

Play a few tricks; confirm the two rows visually rebalance (not "top row stuck at 7 until empty") as cards are played.

- [ ] **Step 6: Verify trump reveal timing and reduced motion**

Confirm trump still only appears once `phase === 'playing'` (no regression). If a reduced-motion OS/browser setting can be toggled in this environment, confirm the deal overlay and hand entrance are skipped (hand just appears) when enabled; if not toggleable here, note that as unverified rather than claiming it was checked.

- [ ] **Step 7: Run the full test suite**

Run: `npm test` (from repo root)
Expected: PASS, same count as before this plan (no engine tests changed; no new mobile tests added, per the standing testing policy) — confirms nothing outside this diff regressed.

## Out of Scope (Deferred, per the design spec)

- The 3-player gömmeli variant's UI (doesn't exist yet).
- Opponent hands adopting a two-row layout.
- Sound effects for the shuffle/cut/deal.
- Any rule/engine behavior change.

## Next Step

None planned — this closes out the requested gameplay-feel changes for 4-player Batak. Ask the user what to tackle next (e.g. resuming the Batak variant roadmap, or further polish).
