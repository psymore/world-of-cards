# Card Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/playground`, a new standalone Expo app for experimenting with card-front designs (border radius/color + overlay image, per number/face/ace group) and table look (felt color, wood-corner color) across a live 52-card gallery.

**Architecture:** A brand-new Expo app, sibling to `apps/mobile` in the existing npm workspace, sharing only `packages/engine` (pure TS `Card`/`Suit`/`Rank` types + `createDeck`). It has its own card-face and table-backdrop rendering components (deliberately not imported from `apps/mobile`), its own zustand store persisted to AsyncStorage, and no navigation library (single screen).

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript (strict), zustand 5 (+ `persist` middleware), `react-native-svg`, `@react-native-community/slider`, `expo-document-picker`, `expo-file-system`, `@react-native-async-storage/async-storage`.

## Global Constraints

- **Full design rationale:** `docs/superpowers/specs/2026-07-12-card-playground-design.md`. Read it if a task's reasoning is unclear.
- **Isolation is a hard constraint, not a style preference:** `apps/playground` must never be imported by `apps/mobile`, and must never import anything from `apps/mobile/src/**`. Among this repo's other packages, it may only depend on `@world-cards/engine`. Every new dependency this plan introduces (`expo-document-picker`, `expo-file-system`, `@react-native-community/slider`, its own `react-native-svg`, `zustand`, `@react-native-async-storage/async-storage`) goes **only** in `apps/playground/package.json` — never `apps/mobile/package.json`.
- **No new automated tests, by project policy** (see `CLAUDE.md`'s Testing policy — mobile/UI code is not test-covered by default; ask before adding a test). Every task is instead verified by (a) a TypeScript compile check, and at the two visual milestones (Task 1, Task 12) by (b) booting the app via `expo start --web` and confirming it bundles with no errors.
- **Expo API shapes change between SDKs — verify before writing code, don't rely on memory** (per `AGENTS.md`). Two APIs already verified for SDK 57 while writing this plan, so use exactly these forms:
  - `expo-file-system`: use the modern class-based API — `new File(uri).text()` — not the deprecated `expo-file-system/legacy` `readAsStringAsync`.
  - `expo-document-picker`: `getDocumentAsync()` resolves to `{ canceled: true, assets: null }` or `{ canceled: false, assets: DocumentPickerAsset[] }` (not the older `{ type: 'success' | 'cancel' }` shape). Each asset has `uri`, `name`, `mimeType?`, `size?`.
- **Colors are always 6-digit hex** (`#rrggbb`), validated by the shared `HEX_COLOR_PATTERN` regex introduced in Task 8.
- **No gesture-based image manipulation** — image scale/position are slider/button controlled only (per spec non-goals).

---

### Task 1: Scaffold `apps/playground` as a bootable Expo app

**Files:**
- Create: `apps/playground/package.json`
- Create: `apps/playground/app.json`
- Create: `apps/playground/tsconfig.json`
- Create: `apps/playground/metro.config.js`
- Create: `apps/playground/index.ts`
- Create: `apps/playground/App.tsx`
- Modify: `package.json:8-11` (root — add a `playground` script)

**Interfaces:**
- Produces: a bootable Expo app at `apps/playground` with a placeholder `App.tsx`, that later tasks will build components into and Task 12 will wire the real screen into.

- [ ] **Step 1: Create `apps/playground/package.json`**

```json
{
  "name": "world-cards-playground",
  "version": "1.0.0",
  "main": "index.ts",
  "private": true,
  "scripts": {
    "start": "expo start",
    "web": "expo start --web"
  },
  "dependencies": {
    "@world-cards/engine": "*",
    "expo": "~57.0.2",
    "expo-status-bar": "~57.0.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.86.0",
    "react-native-web": "^0.21.2"
  },
  "devDependencies": {
    "@types/react": "~19.2.2",
    "typescript": "~6.0.3"
  }
}
```

- [ ] **Step 2: Create `apps/playground/app.json`**

```json
{
  "expo": {
    "name": "World Cards Playground",
    "slug": "world-cards-playground",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.worldcards.playground"
    },
    "web": {}
  }
}
```

- [ ] **Step 3: Create `apps/playground/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

- [ ] **Step 4: Create `apps/playground/metro.config.js`** (mirrors `apps/mobile/metro.config.js` so Metro can resolve the workspace-linked `@world-cards/engine` package)

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

- [ ] **Step 5: Create `apps/playground/index.ts`**

```ts
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
```

- [ ] **Step 6: Create `apps/playground/App.tsx`** (placeholder — Task 12 replaces the body with the real screen)

```tsx
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Card Playground</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12121f' },
  text: { color: '#f4c542', fontSize: 20, fontWeight: 'bold' },
});
```

- [ ] **Step 7: Add the `playground` script to the root `package.json`**

Modify `package.json`'s `scripts` block (currently `{ "mobile": "npm run start --workspace=world-cards-mobile", "test": "jest" }`) to:

```json
  "scripts": {
    "mobile": "npm run start --workspace=world-cards-mobile",
    "playground": "npm run start --workspace=world-cards-playground",
    "test": "jest"
  },
