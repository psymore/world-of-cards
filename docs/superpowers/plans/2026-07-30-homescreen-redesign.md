# HomeScreen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/mobile/src/screens/HomeScreen.tsx`'s plain, unanimated list with the locked v1.0.0 marquee design — a hero illustrated court card, a serif gold wordmark, and per-game menu rows driven by existing engine registry data.

**Architecture:** New small, HomeScreen-only presentational components under `apps/mobile/src/screens/home/`, composed by a rewritten `HomeScreen.tsx`. No `packages/engine` changes. One small `packages/ui` addition (exporting an existing internal color constant). No shared-component extraction — this is a deliberately distinct visual identity from the game tables, per the spec.

**Tech Stack:** React Native (Expo SDK 57), existing `react-native-svg` (gradients — see Global Constraints), new `expo-image` dependency (hero card image), existing `expo-font`-loaded PT Serif, existing `@world-of-cards/ui` `glowShadow`/`SuitIcon`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md` — read it first; this plan implements it exactly.
- **No new automated tests for this decorative UI work**, per the project's standing 2026-07-07 testing policy (CLAUDE.md). `HomeScreen.test.tsx` is updated only enough to keep passing, not expanded. This applies even to the small pure helper functions in Task 2 — they're display formatting for a screen, not engine core logic, so the policy's "ask before adding a test" default applies; don't add tests unless asked.
- **Gradients: use `react-native-svg`'s `<LinearGradient>`, NOT `experimental_backgroundImage`.** The `expo-native-ui` skill's current guidance recommends CSS gradients via `experimental_backgroundImage`, but its own docs state that requires React Native's New Architecture *and* is explicitly unavailable in Expo Go. This app runs via plain Expo Go (`apps/mobile/package.json` has no `expo-dev-client`), and `react-native-svg`'s gradient support is already proven working in this exact app (`PlatformWoodBackground.tsx`, `TableWoodCorners.tsx`, `BidControls.tsx`). Follow that established, working pattern.
- **Shadows: use the existing `glowShadow(color, radius)` helper from `@world-of-cards/ui`** (legacy `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` + `elevation`), not the `expo-native-ui` skill's current recommendation of CSS `boxShadow`. `glowShadow` is this repo's established, working, shared convention (used by `PlayingCard`, `PlayerBadge`, `BidControls`) — switching just this screen to a second shadow system would create inconsistency for no benefit. Worth a future repo-wide look, not decided here.
- **Images: use `expo-image`'s `Image`** (new dependency — `npx expo install expo-image`) for the hero card, per current official Expo guidance. No existing convention conflicts with this (nothing in `apps/mobile` currently imports RN core's `Image`), so this is a clean adoption.
- **Styling: keep `StyleSheet.create`**, matching every existing file in this app — don't switch to inline styles.
- Every new component under `apps/mobile/src/screens/home/` is `React.memo`'d, matching this repo's established convention for decorative/presentational components (`SuitIcon`, `PlayerAvatar`, `TableFelt`, etc.).

---

### Task 1: Source the hero card art asset

**Files:**
- Create: `apps/mobile/assets/hero-card-queen-of-hearts.png`
- Create: `apps/mobile/assets/CARD_ART_ATTRIBUTION.md`

**Interfaces:**
- Produces: a PNG file at `apps/mobile/assets/hero-card-queen-of-hearts.png` that Task 6 imports via `require('../../../assets/hero-card-queen-of-hearts.png')`.

- [ ] **Step 1: Download the asset**

Already verified during planning: `htdebeer/SVG-cards` (GitHub, LGPL-2.1) ships pre-rendered PNGs, and its Queen of Hearts (`png/2x/heart_queen.png`, 338×489px) closely matches the style of the reference image already in this repo (`docs/references/card-art/this what I want to achive.png` — classic rider-style court card, corner index box, symmetrical portrait). Download it directly:

```bash
curl -sL "https://raw.githubusercontent.com/htdebeer/SVG-cards/master/png/2x/heart_queen.png" -o apps/mobile/assets/hero-card-queen-of-hearts.png
```

- [ ] **Step 2: Verify the download**

```bash
node -e "
const fs = require('fs');
const buf = fs.readFileSync('apps/mobile/assets/hero-card-queen-of-hearts.png');
console.log('width', buf.readUInt32BE(16), 'height', buf.readUInt32BE(20), 'bytes', buf.length);
"
```

Expected: `width 338 height 489 bytes 121157` (or close — a re-download should be byte-identical).

- [ ] **Step 3: Write the attribution file**

Create `apps/mobile/assets/CARD_ART_ATTRIBUTION.md`:

```markdown
# Card Art Attribution

