# Batak Bid/Trump Decision Modal + Animated Hand Reflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Batak's bid and trump-suit selection controls into a centered fade+scale-in modal, and make the human's hand reflow (repositioning + overlap change) animate smoothly instead of snapping instantly when a card is played.

**Architecture:** A new generic, game-agnostic `CenteredDecisionModal` shared component (transparent-backdrop `Modal` + hand-rolled fade/scale entrance, since RN's built-in `Modal` animation types don't support scale) hosts Batak's existing bid-button and trump-suit-icon content, unchanged internally beyond a ScrollView→wrapping-grid layout swap for the bid buttons. Separately, a single `LayoutAnimation.configureNext()` call — placed exactly where a human-played card is removed from the rendered hand array — makes the existing (unchanged) overlap-recompute formula in `apps/mobile/src/table/seating.ts` animate instead of snap.

**Tech Stack:** React Native (Expo 57, New Architecture / Fabric — mandatory, no opt-out), `Animated` API, RN `LayoutAnimation`.

## Global Constraints

- Batak-only. No changes to Pişti, `apps/playground`, or `packages/engine` — per the standing per-game visual-change rule, this isn't mirrored elsewhere without a separate discussion.
- No new automated tests, per the standing 2026-07-07 mobile-UI testing policy. Verify each task via typecheck + the existing full Jest suite (confirm identical pass count — no test currently asserts on any of the markup this plan touches, confirmed by grep during brainstorming).
- No proactive screenshot/visual verification, per the user's 2026-07-17 direction. Verification is typecheck + existing-suite-passes only; the user will check visually in their own running Expo session.
- Respect `useReducedMotion()` (`apps/mobile/src/components/useReducedMotion.ts`) everywhere a new animation is added: reduced motion means the change applies instantly, not a faster animation.
- The bid/trump modal backdrop must have **no dim/scrim** — the table stays fully visible behind it — but must still block touches to the table while open (RN `Modal` does this natively).
- New Architecture (Fabric) is mandatory in this Expo version, so `LayoutAnimation` works without the legacy `UIManager.setLayoutAnimationEnabledExperimental(true)` Android opt-in — do not add that call.

---

### Task 1: `CenteredDecisionModal` shared component

**Files:**
- Create: `apps/mobile/src/components/CenteredDecisionModal.tsx`

**Interfaces:**
- Consumes: `useReducedMotion()` from `apps/mobile/src/components/useReducedMotion.ts` (existing, returns `boolean`).
- Produces: `CenteredDecisionModal({ visible: boolean, children: React.ReactNode })` — a default-exported-free, named export `CenteredDecisionModal` React component. Tasks 2 and 3 import it as `import { CenteredDecisionModal } from '../../components/CenteredDecisionModal';`.

- [ ] **Step 1: Create the component**

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

export interface CenteredDecisionModalProps {
  visible: boolean;
  children: React.ReactNode;
}

const ENTRANCE_DURATION_MS = 220;
const ENTRANCE_SCALE_FROM = 0.85;

// A centered, transparent-backdrop modal for a single in-the-moment decision (e.g. Batak's bid
// or trump-suit choice) — fades and scales its content in when it becomes visible. Deliberately
// has no dim backdrop: the underlying table stays fully visible, but RN's Modal still intercepts
// all touches to it while open, so it reads as non-interactive without a visible scrim. RN's
// built-in Modal animationType only supports 'fade'/'slide' (no scale), so the entrance is
// hand-rolled here instead of using that prop.
export function CenteredDecisionModal({ visible, children }: CenteredDecisionModalProps) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: ENTRANCE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, reducedMotion, progress]);

  return (
    <Modal transparent animationType="none" visible={visible}>
      <View style={styles.backdrop}>
        <Animated.View
          style={{
            opacity: progress,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [ENTRANCE_SCALE_FROM, 1],
                }),
              },
            ],
          }}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Typecheck**