```

- [ ] **Step 8: Install dependencies**

Run from the repo root:
```
npm install
```
Expected: completes with no errors; `apps/playground/node_modules` is not created directly (hoisted into the root `node_modules`), and `node_modules/@world-cards` contains a symlink for the engine workspace link.

- [ ] **Step 9: Add the remaining feature dependencies via `expo install`**

Run:
```
cd apps/playground && npx expo install react-native-svg zustand @react-native-async-storage/async-storage expo-document-picker expo-file-system @react-native-community/slider
```
Expected: `apps/playground/package.json`'s `dependencies` gains entries for all six packages, at versions `expo install` reports as compatible with Expo SDK 57 (community packages like `zustand` and `@react-native-async-storage/async-storage` may just resolve to their latest npm version — that's fine). No errors.

- [ ] **Step 10: Verify the app boots**

Run:
```
npm run web --workspace=world-cards-playground
```
in the background. Wait about 20 seconds, then check the command's output. Expected: a `Web Bundled` (or equivalent successful-compile) line with no red error text. Stop the background process once confirmed.

- [ ] **Step 11: Commit**

```bash
git add apps/playground package.json package-lock.json
git commit -m "Scaffold apps/playground as an isolated Expo app"
```

---

### Task 2: Core types and card-group mapping

**Files:**
- Create: `apps/playground/src/types.ts`
- Create: `apps/playground/src/utils/cardGroups.ts`

**Interfaces:**
- Consumes: `Rank`, `Suit` from `@world-cards/engine` (already available per Task 1).
- Produces: `CardGroup`, `CardImage`, `CardTemplate`, `TableTemplate`, `PlaygroundTemplates` types; `DEFAULT_CARD_TEMPLATE`, `DEFAULT_TABLE_TEMPLATE`, `DEFAULT_TEMPLATES`, `PRESET_COLORS` constants (all from `types.ts`); `getCardGroup(rank: Rank): CardGroup` (from `utils/cardGroups.ts`). Every later task imports these.

- [ ] **Step 1: Create `apps/playground/src/types.ts`**

```ts
export type CardGroup = 'number' | 'face' | 'ace';

export interface CardImage {
  uri: string;
  kind: 'png' | 'svg';
  svgXml?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CardTemplate {
  borderRadius: number;
  borderColor: string;
  image: CardImage | null;
}

export interface TableTemplate {
  feltColor: string;
  woodColor: string;
}

export type PlaygroundTemplates = Record<CardGroup, CardTemplate>;

export const DEFAULT_CARD_TEMPLATE: CardTemplate = {
  borderRadius: 6,
  borderColor: '#333333',
  image: null,
};

export const DEFAULT_TABLE_TEMPLATE: TableTemplate = {
  feltColor: '#0b6623',
  woodColor: '#4a2116',
};

export const DEFAULT_TEMPLATES: PlaygroundTemplates = {
  number: { ...DEFAULT_CARD_TEMPLATE },
  face: { ...DEFAULT_CARD_TEMPLATE },
  ace: { ...DEFAULT_CARD_TEMPLATE },
};

export const PRESET_COLORS: string[] = [
  '#f4c542',
  '#c0392b',
  '#0b6623',
  '#1c2451',
  '#4a2116',
  '#ffffff',
  '#111111',
  '#3498db',
];
```

- [ ] **Step 2: Create `apps/playground/src/utils/cardGroups.ts`**

```ts
import type { Rank } from '@world-cards/engine';
import type { CardGroup } from '../types';

// The gallery deck is generated with includeJokers: false, so 'joker' is
// never passed here in practice; it falls through to 'number' if it were.
export function getCardGroup(rank: Rank): CardGroup {
  if (rank === 'A') return 'ace';
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 'face';
  return 'number';
}
```

- [ ] **Step 3: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/playground/src/types.ts apps/playground/src/utils/cardGroups.ts
git commit -m "Add playground card/table template types and group mapping"
```

---

### Task 3: Zustand store with AsyncStorage persistence

**Files:**
- Create: `apps/playground/src/state/playgroundStore.ts`

**Interfaces:**
- Consumes: `CardGroup`, `CardImage`, `CardTemplate`, `TableTemplate`, `DEFAULT_CARD_TEMPLATE`, `DEFAULT_TABLE_TEMPLATE`, `DEFAULT_TEMPLATES` from `../types` (Task 2).
- Produces: `usePlaygroundStore` hook exposing `templates: Record<CardGroup, CardTemplate>`, `table: TableTemplate`, and actions `setBorderRadius(group, radius)`, `setBorderColor(group, color)`, `setCardImage(group, image)`, `updateCardImage(group, patch)`, `clearCardImage(group)`, `resetCardTemplate(group)`, `setFeltColor(color)`, `setWoodColor(color)`, `resetTableTemplate()`. Tasks 9, 10, 11 consume this hook.

- [ ] **Step 1: Create `apps/playground/src/state/playgroundStore.ts`**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CardGroup, CardImage, CardTemplate, TableTemplate } from '../types';
import { DEFAULT_CARD_TEMPLATE, DEFAULT_TABLE_TEMPLATE, DEFAULT_TEMPLATES } from '../types';