## hero-card-queen-of-hearts.png

Source: [htdebeer/SVG-cards](https://github.com/htdebeer/SVG-cards) (`png/2x/heart_queen.png`)
Author: Heerko de Beer (and contributors)
License: LGPL-2.1 (see the source repository's `LICENSE` file)

Used as the HomeScreen's hero illustrated court card, per
`docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/assets/hero-card-queen-of-hearts.png apps/mobile/assets/CARD_ART_ATTRIBUTION.md
git commit -m "feat(mobile): source hero card art for HomeScreen redesign"
```

---

### Task 2: Export `SUIT_COLOR` from `packages/ui`

**Files:**
- Modify: `packages/ui/src/PlayingCard.tsx` (around line 50)
- Modify: `packages/ui/src/index.ts` (line 1)

**Interfaces:**
- Produces: `SUIT_COLOR: { red: string; black: string }`, importable as `import { SUIT_COLOR } from '@world-of-cards/ui'`. Consumed by Task 4's `MiniCardFan`.

- [ ] **Step 1: Export the existing constant**

In `packages/ui/src/PlayingCard.tsx`, find:

```ts
const SUIT_COLOR = { red: "#c0392b", black: "#111" };
```

Change to:

```ts
export const SUIT_COLOR = { red: "#c0392b", black: "#111" };
```

- [ ] **Step 2: Re-export it from the package root**

In `packages/ui/src/index.ts`, find:

```ts
export { PlayingCard, CARD_DIMS } from './PlayingCard';
```

Change to:

```ts
export { PlayingCard, CARD_DIMS, SUIT_COLOR } from './PlayingCard';
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/ui && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the existing UI package tests**

```bash
cd packages/ui && npm test
```

Expected: all existing tests still pass (this is a pure export addition, no behavior change).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/PlayingCard.tsx packages/ui/src/index.ts
git commit -m "feat(ui): export SUIT_COLOR for reuse outside PlayingCard"
```

---

### Task 3: `gameDisplay.ts` helper functions

**Files:**
- Create: `apps/mobile/src/screens/home/gameDisplay.ts`

**Interfaces:**
- Consumes: `GameCategory` type from `@world-of-cards/engine`.
- Produces: `categoryLabel(category: GameCategory): string`, `accentColorForCategory(category: GameCategory): string`, `playerRangeLabel(minPlayers: number, maxPlayers: number): string`. Consumed by Task 5's `GameMenuRow`.

- [ ] **Step 1: Write the file**

```ts
import type { GameCategory } from '@world-of-cards/engine';

const CATEGORY_LABEL: Record<GameCategory, string> = {
  fishing: 'Fishing',
  'trick-taking': 'Trick-taking',
  patience: 'Solitaire',
  betting: 'Betting',
  'draw-and-discard': 'Draw & Discard',
  other: 'Card Game',
};

const CATEGORY_ACCENT: Record<GameCategory, string> = {
  fishing: '#4ac9a0',
  'trick-taking': '#d9b34a',
  patience: '#7aa2f7',
  betting: '#e08a3c',
  'draw-and-discard': '#c77dff',
  other: '#9a8fb0',
};

export function categoryLabel(category: GameCategory): string {
  return CATEGORY_LABEL[category];
}

export function accentColorForCategory(category: GameCategory): string {
  return CATEGORY_ACCENT[category];
}

export function playerRangeLabel(minPlayers: number, maxPlayers: number): string {
  if (minPlayers === maxPlayers) {
    return minPlayers === 1 ? '1 player' : `${minPlayers} players`;
  }
  return `${minPlayers}-${maxPlayers} players`;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors (this file has no consumers yet, so this only checks the file itself is valid).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/home/gameDisplay.ts
git commit -m "feat(mobile): add HomeScreen game-display formatting helpers"
```

---

### Task 4: `MiniCardFan` component

**Files:**
- Create: `apps/mobile/src/screens/home/MiniCardFan.tsx`

**Interfaces:**
- Consumes: `SuitIcon`, `SUIT_COLOR` from `@world-of-cards/ui` (Task 2).
- Produces: `MiniCardFan` component (zero props), a fixed-size ~3-card fan (spade/heart/club, natural suit coloring). Consumed by Task 5's `GameMenuRow`.

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SuitIcon, SUIT_COLOR } from '@world-of-cards/ui';
import type { Suit } from '@world-of-cards/engine';

const FAN_SUITS: Array<{ suit: Suit; color: string }> = [
  { suit: 'spades', color: SUIT_COLOR.black },
  { suit: 'hearts', color: SUIT_COLOR.red },
  { suit: 'clubs', color: SUIT_COLOR.black },
];

export const MiniCardFan = React.memo(function MiniCardFan() {
  return (
    <View style={styles.fan}>
      {FAN_SUITS.map(({ suit, color }, index) => (
        <View key={suit} style={[styles.card, index > 0 && styles.overlap]}>
          <SuitIcon suit={suit} size={11} color={color} />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  fan: { flexDirection: 'row' },
  card: {
    width: 20,
    height: 29,
    borderRadius: 3,
    backgroundColor: '#fdfdfd',
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  overlap: { marginLeft: -11 },
});
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/home/MiniCardFan.tsx
git commit -m "feat(mobile): add MiniCardFan component for HomeScreen menu rows"
```

---

### Task 5: `GameMenuRow` component

**Files:**
- Create: `apps/mobile/src/screens/home/GameMenuRow.tsx`

**Interfaces:**
- Consumes: `MiniCardFan` (Task 4), `categoryLabel`/`accentColorForCategory`/`playerRangeLabel` (Task 3), `GameCategory` from `@world-of-cards/engine`.
- Produces: `GameMenuRow` component, props `{ displayName: string; category: GameCategory; minPlayers: number; maxPlayers: number; onPress: () => void; testID?: string }`. Consumed by Task 7's `HomeScreen.tsx`.

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameCategory } from '@world-of-cards/engine';
import { MiniCardFan } from './MiniCardFan';
import { accentColorForCategory, categoryLabel, playerRangeLabel } from './gameDisplay';

export interface GameMenuRowProps {
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  onPress: () => void;
  testID?: string;
}

export const GameMenuRow = React.memo(function GameMenuRow({
  displayName,
  category,
  minPlayers,
  maxPlayers,
  onPress,
  testID,
}: GameMenuRowProps) {
  const accent = accentColorForCategory(category);
  const subtitle = `${categoryLabel(category)} · ${playerRangeLabel(minPlayers, maxPlayers)}`;
  return (
    <Pressable onPress={onPress} testID={testID} style={[styles.row, { borderLeftColor: accent }]}>
      <MiniCardFan />
      <View style={styles.textBlock}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: '#d9b34a55',
    borderLeftWidth: 3,
  },
  textBlock: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#f2e6ff', letterSpacing: 0.3 },
  subtitle: { fontSize: 11, color: '#f2e6ff', opacity: 0.55, marginTop: 2 },
});
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/home/GameMenuRow.tsx
git commit -m "feat(mobile): add GameMenuRow component for HomeScreen"
```

---

### Task 6: `HomeBackground` and `BaizeStrip` decorative overlays

**Files:**
- Create: `apps/mobile/src/screens/home/HomeBackground.tsx`
- Create: `apps/mobile/src/screens/home/BaizeStrip.tsx`

**Interfaces:**
- Produces: `HomeBackground` (zero props, absolutely fills its parent with the 3-stop navy/plum gradient) and `BaizeStrip` (zero props, thin absolutely-positioned green gradient strip pinned to the bottom edge). Both consumed by Task 7's `HomeScreen.tsx`.

- [ ] **Step 1: Write `HomeBackground.tsx`**

Follows the exact measure-then-render-SVG-gradient pattern already established in `apps/mobile/src/games/batak/table/PlatformWoodBackground.tsx`.

```tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export const HomeBackground = React.memo(function HomeBackground() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.noPointerEvents]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}>
      {size && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id="homeBackgroundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#1a0f2e" />
              <Stop offset="55%" stopColor="#2b1149" />
              <Stop offset="100%" stopColor="#180a26" />
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#homeBackgroundGradient)" />
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  noPointerEvents: { pointerEvents: 'none' },
});
```

- [ ] **Step 2: Write `BaizeStrip.tsx`**

```tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const STRIP_HEIGHT = 140;

export const BaizeStrip = React.memo(function BaizeStrip() {
  const [width, setWidth] = useState(0);
  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      pointerEvents="none">
      {width > 0 && (
        <Svg width={width} height={STRIP_HEIGHT}>
          <Defs>
            <LinearGradient id="baizeStripGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#0d2818" stopOpacity={0.55} />
              <Stop offset="100%" stopColor="#0d2818" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={STRIP_HEIGHT} fill="url(#baizeStripGradient)" />
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0, height: STRIP_HEIGHT },
});
```

Note: `BaizeStrip` does not reuse `@world-of-cards/ui`'s `AbsoluteOverlay` — that component always fills its entire parent (`StyleSheet.absoluteFill`), which doesn't fit a strip pinned only to the bottom edge. It follows the same "decorative, `pointerEvents: none`, memoized" convention by hand instead.

- [ ] **Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/home/HomeBackground.tsx apps/mobile/src/screens/home/BaizeStrip.tsx
git commit -m "feat(mobile): add HomeScreen background gradient and baize strip"
```

---

### Task 7: `HeroCard` and `HomeWordmark` components

**Files:**
- Create: `apps/mobile/src/screens/home/HeroCard.tsx`
- Create: `apps/mobile/src/screens/home/HomeWordmark.tsx`
- Modify: `apps/mobile/package.json` (add `expo-image`)

**Interfaces:**
- Consumes: `glowShadow` from `@world-of-cards/ui`, `apps/mobile/assets/hero-card-queen-of-hearts.png` (Task 1), `packages/ui/src/fonts.ts`'s `'PTSerif-Regular'` font family name (already loaded app-wide via `expo-font` in `App.tsx` — no wiring needed here, just reference the family name string).
- Produces: `HeroCard` and `HomeWordmark` components (both zero props). Consumed by Task 8's `HomeScreen.tsx`.

- [ ] **Step 1: Install `expo-image`**

```bash
cd apps/mobile && npx expo install expo-image
```

- [ ] **Step 2: Write `HeroCard.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { glowShadow } from '@world-of-cards/ui';

const heroCardImage = require('../../../assets/hero-card-queen-of-hearts.png');

export const HeroCard = React.memo(function HeroCard() {
  return (
    <View style={styles.glowWrapper}>
      <Image source={heroCardImage} style={styles.card} contentFit="contain" />
    </View>
  );
});

const styles = StyleSheet.create({
  glowWrapper: {
    alignSelf: 'center',
    marginTop: 34,
    transform: [{ rotate: '-4deg' }],
    ...glowShadow('#1f5c3a', 20),
  },
  card: {
    width: 104,
    height: 151,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#f4c542',
  },
});
```

(`expo-image`'s prop is `contentFit`, not React Native core `Image`'s `resizeMode` — this is the one API difference to get right.)

- [ ] **Step 3: Write `HomeWordmark.tsx`**

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const HomeWordmark = React.memo(function HomeWordmark() {
  return (
    <View style={styles.container}>
      <Text style={styles.word}>World of Cards</Text>
      <View style={styles.rule} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 12 },
  word: {
    fontFamily: 'PTSerif-Regular',
    fontSize: 26,
    color: '#f4c542',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  rule: { width: 60, height: 1, backgroundColor: '#f4c54266', marginTop: 12 },
});
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/src/screens/home/HeroCard.tsx apps/mobile/src/screens/home/HomeWordmark.tsx
git commit -m "feat(mobile): add HomeScreen hero card and wordmark components"
```

(Adjust the lockfile path in the `git add` if this workspace uses a root-level `package-lock.json` instead of a per-app one — check `git status` output before committing and add whichever lockfile actually changed.)

---

### Task 8: Rewrite `HomeScreen.tsx` and update its test

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (full rewrite)
- Modify: `apps/mobile/src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `HomeBackground`, `BaizeStrip` (Task 6), `HeroCard`, `HomeWordmark` (Task 7), `GameMenuRow` (Task 5), `getGames()` from `@world-of-cards/engine` (existing, unchanged).
- Produces: the same `HomeScreenProps` contract as today (`{ onSelectGame: (gameId: string) => void }`) — no consumer of `HomeScreen` (`RootNavigator.tsx`) needs to change.

- [ ] **Step 1: Rewrite `HomeScreen.tsx`**

```tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-of-cards/engine';
import { HomeBackground } from './home/HomeBackground';
import { HeroCard } from './home/HeroCard';
import { HomeWordmark } from './home/HomeWordmark';
import { GameMenuRow } from './home/GameMenuRow';
import { BaizeStrip } from './home/BaizeStrip';

export interface HomeScreenProps {
  onSelectGame: (gameId: string) => void;
}

export function HomeScreen({ onSelectGame }: HomeScreenProps) {
  const games = getGames();
  return (
    <View style={styles.container}>
      <HomeBackground />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <HeroCard />
        <HomeWordmark />
        <View style={styles.menu}>
          {games.length === 0 ? (
            <Text style={styles.empty}>No games installed yet</Text>
          ) : (
            games.map((game) => (
              <GameMenuRow
                key={game.id}
                displayName={game.displayName}
                category={game.category}
                minPlayers={game.minPlayers}
                maxPlayers={game.maxPlayers}
                onPress={() => onSelectGame(game.id)}
                testID={`game-menu-row-${game.id}`}
              />
            ))
          )}
        </View>
      </ScrollView>
      <BaizeStrip />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0f2e' },
  content: { flexGrow: 1, paddingTop: 48, paddingBottom: 40 },
  menu: { paddingHorizontal: 22, marginTop: 20, gap: 12 },
  empty: { fontSize: 14, color: '#f2e6ff88', textAlign: 'center', marginTop: 20 },
});
```

(`container`'s `backgroundColor` is a plain fallback matching `HomeBackground`'s gradient start color, painted underneath it — avoids a flash of the default white/system background before the first `onLayout` fires and the gradient SVG renders.)

- [ ] **Step 2: Update `HomeScreen.test.tsx`**

The two existing tests query `screen.getByText('World of Cards')` (now rendered by `HomeWordmark`, unchanged text) and `screen.getByText('Fake Game')` / `screen.getByText('No games installed yet')` (now rendered by `GameMenuRow`/the empty-state branch, unchanged text) — both should keep passing unmodified. Run them first to confirm before making any edits:

```bash
cd apps/mobile && npx jest HomeScreen.test.tsx
```

If both tests pass unmodified, make no changes to the test file. If either fails (e.g. because `fireEvent.press` can no longer find the row by its inner text now that `GameMenuRow` wraps it differently), update only the failing assertion to match the new structure — for example, querying by the new `testID` (`game-menu-row-fake-game`) instead of text, if pressing by text stops working:

```tsx
fireEvent.press(screen.getByTestId('game-menu-row-fake-game'));
```

- [ ] **Step 3: Run the full mobile test suite**

```bash
cd apps/mobile && npm test
```

Expected: all suites pass, including `HomeScreen.test.tsx`.

- [ ] **Step 4: Typecheck the whole app**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx apps/mobile/src/screens/HomeScreen.test.tsx
git commit -m "feat(mobile): compose the redesigned HomeScreen"
```

---

### Task 9: Staggered mount-entrance animation

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/screens/home/GameMenuRow.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` from `apps/mobile/src/components/useReducedMotion` (existing).
- Produces: no new exported interface — purely adds mount-time motion to existing components.

- [ ] **Step 1: Stop and choose an Audit template with the user before writing any animation code**

This repo's `docs/animation/` Constitution requires an Architecture Audit before any animation implementation (`docs/animation/AnimationReviewWorkflow.md` §2), and per standing project guidance the choice of full `audits/AuditTemplate.md` vs. the lighter `audits/QuickAuditTemplate.md` must be asked of the user directly, never self-selected by whoever is implementing this task. Read `docs/animation/00-DocumentationMap.md` first for orientation, then ask.

This is a single-mount, non-reflowing, non-gesture entrance (hero card + N rows fade/slide in once, no interaction) — likely eligible for the Quick Audit path per its own eligibility checklist, but confirm against that checklist rather than assuming.

- [ ] **Step 2: Complete the chosen Audit**

Follow the chosen template exactly (`docs/animation/audits/AuditTemplate.md` or `QuickAuditTemplate.md`), recording it under `docs/animation/audits/` per that folder's existing naming convention (see its `README.md`). Per this plan's Global Constraints and `docs/animation/ADR/ADR-003-scope-reanimated-migration-to-evidenced-need.md`, default to plain `Animated` (`useNativeDriver: true`) — this is a one-time mount entrance with no reflow and no gesture, so there is no evidenced reason to reach for Reanimated here. Only deviate if the completed Audit finds a concrete reason to.

- [ ] **Step 3: Implement the entrance in `GameMenuRow.tsx`**

Add an `entranceDelayMs` prop and drive opacity/translateY off a mount-time `Animated.timing`, respecting `useReducedMotion()`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameCategory } from '@world-of-cards/engine';
import { MiniCardFan } from './MiniCardFan';
import { accentColorForCategory, categoryLabel, playerRangeLabel } from './gameDisplay';
import { useReducedMotion } from '../../components/useReducedMotion';

export interface GameMenuRowProps {
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  onPress: () => void;
  entranceDelayMs?: number;
  testID?: string;
}

export const GameMenuRow = React.memo(function GameMenuRow({
  displayName,
  category,
  minPlayers,
  maxPlayers,
  onPress,
  entranceDelayMs = 0,
  testID,
}: GameMenuRowProps) {
  const accent = accentColorForCategory(category);
  const subtitle = `${categoryLabel(category)} · ${playerRangeLabel(minPlayers, maxPlayers)}`;
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: entranceDelayMs,
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, entranceDelayMs, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}>
      <Pressable onPress={onPress} testID={testID} style={[styles.row, { borderLeftColor: accent }]}>
        <MiniCardFan />
        <View style={styles.textBlock}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: '#d9b34a55',
    borderLeftWidth: 3,
  },
  textBlock: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#f2e6ff', letterSpacing: 0.3 },
  subtitle: { fontSize: 11, color: '#f2e6ff', opacity: 0.55, marginTop: 2 },
});
```

- [ ] **Step 4: Pass a staggered delay from `HomeScreen.tsx`**

In `HomeScreen.tsx`, change the `games.map(...)` block to pass `entranceDelayMs={index * 60}`:

```tsx
games.map((game, index) => (
  <GameMenuRow
    key={game.id}
    displayName={game.displayName}
    category={game.category}
    minPlayers={game.minPlayers}
    maxPlayers={game.maxPlayers}
    onPress={() => onSelectGame(game.id)}
    entranceDelayMs={index * 60}
    testID={`game-menu-row-${game.id}`}
  />
))
```

(`HeroCard`'s own entrance — settling into its tilted rest position before the rows start — is a reasonable follow-up but is not required to satisfy the spec's "signature moment," which is centered on the row stagger; if the completed Audit's scope naturally covers it too, include it, otherwise leave `HeroCard` static and note it as a follow-up in the Audit doc.)

- [ ] **Step 5: Run the full mobile test suite**

```bash
cd apps/mobile && npm test
```

Expected: all suites pass. If `HomeScreen.test.tsx` or any test rendering `GameMenuRow` fails because of the new `Animated.Value`/`useEffect`, check whether it needs `await` around `render(...)` (already the pattern used in `HomeScreen.test.tsx`) or fake-timer handling — fix the test to accommodate the animation without weakening its assertions.

- [ ] **Step 6: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx apps/mobile/src/screens/home/GameMenuRow.tsx docs/animation/audits/
git commit -m "feat(mobile): add staggered entrance animation to HomeScreen menu rows"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Palette/typography (Tasks 6-7), layout/components (Tasks 4-8), hero art sourcing (Task 1), data-driven subtitles/accents (Task 3), animation (Task 9), testing policy (Global Constraints + Task 8), reuse decisions (Global Constraints) — every spec section has a task. Setup-screen re-theming and the full court-card-art system are spec-confirmed out of scope and correctly have no task here.
- **No placeholders:** every step has real, complete code or an exact command — verified on this pass.
- **Type consistency:** `GameMenuRowProps` in Task 5 gains `entranceDelayMs?: number` in Task 9 (additive, not a breaking rename) — `displayName`/`category`/`minPlayers`/`maxPlayers`/`onPress`/`testID` are identical across both. `HeroCard`/`HomeWordmark`/`HomeBackground`/`BaizeStrip`/`MiniCardFan` are all zero-prop across every task that references them.