Run (from repo root): `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Run the existing suite**

Run (from repo root): `npx jest`
Expected: same pass count as before this change — this is a new, not-yet-imported file, so nothing should be affected.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/CenteredDecisionModal.tsx
git commit -m "Add CenteredDecisionModal shared component"
```

---

### Task 2: Bid modal

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `CenteredDecisionModal` from Task 1 (`../../components/CenteredDecisionModal`).
- Produces: no new exports — `BidControls` keeps its existing signature (`{ legalMoves: BatakMove[]; onMove: (move: BatakMove) => void }`), just relocated and restyled.

**Context:** Today, `BidControls` (a horizontal `ScrollView` of bid-amount buttons + Pass) renders inline inside `handArea`, gated by `state.phase === "bidding" && isHumanInteractive` (`BatakTable.tsx:732-734`). `BiddingCenter` (the ambient "Bidding" heading + "Highest bid: N" line, `BatakTable.tsx:246-264`) renders separately in the center panel and is **not** changing in this task — it stays visible to everyone throughout bidding.

- [ ] **Step 1: Drop the now-unused `ScrollView` import**

In `apps/mobile/src/games/batak/BatakTable.tsx`, the top-of-file `react-native` import currently reads:

```tsx
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
```

Remove the `ScrollView,` line (confirmed via grep during brainstorming that `ScrollView` is used nowhere else in this file — `BidControls`, changed below, is its only consumer):

```tsx
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
```

- [ ] **Step 2: Import `CenteredDecisionModal`**

Add to the local-import block near the top of the file (next to the other `../../components/...` imports, e.g. after the `PlayerAvatar` import):

```tsx
import { CenteredDecisionModal } from "../../components/CenteredDecisionModal";
```

- [ ] **Step 3: Restyle `BidControls` as a wrapping grid inside a themed card**

Replace the existing `BidControls` function (`BatakTable.tsx:417-452`):

```tsx
function BidControls({
  legalMoves,
  onMove,
}: {
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
}) {
  const bidMoves = legalMoves.filter(
    (m): m is Extract<BatakMove, { type: "bid" }> => m.type === "bid",
  );
  const hasPass = legalMoves.some(m => m.type === "pass");
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.bidRow}
      testID="bid-controls">
      {bidMoves.map(move => (
        <Pressable
          key={move.amount}
          onPress={() => onMove(move)}
          style={styles.bidButton}
          accessibilityRole="button">
          <Text style={styles.bidButtonText}>{`Bid ${move.amount}`}</Text>
        </Pressable>
      ))}
      {hasPass && (
        <Pressable
          onPress={() => onMove({ type: "pass" })}
          style={[styles.bidButton, styles.passButton]}
          accessibilityRole="button">
          <Text style={styles.bidButtonText}>Pass</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
```

with:

```tsx
function BidControls({
  legalMoves,
  onMove,
}: {
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
}) {
  const bidMoves = legalMoves.filter(
    (m): m is Extract<BatakMove, { type: "bid" }> => m.type === "bid",
  );
  const hasPass = legalMoves.some(m => m.type === "pass");
  return (
    <View style={styles.modalCard} testID="bid-controls">
      <View style={styles.bidGrid}>
        {bidMoves.map(move => (
          <Pressable
            key={move.amount}
            onPress={() => onMove(move)}
            style={styles.bidButton}
            accessibilityRole="button">
            <Text style={styles.bidButtonText}>{`Bid ${move.amount}`}</Text>
          </Pressable>
        ))}
        {hasPass && (
          <Pressable
            onPress={() => onMove({ type: "pass" })}
            style={[styles.bidButton, styles.passButton]}
            accessibilityRole="button">
            <Text style={styles.bidButtonText}>Pass</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Move the bid controls out of `handArea` and into a modal**

In the `BatakTable` component's returned JSX, remove this block from inside `styles.handArea` (`BatakTable.tsx:732-734`):

```tsx
        {state.phase === "bidding" && isHumanInteractive && (
          <BidControls legalMoves={legalMoves} onMove={onMove} />
        )}
