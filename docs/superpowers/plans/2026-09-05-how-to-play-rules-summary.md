# How-to-Play Rules Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand, static "how to play" rules-summary modal for each of the three built games (Pişti, Batak, Pis Yedili), reachable from an info icon on Home's game list.

**Architecture:** A single game-agnostic `RulesSummaryModal` component (`apps/mobile/src/components`) renders whichever game's plain-data `GameRules` object it's given. Each game owns its own rules content (`apps/mobile/src/games/<id>/rules.ts`); a small `rulesRegistry.ts` maps `gameId → GameRules` the same way `registry.ts` already maps `gameId → screen component`, so `HomeScreen`/`GameMenuRow` never import a specific game's folder directly.

**Tech Stack:** React Native, TypeScript, existing `@world-of-cards/ui` modal primitives (`ModalCloseButton`, `MODAL_CARD_LARGE_IMAGE`).

**Spec:** `docs/superpowers/specs/2026-09-05-how-to-play-rules-summary-design.md`

## Global Constraints

- Rules prose never lives in `packages/engine` — the engine has zero React/content dependency (Engineering Principle 1).
- Each game's rules content lives inside that game's own `apps/mobile/src/games/<id>/` folder, not in shared/shell code (Engineering Principle 2).
- No proactive automated tests for this mobile-UI feature by default (Engineering Principle 4) — every task verifies via `tsc --noEmit` plus a manual/visual check, not a new test file.
- `RulesSummaryModal` lives in `apps/mobile/src/components/`, not `packages/ui` — `packages/ui` today holds only content-free visual primitives.
- The Turkish rules text drafted in Tasks 2–4 is a **draft**, sourced from this repo's actual rule engines — it must be explicitly reviewed and approved by the user in Task 5 before Task 6 wires it into the app. Do not skip or fold Task 5 into another task.
- Modal visual language follows the existing `BatakSettingsModal` pattern (`Modal` → backdrop `Pressable` that closes on tap → inner no-op `Pressable` that swallows the tap so inside taps don't close it → `ModalCloseButton`), using `MODAL_CARD_LARGE_IMAGE`/`MODAL_CARD_LARGE_ASPECT_RATIO` instead of the small variant, since this modal's content is longer than `BatakSettingsModal`'s one static row.

---

## Task 1: `RulesSummaryModal` component and shared types

**Files:**
- Create: `apps/mobile/src/components/RulesSummaryModal.tsx`

**Interfaces:**
- Produces: `GameRulesSection { heading: string; body: string }`, `GameRules { title: string; sections: GameRulesSection[] }`, `RulesSummaryModalProps { rules: GameRules; visible: boolean; onClose: () => void }`, and the component `RulesSummaryModal(props: RulesSummaryModalProps): JSX.Element`. Tasks 2–4 import `GameRules` from this file; Task 6 imports the component itself.

- [ ] **Step 1: Create the component file**

```tsx
import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  BODY_REGULAR,
  DISPLAY_BOLD,
  MODAL_CARD_LARGE_ASPECT_RATIO,
  MODAL_CARD_LARGE_IMAGE,
  ModalCloseButton,
} from '@world-of-cards/ui';

export interface GameRulesSection {
  heading: string;
  body: string;
}

export interface GameRules {
  title: string;
  sections: GameRulesSection[];
}

export interface RulesSummaryModalProps {
  rules: GameRules;
  visible: boolean;
  onClose: () => void;
}

// Same Modal → backdrop-tap-to-close → inner no-op-Pressable shape as BatakSettingsModal
// (apps/mobile/src/games/batak/BatakSettingsModal.tsx), scaled up to MODAL_CARD_LARGE_IMAGE
// with a ScrollView, since rules content is longer than that modal's one static row.
export function RulesSummaryModal({ rules, visible, onClose }: RulesSummaryModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxWidth = windowWidth * 0.9;
  const maxHeight = windowHeight * 0.85;
  const cardWidth = Math.min(maxWidth, maxHeight * MODAL_CARD_LARGE_ASPECT_RATIO);
  const cardHeight = cardWidth / MODAL_CARD_LARGE_ASPECT_RATIO;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="rules-summary-modal-backdrop">
        <Pressable onPress={() => {}}>
          <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
            <Image
              source={MODAL_CARD_LARGE_IMAGE}
              resizeMode="stretch"
              style={[StyleSheet.absoluteFill, styles.cardImage]}
            />
            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
              <Text style={styles.title}>{rules.title}</Text>
              {rules.sections.map((section) => (
                <View key={section.heading} style={styles.section}>
                  <Text style={styles.sectionHeading}>{section.heading}</Text>
                  <Text style={styles.sectionBody}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
            <ModalCloseButton onPress={onClose} style={styles.closeButton} testID="rules-summary-modal-close" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  content: { flex: 1 },
  contentInner: { padding: 28, paddingTop: 40 },
  title: { fontFamily: DISPLAY_BOLD, fontSize: 20, textAlign: 'center', color: '#f4c542', marginBottom: 18 },
  section: { marginBottom: 16 },
  sectionHeading: { fontFamily: DISPLAY_BOLD, fontSize: 14, color: '#f4c542', marginBottom: 4 },
  sectionBody: { fontFamily: BODY_REGULAR, fontSize: 13.5, color: '#f5f0e6', lineHeight: 19 },
  closeButton: { position: 'absolute', top: 10, right: 10 },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors referencing `RulesSummaryModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/RulesSummaryModal.tsx
git commit -m "feat(mobile): add game-agnostic RulesSummaryModal component"
```

---

## Task 2: Pişti rules content

**Files:**
- Create: `apps/mobile/src/games/pisti/rules.ts`

**Interfaces:**
- Consumes: `GameRules` from `../../components/RulesSummaryModal` (Task 1).
- Produces: `pistiRules: GameRules`, consumed by Task 6's `rulesRegistry.ts`.

Content is sourced directly from `packages/engine/src/games/pisti/rules.ts`'s actual `cardPoints`, capture, and bonus logic — not generic outside knowledge of Pişti — per the spec's content-authorship requirement.

- [ ] **Step 1: Create the content file**

```ts
import type { GameRules } from '../../components/RulesSummaryModal';

export const pistiRules: GameRules = {
  title: 'Pişti Nasıl Oynanır?',
  sections: [
    {
      heading: 'Amaç',
      body: 'Ortadaki yığından en çok kartı ve en değerli kartları toplayarak rakiplerinden yüksek puana ulaşmak.',
    },
    {
      heading: 'Kart Toplama',
      body: 'Sırayla elindeki bir kartı ortaya atarsın. Attığın kart, yığının en üstündeki kartla aynı numaraysa ya da bir Vale ise, yığındaki tüm kartları toplarsın. Yığının üstünde bir Vale varsa, onu ancak başka bir Vale ile toplayabilirsin.',
    },
    {
      heading: 'Pişti',
      body: 'Yığında tek kart varken üstüne aynı numarayı koyup toplarsan buna "pişti" denir ve 10 bonus puan kazanırsın. Yığındaki tek kart bir Vale ise ve onu bir Vale ile toplarsan bonus 20 puana çıkar.',
    },
    {
      heading: 'Puanlama',
      body: 'Topladığın kartlardan Aslar ve Valeler 1\'er puan, Sinek 2 kartı 2 puan, Karo 10 kartı 3 puan değerindedir. En çok kartı toplayan oyuncuya (veya takıma) ek 3 puan verilir — birden fazla oyuncu eşit sayıda kartla en öndeyse bu bonus verilmez.',
    },
    {
      heading: 'Elin Sonu',
      body: 'Kartlar bitince yeniden dağıtılır; desteden çekilecek kart kalmayınca el sona erer ve masada kalan son kartlar en son toplamayı yapan oyuncuya geçer. En yüksek toplam puana sahip oyuncu (veya takım) eli kazanır.',
    },
  ],
};
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors referencing `games/pisti/rules.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pisti/rules.ts
git commit -m "feat(pisti): add how-to-play rules content"
```

---

## Task 3: Batak rules content

**Files:**
- Create: `apps/mobile/src/games/batak/rules.ts`

**Interfaces:**
- Consumes: `GameRules` from `../../components/RulesSummaryModal` (Task 1).
- Produces: `batakRules: GameRules`, consumed by Task 6's `rulesRegistry.ts`.

Content is sourced from `packages/engine/src/games/batak/rules.ts` — bidding (`ruleConstants`, `biddingLegalMoves`), trump/kitty (`kittyExchangeLegalMoves`, `ruleConstants`'s `kittySize`), the must-follow/must-overtake play rule (`playingLegalMoves`), and scoring (`calculateScore`) — covering both the 4-player (no kitty) and 3-player gömmeli (4-card kitty) variants in one summary, per the spec's single-modal-per-game decision (no per-variant sub-screens).

- [ ] **Step 1: Create the content file**

```ts
import type { GameRules } from '../../components/RulesSummaryModal';

export const batakRules: GameRules = {
  title: 'Batak Nasıl Oynanır?',
  sections: [
    {
      heading: 'Amaç',
      body: 'Sırayla söz (ihale) alıp, o elde kaç el (trick) alacağını taahhüt ederek taahhüdünü tutturmaya çalışmak.',
    },
    {
      heading: 'İhale',
      body: 'Kartlar dağıtıldıktan sonra sırayla ya bir sayı söylersin (o elde en az o kadar el alacağını taahhüt edersin) ya da pas geçersin. En yüksek sayıyı söyleyen oyuncu ihaleyi kazanır ve koz rengini seçer. Herkes pas geçerse ihale, düşük bir taahhütle otomatik olarak bir oyuncuya verilir.',
    },
    {
      heading: 'Gömmeli (3 Kişilik) Farkı',
      body: '3 kişilik oyunda masada kapalı 4 kartlık bir "kitty" bulunur. İhaleyi kazanan oyuncu koz rengini seçtikten sonra bu 4 kartı eline alır, sonra elinden istediği 4 kartı görünmeden gömer. 4 kişilik oyunda kitty yoktur, koz seçilir seçilmez oyuna başlanır.',
    },
    {
      heading: 'Elin Oynanışı',
      body: 'Açılan rengin elinde varsa o renkten oynamak, üstelik mümkünse masadaki en yüksek karttan daha yükseğini oynamak zorundasın. O renk elinde yoksa koz oynayabilirsin (kozun da elinde varsa ve masada koz varsa, yine mümkünse daha yükseğini oynamak zorundasın). Koz da yoksa istediğin kartı atabilirsin. Koz, biri koz oynayana kadar açılış rengi olarak oynanamaz — elinde başka renk kalmadıysa bu kural uygulanmaz.',
    },
    {
      heading: 'Puanlama',
      body: 'İhaleyi alan oyuncu taahhüt ettiği sayıda (veya fazla) el alırsa aldığı el sayısı kadar puan kazanır; alamazsa taahhüdü kadar puan kaybeder. Diğer oyuncular aldıkları el sayısı kadar puan kazanır — ama çok az el alırlarsa (4 kişilikte hiç el almazlarsa, 3 kişilikte 2\'den az el alırlarsa) onlar da ihale miktarı kadar puan kaybeder.',
    },
  ],
};
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors referencing `games/batak/rules.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/rules.ts
git commit -m "feat(batak): add how-to-play rules content"
```

---

## Task 4: Pis Yedili rules content

**Files:**
- Create: `apps/mobile/src/games/pis-yedili/rules.ts`

**Interfaces:**
- Consumes: `GameRules` from `../../components/RulesSummaryModal` (Task 1).
- Produces: `pisYedeliRules: GameRules`, consumed by Task 6's `rulesRegistry.ts`.

Content is sourced from `docs/domains/games/pis-yedili/overview.md`'s existing rules description (Mau-Mau/Crazy Eights family: suit-or-rank matching, wild/skip Jacks, stacking 7-penalty).

- [ ] **Step 1: Create the content file**

```ts
import type { GameRules } from '../../components/RulesSummaryModal';

export const pisYedeliRules: GameRules = {
  title: 'Pis Yedili Nasıl Oynanır?',
  sections: [
    {
      heading: 'Amaç',
      body: 'Elindeki tüm kartlardan ilk kurtulan oyuncu eli kazanır.',
    },
    {
      heading: 'Oynanış',
      body: 'Sıra sende, ortadaki yığının en üstündeki kartla aynı renk ya da aynı numarada bir kart oynayabilirsin. Elinde oynayacak uygun kart yoksa desteden bir kart çekersin; deste de boşsa sırayı pas geçersin.',
    },
    {
      heading: 'Vale',
      body: 'Vale her zaman oynanabilir ve bir sonraki oyuncu için geçerli olacak rengi sen belirlersin. Vale oynamak ayrıca sırayı bir kişi atlatır — 2 kişilik oyunda Vale oynadığında sıra tekrar sana gelir.',
    },
    {
      heading: '7 (Pis Yedi)',
      body: '7 oynarsan bir sonraki oyuncu 2 kart çekmek zorunda kalır. O oyuncu başka bir 7 oynayarak cezayı bir sonraki oyuncuya devredebilir (cezalar üst üste biner); devredemezse birikmiş toplam kartı çeker ve sırasını kaybeder.',
    },
  ],
};
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors referencing `games/pis-yedili/rules.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pis-yedili/rules.ts
git commit -m "feat(pis-yedili): add how-to-play rules content"
```

---

## Task 5: Content review checkpoint (hard gate — do not skip)

**Files:** none — this task produces no diff.

Per the spec's §4 requirement, the three drafted rules texts (Tasks 2–4) must be explicitly reviewed and approved by the user before Task 6 wires them into the running app. This is a correctness gate, not a formality: a subtly wrong sentence here is a player-visible rules bug.

- [ ] **Step 1: Present all three `rules.ts` contents to the user for review**, either by pointing them at the three files created in Tasks 2–4 or by pasting the three `sections` arrays into the conversation.
- [ ] **Step 2: Get explicit approval, or apply requested edits and re-run Steps 2–3 of whichever Task's file changed.**
- [ ] **Step 3: Only proceed to Task 6 once approval is given.**

---

## Task 6: Wire info icon, registry, and Home-screen state

**Files:**
- Create: `apps/mobile/src/games/rulesRegistry.ts`
- Modify: `apps/mobile/src/screens/home/GameMenuRow.tsx`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `GameRules`/`RulesSummaryModal` (Task 1), `pistiRules`/`batakRules`/`pisYedeliRules` (Tasks 2–4).
- Produces: `gameRules: Record<string, GameRules>` (the registry), `GameMenuRowProps.onInfoPress?: () => void` (new optional prop).

- [ ] **Step 1: Create the rules registry**, mirroring `apps/mobile/src/games/registry.ts`'s exact `Record<string, ...>` shape so it's the one place (besides each game's own folder) that changes when a game is added:

```ts
import type { GameRules } from '../components/RulesSummaryModal';
import { pistiRules } from './pisti/rules';
import { batakRules } from './batak/rules';
import { pisYedeliRules } from './pis-yedili/rules';

export const gameRules: Record<string, GameRules> = {
  pisti: pistiRules,
  batak: batakRules,
  'pis-yedili': pisYedeliRules,
};
```

- [ ] **Step 2: Add an info-icon touch target to `GameMenuRow.tsx`**

Modify `apps/mobile/src/screens/home/GameMenuRow.tsx`. Add `onInfoPress?: () => void` to `GameMenuRowProps`, and render a small info button as a sibling of `textBlock` inside the existing `PressableFeedback`, using its own nested `PressableFeedback` with `hitSlop` so it captures its own tap independently of the row's:

```tsx
export interface GameMenuRowProps {
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  onPress: () => void;
  onInfoPress?: () => void;
  entranceDelayMs?: number;
  testID?: string;
}
```

Inside the component, after destructuring `onInfoPress` alongside the existing props, add the info button as the last child of the row's `PressableFeedback`, right after `textBlock`'s closing tag:

```tsx
{onInfoPress && (
  <PressableFeedback
    onPress={onInfoPress}
    hitSlop={10}
    style={styles.infoButton}
    overlayBorderRadius={14}
    testID={testID ? `${testID}-info` : undefined}>
    <Text style={styles.infoIcon}>{'ⓘ'}</Text>
  </PressableFeedback>
)}
```

(`ⓘ` is "ⓘ", circled Latin small letter i — avoids pulling in an icon font/library for one glyph.)

Add matching styles:

```ts
infoButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
infoIcon: { fontSize: 16, color: '#f5f0e6', opacity: 0.85 },
```

- [ ] **Step 3: Wire `HomeScreen.tsx` to own which game's rules modal is open**

Modify `apps/mobile/src/screens/HomeScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-of-cards/engine';
import { BODY_REGULAR, TableFelt } from '@world-of-cards/ui';
import { HeroCard } from './home/HeroCard';
import { HomeWordmark } from './home/HomeWordmark';
import { GameMenuRow } from './home/GameMenuRow';
import { RulesSummaryModal } from '../components/RulesSummaryModal';
import { gameRules } from '../games/rulesRegistry';

export interface HomeScreenProps {
  onSelectGame: (gameId: string) => void;
}

export function HomeScreen({ onSelectGame }: HomeScreenProps) {
  const games = getGames();
  const [rulesModalGameId, setRulesModalGameId] = useState<string | null>(null);
  const activeRules = rulesModalGameId ? gameRules[rulesModalGameId] : null;

  return (
    <View style={styles.container}>
      <TableFelt />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <HeroCard />
        <HomeWordmark />
        <View style={styles.menu}>
          {games.length === 0 ? (
            <Text style={styles.empty}>No games installed yet</Text>
          ) : (
            games.map((game, index) => (
              <GameMenuRow
                key={game.id}
                displayName={game.displayName}
                category={game.category}
                minPlayers={game.minPlayers}
                maxPlayers={game.maxPlayers}
                onPress={() => onSelectGame(game.id)}
                onInfoPress={gameRules[game.id] ? () => setRulesModalGameId(game.id) : undefined}
                entranceDelayMs={index * 60}
                testID={`game-menu-row-${game.id}`}
              />
            ))
          )}
        </View>
      </ScrollView>
      {activeRules && (
        <RulesSummaryModal rules={activeRules} visible={!!rulesModalGameId} onClose={() => setRulesModalGameId(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a2e1f' },
  content: { flexGrow: 1, paddingTop: 48, paddingBottom: 40 },
  menu: { paddingHorizontal: 22, marginTop: 20, gap: 12 },
  empty: { fontFamily: BODY_REGULAR, fontSize: 14, color: '#f5f0e688', textAlign: 'center', marginTop: 20 },
});
```

(`onInfoPress={gameRules[game.id] ? ... : undefined}` means a future game with no `rules.ts` entry yet simply shows no info icon, rather than crashing — matches Engineering Principle 2's "additive, not a change to shared plumbing" for games still mid-build.)

- [ ] **Step 4: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/rulesRegistry.ts apps/mobile/src/screens/home/GameMenuRow.tsx apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat(mobile): wire how-to-play info icon into Home's game list"
```

---

## Task 7: On-device/emulator verification

Per `docs/governance/guardrails.md` Rule 3 (proactive screenshot verification for UI-affecting work) and the spec's explicitly flagged nested-touch-target risk (§3.3): the info icon sits inside the same row as the existing full-row `PressableFeedback`, and RN's responder system can behave surprisingly with nested pressables.

**Files:** none — this task produces no diff unless it uncovers a bug, in which case fix inline and re-run Task 6's Step 4.

- [ ] **Step 1: Start the app** (`apps/mobile`'s existing dev workflow — emulator, physical device over adb, or the `react-native-web`/Playwright browser workaround per `docs/domains/mobile-expo/overview.md`, whichever this session already has available).
- [ ] **Step 2: For each of the three games on Home, tap the info icon and confirm:** the rules modal opens with that game's correct title/content, tapping outside the card closes it, the close button closes it, and — critically — tapping the info icon does **not** also trigger `onSelectGame` (i.e., does not navigate into the game).
- [ ] **Step 3: Confirm tapping elsewhere on a row (not the info icon) still opens the game as before** (no regression to the existing primary tap target).
- [ ] **Step 4: Take a screenshot of one rules modal open, per Rule 3**, then delete it before merging per that same rule.
- [ ] **Step 5: If any check in Steps 2–3 fails**, fix it in `GameMenuRow.tsx` (e.g. adjust `hitSlop`, wrap the info button so its bounds don't overlap the row's own responder area) and re-run Task 6's Steps 4–5.