interface PlaygroundState {
  templates: Record<CardGroup, CardTemplate>;
  table: TableTemplate;
  setBorderRadius: (group: CardGroup, radius: number) => void;
  setBorderColor: (group: CardGroup, color: string) => void;
  setCardImage: (group: CardGroup, image: CardImage) => void;
  updateCardImage: (group: CardGroup, patch: Partial<Pick<CardImage, 'scale' | 'offsetX' | 'offsetY'>>) => void;
  clearCardImage: (group: CardGroup) => void;
  resetCardTemplate: (group: CardGroup) => void;
  setFeltColor: (color: string) => void;
  setWoodColor: (color: string) => void;
  resetTableTemplate: () => void;
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set) => ({
      templates: DEFAULT_TEMPLATES,
      table: DEFAULT_TABLE_TEMPLATE,

      setBorderRadius: (group, radius) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], borderRadius: radius } },
        })),

      setBorderColor: (group, color) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], borderColor: color } },
        })),

      setCardImage: (group, image) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], image } },
        })),

      updateCardImage: (group, patch) =>
        set((state) => {
          const current = state.templates[group].image;
          if (current == null) return state;
          return {
            templates: {
              ...state.templates,
              [group]: { ...state.templates[group], image: { ...current, ...patch } },
            },
          };
        }),

      clearCardImage: (group) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], image: null } },
        })),

      resetCardTemplate: (group) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...DEFAULT_CARD_TEMPLATE } },
        })),

      setFeltColor: (color) => set((state) => ({ table: { ...state.table, feltColor: color } })),
      setWoodColor: (color) => set((state) => ({ table: { ...state.table, woodColor: color } })),
      resetTableTemplate: () => set({ table: { ...DEFAULT_TABLE_TEMPLATE } }),
    }),
    {
      name: 'card-playground-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors. (Functional correctness of persistence is confirmed visually in Task 12, once the store is wired into a running screen — zustand's `persist` middleware needs a real AsyncStorage-backed environment, which isn't available from a plain type-check.)

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/state/playgroundStore.ts
git commit -m "Add persisted playground zustand store"
```

---

### Task 4: `SuitGlyph` — standalone suit icon

**Files:**
- Create: `apps/playground/src/components/SuitGlyph.tsx`

**Interfaces:**
- Consumes: `Suit` from `@world-cards/engine`.
- Produces: `SuitGlyph` component, props `{ suit: Suit; size: number; color: string; opacity?: number; testID?: string }`. Consumed by Task 6 (`PlaygroundCard`).

- [ ] **Step 1: Create `apps/playground/src/components/SuitGlyph.tsx`**

This is a standalone copy (not an import) of `apps/mobile/src/components/SuitIcon.tsx`'s path data, per the isolation constraint — a deliberate, small duplication, not a dependency.

```tsx
import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { Suit } from '@world-cards/engine';

export interface SuitGlyphProps {
  suit: Suit;
  size: number;
  color: string;
  opacity?: number;
  testID?: string;
}

const HEART_PATH =
  'M12,21 C12,21 3,14.5 3,8.5 C3,5.5 5.5,3 8.5,3 C10.36,3 12,4.5 12,6.5 C12,4.5 13.64,3 15.5,3 C18.5,3 21,5.5 21,8.5 C21,14.5 12,21 12,21 Z';

const DIAMOND_PATH = 'M12,2 L21,12 L12,22 L3,12 Z';

const SPADE_PATH =
  'M12,2 C12,2 21,9.5 21,14.5 C21,17.5 18.5,20 15.5,20 C14.1,20 12.85,19.3 12,18.2 C12.4,19.6 13.3,20.8 14.5,21.5 C14.9,21.7 14.7,22 14.3,22 L9.7,22 C9.3,22 9.1,21.7 9.5,21.5 C10.7,20.8 11.6,19.6 12,18.2 C11.15,19.3 9.9,20 8.5,20 C5.5,20 3,17.5 3,14.5 C3,9.5 12,2 12,2 Z';

const CLUB_STEM_PATH =
  'M11,15 C11,17 10.3,19.5 8.7,20.8 C8.3,21.1 8.5,21.5 9,21.5 L15,21.5 C15.5,21.5 15.7,21.1 15.3,20.8 C13.7,19.5 13,17 13,15 Z';

function SuitGlyphComponent({ suit, size, color, opacity = 1, testID }: SuitGlyphProps) {
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {suit === 'hearts' && <Path d={HEART_PATH} fill={color} />}
      {suit === 'diamonds' && <Path d={DIAMOND_PATH} fill={color} />}
      {suit === 'spades' && <Path d={SPADE_PATH} fill={color} />}
      {suit === 'clubs' && (
        <G>
          <Circle cx={12} cy={8} r={4.2} fill={color} />
          <Circle cx={7.3} cy={14} r={4.2} fill={color} />
          <Circle cx={16.7} cy={14} r={4.2} fill={color} />
          <Path d={CLUB_STEM_PATH} fill={color} />
        </G>
      )}
    </Svg>
  );
}