```

`handArea`'s children should now go straight from the `PlayerBadge` to the `<View style={styles.handFan} testID="human-hand">` block, unchanged otherwise.

Then add the modal as a new sibling near the end of the returned JSX, immediately before the closing `</DeselectableSurface>` (i.e. right after the `{dealPhase !== "revealing" && <DealFlightOverlay seats={dealSeats} />}` line, `BatakTable.tsx:760`):

```tsx
      <CenteredDecisionModal visible={state.phase === "bidding" && isHumanInteractive}>
        <BidControls legalMoves={legalMoves} onMove={onMove} />
      </CenteredDecisionModal>
```

- [ ] **Step 5: Replace the `bidRow` style with `bidGrid` + `modalCard`**

In the `StyleSheet.create` block at the bottom of the file, replace:

```tsx
  bidRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
```

with:

```tsx
  modalCard: {
    backgroundColor: "rgba(11, 30, 20, 0.94)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(244, 197, 66, 0.5)",
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxWidth: 320,
    alignItems: "center",
  },
  bidGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
```

(`bidButton`, `passButton`, `bidButtonText` styles are unchanged — leave them as-is.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors. (If `ScrollView` still shows as referenced anywhere, Step 1 was incomplete — re-check.)

- [ ] **Step 7: Run the existing suite**

Run: `npx jest`
Expected: same pass count as before — no test asserts on `bid-controls`' internal markup (confirmed by grep during brainstorming), so this restyle shouldn't break anything.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Move Batak bid controls into a centered decision modal"
```

---

### Task 3: Trump-suit modal

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `CenteredDecisionModal` from Task 1 (already imported in this file as of Task 2).
- Produces: no new exports — splits the existing `TrumpSelectionCenter` into two internal-only components (`TrumpWaitingCenter`, `TrumpSuitPicker`), neither imported elsewhere.

**Context:** Today, `TrumpSelectionCenter` (`BatakTable.tsx:266-305`) renders one of two things inline in the center panel depending on who won the bid: the human gets the 4-suit picker, everyone else sees a "`{name} is choosing trump…`" waiting message. This task keeps the waiting message inline (ambient status) and moves only the picker into a modal.

- [ ] **Step 1: Split `TrumpSelectionCenter` into two components**

Replace the existing `TrumpSelectionCenter` function (`BatakTable.tsx:266-305`):

```tsx
function TrumpSelectionCenter({
  state,
  humanPlayerId,
  playerNames,
  onMove,
}: {
  state: BatakState;
  humanPlayerId: string;
  playerNames: Record<string, string>;
  onMove: (move: BatakMove) => void;
}) {
  if (state.bidWinner === humanPlayerId) {
    return (
      <View style={styles.centerPanel}>
        <Text
          style={
            styles.centerHeading
          }>{`Choose trump (contract: ${state.contract})`}</Text>
        <View style={styles.suitRow}>
          {SUITS.map(suit => (
            <Pressable
              key={suit}
              onPress={() => onMove({ type: "selectTrump", suit })}
              style={styles.suitButton}
              accessibilityRole="button">
              <SuitIcon suit={suit} size={28} color={suitColor(suit)} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.centerPanel}>
      <Text style={styles.centerHeading}>
        {`${playerNames[state.bidWinner ?? ""] ?? state.bidWinner} is choosing trump…`}
      </Text>
    </View>
  );
}
```

with:

