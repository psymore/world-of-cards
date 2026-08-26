# Pis Yedili Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playable Pis Yedili screen (setup + table) to `apps/mobile`, wired into `games/registry.ts` so it appears on the home screen and is navigable end-to-end.

**Architecture:** New `apps/mobile/src/games/pis-yedili/` module reusing every game-agnostic piece Pişti/Batak already proved out (`createGameSessionStore`, `useAITurn`, `GameScreenLayout`, `GameResultModal`, `assignSeats`/`OpponentSeatGroup`/`PlayerBadge`, `PlayingCard`). No bespoke travel-reveal animation or deal sequence — moves commit directly to the session store on tap.

**Tech Stack:** React Native / Expo, TypeScript, Zustand (`createGameSessionStore`), `@world-of-cards/engine` (`pisYedeliDescriptor` from `@world-of-cards/engine/games/pis-yedili` — already registered in `package.json`'s `exports` map), `@world-of-cards/ui` shared components.

**Spec:** `docs/superpowers/specs/2026-08-26-pis-yedili-mobile-ui-design.md`

## Global Constraints

- Free-for-all only, 2–4 players — no team/partnership concept (unlike Pişti's four-player mode toggle).
- No card-travel reveal animation, no deal-sequence flourish, no capture/bonus banners, no dev-tuning modal — explicitly out of scope per the spec.
- Per `docs/governance/engineering-principles.md` §4, this repo's testing policy overrides the general TDD default for mobile UI components: no proactive Jest tests are written for these files. Each task instead verifies via `npx tsc --noEmit` (from `apps/mobile`) and, for the final task, a scripted visual check (Expo web + Playwright screenshot, same approach already used elsewhere in this session).
- Every new file goes in `apps/mobile/src/games/pis-yedili/`, following the existing `games/pisti/` / `games/batak/` sibling-folder convention.

---

### Task 1: Setup view

**Files:**
- Create: `apps/mobile/src/games/pis-yedili/PisYedeliSetupView.tsx`

**Interfaces:**
- Consumes: `useSettingsStore` (`s.defaultDifficulty`, `setDefaultDifficulty`) from `apps/mobile/src/state/settingsStore.ts`; `DifficultyStars` from `apps/mobile/src/components/DifficultyStars.tsx`; `Difficulty` type, `IconButton`, `ICON_HOME_IMAGE`, `PressableFeedback`, `TableFelt`, `DISPLAY_BOLD`, `BODY_REGULAR`, `BODY_SEMIBOLD` from `@world-of-cards/ui` / `@world-of-cards/engine`.
- Produces: `PisYedeliSetupView` component, `PisYedeliPlayerCount` type (`2 | 3 | 4`), `PisYedeliSetupViewProps` (`{ defaultDifficulty: Difficulty; onStart: (difficulty: Difficulty, playerCount: PisYedeliPlayerCount) => void; onBack: () => void }`) — Task 2 imports all three.

- [ ] **Step 1: Write the file**

```tsx
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BODY_REGULAR,
  BODY_SEMIBOLD,
  DISPLAY_BOLD,
  IconButton,
  ICON_HOME_IMAGE,
  PressableFeedback,
  TableFelt,
} from '@world-of-cards/ui';
import type { Difficulty } from '@world-of-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';
import { DifficultyStars } from '../../components/DifficultyStars';

const HOME_ICON_SIZE = 32;

export type PisYedeliPlayerCount = 2 | 3 | 4;

export interface PisYedeliSetupViewProps {
  defaultDifficulty: Difficulty;
  onStart: (difficulty: Difficulty, playerCount: PisYedeliPlayerCount) => void;
  onBack: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const PLAYER_COUNTS: { value: PisYedeliPlayerCount; label: string }[] = [
  { value: 2, label: '2 Players' },
  { value: 3, label: '3 Players' },
  { value: 4, label: '4 Players' },
];

export function PisYedeliSetupView({ defaultDifficulty, onStart, onBack }: PisYedeliSetupViewProps) {
  const [playerCount, setPlayerCount] = useState<PisYedeliPlayerCount>(2);

  function handlePress(value: Difficulty) {
    useSettingsStore.getState().setDefaultDifficulty(value);
    onStart(value, playerCount);
  }

  return (
    <View style={styles.container}>
      <TableFelt />
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Pis Yedili</Text>
        <IconButton
          source={ICON_HOME_IMAGE}
          size={HOME_ICON_SIZE}
          onPress={onBack}
          accessibilityLabel="Home"
          testID="pis-yedili-setup-home-button"
        />
      </View>

      <Text style={styles.title}>Table size</Text>
      <View style={styles.playerCountRow}>
        {PLAYER_COUNTS.map(({ value, label }) => (
          <PressableFeedback
            key={value}
            onPress={() => setPlayerCount(value)}
            style={[styles.playerCountOption, value === playerCount && styles.optionDefault]}
            overlayBorderRadius={8}>
            <Text style={styles.optionText}>{label}</Text>
          </PressableFeedback>
        ))}
      </View>

      <Text style={styles.title}>Choose a difficulty</Text>
      {DIFFICULTIES.map(({ value, label }) => (
        <PressableFeedback
          key={value}
          onPress={() => handlePress(value)}
          style={[styles.option, value === defaultDifficulty && styles.optionDefault]}
          overlayBorderRadius={8}>
          <View style={styles.difficultyRow}>
            <Text style={styles.optionText}>{label}</Text>
            <DifficultyStars difficulty={value} />
          </View>
          {value === defaultDifficulty && <Text style={styles.defaultBadge}>Last played</Text>}
        </PressableFeedback>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#0a2e1f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  pageTitle: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 26,
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  title: { fontFamily: BODY_SEMIBOLD, fontSize: 18, marginBottom: 16, textAlign: 'center', color: '#f5f0e6' },
  option: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#f4c542', backgroundColor: 'rgba(244, 197, 66, 0.2)' },
  difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionText: { fontFamily: BODY_REGULAR, fontSize: 18, color: '#eee' },
  defaultBadge: { fontFamily: BODY_SEMIBOLD, fontSize: 12, color: '#f4c542', marginTop: 2 },
  playerCountRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  playerCountOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile`): `npx tsc --noEmit -p .`
Expected: no errors referencing `PisYedeliSetupView.tsx` (errors in unrelated pre-existing files, if any, are not this task's concern).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pis-yedili/PisYedeliSetupView.tsx
git commit -m "feat(pis-yedili): add setup view (player count + difficulty)"
```

---

### Task 2: Screen + session wiring

**Files:**
- Create: `apps/mobile/src/games/pis-yedili/PisYedeliScreen.tsx`

**Interfaces:**
- Consumes: `PisYedeliSetupView`, `PisYedeliPlayerCount`, `PisYedeliSetupViewProps` (Task 1); `PisYedeliTable` with props `{ state: PisYedeliState; humanPlayerId: PlayerId; opponentPlayerIds: PlayerId[]; playerNames: Record<PlayerId, string>; onPerformMove: (move: PisYedeliMove) => void }` (Task 3 — imported here, defined there); `createGameSessionStore`, `useSettingsStore`, `GameScreenLayout`, `GameResultModal`, `useAITurn` (all pre-existing, game-agnostic); `pisYedeliDescriptor`, `PisYedeliState`, `PisYedeliMove` from `@world-of-cards/engine/games/pis-yedili`; `createRng`, `RNG`, `Difficulty`, `PlayerId` from `@world-of-cards/engine`.
- Produces: `PisYedeliScreen` component with `PisYedeliScreenProps = { onExitToHome: () => void }` — Task 5 (`games/registry.ts`) imports this.

- [ ] **Step 1: Write the file**

```tsx
import React, { useMemo, useState } from 'react';
import { createRng, RNG, Difficulty, PlayerId } from '@world-of-cards/engine';
import { pisYedeliDescriptor, PisYedeliState, PisYedeliMove } from '@world-of-cards/engine/games/pis-yedili';
import { createGameSessionStore } from '../../state/createGameSessionStore';
import { useSettingsStore } from '../../state/settingsStore';
import { GameScreenLayout } from '../../components/GameScreenLayout';
import { GameResultModal } from '../../components/GameResultModal';
import { PisYedeliSetupView, PisYedeliPlayerCount } from './PisYedeliSetupView';
import { PisYedeliTable } from './PisYedeliTable';
import { useAITurn } from '../../hooks/useAITurn';

const HUMAN_ID: PlayerId = 'human';

function buildAiIds(playerCount: PisYedeliPlayerCount): PlayerId[] {
  return Array.from({ length: playerCount - 1 }, (_, i) => `ai-${i + 1}`);
}

function buildPlayerNames(aiIds: PlayerId[]): Record<PlayerId, string> {
  const names: Record<PlayerId, string> = { [HUMAN_ID]: 'You' };
  if (aiIds.length === 1) {
    names[aiIds[0]] = 'Computer';
  } else {
    aiIds.forEach((id, i) => {
      names[id] = `AI ${i + 1}`;
    });
  }
  return names;
}

export interface PisYedeliScreenProps {
  onExitToHome: () => void;
}

interface PisYedeliSession {
  difficulty: Difficulty;
  aiIds: PlayerId[];
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<PisYedeliState, PisYedeliMove>>;
}

export function PisYedeliScreen({ onExitToHome }: PisYedeliScreenProps) {
  const [session, setSession] = useState<PisYedeliSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const defaultDifficulty = useSettingsStore((s) => s.defaultDifficulty);

  function startGame(difficulty: Difficulty, playerCount: PisYedeliPlayerCount) {
    const aiIds = buildAiIds(playerCount);
    const rng = createRng(Date.now());
    const initialState = pisYedeliDescriptor.ruleEngine.setup({ players: [HUMAN_ID, ...aiIds] }, rng);
    const useSessionStore = createGameSessionStore(pisYedeliDescriptor.ruleEngine, initialState);
    setSession({ difficulty, aiIds, rng, useSessionStore });
    setSessionKey((k) => k + 1);
  }

  if (!session) {
    return <PisYedeliSetupView defaultDifficulty={defaultDifficulty} onStart={startGame} onBack={onExitToHome} />;
  }

  return (
    <ActiveGame
      key={sessionKey}
      difficulty={session.difficulty}
      aiIds={session.aiIds}
      rng={session.rng}
      useSessionStore={session.useSessionStore}
      onPlayAgain={() => startGame(session.difficulty, (session.aiIds.length + 1) as PisYedeliPlayerCount)}
      onBackHome={onExitToHome}
    />
  );
}

interface ActiveGameProps {
  difficulty: Difficulty;
  aiIds: PlayerId[];
  rng: RNG;
  useSessionStore: ReturnType<typeof createGameSessionStore<PisYedeliState, PisYedeliMove>>;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

function ActiveGame({ difficulty, aiIds, rng, useSessionStore, onPlayAgain, onBackHome }: ActiveGameProps) {
  const state = useSessionStore((s) => s.state);
  const performMove = useSessionStore((s) => s.performMove);
  const playerNames = useMemo(() => buildPlayerNames(aiIds), [aiIds]);
  const aiStrategy = pisYedeliDescriptor.aiStrategies[difficulty];

  useAITurn({
    state,
    aiPlayerIds: aiIds,
    aiStrategy,
    ruleEngine: pisYedeliDescriptor.ruleEngine,
    rng,
    onMove: (move) => performMove(move),
  });

  const gameOver = pisYedeliDescriptor.ruleEngine.gameOver(state);

  return (
    <GameScreenLayout
      title="Pis Yedili"
      onExit={onBackHome}
      backgroundColor="#000000"
      titleColor="#f4c542"
      darkGlowHeader
      darkGlowHeaderColor="#000000">
      <PisYedeliTable
        state={state}
        humanPlayerId={HUMAN_ID}
        opponentPlayerIds={aiIds}
        playerNames={playerNames}
        onPerformMove={performMove}
      />
      {gameOver && (
        <GameResultModal
          scores={pisYedeliDescriptor.ruleEngine.calculateScore(state)}
          winners={pisYedeliDescriptor.ruleEngine.determineWinner(state) ?? []}
          playerNames={playerNames}
          humanPlayerId={HUMAN_ID}
          onPlayAgain={onPlayAgain}
          onBackHome={onBackHome}
        />
      )}
    </GameScreenLayout>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile`): `npx tsc --noEmit -p .`
Expected: errors only about the not-yet-created `./PisYedeliTable` import (resolved by Task 3) — no other errors in this file.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pis-yedili/PisYedeliScreen.tsx
git commit -m "feat(pis-yedili): add screen session wiring (setup -> active game -> result)"
```

---

### Task 3: Table (seats, piles, hand, draw/pass)

**Files:**
- Create: `apps/mobile/src/games/pis-yedili/PisYedeliTable.tsx`

**Interfaces:**
- Consumes: `PisYedeliSuitPickerModal` with props `{ visible: boolean; onSelect: (suit: Suit) => void; onCancel: () => void }` (Task 4 — imported here, defined there); `PlayerBadge` (`{ name, statusText, isHuman, compact? }`, already in the repo, unchanged by this plan); `OpponentSeatGroup`, `seatLayoutStyles` from `apps/mobile/src/table/OpponentSeatGroup.tsx`; `assignSeats` from `apps/mobile/src/table/seating.ts`; `PlayingCard`, `PressableFeedback`, `SuitIcon`, `SUIT_COLOR`, `BODY_SEMIBOLD`, `DISPLAY_BOLD` from `@world-of-cards/ui`; `pisYedeliDescriptor`, `PisYedeliState`, `PisYedeliMove` from `@world-of-cards/engine/games/pis-yedili`; `PlayerId`, `Suit` from `@world-of-cards/engine`.
- Produces: `PisYedeliTable` component with `PisYedeliTableProps` exactly as declared in Task 2's "Consumes" line — Task 2 already imports it by that name.

- [ ] **Step 1: Write the file**

```tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerId, Suit } from '@world-of-cards/engine';
import { pisYedeliDescriptor, PisYedeliState, PisYedeliMove } from '@world-of-cards/engine/games/pis-yedili';
import { BODY_SEMIBOLD, DISPLAY_BOLD, PlayingCard, PressableFeedback, SUIT_COLOR, SuitIcon } from '@world-of-cards/ui';
import { PlayerBadge } from '../../table/PlayerBadge';
import { OpponentSeatGroup, seatLayoutStyles } from '../../table/OpponentSeatGroup';
import { assignSeats } from '../../table/seating';
import { PisYedeliSuitPickerModal } from './PisYedeliSuitPickerModal';

export interface PisYedeliTableProps {
  state: PisYedeliState;
  humanPlayerId: PlayerId;
  opponentPlayerIds: PlayerId[];
  playerNames: Record<PlayerId, string>;
  onPerformMove: (move: PisYedeliMove) => void;
}

const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
function suitColor(suit: Suit): string {
  return RED_SUITS.includes(suit) ? SUIT_COLOR.red : SUIT_COLOR.black;
}

export function PisYedeliTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  onPerformMove,
}: PisYedeliTableProps) {
  const [pendingJackCardId, setPendingJackCardId] = useState<string | null>(null);
  const seats = assignSeats(opponentPlayerIds);
  const legalMoves = pisYedeliDescriptor.ruleEngine.getLegalMoves(state, humanPlayerId);
  const legalCardIds = new Set(legalMoves.filter((m) => m.type === 'play').map((m) => m.cardId));
  const canDraw = legalMoves.some((m) => m.type === 'draw');
  const canPass = legalMoves.some((m) => m.type === 'pass');
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;

  const hand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const discard = state.table.zones['discard'].cards;
  const stock = state.table.zones['stock'].cards;
  const topDiscard = discard[discard.length - 1];

  function handleCardTap(cardId: string, rank: string) {
    if (!isHumanTurn || !legalCardIds.has(cardId)) return;
    if (rank === 'J') {
      setPendingJackCardId(cardId);
      return;
    }
    onPerformMove({ type: 'play', cardId });
  }

  function handleDeclareSuit(suit: Suit) {
    if (!pendingJackCardId) return;
    onPerformMove({ type: 'play', cardId: pendingJackCardId, declaredSuit: suit });
    setPendingJackCardId(null);
  }

  function handleDraw() {
    if (!isHumanTurn || !canDraw) return;
    onPerformMove({ type: 'draw' });
  }

  function handlePass() {
    if (!isHumanTurn || !canPass) return;
    onPerformMove({ type: 'pass' });
  }

  function opponentSeatContent(seatPlayerId: string, compact: boolean) {
    const cardCount = state.table.zones[`hand-${seatPlayerId}`].cards.length;
    return (
      <PlayerBadge
        name={playerNames[seatPlayerId] ?? seatPlayerId}
        statusText={`${cardCount} card${cardCount === 1 ? '' : 's'}`}
        isHuman={false}
        compact={compact}
      />
    );
  }

  return (
    <View style={styles.container}>
      <OpponentSeatGroup
        position="top"
        seats={seats}
        renderSeat={(seat) => <View style={styles.opponentAreaTop}>{opponentSeatContent(seat.playerId, false)}</View>}
      />
      <View style={seatLayoutStyles.middleRow}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          renderSeat={(seat) => (
            <View style={seatLayoutStyles.opponentAreaSide}>{opponentSeatContent(seat.playerId, true)}</View>
          )}
        />

        <View style={styles.centerArea}>
          <PressableFeedback onPress={handleDraw} disabled={!isHumanTurn || !canDraw} style={styles.stockPile}>
            <PlayingCard faceDown size="normal" />
            <Text style={styles.stockCount}>{stock.length}</Text>
          </PressableFeedback>
          <View style={styles.discardPile}>
            {topDiscard ? (
              <PlayingCard card={topDiscard} size="normal" />
            ) : (
              <View style={styles.emptyDiscard} />
            )}
            {state.activeSuit && (
              <View style={styles.activeSuitBadge}>
                <SuitIcon suit={state.activeSuit} size={18} color={suitColor(state.activeSuit)} />
              </View>
            )}
          </View>
          {state.pendingDraw > 0 && <Text style={styles.pendingDrawText}>Draw {state.pendingDraw}</Text>}
        </View>

        <OpponentSeatGroup
          position="right"
          seats={seats}
          renderSeat={(seat) => (
            <View style={seatLayoutStyles.opponentAreaSide}>{opponentSeatContent(seat.playerId, true)}</View>
          )}
        />
      </View>

      <View style={styles.handArea}>
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? 'You'}
          statusText={`${hand.length} card${hand.length === 1 ? '' : 's'}`}
          isHuman
        />
        <ScrollView horizontal contentContainerStyle={styles.handRow} showsHorizontalScrollIndicator={false}>
          {hand.map((card) => {
            const interactive = isHumanTurn && legalCardIds.has(card.id);
            return (
              <PressableFeedback
                key={card.id}
                disabled={!interactive}
                onPress={() => handleCardTap(card.id, card.rank)}
                style={styles.handCard}
                testID={`pis-yedili-hand-card-${card.id}`}>
                <PlayingCard card={card} size="normal" style={!interactive && styles.dimmedCard} />
              </PressableFeedback>
            );
          })}
        </ScrollView>
        {canPass && (
          <PressableFeedback
            onPress={handlePass}
            disabled={!isHumanTurn}
            style={styles.passButton}
            overlayBorderRadius={8}
            testID="pis-yedili-pass-button">
            <Text style={styles.passButtonText}>Pass</Text>
          </PressableFeedback>
        )}
      </View>

      <PisYedeliSuitPickerModal
        visible={pendingJackCardId != null}
        onSelect={handleDeclareSuit}
        onCancel={() => setPendingJackCardId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  opponentAreaTop: { alignItems: 'center' },
  centerArea: { alignItems: 'center', gap: 8 },
  stockPile: { alignItems: 'center', gap: 4 },
  stockCount: { fontFamily: BODY_SEMIBOLD, fontSize: 14, color: '#f5f0e6' },
  discardPile: { position: 'relative' },
  emptyDiscard: {
    width: 94,
    height: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activeSuitBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#f5f0e6',
    borderRadius: 12,
    padding: 4,
  },
  pendingDrawText: { fontFamily: DISPLAY_BOLD, fontSize: 16, color: '#d64545' },
  handArea: { alignItems: 'center', paddingBottom: 12, gap: 8 },
  handRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  handCard: {},
  dimmedCard: { opacity: 0.4 },
  passButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  passButtonText: { fontFamily: BODY_SEMIBOLD, fontSize: 16, color: '#f5f0e6' },
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile`): `npx tsc --noEmit -p .`
Expected: errors only about the not-yet-created `./PisYedeliSuitPickerModal` import (resolved by Task 4) — no other errors in this file. The `PisYedeliScreen.tsx` error from Task 2 about the missing `./PisYedeliTable` import should now be gone.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pis-yedili/PisYedeliTable.tsx
git commit -m "feat(pis-yedili): add table (seats, stock/discard piles, hand, draw/pass)"
```

---

### Task 4: Suit-declare modal

**Files:**
- Create: `apps/mobile/src/games/pis-yedili/PisYedeliSuitPickerModal.tsx`

**Interfaces:**
- Consumes: `SuitIcon`, `SUIT_COLOR`, `DISPLAY_BOLD` from `@world-of-cards/ui`; `Suit` from `@world-of-cards/engine`.
- Produces: `PisYedeliSuitPickerModal` component with `PisYedeliSuitPickerModalProps` exactly as declared in Task 3's "Consumes" line — Task 3 already imports it by that name.

- [ ] **Step 1: Write the file**

```tsx
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Suit } from '@world-of-cards/engine';
import { DISPLAY_BOLD, SUIT_COLOR, SuitIcon } from '@world-of-cards/ui';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RED_SUITS: Suit[] = ['hearts', 'diamonds'];

function suitColor(suit: Suit): string {
  return RED_SUITS.includes(suit) ? SUIT_COLOR.red : SUIT_COLOR.black;
}

export interface PisYedeliSuitPickerModalProps {
  visible: boolean;
  onSelect: (suit: Suit) => void;
  onCancel: () => void;
}

export function PisYedeliSuitPickerModal({ visible, onSelect, onCancel }: PisYedeliSuitPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} testID="pis-yedili-suit-picker-backdrop">
        <View style={styles.card}>
          <Text style={styles.title}>Choose a suit</Text>
          <View style={styles.suitRow}>
            {SUITS.map((suit) => (
              <Pressable
                key={suit}
                onPress={() => onSelect(suit)}
                style={styles.suitOption}
                testID={`pis-yedili-suit-${suit}`}>
                <SuitIcon suit={suit} size={32} color={suitColor(suit)} />
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: '#0a2e1f',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: { fontFamily: DISPLAY_BOLD, fontSize: 18, color: '#f4c542', textAlign: 'center', marginBottom: 16 },
  suitRow: { flexDirection: 'row', gap: 16 },
  suitOption: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 },
});
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile`): `npx tsc --noEmit -p .`
Expected: no errors anywhere in `apps/mobile/src/games/pis-yedili/` — all four files now resolve against each other cleanly.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pis-yedili/PisYedeliSuitPickerModal.tsx
git commit -m "feat(pis-yedili): add Jack suit-declare modal"
```

---

### Task 5: Registry wiring + end-to-end verification

**Files:**
- Modify: `apps/mobile/src/games/registry.ts`

**Interfaces:**
- Consumes: `PisYedeliScreen` (Task 2).
- Produces: `gameScreens['pis-yedili']` entry — makes the screen reachable via `RootNavigator`'s `Game` route, and (by importing `@world-of-cards/engine/games/pis-yedili` transitively through `PisYedeliScreen.tsx`) triggers that module's `registerGame(pisYedeliDescriptor)` call, so `HomeScreen`'s `getGames()` lists it automatically.

- [ ] **Step 1: Modify the registry**

Current content of `apps/mobile/src/games/registry.ts`:

```tsx
import type { ComponentType } from 'react';
import { PistiScreen } from './pisti/PistiScreen';
import { BatakScreen } from './batak/BatakScreen';

export interface GameScreenProps {
  onExitToHome: () => void;
}

export const gameScreens: Record<string, ComponentType<GameScreenProps>> = {
  pisti: PistiScreen,
  batak: BatakScreen,
};
```

Replace with:

```tsx
import type { ComponentType } from 'react';
import { PistiScreen } from './pisti/PistiScreen';
import { BatakScreen } from './batak/BatakScreen';
import { PisYedeliScreen } from './pis-yedili/PisYedeliScreen';

export interface GameScreenProps {
  onExitToHome: () => void;
}

export const gameScreens: Record<string, ComponentType<GameScreenProps>> = {
  pisti: PistiScreen,
  batak: BatakScreen,
  'pis-yedili': PisYedeliScreen,
};
```

- [ ] **Step 2: Typecheck the whole app**

Run (from `apps/mobile`): `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Run the existing test suites (regression check)**

Run (from `apps/mobile`): `npx jest`
Expected: all existing suites still pass — this task adds no new tests (per the testing-policy note in Global Constraints) but must not break anything already covered (e.g. `HomeScreen.test.tsx`, which asserts against `getGames()`'s list — confirm it doesn't hardcode an exact game count/list that this addition would invalidate; if it does, that's a pre-existing test to fix as part of this task, not a new one to add).

- [ ] **Step 4: Visual end-to-end verification**

Start the Expo web dev server from `apps/mobile`: `npx expo start --web --port 8081`, wait for `http://localhost:8081` to respond, then drive it with Playwright (or `chromium-cli` if available) through:
1. Home screen — confirm a "Pis Yedili" row appears (via `getGames()`, no `HomeScreen.tsx` changes needed).
2. Tap it — confirm `PisYedeliSetupView` renders (title, table-size row with 2/3/4, difficulty row).
3. Pick 3 players + Easy — confirm the table renders: two opponent seats (a 2-opponent layout, left/right per `assignSeats`), stock pile, discard pile with one face-up card, human hand of 7 cards, human's own `PlayerBadge`.
4. Tap a legal hand card — confirm the discard pile's top card updates and the hand shrinks by one.
5. If a Jack is legally tappable at some point in the manual run, tap it — confirm `PisYedeliSuitPickerModal` appears with 4 suit options, and picking one closes it and commits the move (discard top becomes the Jack, `activeSuit` badge shows the picked suit).
6. Let AI turns proceed (or tap Draw/Pass as they become available) until `gameOver` — confirm `GameResultModal` appears with a winner.

Stop the dev server afterward (kill the port's listener) and delete any screenshot files produced during this check, per `docs/governance/guardrails.md` §3.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/registry.ts
git commit -m "feat(pis-yedili): wire screen into game registry, register with home screen"
```