export const SuitGlyph = React.memo(SuitGlyphComponent);
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/SuitGlyph.tsx
git commit -m "Add standalone SuitGlyph component to playground"
```

---

### Task 5: `TableBackdrop` — felt + wood-corner rendering

**Files:**
- Create: `apps/playground/src/components/TableBackdrop.tsx`

**Interfaces:**
- Consumes: `TableTemplate` from `../types` (Task 2).
- Produces: `TableBackdrop` component, props `{ table: TableTemplate; style?: StyleProp<ViewStyle>; children?: React.ReactNode }` — a colored container (felt background + 4 wood-corner wedges) that renders `children` on top. Consumed by Tasks 10 (`TableTemplateEditor`) and 11 (`CardGallery`).

- [ ] **Step 1: Create `apps/playground/src/components/TableBackdrop.tsx`**

The wedge arc geometry is adapted from `apps/mobile/src/components/TableWoodCorners.tsx` (copied, not imported, per isolation), simplified to a single solid `woodColor` fill instead of a two-tone gradient, since color is the only customizable knob here.

```tsx
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TableTemplate } from '../types';

const WEDGE_SIZE = 56;
const TRIM_COLOR = '#ffd966';

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface WedgeGeometry {
  fillPath: string;
  trimPath: string;
  positionStyle: { top?: number; bottom?: number; left?: number; right?: number };
}

const S = WEDGE_SIZE;

const WEDGE_GEOMETRY: Record<Corner, WedgeGeometry> = {
  topLeft: {
    fillPath: `M0,0 L${S},0 A${S},${S} 0 0 1 0,${S} Z`,
    trimPath: `M${S},0 A${S},${S} 0 0 1 0,${S}`,
    positionStyle: { top: 0, left: 0 },
  },
  topRight: {
    fillPath: `M${S},0 L0,0 A${S},${S} 0 0 0 ${S},${S} Z`,
    trimPath: `M0,0 A${S},${S} 0 0 0 ${S},${S}`,
    positionStyle: { top: 0, right: 0 },
  },
  bottomLeft: {
    fillPath: `M0,${S} L${S},${S} A${S},${S} 0 0 0 0,0 Z`,
    trimPath: `M${S},${S} A${S},${S} 0 0 0 0,0`,
    positionStyle: { bottom: 0, left: 0 },
  },
  bottomRight: {
    fillPath: `M${S},${S} L0,${S} A${S},${S} 0 0 1 ${S},0 Z`,
    trimPath: `M0,${S} A${S},${S} 0 0 1 ${S},0`,
    positionStyle: { bottom: 0, right: 0 },
  },
};

const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

function Wedge({ corner, color }: { corner: Corner; color: string }) {
  const { fillPath, trimPath, positionStyle } = WEDGE_GEOMETRY[corner];
  return (
    <View style={[styles.wedgeWrap, positionStyle]} testID={`table-backdrop-wood-${corner}`}>
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <Path d={fillPath} fill={color} />
        <Path d={trimPath} fill="none" stroke={TRIM_COLOR} strokeOpacity={0.85} strokeWidth={2} />
      </Svg>
    </View>
  );
}

export interface TableBackdropProps {
  table: TableTemplate;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

function TableBackdropComponent({ table, style, children }: TableBackdropProps) {
  return (
    <View testID="table-backdrop" style={[styles.container, { backgroundColor: table.feltColor }, style]}>
      {CORNERS.map((corner) => (
        <Wedge key={corner} corner={corner} color={table.woodColor} />
      ))}
      {children}
    </View>
  );
}

export const TableBackdrop = React.memo(TableBackdropComponent);

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  wedgeWrap: { position: 'absolute', width: S, height: S },
});
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/TableBackdrop.tsx
git commit -m "Add standalone TableBackdrop component to playground"
```

---

### Task 6: `PlaygroundCard` — standalone card-face renderer

**Files:**
- Create: `apps/playground/src/components/PlaygroundCard.tsx`

**Interfaces:**
- Consumes: `Card`, `Suit` from `@world-cards/engine`; `CardImage`, `CardTemplate` from `../types` (Task 2); `SuitGlyph` from `./SuitGlyph` (Task 4).
- Produces: `PlaygroundCard` component, props `{ card: Card; template: CardTemplate; size?: 'large' | 'grid' }` (defaults to `'large'`). Consumed by Tasks 9 (`CardTemplateEditor`) and 11 (`CardGallery`).

- [ ] **Step 1: Create `apps/playground/src/components/PlaygroundCard.tsx`**

```tsx
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Card, Suit } from '@world-cards/engine';
import { SuitGlyph } from './SuitGlyph';
import type { CardImage, CardTemplate } from '../types';

export type PlaygroundCardSize = 'large' | 'grid';

export interface PlaygroundCardProps {
  card: Card;
  template: CardTemplate;
  size?: PlaygroundCardSize;
}

const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
const SUIT_COLOR = { red: '#c0392b', black: '#111111' };
const CARD_DIMS = { large: { width: 160, height: 224 }, grid: { width: 54, height: 78 } };
const CORNER_ICON_SIZE = { large: 20, grid: 12 };
const WATERMARK_ICON_SIZE = { large: 72, grid: 39 };
const OVERLAY_BASE_SIZE = { large: 110, grid: 40 };