```tsx
function TrumpWaitingCenter({
  state,
  playerNames,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
}) {
  return (
    <View style={styles.centerPanel}>
      <Text style={styles.centerHeading}>
        {`${playerNames[state.bidWinner ?? ""] ?? state.bidWinner} is choosing trump…`}
      </Text>
    </View>
  );
}

function TrumpSuitPicker({
  state,
  onMove,
}: {
  state: BatakState;
  onMove: (move: BatakMove) => void;
}) {
  return (
    <View style={styles.modalCard}>
      <Text
        style={
          styles.centerHeading
        }>{`Choose trump (contract: ${state.contract})`}</Text>
      <View style={styles.suitRow}>
        {SUITS.map(suit => (
          <Pressable
            key={suit}
            onPress={() => onMove({ type: "selectTrump", suit })}
            style={styles.suitButton}
            accessibilityRole="button">
            <SuitIcon suit={suit} size={28} color={suitColor(suit)} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Update the center-panel render to use the ambient-only component**

In `BatakTable`'s returned JSX, replace (`BatakTable.tsx:695-702`):

```tsx
        {state.phase === "trump-selection" && (
          <TrumpSelectionCenter
            state={state}
            humanPlayerId={humanPlayerId}
            playerNames={playerNames}
            onMove={onMove}
          />
        )}
```

with:

```tsx
        {state.phase === "trump-selection" && state.bidWinner !== humanPlayerId && (
          <TrumpWaitingCenter state={state} playerNames={playerNames} />
        )}
```

- [ ] **Step 3: Add the trump-picker modal**

Immediately below the `CenteredDecisionModal` for bidding added in Task 2 (near the end of the returned JSX, before `</DeselectableSurface>`), add:

```tsx
      <CenteredDecisionModal
        visible={state.phase === "trump-selection" && state.bidWinner === humanPlayerId}>
        <TrumpSuitPicker state={state} onMove={onMove} />
      </CenteredDecisionModal>
```

So the tail of the returned JSX now reads (both modals as siblings):

```tsx
      <CenteredDecisionModal visible={state.phase === "bidding" && isHumanInteractive}>
        <BidControls legalMoves={legalMoves} onMove={onMove} />
      </CenteredDecisionModal>
      <CenteredDecisionModal
        visible={state.phase === "trump-selection" && state.bidWinner === humanPlayerId}>
        <TrumpSuitPicker state={state} onMove={onMove} />
      </CenteredDecisionModal>
    </DeselectableSurface>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Run the existing suite**

Run: `npx jest`
Expected: same pass count as before — no test references `TrumpSelectionCenter` (it was never an exported symbol) or asserts on the suit-picker markup.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "Move Batak trump-suit picker into a centered decision modal"
```

---

### Task 4: Animate hand reflow via `LayoutAnimation`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` from `apps/mobile/src/components/useReducedMotion.ts` (existing).
- Produces: no new exports. Purely internal timing/animation behavior inside `ActiveGame`'s `commitMove`.

