# Playground Full-Deck Card Browsing & Larger Gallery Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `apps/playground`'s `CardTemplateEditor` ‹/› arrows to browse all 52 cards (today they only cycle between 3 fixed group-representative cards), and bump the full-deck gallery grid from `size="small"` to `size="normal"` so ranks like "10" render legibly.

**Architecture:** Extract the 52-card array both components already need into one shared util (`ORDERED_DECK`), so `CardGallery` and `CardTemplateEditor` read from a single source of truth. `CardTemplateEditor` switches its selection state from a `CardGroup` string to a numeric index into that array, deriving the group (for template editing) from whichever card is currently shown.

**Tech Stack:** TypeScript, React Native (Expo), `@world-cards/engine` (`createDeck`, `Card`/`Rank`/`Suit` types), `@world-cards/ui` (`PlayingCard`). No test framework is configured for `apps/playground` (confirmed: it's intentionally excluded from the root Jest `projects` array — see `docs/superpowers/specs/2026-07-12-card-playground-design.md`), so verification here is TypeScript compilation, not automated tests, matching the project's standing "no new tests for playground/mobile UI by default" policy.

## Global Constraints

- Scope is `apps/playground` only — no changes to `packages/ui`, `packages/engine`, or `apps/mobile`.
- No new automated tests (playground has no test runner configured; this is a UI-only prototyping tool per its own design spec).
- No screenshot/visual verification unless the user explicitly asks for it (standing instruction, 2026-07-17) — verification below is TypeScript compilation only.
- Typecheck command (confirmed working against the current baseline with zero errors): `npx tsc --noEmit` run from `apps/playground/`.

---

### Task 1: Shared deck ordering + card-label utilities

**Files:**
- Create: `apps/playground/src/utils/orderedDeck.ts`
- Modify: `apps/playground/src/utils/cardGroups.ts`

**Interfaces:**
- Produces: `ORDERED_DECK: Card[]` (52-card array, `@world-cards/engine`'s `createDeck({ deckCount: 1, includeJokers: false })` order) from `orderedDeck.ts`.
- Produces: `SUIT_LABELS: Record<Suit, string>` and `formatCardLabel(card: Card): string` (e.g. `formatCardLabel({rank: '7', suit: 'spades', id: '...'})` → `"7 of Spades"`) from `cardGroups.ts`, alongside the existing `getCardGroup`.

- [ ] **Step 1: Create `apps/playground/src/utils/orderedDeck.ts`**

```ts
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';

// Single source of truth for full-deck ordering, shared by CardGallery (which groups this by
// suit for display) and CardTemplateEditor (which pages through it one card at a time via the
// ‹/› arrows) — both need the exact same 52-card array so "card 14" means the same card in both.
export const ORDERED_DECK: Card[] = createDeck({ deckCount: 1, includeJokers: false });
```

- [ ] **Step 2: Add `SUIT_LABELS` and `formatCardLabel` to `apps/playground/src/utils/cardGroups.ts`**

Replace the full file contents with:

```ts
import type { Card, Rank, Suit } from '@world-cards/engine';
import type { CardGroup } from '../types';

// The gallery deck is generated with includeJokers: false, so 'joker' is
// never passed here in practice; it falls through to 'number' if it were.
export function getCardGroup(rank: Rank): CardGroup {
  if (rank === 'A') return 'ace';
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 'face';
  return 'number';
}

export const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  clubs: 'Clubs',
  diamonds: 'Diamonds',
};

// Used by CardTemplateEditor's per-card preview label (e.g. "7 of Spades") so it's clear
// exactly which of the 52 cards is currently shown while paging through with the ‹/› arrows.
export function formatCardLabel(card: Card): string {
  return card.suit != null ? `${card.rank} of ${SUIT_LABELS[card.suit]}` : card.rank;
}
```

- [ ] **Step 3: Typecheck**

Run (from `apps/playground/`): `npx tsc --noEmit`
Expected: no output (clean compile). `SUIT_LABELS`/`formatCardLabel` aren't consumed yet, so this only checks the new files compile in isolation — Tasks 2 and 3 wire up the actual usages.

- [ ] **Step 4: Commit**

```bash
git add apps/playground/src/utils/orderedDeck.ts apps/playground/src/utils/cardGroups.ts
git commit -m "feat(playground): add shared ORDERED_DECK and card-label utilities"
```

---

### Task 2: Larger gallery cards + shared deck source

**Files:**
- Modify: `apps/playground/src/components/CardGallery.tsx`

**Interfaces:**
- Consumes: `ORDERED_DECK: Card[]` from `../utils/orderedDeck` (Task 1). `SUIT_LABELS: Record<Suit, string>` from `../utils/cardGroups` (Task 1).

- [ ] **Step 1: Replace `CardGallery.tsx`'s local deck/labels with the shared utilities and bump card size**

Replace the full file contents with:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';
import { PlayingCard, TableFelt, TableWoodCorners } from '@world-cards/ui';
import { usePlaygroundStore } from '../state/playgroundStore';
import { getCardGroup, SUIT_LABELS } from '../utils/cardGroups';
import { ORDERED_DECK } from '../utils/orderedDeck';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

function cardsBySuit(suit: Suit): Card[] {
  return ORDERED_DECK.filter((card) => card.suit === suit);
}

export function CardGallery() {
  const templates = usePlaygroundStore((state) => state.templates);
  const table = usePlaygroundStore((state) => state.table);

  return (
    <View style={[styles.backdrop, { backgroundColor: table.feltColor }]}>
      <TableFelt />
      <TableWoodCorners woodColor={table.woodColor} />
      {SUIT_ORDER.map((suit) => (
        <View key={suit} style={styles.suitSection}>
          <Text style={styles.suitLabel}>{SUIT_LABELS[suit]}</Text>
          <View style={styles.row}>
            {cardsBySuit(suit).map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="normal"
                {...toPlayingCardOverrides(templates[getCardGroup(card.rank)])}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'relative', overflow: 'hidden', padding: 14 },
  suitSection: { marginBottom: 16 },
  suitLabel: { color: '#ffffff', fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 12 },
});
```

(This drops the file's own `createDeck`/local `DECK`/local `SUIT_LABELS` in favor of the Task 1 utilities; `cardsBySuit` now filters `ORDERED_DECK`. `size="small"` → `size="normal"` is the actual fix for the cramped "10".)

- [ ] **Step 2: Typecheck**

Run (from `apps/playground/`): `npx tsc --noEmit`
Expected: no output (clean compile).

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/CardGallery.tsx
git commit -m "feat(playground): render gallery cards at normal size, share deck ordering"
```

---

### Task 3: Full-deck arrow browsing in CardTemplateEditor

**Files:**
- Modify: `apps/playground/src/components/CardTemplateEditor.tsx`

**Interfaces:**
- Consumes: `ORDERED_DECK: Card[]` from `../utils/orderedDeck` (Task 1). `getCardGroup(rank: Rank): CardGroup` and `formatCardLabel(card: Card): string` from `../utils/cardGroups` (Task 1).

- [ ] **Step 1: Replace the group-based selection state with card-index-based state**

In `apps/playground/src/components/CardTemplateEditor.tsx`, change the imports at the top of the file from:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import type { Card } from '@world-cards/engine';
import type { CardGroup } from '../types';
import { MAX_CARD_BORDERS } from '../types';
import { usePlaygroundStore } from '../state/playgroundStore';
import { PlayingCard } from '@world-cards/ui';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';
import { ColorPicker } from './ColorPicker';
import { pickCardImage, buildCardImage } from '../utils/imagePicker';
```

to:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import type { Rank, Suit } from '@world-cards/engine';
import type { CardGroup } from '../types';
import { MAX_CARD_BORDERS } from '../types';
import { usePlaygroundStore } from '../state/playgroundStore';
import { PlayingCard } from '@world-cards/ui';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';
import { getCardGroup, formatCardLabel } from '../utils/cardGroups';
import { ORDERED_DECK } from '../utils/orderedDeck';
import { ColorPicker } from './ColorPicker';
import { pickCardImage, buildCardImage } from '../utils/imagePicker';
```

(`Card` is no longer referenced directly by name — `ORDERED_DECK` is already typed as `Card[]` — so it's replaced with the `Rank`/`Suit` types the new representative-card lookup needs.)

- [ ] **Step 2: Replace `GROUP_PREVIEW_CARD` with a representative rank/suit lookup, and add the index-lookup helper**

Replace this block:

```tsx
const GROUP_ORDER: CardGroup[] = ['number', 'face', 'ace'];

const GROUP_PREVIEW_CARD: Record<CardGroup, Card> = {
  number: { id: 'preview-number', suit: 'spades', rank: '7' },
  face: { id: 'preview-face', suit: 'hearts', rank: 'Q' },
  ace: { id: 'preview-ace', suit: 'clubs', rank: 'A' },
};
```

with:

```tsx
const GROUP_ORDER: CardGroup[] = ['number', 'face', 'ace'];

// Which card each group tab jumps the browser to when tapped — same representative
// cards the old fixed-preview design used (7♠ / Q♥ / A♣), just resolved against
// ORDERED_DECK's real card objects instead of one-off placeholder Card literals.
const GROUP_REPRESENTATIVE: Record<CardGroup, { rank: Rank; suit: Suit }> = {
  number: { rank: '7', suit: 'spades' },
  face: { rank: 'Q', suit: 'hearts' },
  ace: { rank: 'A', suit: 'clubs' },
};

function findCardIndex(rank: Rank, suit: Suit): number {
  return ORDERED_DECK.findIndex((card) => card.rank === rank && card.suit === suit);
}
```

- [ ] **Step 3: Replace the `selectedGroup` state and `cycleGroup` function with card-index state**

Replace:

```tsx
export function CardTemplateEditor() {
  const [selectedGroup, setSelectedGroup] = useState<CardGroup>('number');
  const [presetName, setPresetName] = useState('');
```

with:

```tsx
export function CardTemplateEditor() {
  const [cardIndex, setCardIndex] = useState<number>(() =>
    findCardIndex(GROUP_REPRESENTATIVE.number.rank, GROUP_REPRESENTATIVE.number.suit)
  );
  const currentCard = ORDERED_DECK[cardIndex];
  const selectedGroup = getCardGroup(currentCard.rank);
  const [presetName, setPresetName] = useState('');
```

Then replace:

```tsx
  function cycleGroup(delta: number) {
    const index = GROUP_ORDER.indexOf(selectedGroup);
    const next = (index + delta + GROUP_ORDER.length) % GROUP_ORDER.length;
    setSelectedGroup(GROUP_ORDER[next]);
  }
```

with:

```tsx
  function cycleCard(delta: number) {
    setCardIndex((index) => (index + delta + ORDERED_DECK.length) % ORDERED_DECK.length);
  }
```

- [ ] **Step 4: Wire the arrows, group tabs, and preview to the new state**

Replace:

```tsx
        <Pressable testID="group-nav-prev" onPress={() => cycleGroup(-1)} style={styles.groupNavButton}>
          <Text style={styles.groupNavLabel}>‹</Text>
        </Pressable>
        {GROUP_ORDER.map((group) => (
          <Pressable
            key={group}
            testID={`group-tab-${group}`}
            onPress={() => setSelectedGroup(group)}
            style={[styles.groupTab, group === selectedGroup && styles.groupTabActive]}
          >
            <Text style={styles.groupTabLabel}>{GROUP_LABELS[group]}</Text>
          </Pressable>
        ))}
        <Pressable testID="group-nav-next" onPress={() => cycleGroup(1)} style={styles.groupNavButton}>
          <Text style={styles.groupNavLabel}>›</Text>
        </Pressable>
      </View>

      <View style={styles.editorBody}>
        <PlayingCard card={GROUP_PREVIEW_CARD[selectedGroup]} size="normal" {...toPlayingCardOverrides(template)} />
```

with:

```tsx
        <Pressable testID="group-nav-prev" onPress={() => cycleCard(-1)} style={styles.groupNavButton}>
          <Text style={styles.groupNavLabel}>‹</Text>
        </Pressable>
        {GROUP_ORDER.map((group) => (
          <Pressable
            key={group}
            testID={`group-tab-${group}`}
            onPress={() => setCardIndex(findCardIndex(GROUP_REPRESENTATIVE[group].rank, GROUP_REPRESENTATIVE[group].suit))}
            style={[styles.groupTab, group === selectedGroup && styles.groupTabActive]}
          >
            <Text style={styles.groupTabLabel}>{GROUP_LABELS[group]}</Text>
          </Pressable>
        ))}
        <Pressable testID="group-nav-next" onPress={() => cycleCard(1)} style={styles.groupNavButton}>
          <Text style={styles.groupNavLabel}>›</Text>
        </Pressable>
      </View>

      <View style={styles.editorBody}>
        <View style={styles.previewColumn}>
          <Text style={styles.previewLabel}>{formatCardLabel(currentCard)}</Text>
          <PlayingCard card={currentCard} size="normal" {...toPlayingCardOverrides(template)} />
        </View>
```

- [ ] **Step 5: Add the two new styles**

In the `StyleSheet.create` call at the bottom of the file, add (next to `editorBody`):

```tsx
  previewColumn: { alignItems: 'center', gap: 6 },
  previewLabel: { color: '#eeeeee', fontWeight: 'bold' },
```

- [ ] **Step 6: Typecheck**

Run (from `apps/playground/`): `npx tsc --noEmit`
Expected: no output (clean compile). This also confirms `GROUP_PREVIEW_CARD` and the old `Card`-typed import are fully gone (no unused-import errors) and that `template` (still `usePlaygroundStore((state) => state.templates[selectedGroup])`, unchanged) still resolves against the now-derived `selectedGroup`.

- [ ] **Step 7: Commit**

```bash
git add apps/playground/src/components/CardTemplateEditor.tsx
git commit -m "feat(playground): browse the full 52-card deck via the editor's arrow buttons"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers the spec's `ORDERED_DECK` extraction; Task 2 covers the gallery `size="normal"` fix and its `ORDERED_DECK` consumption; Task 3 covers all of `CardTemplateEditor`'s full-deck browsing behavior (index state, `cycleCard`, group-tab jump-to-representative, derived `selectedGroup`, and the new current-card label). No spec section is left uncovered; the spec's explicit non-goals (face-card box variation, any `packages/ui` change, new tests) are correctly untouched by this plan.
- **Type consistency:** `ORDERED_DECK`/`findCardIndex`/`GROUP_REPRESENTATIVE`/`formatCardLabel`/`SUIT_LABELS` are named identically everywhere they're produced (Task 1) and consumed (Tasks 2–3). `selectedGroup` keeps its original type (`CardGroup`) and is still the value every existing border/image handler call (`setBorderRadius(selectedGroup, ...)` etc., untouched by this plan) expects.
- **No placeholders:** every step above shows full, exact code — no "similar to Task N" shorthand.