function CornerIndex({
  rank,
  suit,
  suitColor,
  isRed,
  iconSize,
  mirrored,
}: {
  rank: string;
  suit: Suit | null;
  suitColor: string;
  isRed: boolean;
  iconSize: number;
  mirrored?: boolean;
}) {
  return (
    <View style={mirrored ? styles.cornerMirrored : styles.corner}>
      <Text style={[styles.cornerRank, isRed && styles.red]}>{rank}</Text>
      {suit != null && <SuitGlyph suit={suit} size={iconSize} color={suitColor} />}
    </View>
  );
}

function OverlayImage({ image, baseSize }: { image: CardImage; baseSize: number }) {
  const dimension = baseSize * image.scale;
  const overlayStyle = {
    width: dimension,
    height: dimension,
    transform: [{ translateX: image.offsetX }, { translateY: image.offsetY }],
  };
  if (image.kind === 'svg' && image.svgXml != null) {
    return (
      <View testID="playground-card-overlay" style={[styles.overlay, overlayStyle]}>
        <SvgXml xml={image.svgXml} width="100%" height="100%" />
      </View>
    );
  }
  return (
    <Image
      testID="playground-card-overlay"
      source={{ uri: image.uri }}
      resizeMode="contain"
      style={[styles.overlay, overlayStyle]}
    />
  );
}

function PlaygroundCardComponent({ card, template, size = 'large' }: PlaygroundCardProps) {
  const dims = CARD_DIMS[size];
  const iconSize = CORNER_ICON_SIZE[size];
  const watermarkSize = WATERMARK_ICON_SIZE[size];
  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitColor = isRed ? SUIT_COLOR.red : SUIT_COLOR.black;

  return (
    <View
      testID="playground-card"
      style={[
        styles.card,
        {
          width: dims.width,
          height: dims.height,
          borderRadius: template.borderRadius,
          borderColor: template.borderColor,
        },
      ]}
    >
      <CornerIndex rank={card.rank} suit={card.suit} suitColor={suitColor} isRed={isRed} iconSize={iconSize} />
      <CornerIndex
        rank={card.rank}
        suit={card.suit}
        suitColor={suitColor}
        isRed={isRed}
        iconSize={iconSize}
        mirrored
      />
      <View style={styles.centerArt}>
        {card.suit != null && <SuitGlyph suit={card.suit} size={watermarkSize} color={suitColor} opacity={0.16} />}
        {template.image != null && <OverlayImage image={template.image} baseSize={OVERLAY_BASE_SIZE[size]} />}
      </View>
    </View>
  );
}

export const PlaygroundCard = React.memo(PlaygroundCardComponent);

const styles = StyleSheet.create({
  card: { borderWidth: 2, backgroundColor: '#ffffff', overflow: 'hidden' },
  corner: { position: 'absolute', top: 6, left: 6, alignItems: 'center', zIndex: 1 },
  cornerMirrored: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
    zIndex: 1,
  },
  cornerRank: { fontSize: 16, fontWeight: 'bold', color: '#111111' },
  red: { color: '#c0392b' },
  centerArt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute' },
});
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/PlaygroundCard.tsx
git commit -m "Add standalone PlaygroundCard component"
```

---

### Task 7: Image picker utility

**Files:**
- Create: `apps/playground/src/utils/imagePicker.ts`

**Interfaces:**
- Consumes: `CardImage` from `../types` (Task 2).
- Produces: `pickCardImage(): Promise<Pick<CardImage, 'uri' | 'kind' | 'svgXml'> | null>` and `buildCardImage(picked: Pick<CardImage, 'uri' | 'kind' | 'svgXml'>): CardImage`. Consumed by Task 9 (`CardTemplateEditor`).

- [ ] **Step 1: Create `apps/playground/src/utils/imagePicker.ts`**

Uses the SDK 57 APIs verified in Global Constraints: `expo-document-picker`'s `{ canceled, assets }` result shape, and `expo-file-system`'s modern `File` class (not the deprecated `readAsStringAsync`).

```ts
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { CardImage } from '../types';

const DEFAULT_SCALE = 1;
const DEFAULT_OFFSET = 0;

export async function pickCardImage(): Promise<Pick<CardImage, 'uri' | 'kind' | 'svgXml'> | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/png', 'image/jpeg', 'image/svg+xml'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  const isSvg = asset.mimeType === 'image/svg+xml' || asset.name.toLowerCase().endsWith('.svg');

  if (isSvg) {
    const file = new File(asset.uri);
    const svgXml = await file.text();
    return { uri: asset.uri, kind: 'svg', svgXml };
  }

  return { uri: asset.uri, kind: 'png' };
}

export function buildCardImage(picked: Pick<CardImage, 'uri' | 'kind' | 'svgXml'>): CardImage {
  return { ...picked, scale: DEFAULT_SCALE, offsetX: DEFAULT_OFFSET, offsetY: DEFAULT_OFFSET };
}
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/utils/imagePicker.ts
git commit -m "Add image picker utility for card overlay images"
```

---

### Task 8: `ColorPicker` — preset swatches + hex input

**Files:**
- Create: `apps/playground/src/components/ColorPicker.tsx`

**Interfaces:**
- Consumes: `PRESET_COLORS` from `../types` (Task 2).
- Produces: `ColorPicker` component, props `{ label: string; color: string; onChange: (color: string) => void }`; exported `HEX_COLOR_PATTERN` regex (referenced by Global Constraints). Consumed by Tasks 9 (`CardTemplateEditor`) and 10 (`TableTemplateEditor`).

- [ ] **Step 1: Create `apps/playground/src/components/ColorPicker.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PRESET_COLORS } from '../types';