**Context:** `BatakTable.tsx`'s human hand (`humanHand`, `topRow`/`bottomRow`, `topRowMargin`/`bottomRowMargin` via `fillWidthMarginPx`) already recomputes correctly every render as cards are removed — the formula itself needs no changes. The only gap is that this recompute currently snaps instantly. The fix is a single `LayoutAnimation.configureNext()` call in `BatakScreen.tsx`'s `commitMove`, right before the `setPendingPlay(...)` call that removes a human-played card from the rendered array (`BatakTable.tsx`'s `humanHand` filters out `pendingPlay.card` as soon as `pendingPlay` is set — see `isPendingHuman` at `BatakTable.tsx:596-599`).

- [ ] **Step 1: Import `LayoutAnimation` and `useReducedMotion`, add the duration constant**

In `apps/mobile/src/games/batak/BatakScreen.tsx`, the top imports currently read:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import type { Difficulty, PlayerId, RNG } from '@world-of-cards/engine';
import { createRng } from '@world-of-cards/engine';
import { batakDescriptor, BatakState, BatakMove } from '@world-of-cards/engine/games/batak';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { useAITurn } from '../../hooks/useAITurn';
import { useDealSequence } from '../../hooks/useDealSequence';
import { BatakSetupView } from './BatakSetupView';
import { BatakTable, PendingBatakPlay } from './BatakTable';
import { BatakSettingsModal } from './BatakSettingsModal';
```

Add `LayoutAnimation` to a new `react-native` import, and import `useReducedMotion`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { LayoutAnimation } from 'react-native';
import type { Difficulty, PlayerId, RNG } from '@world-of-cards/engine';
import { createRng } from '@world-of-cards/engine';
import { batakDescriptor, BatakState, BatakMove } from '@world-of-cards/engine/games/batak';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { useReducedMotion } from '../../components/useReducedMotion';
import { useAITurn } from '../../hooks/useAITurn';
import { useDealSequence } from '../../hooks/useDealSequence';
import { BatakSetupView } from './BatakSetupView';
import { BatakTable, PendingBatakPlay } from './BatakTable';
import { BatakSettingsModal } from './BatakSettingsModal';
```

Add a new constant next to the existing `PLAY_TRAVEL_DELAY_MS` constant:

```tsx
// Matches CenteredDecisionModal's own entrance duration (apps/mobile/src/components/
// CenteredDecisionModal.tsx) so the two animations added in this pass feel consistent.
const HAND_REFLOW_DURATION_MS = 220;
```

- [ ] **Step 2: Call `useReducedMotion()` in `ActiveGame`**

In the `ActiveGame` function body, add alongside the other hook calls near the top (after `const dealPhase = useDealSequence();`):

```tsx
  const reducedMotion = useReducedMotion();
```

- [ ] **Step 3: Trigger the layout animation for the human's own plays**

In `commitMove`, the `move.type === 'play'` branch currently reads:

```tsx
    if (move.type === 'play') {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      const delay = state.currentTrick.length === 3 ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
      setPendingPlay({ playerId, card, originOffset });
      pendingTimeoutRef.current = setTimeout(() => {
        performMove(move);
        setPendingPlay(null);
      }, delay);
      return;
    }
```

Change it to:

```tsx
    if (move.type === 'play') {
      const hand = state.table.zones[`hand-${playerId}`].cards;
      const card = hand.find((c) => c.id === move.cardId);
      if (!card) {
        performMove(move);
        return;
      }
      const delay = state.currentTrick.length === 3 ? TRICK_COMPLETION_PAUSE_MS : PLAY_TRAVEL_DELAY_MS;
      // Only the human's own plays remove a card from BatakTable's rendered hand array (see
      // isPendingHuman in BatakTable.tsx) — AI plays never touch it, so they need no trigger.
      if (playerId === HUMAN_ID && !reducedMotion) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(
            HAND_REFLOW_DURATION_MS,
            LayoutAnimation.Types.easeInEaseOut,
            LayoutAnimation.Properties.opacity,
          ),
        );
      }
      setPendingPlay({ playerId, card, originOffset });
      pendingTimeoutRef.current = setTimeout(() => {
        performMove(move);
        setPendingPlay(null);
      }, delay);
      return;
    }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Run the existing suite**

Run: `npx jest`
Expected: same pass count as before — `LayoutAnimation.configureNext` is a fire-and-forget native-module call with no observable effect under Jest's test renderer (no layout is actually measured/animated in that environment), so no existing test should be affected.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "Animate Batak's human hand reflow via LayoutAnimation"
```

---

## Self-Review Notes

- **Spec coverage:** Bid modal (Task 2) ✓, trump modal (Task 3) ✓, no-dim-but-blocking backdrop (Task 1's `CenteredDecisionModal`) ✓, horizontal/grid bid layout (Task 2 Step 3) ✓, smooth hand repositioning + progressive-overlap animation (Task 4) ✓, reduced-motion respected everywhere new animation is added (Tasks 1 and 4) ✓, no engine/Pişti/playground changes ✓, no new tests ✓.
- **Placeholder scan:** none found — every step has complete, concrete code.
- **Type consistency:** `CenteredDecisionModalProps` (`visible: boolean`, `children: React.ReactNode`) matches both call sites in Task 2/3 exactly. `TrumpWaitingCenter`/`TrumpSuitPicker` prop shapes match their call sites. `HAND_REFLOW_DURATION_MS` is defined once (Task 4 Step 1) and used once (Task 4 Step 3).