export const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

export interface ColorPickerProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, color, onChange }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(color);

  // Keep the text input in sync when the color changes from outside this
  // component (e.g. a preset swatch tap, or a "Reset" button elsewhere).
  useEffect(() => {
    setHexInput(color);
  }, [color]);

  function handleHexSubmit() {
    const candidate = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (HEX_COLOR_PATTERN.test(candidate)) {
      onChange(candidate);
    } else {
      setHexInput(color);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.swatchRow}>
        {PRESET_COLORS.map((preset) => (
          <Pressable
            key={preset}
            testID={`color-swatch-${preset}`}
            onPress={() => onChange(preset)}
            style={[styles.swatch, { backgroundColor: preset }, preset === color && styles.swatchSelected]}
          />
        ))}
      </View>
      <TextInput
        testID="color-hex-input"
        value={hexInput}
        onChangeText={setHexInput}
        onSubmitEditing={handleHexSubmit}
        onBlur={handleHexSubmit}
        autoCapitalize="none"
        style={styles.hexInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  label: { fontWeight: 'bold', marginBottom: 4 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00000033' },
  swatchSelected: { borderWidth: 3, borderColor: '#000000' },
  hexInput: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 4, padding: 6, width: 100 },
});
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/ColorPicker.tsx
git commit -m "Add ColorPicker component (preset swatches + hex input)"
```

---

### Task 9: `CardTemplateEditor` — group selector + live card editor

**Files:**
- Create: `apps/playground/src/components/CardTemplateEditor.tsx`

**Interfaces:**
- Consumes: `Card` from `@world-cards/engine`; `CardGroup` from `../types` (Task 2); `usePlaygroundStore` from `../state/playgroundStore` (Task 3); `PlaygroundCard` from `./PlaygroundCard` (Task 6); `ColorPicker` from `./ColorPicker` (Task 8); `pickCardImage`, `buildCardImage` from `../utils/imagePicker` (Task 7).
- Produces: `CardTemplateEditor` component (no props — reads/writes the store directly). Consumed by Task 12 (`PlaygroundScreen`).

- [ ] **Step 1: Create `apps/playground/src/components/CardTemplateEditor.tsx`**

```tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import type { Card } from '@world-cards/engine';
import type { CardGroup } from '../types';
import { usePlaygroundStore } from '../state/playgroundStore';
import { PlaygroundCard } from './PlaygroundCard';
import { ColorPicker } from './ColorPicker';
import { pickCardImage, buildCardImage } from '../utils/imagePicker';

const GROUP_LABELS: Record<CardGroup, string> = {
  number: '2–10',
  face: 'J · Q · K',
  ace: 'Aces',
};

const GROUP_ORDER: CardGroup[] = ['number', 'face', 'ace'];

const GROUP_PREVIEW_CARD: Record<CardGroup, Card> = {
  number: { id: 'preview-number', suit: 'spades', rank: '7' },
  face: { id: 'preview-face', suit: 'hearts', rank: 'Q' },
  ace: { id: 'preview-ace', suit: 'clubs', rank: 'A' },
};

export function CardTemplateEditor() {
  const [selectedGroup, setSelectedGroup] = useState<CardGroup>('number');
  const template = usePlaygroundStore((state) => state.templates[selectedGroup]);
  const setBorderRadius = usePlaygroundStore((state) => state.setBorderRadius);
  const setBorderColor = usePlaygroundStore((state) => state.setBorderColor);
  const setCardImage = usePlaygroundStore((state) => state.setCardImage);
  const updateCardImage = usePlaygroundStore((state) => state.updateCardImage);
  const clearCardImage = usePlaygroundStore((state) => state.clearCardImage);
  const resetCardTemplate = usePlaygroundStore((state) => state.resetCardTemplate);

  async function handleAddImage() {
    const picked = await pickCardImage();
    if (picked != null) {
      setCardImage(selectedGroup, buildCardImage(picked));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.groupRow}>
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
      </View>

      <View style={styles.editorBody}>
        <PlaygroundCard card={GROUP_PREVIEW_CARD[selectedGroup]} template={template} size="large" />

        <View style={styles.controls}>
          <Text style={styles.controlLabel}>Border radius: {template.borderRadius}</Text>
          <Slider
            testID="border-radius-slider"
            minimumValue={0}
            maximumValue={40}
            step={1}
            value={template.borderRadius}
            onValueChange={(value) => setBorderRadius(selectedGroup, value)}
          />

          <ColorPicker
            label="Border color"
            color={template.borderColor}
            onChange={(color) => setBorderColor(selectedGroup, color)}
          />

          {template.image == null ? (
            <Pressable testID="add-image-button" onPress={handleAddImage} style={styles.actionButton}>
              <Text style={styles.actionButtonLabel}>Add Image</Text>
            </Pressable>
          ) : (
            <View>
              <Text style={styles.controlLabel}>Scale: {template.image.scale.toFixed(2)}</Text>
              <Slider
                testID="image-scale-slider"
                minimumValue={0.3}
                maximumValue={2.5}
                step={0.05}
                value={template.image.scale}
                onValueChange={(value) => updateCardImage(selectedGroup, { scale: value })}
              />
              <Text style={styles.controlLabel}>Horizontal offset: {template.image.offsetX}</Text>
              <Slider
                testID="image-offset-x-slider"
                minimumValue={-60}
                maximumValue={60}
                step={1}
                value={template.image.offsetX}
                onValueChange={(value) => updateCardImage(selectedGroup, { offsetX: value })}
              />
              <Text style={styles.controlLabel}>Vertical offset: {template.image.offsetY}</Text>
              <Slider
                testID="image-offset-y-slider"
                minimumValue={-60}
                maximumValue={60}
                step={1}
                value={template.image.offsetY}
                onValueChange={(value) => updateCardImage(selectedGroup, { offsetY: value })}
              />
              <Pressable
                testID="remove-image-button"
                onPress={() => clearCardImage(selectedGroup)}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonLabel}>Remove Image</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            testID="reset-group-button"
            onPress={() => resetCardTemplate(selectedGroup)}
            style={styles.resetButton}
          >
            <Text style={styles.actionButtonLabel}>Reset {GROUP_LABELS[selectedGroup]}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  groupRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  groupTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#eeeeee' },
  groupTabActive: { backgroundColor: '#f4c542' },
  groupTabLabel: { fontWeight: 'bold' },
  editorBody: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  controls: { flex: 1 },
  controlLabel: { marginTop: 8, marginBottom: 2 },
  actionButton: { backgroundColor: '#1c2451', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  resetButton: { backgroundColor: '#c0392b', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 16 },
  actionButtonLabel: { color: '#ffffff', fontWeight: 'bold' },
});
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/CardTemplateEditor.tsx
git commit -m "Add CardTemplateEditor component"
```

---

### Task 10: `TableTemplateEditor` — felt/wood color editor

**Files:**
- Create: `apps/playground/src/components/TableTemplateEditor.tsx`

**Interfaces:**
- Consumes: `usePlaygroundStore` from `../state/playgroundStore` (Task 3); `ColorPicker` from `./ColorPicker` (Task 8); `TableBackdrop` from `./TableBackdrop` (Task 5).
- Produces: `TableTemplateEditor` component (no props). Consumed by Task 12 (`PlaygroundScreen`).

- [ ] **Step 1: Create `apps/playground/src/components/TableTemplateEditor.tsx`**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlaygroundStore } from '../state/playgroundStore';
import { ColorPicker } from './ColorPicker';
import { TableBackdrop } from './TableBackdrop';

export function TableTemplateEditor() {
  const table = usePlaygroundStore((state) => state.table);
  const setFeltColor = usePlaygroundStore((state) => state.setFeltColor);
  const setWoodColor = usePlaygroundStore((state) => state.setWoodColor);
  const resetTableTemplate = usePlaygroundStore((state) => state.resetTableTemplate);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Table</Text>
      <TableBackdrop table={table} style={styles.preview} />
      <ColorPicker label="Felt color" color={table.feltColor} onChange={setFeltColor} />
      <ColorPicker label="Wood corner color" color={table.woodColor} onChange={setWoodColor} />
      <Pressable testID="reset-table-button" onPress={resetTableTemplate} style={styles.resetButton}>
        <Text style={styles.resetButtonLabel}>Reset Table</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#f4c542' },
  preview: { height: 100, borderRadius: 8, marginBottom: 12 },
  resetButton: { backgroundColor: '#c0392b', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  resetButtonLabel: { color: '#ffffff', fontWeight: 'bold' },
});
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/TableTemplateEditor.tsx
git commit -m "Add TableTemplateEditor component"
```

---

### Task 11: `CardGallery` — full 52-card live preview

**Files:**
- Create: `apps/playground/src/components/CardGallery.tsx`

**Interfaces:**
- Consumes: `Card`, `Suit`, `createDeck` from `@world-cards/engine`; `usePlaygroundStore` from `../state/playgroundStore` (Task 3); `getCardGroup` from `../utils/cardGroups` (Task 2); `PlaygroundCard` from `./PlaygroundCard` (Task 6); `TableBackdrop` from `./TableBackdrop` (Task 5).
- Produces: `CardGallery` component (no props). Consumed by Task 12 (`PlaygroundScreen`).

- [ ] **Step 1: Create `apps/playground/src/components/CardGallery.tsx`**

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card, Suit } from '@world-cards/engine';
import { usePlaygroundStore } from '../state/playgroundStore';
import { getCardGroup } from '../utils/cardGroups';
import { PlaygroundCard } from './PlaygroundCard';
import { TableBackdrop } from './TableBackdrop';

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  clubs: 'Clubs',
  diamonds: 'Diamonds',
};

const DECK: Card[] = createDeck({ deckCount: 1, includeJokers: false });

function cardsBySuit(suit: Suit): Card[] {
  return DECK.filter((card) => card.suit === suit);
}

export function CardGallery() {
  const templates = usePlaygroundStore((state) => state.templates);
  const table = usePlaygroundStore((state) => state.table);

  return (
    <TableBackdrop table={table} style={styles.backdrop}>
      {SUIT_ORDER.map((suit) => (
        <View key={suit} style={styles.suitSection}>
          <Text style={styles.suitLabel}>{SUIT_LABELS[suit]}</Text>
          <View style={styles.row}>
            {cardsBySuit(suit).map((card) => (
              <PlaygroundCard
                key={card.id}
                card={card}
                template={templates[getCardGroup(card.rank)]}
                size="grid"
              />
            ))}
          </View>
        </View>
      ))}
    </TableBackdrop>
  );
}

const styles = StyleSheet.create({
  backdrop: { padding: 12 },
  suitSection: { marginBottom: 16 },
  suitLabel: { color: '#ffffff', fontWeight: 'bold', marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
```

- [ ] **Step 2: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playground/src/components/CardGallery.tsx
git commit -m "Add CardGallery component (all 52 cards, grouped by suit)"
```

---

### Task 12: Assemble `PlaygroundScreen` and wire it into `App.tsx`

**Files:**
- Create: `apps/playground/src/PlaygroundScreen.tsx`
- Modify: `apps/playground/App.tsx` (replace the Task 1 placeholder)

**Interfaces:**
- Consumes: `TableTemplateEditor` (Task 10), `CardTemplateEditor` (Task 9), `CardGallery` (Task 11).
- Produces: `PlaygroundScreen` component, rendered by `App.tsx`. This is the final deliverable of the plan.

- [ ] **Step 1: Create `apps/playground/src/PlaygroundScreen.tsx`**

```tsx
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { TableTemplateEditor } from './components/TableTemplateEditor';
import { CardTemplateEditor } from './components/CardTemplateEditor';
import { CardGallery } from './components/CardGallery';

export function PlaygroundScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Card Playground</Text>
      <TableTemplateEditor />
      <CardTemplateEditor />
      <CardGallery />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f' },
  content: { paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f4c542', textAlign: 'center', marginVertical: 16 },
});
```

- [ ] **Step 2: Replace `apps/playground/App.tsx`'s placeholder body**

```tsx
import { StatusBar } from 'expo-status-bar';
import { PlaygroundScreen } from './src/PlaygroundScreen';

export default function App() {
  return (
    <>
      <PlaygroundScreen />
      <StatusBar style="light" />
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

Run:
```
npx tsc --noEmit -p apps/playground/tsconfig.json
```
Expected: no errors.

- [ ] **Step 4: Boot and visually verify**

Run:
```
npm run web --workspace=world-cards-playground
```
in the background. Wait about 20 seconds, confirm a successful bundle with no errors in the output, then open the printed local URL (or use whatever browser-screenshot tooling is available in this environment) and confirm:
- The title "Card Playground" renders at the top.
- A "Table" section with a felt-colored preview strip, felt/wood color swatch rows + hex inputs, and a "Reset Table" button.
- A group-tab row ("2–10" / "J · Q · K" / "Aces") above one large preview card, a border-radius slider, a border-color picker, and an "Add Image" button.
- A gallery below showing all 52 cards grouped into 4 suit rows (13 cards each), rendered over the felt/wood-corner backdrop.
- Dragging the border-radius slider visibly rounds the corners of both the large preview card and, once the interaction settles, cards in the gallery for that group.
- Tapping a felt-color swatch visibly changes the gallery's background color.

Stop the background process once confirmed.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/PlaygroundScreen.tsx apps/playground/App.tsx
git commit -m "Assemble PlaygroundScreen and wire it into App.tsx"
```

---

## Self-Review Notes

- **Spec coverage:** isolation/scaffold (Task 1), data model (Task 2), persistence (Task 3), suit icon copy (Task 4), table felt/wood color knobs (Task 5, 10), card border radius/color + overlay image with scale/offset controls (Tasks 6, 7, 8, 9), 52-card gallery grouped by suit over the table backdrop (Task 11), full screen assembly + visual verification (Task 12). No spec section is without a task.
- **Placeholder scan:** no TBD/TODO; every code step has complete, working code; no "similar to Task N" shortcuts — each task's code is fully written out even where it resembles another task's shape (e.g. `ColorPicker` used identically by two later tasks).
- **Type consistency:** `CardGroup`/`CardImage`/`CardTemplate`/`TableTemplate` (Task 2) are used with identical field names throughout — `borderRadius`/`borderColor`/`image` on `CardTemplate`, `feltColor`/`woodColor` on `TableTemplate`, `uri`/`kind`/`svgXml`/`scale`/`offsetX`/`offsetY` on `CardImage` — verified consistent across Tasks 3, 6, 7, 9, 10, 11. Store action names (`setBorderRadius`, `setBorderColor`, `setCardImage`, `updateCardImage`, `clearCardImage`, `resetCardTemplate`, `setFeltColor`, `setWoodColor`, `resetTableTemplate`) defined in Task 3 match their call sites in Tasks 9 and 10 exactly.
