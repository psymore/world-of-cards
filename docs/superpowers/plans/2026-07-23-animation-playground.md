# Animation Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained "Animation Playground" mode inside `apps/playground`, implementing the 6 demos from `apps/playground/ANIMATION_ARCHITECTURE.md` on top of one reusable, single-progress-value motion primitive (`useCardMotion`), so card-travel animation quality can be perfected in isolation before it's ever ported into Batak.

**Architecture:** A new `apps/playground/src/animation/` folder, reachable via a local-state mode toggle in `App.tsx`. Every animated card property is derived from one `Animated.Value` per card instance via `useCardMotion`; cards are rendered with a simplified text/suit-glyph `SimpleCard`, not `@world-cards/ui`'s `PlayingCard`. Demo 06 additionally uses a small local `useDealLoop` reducer (built on `@world-cards/engine`'s `createDeck`/`shuffle`/`createRng`) for the continuous 4-seat deal loop — no bidding/trump/trick-winner logic.

**Tech Stack:** React Native's built-in `Animated` API (`useNativeDriver: true`), `@react-native-community/slider` (already a dependency), `@world-cards/engine` root exports. No `react-native-reanimated`, no `@world-cards/ui`, no new dependencies.

## Global Constraints

- No automated tests (Jest/RNTL) are written for this module — per this repo's standing 2026-07-07 mobile-UI testing policy, this is decorative/animation UI work judged by eye, not assertions. Every task's verification step is `npx tsc -p apps/playground/tsconfig.json --noEmit` plus running the app and manually checking behavior against `apps/playground/CLAUDE_ANIMATION_RULES.md`'s per-demo checklist (motion, continuity, scaling, landing, rotation, performance).
- Do not add `react-native-reanimated` or any new npm dependency. Everything needed (`@react-native-community/slider`, `react-native`'s `Animated`, `@world-cards/engine`) is already present in `apps/playground/package.json`.
- `apps/playground/src/animation/` must not import from `@world-cards/ui` or `apps/mobile`. It may import from `@world-cards/engine`'s root export only (`createDeck`, `shuffle`, `createRng`, `Card`, `Suit`, `Rank`).
- Do not modify `apps/mobile` in this plan — porting into Batak is an explicitly separate, later sub-project.
- Every `Animated.timing` call must pass `useNativeDriver: true`.
- One demo per task, in order — do not start a later demo's task before the previous one's manual verification checklist passes, per `CLAUDE_ANIMATION_RULES.md`'s "One Problem at a Time" / "Demo First" rules.
- Every card's animated properties are driven by exactly one `Animated.Value` via `useCardMotion` — never chain multiple independent `Animated.timing` calls for one card's single logical movement.

---

### Task 1: Entry point, demo switcher, shared types

**Files:**
- Create: `apps/playground/src/animation/types.ts`
- Create: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`
- Modify: `apps/playground/App.tsx`

**Interfaces:**
- Produces: `DemoId` (`'fan-layout' | 'selection' | 'play-travel' | 'landing' | 'transform' | 'complete-sequence'`), `DEMO_LABELS`, `DEMO_ORDER`, `CardMotionKeyframe` (`{x, y, rotateDeg, scale, glyphScale}`), `idleKeyframe(overrides?)`. Every later task consumes these from `./types`.

- [ ] **Step 1: Create `apps/playground/src/animation/types.ts`**

```ts
import type { Card } from '@world-cards/engine';

export type DemoId =
  | 'fan-layout'
  | 'selection'
  | 'play-travel'
  | 'landing'
  | 'transform'
  | 'complete-sequence';

export const DEMO_ORDER: DemoId[] = [
  'fan-layout',
  'selection',
  'play-travel',
  'landing',
  'transform',
  'complete-sequence',
];

export const DEMO_LABELS: Record<DemoId, string> = {
  'fan-layout': 'Demo 1: Fan Layout',
  selection: 'Demo 2: Selection',
  'play-travel': 'Demo 3: Play Card',
  landing: 'Demo 4: Landing',
  transform: 'Demo 5: Transform',
  'complete-sequence': 'Demo 6: Complete Sequence',
};

// A single point in a card's animated life: position/rotation/scale, plus the
// corner/watermark glyph's own independent scale (used from Demo 05 onward). Every
// animated card property in this module is derived from exactly one pair of these
// keyframes interpolated against one progress value — see useCardMotion (Task 4).
export interface CardMotionKeyframe {
  x: number;
  y: number;
  rotateDeg: number;
  scale: number;
  glyphScale: number;
}

export function idleKeyframe(overrides: Partial<CardMotionKeyframe> = {}): CardMotionKeyframe {
  return { x: 0, y: 0, rotateDeg: 0, scale: 1, glyphScale: 1, ...overrides };
}

export interface DealSeatState {
  seat: number;
  hand: Card[];
}
```

- [ ] **Step 2: Create `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DemoId } from './types';
import { DEMO_LABELS, DEMO_ORDER } from './types';

// Each placeholder below is replaced by its real demo component in a later task
// (Demo 1 in Task 3, Demo 2 in Task 4, ... Demo 6 in Task 8) — see
// docs/superpowers/plans/2026-07-23-animation-playground.md.
function PlaceholderDemo({ label }: { label: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{label} — not implemented yet</Text>
    </View>
  );
}

function renderDemo(demo: DemoId): React.ReactElement {
  return <PlaceholderDemo label={DEMO_LABELS[demo]} />;
}

export function AnimationPlaygroundScreen() {
  const [activeDemo, setActiveDemo] = useState<DemoId>('fan-layout');

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
        showsHorizontalScrollIndicator={false}>
        {DEMO_ORDER.map(demo => (
          <Pressable
            key={demo}
            testID={`demo-tab-${demo}`}
            onPress={() => setActiveDemo(demo)}
            style={[styles.tab, activeDemo === demo && styles.tabActive]}>
            <Text style={[styles.tabText, activeDemo === demo && styles.tabTextActive]}>
              {DEMO_LABELS[demo]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.demoArea}>{renderDemo(activeDemo)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b6623' },
  tabBar: { flexGrow: 0, backgroundColor: '#1c2451' },
  tabBarContent: { paddingHorizontal: 8, paddingVertical: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4, borderRadius: 6 },
  tabActive: { backgroundColor: '#f4c542' },
  tabText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#1c2451' },
  demoArea: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#fff', fontSize: 16 },
});
```

- [ ] **Step 3: Modify `apps/playground/App.tsx` to add the mode toggle**

Replace the full file contents with:

```tsx
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS } from '@world-cards/ui';
import { PlaygroundScreen } from './src/PlaygroundScreen';
import { AnimationPlaygroundScreen } from './src/animation/AnimationPlaygroundScreen';

SplashScreen.preventAutoHideAsync();

type Mode = 'design' | 'animation';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const [mode, setMode] = useState<Mode>('design');

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={styles.root}>
      {/* Fixed 44px top padding approximates the status bar height without pulling in
          react-native-safe-area-context (a dependency this dev-tool app doesn't otherwise
          need) — acceptable for a dev tool, not pixel-perfect on every device. */}
      <View style={styles.modeBar}>
        <Pressable
          testID="mode-tab-design"
          onPress={() => setMode('design')}
          style={[styles.modeTab, mode === 'design' && styles.modeTabActive]}>
          <Text style={[styles.modeTabText, mode === 'design' && styles.modeTabTextActive]}>
            Design
          </Text>
        </Pressable>
        <Pressable
          testID="mode-tab-animation"
          onPress={() => setMode('animation')}
          style={[styles.modeTab, mode === 'animation' && styles.modeTabActive]}>
          <Text style={[styles.modeTabText, mode === 'animation' && styles.modeTabTextActive]}>
            Animation
          </Text>
        </Pressable>
      </View>
      {mode === 'design' ? <PlaygroundScreen /> : <AnimationPlaygroundScreen />}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingTop: 44,
    paddingBottom: 8,
    justifyContent: 'center',
    gap: 8,
  },
  modeTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: '#333' },
  modeTabActive: { backgroundColor: '#f4c542' },
  modeTabText: { color: '#fff', fontWeight: '600' },
  modeTabTextActive: { color: '#111' },
});
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Manually verify**

Run: `npm run playground` (or `cd apps/playground && npx expo start --web`). Confirm: the app opens on the "Design" mode by default (unchanged from before), tapping "Animation" switches to the new screen showing 6 demo tabs, tapping each tab shows that demo's placeholder text, tapping "Design" switches back.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/App.tsx apps/playground/src/animation/types.ts apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "Add animation playground entry point and demo switcher scaffold"
```

---

### Task 2: `SimpleCard` component

**Files:**
- Create: `apps/playground/src/animation/components/SimpleCard.tsx`

**Interfaces:**
- Consumes: `Card`, `Suit` from `@world-cards/engine`.
- Produces: `SimpleCard` component, `SIMPLE_CARD_WIDTH`, `SIMPLE_CARD_HEIGHT` constants. Every later task's card rendering uses these.

- [ ] **Step 1: Create `apps/playground/src/animation/components/SimpleCard.tsx`**

```tsx
import React from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';

export const SIMPLE_CARD_WIDTH = 64;
export const SIMPLE_CARD_HEIGHT = 92;

const SUIT_GLYPHS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#c0392b',
  diamonds: '#c0392b',
  clubs: '#111111',
  spades: '#111111',
};

export interface SimpleCardProps {
  card: Card;
  // Optional animated style applied to the rank/suit glyph content only, separate
  // from whatever transform the caller applies to the outer card — see Demo 05
  // (Task 7), which animates this toward a smaller resting size independently of
  // the outer card's own scale.
  glyphStyle?: StyleProp<ViewStyle>;
}

// Deliberately does not use @world-cards/ui's PlayingCard/SuitIcon — per
// ANIMATION_ARCHITECTURE.md's "Playground Scope," this module renders cards as plain
// text + Unicode suit glyphs at one fixed size, so animation work here is never
// blocked on (or confused with) the real game's card art.
export function SimpleCard({ card, glyphStyle }: SimpleCardProps) {
  const suit = card.suit ?? 'spades';
  return (
    <View style={styles.card} testID={`simple-card-${card.id}`}>
      <Animated.View style={glyphStyle}>
        <Text style={[styles.rank, { color: SUIT_COLORS[suit] }]}>{card.rank}</Text>
        <Text style={[styles.suit, { color: SUIT_COLORS[suit] }]}>{SUIT_GLYPHS[suit]}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SIMPLE_CARD_WIDTH,
    height: SIMPLE_CARD_HEIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#999',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  suit: { fontSize: 22, textAlign: 'center' },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify**

Temporarily render `<SimpleCard card={{ id: 'x', suit: 'hearts', rank: 'K' }} />` inside `AnimationPlaygroundScreen`'s placeholder (or a scratch file) to confirm it shows "K" and a red heart glyph at a fixed ~64×92 size, then remove the temporary render (this task has no permanent visual home yet — Task 3 gives it one).

- [ ] **Step 4: Commit**

```bash
git add apps/playground/src/animation/components/SimpleCard.tsx
git commit -m "Add SimpleCard: text/suit-glyph card for the animation playground"
```

---

### Task 3: Fan layout math, `Hand` component, Demo 01

**Files:**
- Create: `apps/playground/src/animation/components/fanLayout.ts`
- Create: `apps/playground/src/animation/components/Hand.tsx`
- Create: `apps/playground/src/animation/components/LabeledSlider.tsx`
- Create: `apps/playground/src/animation/demos/Demo01FanLayout.tsx`
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`

**Interfaces:**
- Consumes: `SIMPLE_CARD_WIDTH`, `SIMPLE_CARD_HEIGHT`, `SimpleCard` from `../components/SimpleCard` (Task 2); `Card`, `createDeck` from `@world-cards/engine`.
- Produces: `computeFanSlot(index, count, config): {x, y, rotateDeg}`, `computeFanWidth(count, config): number`, `FanLayoutConfig` type from `./fanLayout` — Task 4 (Demo 02) reuses these directly so hand-slot math is defined exactly once.

- [ ] **Step 1: Create `apps/playground/src/animation/components/fanLayout.ts`**

```ts
import { SIMPLE_CARD_WIDTH } from './SimpleCard';

export interface FanLayoutConfig {
  overlap: number; // 0..1 fraction of card width overlapped between neighbors
  arcDegrees: number; // total rotation sweep from leftmost to rightmost card
  maxRotationDeg: number; // hard clamp on any single card's rotation
  spacingPx: number; // base per-card horizontal step before overlap reduces it
}

export interface FanSlot {
  x: number;
  y: number;
  rotateDeg: number;
}

function fanStep(config: FanLayoutConfig): number {
  return config.spacingPx * (1 - config.overlap);
}

// Pure function: a card's position/rotation depends only on its index, the hand's
// total count, and these 4 config values — no taps, no animation, no external state.
// Reused unchanged by Hand (Demo 01) and every later demo's hand rendering.
export function computeFanSlot(index: number, count: number, config: FanLayoutConfig): FanSlot {
  const step = fanStep(config);
  const t = count > 1 ? (index / (count - 1)) * 2 - 1 : 0;
  const rawRotate = t * (config.arcDegrees / 2);
  const rotateDeg = Math.max(-config.maxRotationDeg, Math.min(config.maxRotationDeg, rawRotate));
  // Small vertical rise proportional to |rotation| so the fan reads as a curve rather
  // than cards merely rotating in place along a flat line.
  const y = Math.abs(rotateDeg) * 0.6;
  return { x: index * step, y, rotateDeg };
}

export function computeFanWidth(count: number, config: FanLayoutConfig): number {
  const step = fanStep(config);
  return count > 0 ? (count - 1) * step + SIMPLE_CARD_WIDTH : SIMPLE_CARD_WIDTH;
}
```

- [ ] **Step 2: Create `apps/playground/src/animation/components/Hand.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from './SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig } from './fanLayout';

export interface HandProps extends FanLayoutConfig {
  cards: Card[];
}

// Pure layout only — no taps, no animation (Demo 01's own scope). Every card's
// position/rotation comes from computeFanSlot alone.
export function Hand({ cards, overlap, arcDegrees, maxRotationDeg, spacingPx }: HandProps) {
  const config: FanLayoutConfig = { overlap, arcDegrees, maxRotationDeg, spacingPx };
  const totalWidth = computeFanWidth(cards.length, config);

  return (
    <View style={[styles.hand, { width: totalWidth, height: SIMPLE_CARD_HEIGHT + 40 }]}>
      {cards.map((card, i) => {
        const slot = computeFanSlot(i, cards.length, config);
        return (
          <View
            key={card.id}
            style={[
              styles.cardSlot,
              { left: slot.x, top: slot.y, transform: [{ rotate: `${slot.rotateDeg}deg` }] },
            ]}>
            <SimpleCard card={card} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hand: { alignSelf: 'center', marginTop: 20 },
  cardSlot: { position: 'absolute' },
});
```

- [ ] **Step 3: Create `apps/playground/src/animation/components/LabeledSlider.tsx`**

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

export interface LabeledSliderProps {
  label: string;
  testID: string;
  minimumValue: number;
  maximumValue: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

// Minimal labeled slider for this module's live-tunable demo controls. Deliberately
// separate from apps/playground/src/components/CardTemplateEditor.tsx's own (private,
// unexported) SliderWithInput — this module stays self-contained, per the design spec.
export function LabeledSlider({
  label,
  testID,
  minimumValue,
  maximumValue,
  step,
  value,
  onChange,
}: LabeledSliderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {label}: {Number(value.toFixed(2))}
      </Text>
      <Slider
        testID={testID}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: 16, marginBottom: 8 },
  label: { color: '#fff', fontSize: 13, marginBottom: 2 },
});
```

- [ ] **Step 4: Create `apps/playground/src/animation/demos/Demo01FanLayout.tsx`**

```tsx
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import { Hand } from '../components/Hand';
import { LabeledSlider } from '../components/LabeledSlider';
import { SIMPLE_CARD_WIDTH } from '../components/SimpleCard';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });

// Demo 01: pure layout, no taps, no animation — see ANIMATION_ARCHITECTURE.md's
// "Demo 01 / Fan Layout" section.
export function Demo01FanLayout() {
  const [handSize, setHandSize] = useState(13);
  const [overlap, setOverlap] = useState(0.6);
  const [arcDegrees, setArcDegrees] = useState(40);
  const [maxRotationDeg, setMaxRotationDeg] = useState(20);
  const [spacingPx, setSpacingPx] = useState(SIMPLE_CARD_WIDTH * 0.6);

  const cards = useMemo(() => FULL_DECK.slice(0, handSize), [handSize]);

  return (
    <View style={styles.container}>
      <View style={styles.handArea}>
        <Hand
          cards={cards}
          overlap={overlap}
          arcDegrees={arcDegrees}
          maxRotationDeg={maxRotationDeg}
          spacingPx={spacingPx}
        />
      </View>
      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        <LabeledSlider
          label="Hand size"
          testID="control-hand-size"
          minimumValue={1}
          maximumValue={13}
          step={1}
          value={handSize}
          onChange={v => setHandSize(Math.round(v))}
        />
        <LabeledSlider
          label="Overlap"
          testID="control-overlap"
          minimumValue={0}
          maximumValue={0.9}
          step={0.01}
          value={overlap}
          onChange={setOverlap}
        />
        <LabeledSlider
          label="Arc degrees"
          testID="control-arc"
          minimumValue={0}
          maximumValue={90}
          step={1}
          value={arcDegrees}
          onChange={setArcDegrees}
        />
        <LabeledSlider
          label="Max rotation"
          testID="control-max-rotation"
          minimumValue={0}
          maximumValue={45}
          step={1}
          value={maxRotationDeg}
          onChange={setMaxRotationDeg}
        />
        <LabeledSlider
          label="Spacing"
          testID="control-spacing"
          minimumValue={SIMPLE_CARD_WIDTH * 0.2}
          maximumValue={SIMPLE_CARD_WIDTH}
          step={1}
          value={spacingPx}
          onChange={setSpacingPx}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handArea: { height: 220, alignItems: 'center', justifyContent: 'flex-start' },
  controls: { flex: 1, backgroundColor: '#00000066' },
  controlsContent: { paddingVertical: 12 },
});
```

- [ ] **Step 5: Wire Demo 01 into the switcher**

In `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`, add the import and replace `renderDemo`'s body:

```tsx
import { Demo01FanLayout } from './demos/Demo01FanLayout';
```

```tsx
function renderDemo(demo: DemoId): React.ReactElement {
  switch (demo) {
    case 'fan-layout':
      return <Demo01FanLayout />;
    default:
      return <PlaceholderDemo label={DEMO_LABELS[demo]} />;
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 7: Manually verify against `CLAUDE_ANIMATION_RULES.md`'s checklist**

Run the app, open Demo 1. Confirm: dragging each of the 5 sliders updates the fan live with no lag; "Hand size" changes the number of cards from 1–13; "Overlap" tightens/loosens spacing; "Arc degrees" and "Max rotation" both visibly affect end-card tilt (and max rotation visibly clamps arc at extreme values); no taps do anything (pure layout, as required).

- [ ] **Step 8: Commit**

```bash
git add apps/playground/src/animation/components/fanLayout.ts apps/playground/src/animation/components/Hand.tsx apps/playground/src/animation/components/LabeledSlider.tsx apps/playground/src/animation/demos/Demo01FanLayout.tsx apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "Implement Demo 01: configurable fan layout"
```

---

### Task 4: `useCardMotion` core primitive, Demo 02

**Files:**
- Create: `apps/playground/src/animation/engine/useCardMotion.ts`
- Create: `apps/playground/src/animation/demos/Demo02Selection.tsx`
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`

**Interfaces:**
- Consumes: `CardMotionKeyframe`, `idleKeyframe` from `../types` (Task 1); `computeFanSlot`, `FanLayoutConfig` from `../components/fanLayout` (Task 3); `SimpleCard` from `../components/SimpleCard` (Task 2).
- Produces: `useCardMotion(options): CardMotionResult` — `{ transform, glyphScale, retarget(to, options?), getCurrentKeyframe() }`. Every later demo (03, 04, 05, 06) uses this exact hook and return shape; do not change its signature in later tasks.

- [ ] **Step 1: Create `apps/playground/src/animation/engine/useCardMotion.ts`**

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, EasingFunction } from 'react-native';
import type { CardMotionKeyframe } from '../types';

export interface RetargetOptions {
  durationMs?: number;
  easing?: EasingFunction;
}

export interface UseCardMotionOptions {
  initial: CardMotionKeyframe;
  defaultDurationMs: number;
  defaultEasing: EasingFunction;
}

export interface CardMotionResult {
  // Ready-to-spread transform array for an Animated.View's style.transform.
  transform: [
    { translateX: Animated.AnimatedInterpolation<number> },
    { translateY: Animated.AnimatedInterpolation<number> },
    { rotate: Animated.AnimatedInterpolation<string> },
    { scale: Animated.AnimatedInterpolation<number> },
  ];
  glyphScale: Animated.AnimatedInterpolation<number>;
  // Re-targets the animation toward `to`, starting from wherever the card visually
  // is right now (not the original `from`) — see ANIMATION_ARCHITECTURE.md's
  // "Preserve Spatial Continuity" rule. Safe to call while a previous retarget is
  // still animating.
  retarget: (to: CardMotionKeyframe, options?: RetargetOptions) => void;
  // The card's current interpolated keyframe, read synchronously.
  getCurrentKeyframe: () => CardMotionKeyframe;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// The single reusable motion primitive this whole sub-project exists to build.
// Drives exactly one Animated.Value (0 -> 1) via Animated.timing; every visual
// output below is an .interpolate() off that same value — see
// ANIMATION_ARCHITECTURE.md's "One source of truth" rule. zIndex/shadow are
// deliberately NOT produced here — see the design spec's documented exception;
// callers that need them derive discrete step changes from getCurrentKeyframe()
// themselves.
export function useCardMotion({
  initial,
  defaultDurationMs,
  defaultEasing,
}: UseCardMotionOptions): CardMotionResult {
  const progress = useRef(new Animated.Value(0)).current;
  const progressValueRef = useRef(0);
  const fromRef = useRef<CardMotionKeyframe>(initial);
  const toRef = useRef<CardMotionKeyframe>(initial);
  const durationRef = useRef(defaultDurationMs);
  const easingRef = useRef(defaultEasing);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValueRef.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  function getCurrentKeyframe(): CardMotionKeyframe {
    const t = progressValueRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    return {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      rotateDeg: lerp(from.rotateDeg, to.rotateDeg, t),
      scale: lerp(from.scale, to.scale, t),
      glyphScale: lerp(from.glyphScale, to.glyphScale, t),
    };
  }

  function retarget(to: CardMotionKeyframe, options?: RetargetOptions) {
    const current = getCurrentKeyframe();
    progress.stopAnimation();
    fromRef.current = current;
    toRef.current = to;
    progress.setValue(0);
    progressValueRef.current = 0;
    durationRef.current = options?.durationMs ?? defaultDurationMs;
    easingRef.current = options?.easing ?? defaultEasing;
    // Bumps so the useMemo below rebuilds its .interpolate() calls around the new
    // from/to refs — the single underlying `progress` Value keeps flowing on the
    // native thread across this re-render, it isn't restarted.
    setGeneration(g => g + 1);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationRef.current,
      easing: easingRef.current,
      useNativeDriver: true,
    }).start();
  }

  const { transform, glyphScale } = useMemo(() => {
    const from = fromRef.current;
    const to = toRef.current;
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
    const rotate = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [`${from.rotateDeg}deg`, `${to.rotateDeg}deg`],
    });
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [from.scale, to.scale] });
    const glyphScaleInterp = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [from.glyphScale, to.glyphScale],
    });
    return {
      transform: [{ translateX }, { translateY }, { rotate }, { scale }] as CardMotionResult['transform'],
      glyphScale: glyphScaleInterp,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  return { transform, glyphScale, retarget, getCurrentKeyframe };
}
```

- [ ] **Step 2: Create `apps/playground/src/animation/demos/Demo02Selection.tsx`**

```tsx
import React, { useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 8;
const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const SELECT_DURATION_MS = 200;
const HAND_TOP_OFFSET = 30;

function SelectableDemoCard({ card, slot }: { card: Card; slot: FanSlot }) {
  const [selected, setSelected] = useState(false);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: SELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    const next = !selected;
    setSelected(next);
    // Rotation is carried over unchanged in both keyframes — only y (the lift)
    // differs — satisfying Demo 02's "Rotation must remain unchanged" requirement.
    motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: next ? -SELECT_LIFT_PX : 0 }));
  }

  return (
    <Pressable
      testID={`demo02-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 02: tap-to-select lift. Neighbor cards' own slots (computed once from the
// fixed FAN_CONFIG/hand) never change when one card is selected — selection only
// ever affects the tapped card's own motion, never triggers a layout recalculation.
export function Demo02Selection() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);

  return (
    <View style={styles.container}>
      <View style={[styles.hand, { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 40 }]}>
        {cards.map((card, i) => (
          <SelectableDemoCard key={card.id} card={card} slot={computeFanSlot(i, cards.length, FAN_CONFIG)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
```

- [ ] **Step 3: Wire Demo 02 into the switcher**

In `AnimationPlaygroundScreen.tsx`, add the import and `case 'selection': return <Demo02Selection />;` to the `switch`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Manually verify against `CLAUDE_ANIMATION_RULES.md`'s checklist**

Run the app, open Demo 2. Confirm: tapping any card smoothly rises ~28px with no snap; its rotation angle looks identical before/during/after the lift; tapping it again smoothly lowers it back; tapping a different card doesn't move any other card.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/src/animation/engine/useCardMotion.ts apps/playground/src/animation/demos/Demo02Selection.tsx apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "Implement useCardMotion primitive and Demo 02: selection"
```

---

### Task 5: Demo 03 — Play Card

**Files:**
- Create: `apps/playground/src/animation/demos/Demo03PlayTravel.tsx`
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`

**Interfaces:**
- Consumes: `useCardMotion` (Task 4), `computeFanSlot`/`computeFanWidth`/`FanLayoutConfig`/`FanSlot` (Task 3), `SimpleCard` (Task 2), `idleKeyframe` (Task 1).

This demo is deliberately scoped as a small, replayable single-hand sandbox for tuning travel physics in isolation — it does not deplete the hand or reflow siblings (that real data-flow handoff is Demo 06's job, Task 8). After a played card completes its travel and holds briefly, it eases back to its idle slot so the demo can be replayed indefinitely.

- [ ] **Step 1: Create `apps/playground/src/animation/demos/Demo03PlayTravel.tsx`**

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 6;
const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const SELECT_DURATION_MS = 200;
export const TRAVEL_DISTANCE = 260;
export const TRAVEL_DURATION_MS = 450;
const HOLD_MS = 700;
const RESET_DURATION_MS = 300;
const HAND_TOP_OFFSET = 30;

type CardStage = 'idle' | 'selected' | 'traveling' | 'holding';

function PlayableDemoCard({ card, slot }: { card: Card; slot: FanSlot }) {
  const [stage, setStage] = useState<CardStage>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: SELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    // Ignore taps while mid-flight or holding — without this guard, a tap landing
    // during 'traveling'/'holding' cancels the pending reset timer with nothing to
    // reschedule it (neither branch below matches those two stages), permanently
    // freezing the card. Found by task review; only 'idle'/'selected' should ever
    // respond to a tap.
    if (stage === 'traveling' || stage === 'holding') return;
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (stage === 'idle') {
      setStage('selected');
      // Rotation held fixed — only y changes.
      motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: -SELECT_LIFT_PX }));
      return;
    }
    if (stage === 'selected') {
      setStage('traveling');
      // Destination: converge horizontally to the hand's own left edge (x: -slot.x
      // cancels this card's own base x offset) and travel up past the lift — begins
      // exactly from the current lifted position (getCurrentKeyframe(), inside
      // retarget), not from the original layout, per "Preserve Spatial Continuity."
      // Rotation is still the same slot.rotateDeg as every prior keyframe — held
      // fixed for the whole flight, per the doc's Rotation Rules.
      motion.retarget(
        idleKeyframe({ rotateDeg: slot.rotateDeg, x: -slot.x, y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE) }),
        { durationMs: TRAVEL_DURATION_MS, easing: Easing.out(Easing.cubic) },
      );
      resetTimer.current = setTimeout(() => {
        setStage('holding');
        resetTimer.current = setTimeout(() => {
          setStage('idle');
          motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg }), { durationMs: RESET_DURATION_MS });
        }, HOLD_MS);
      }, TRAVEL_DURATION_MS);
    }
  }

  return (
    <Pressable
      testID={`demo03-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 03: first tap selects (Demo 02's motion), second tap plays — travels toward
// a shared table point, then holds briefly and resets so the demo can be replayed.
export function Demo03PlayTravel() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.hand,
          { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + TRAVEL_DISTANCE + 60 },
        ]}>
        {cards.map((card, i) => (
          <PlayableDemoCard key={card.id} card={card} slot={computeFanSlot(i, cards.length, FAN_CONFIG)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
```

- [ ] **Step 2: Wire Demo 03 into the switcher**

In `AnimationPlaygroundScreen.tsx`, add the import and `case 'play-travel': return <Demo03PlayTravel />;`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify against `CLAUDE_ANIMATION_RULES.md`'s checklist**

Run the app, open Demo 3. Confirm: tap once to lift a card, tap again — it travels smoothly from its lifted position (not a jump back to the original layout position first) up toward the top, holding its rotation fixed the whole way, with no visible snap at the start of the flight; after ~1s it eases back down to its hand slot, ready to replay.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/animation/demos/Demo03PlayTravel.tsx apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "Implement Demo 03: play-card travel"
```

---

### Task 6: Demo 04 — Landing

**Files:**
- Create: `apps/playground/src/animation/demos/Demo04Landing.tsx`
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`

**Interfaces:**
- Consumes: same as Task 5 (`useCardMotion`, `fanLayout` helpers, `SimpleCard`, `idleKeyframe`), plus reuses `TRAVEL_DISTANCE`/`TRAVEL_DURATION_MS` exported from `./Demo03PlayTravel`.

This demo is Demo 03's exact mechanic with one axis exposed for comparison: which easing curve drives the travel leg, so landing quality (soft deceleration, no visible stop) can be tuned and A/B'd live.

- [ ] **Step 1: Create `apps/playground/src/animation/demos/Demo04Landing.tsx`**

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, EasingFunction, Pressable, StyleSheet, Text, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';
import { TRAVEL_DISTANCE, TRAVEL_DURATION_MS } from './Demo03PlayTravel';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 6;
const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const HOLD_MS = 700;
const RESET_DURATION_MS = 300;
const HAND_TOP_OFFSET = 30;

type EasingPresetId = 'linear' | 'easeOutCubic' | 'easeOutQuart' | 'easeOutBack';

const EASING_PRESETS: Record<EasingPresetId, { label: string; easing: EasingFunction }> = {
  linear: { label: 'Linear (no easing)', easing: Easing.linear },
  easeOutCubic: { label: 'Ease Out Cubic', easing: Easing.out(Easing.cubic) },
  easeOutQuart: { label: 'Ease Out Quart', easing: Easing.out(Easing.poly(4)) },
  easeOutBack: { label: 'Ease Out Back (overshoot)', easing: Easing.out(Easing.back(1.5)) },
};

type CardStage = 'idle' | 'selected' | 'traveling' | 'holding';

function LandingDemoCard({
  card,
  slot,
  easing,
}: {
  card: Card;
  slot: FanSlot;
  easing: EasingFunction;
}) {
  const [stage, setStage] = useState<CardStage>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: 200,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    // See Demo03PlayTravel.tsx's identical guard — without this, a tap during
    // 'traveling'/'holding' permanently freezes the card (found by task review).
    if (stage === 'traveling' || stage === 'holding') return;
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (stage === 'idle') {
      setStage('selected');
      motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: -SELECT_LIFT_PX }));
      return;
    }
    if (stage === 'selected') {
      setStage('traveling');
      motion.retarget(
        idleKeyframe({ rotateDeg: slot.rotateDeg, x: -slot.x, y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE) }),
        { durationMs: TRAVEL_DURATION_MS, easing },
      );
      resetTimer.current = setTimeout(() => {
        setStage('holding');
        resetTimer.current = setTimeout(() => {
          setStage('idle');
          motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg }), { durationMs: RESET_DURATION_MS });
        }, HOLD_MS);
      }, TRAVEL_DURATION_MS);
    }
  }

  return (
    <Pressable
      testID={`demo04-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 04: identical mechanic to Demo 03, with the easing curve exposed as a live
// picker so landing quality (soft deceleration, no visible stop) can be A/B'd.
export function Demo04Landing() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);
  const [presetId, setPresetId] = useState<EasingPresetId>('easeOutCubic');

  return (
    <View style={styles.container}>
      <View style={styles.presetRow}>
        {(Object.keys(EASING_PRESETS) as EasingPresetId[]).map(id => (
          <Pressable
            key={id}
            testID={`easing-preset-${id}`}
            onPress={() => setPresetId(id)}
            style={[styles.presetButton, presetId === id && styles.presetButtonActive]}>
            <Text style={styles.presetButtonText}>{EASING_PRESETS[id].label}</Text>
          </Pressable>
        ))}
      </View>
      <View
        style={[
          styles.hand,
          { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + TRAVEL_DISTANCE + 60 },
        ]}>
        {cards.map((card, i) => (
          <LandingDemoCard
            key={card.id}
            card={card}
            slot={computeFanSlot(i, cards.length, FAN_CONFIG)}
            easing={EASING_PRESETS[presetId].easing}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 12 },
  presetButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#333' },
  presetButtonActive: { backgroundColor: '#f4c542' },
  presetButtonText: { color: '#fff', fontSize: 12 },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
```

- [ ] **Step 2: Wire Demo 04 into the switcher**

In `AnimationPlaygroundScreen.tsx`, add the import and `case 'landing': return <Demo04Landing />;`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify against `CLAUDE_ANIMATION_RULES.md`'s checklist**

Run the app, open Demo 4. Confirm: switching easing presets changes how each played card decelerates on arrival; "Linear" visibly looks robotic/abrupt at the stop, "Ease Out Cubic"/"Ease Out Quart" settle smoothly, "Ease Out Back" visibly overshoots then settles — pick whichever preset (note it) reads best per the doc's "soft deceleration... no visible stop" requirement.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/animation/demos/Demo04Landing.tsx apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "Implement Demo 04: landing easing comparison"
```

---

### Task 7: Demo 05 — Transformation

**Files:**
- Create: `apps/playground/src/animation/demos/Demo05Transform.tsx`
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`

**Interfaces:**
- Consumes: same as Task 5, plus `SimpleCard`'s `glyphStyle` prop (Task 2) to animate the glyph's own scale.

- [ ] **Step 1: Create `apps/playground/src/animation/demos/Demo05Transform.tsx`**

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';
import { TRAVEL_DISTANCE, TRAVEL_DURATION_MS } from './Demo03PlayTravel';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 6;
const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const HOLD_MS = 700;
const RESET_DURATION_MS = 300;
const HAND_TOP_OFFSET = 30;
const RESTING_SCALE = 0.7;
const RESTING_GLYPH_SCALE = 0.75;

type CardStage = 'idle' | 'selected' | 'traveling' | 'holding';

function TransformDemoCard({ card, slot }: { card: Card; slot: FanSlot }) {
  const [stage, setStage] = useState<CardStage>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: 200,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    // See Demo03PlayTravel.tsx's identical guard — without this, a tap during
    // 'traveling'/'holding' permanently freezes the card (found by task review).
    if (stage === 'traveling' || stage === 'holding') return;
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (stage === 'idle') {
      setStage('selected');
      motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: -SELECT_LIFT_PX }));
      return;
    }
    if (stage === 'selected') {
      setStage('traveling');
      // Same travel as Demo 03/04, but the destination keyframe also shrinks scale
      // and glyphScale together with position/rotation — still one timeline, no
      // separate post-arrival "settle" step (Demo 05's own requirement).
      motion.retarget(
        idleKeyframe({
          rotateDeg: slot.rotateDeg,
          x: -slot.x,
          y: -(SELECT_LIFT_PX + TRAVEL_DISTANCE),
          scale: RESTING_SCALE,
          glyphScale: RESTING_GLYPH_SCALE,
        }),
        { durationMs: TRAVEL_DURATION_MS, easing: Easing.out(Easing.cubic) },
      );
      resetTimer.current = setTimeout(() => {
        setStage('holding');
        resetTimer.current = setTimeout(() => {
          setStage('idle');
          motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg }), { durationMs: RESET_DURATION_MS });
        }, HOLD_MS);
      }, TRAVEL_DURATION_MS);
    }
  }

  return (
    <Pressable
      testID={`demo05-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} glyphStyle={{ transform: [{ scale: motion.glyphScale }] }} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 05: extends Demo 03/04's travel with a scale-down (card + glyph together) to
// the resting trick-card size — still one timeline, per "Scale must not begin after
// translation ends."
export function Demo05Transform() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.hand,
          { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + TRAVEL_DISTANCE + 60 },
        ]}>
        {cards.map((card, i) => (
          <TransformDemoCard key={card.id} card={card} slot={computeFanSlot(i, cards.length, FAN_CONFIG)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
```

- [ ] **Step 2: Wire Demo 05 into the switcher**

In `AnimationPlaygroundScreen.tsx`, add the import and `case 'transform': return <Demo05Transform />;`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify against `CLAUDE_ANIMATION_RULES.md`'s checklist**

Run the app, open Demo 5. Confirm: the played card shrinks smoothly (both the card and its rank/suit text together) over the whole flight, with no visible "pop" or size jump right as it arrives; the card stays centered (doesn't drift sideways) as it shrinks.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/animation/demos/Demo05Transform.tsx apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "Implement Demo 05: scale/glyph transformation"
```

---

### Task 8: `useDealLoop`, Demo 06 — Complete Sequence

**Files:**
- Create: `apps/playground/src/animation/state/useDealLoop.ts`
- Create: `apps/playground/src/animation/demos/Demo06CompleteSequence.tsx`
- Modify: `apps/playground/src/animation/AnimationPlaygroundScreen.tsx`

**Interfaces:**
- Consumes: `createDeck`, `shuffle`, `createRng`, `Card` from `@world-cards/engine`; `useCardMotion` (Task 4); `SimpleCard`, `SIMPLE_CARD_WIDTH`/`HEIGHT` (Task 2); `computeFanSlot`/`computeFanWidth`/`FanLayoutConfig` (Task 3); `idleKeyframe` (Task 1).
- Produces: `useDealLoop(): DealLoopApi` — `{ seats: Card[][], turnSeat: number, currentTrick: {seat:number; card:Card}[], playCard(seat, cardId): Card | null, clearTrick(): void }`.

This is the "everything combined" demo: a real 4-seat, 13-card deal with turn order that cycles continuously (no trick-winner logic — confirmed with the user, see the design spec), auto-reshuffle once every hand is empty, the human seat (0) using the full select→play flow from Tasks 4–7, and the other 3 seats auto-playing on a timer.

- [ ] **Step 1: Create `apps/playground/src/animation/state/useDealLoop.ts`**

```ts
import { useCallback, useState } from 'react';
import { createDeck, createRng, shuffle } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';

export const SEAT_COUNT = 4;
export const HAND_SIZE = 13;

export interface DealLoopState {
  seats: Card[][];
  turnSeat: number;
  currentTrick: { seat: number; card: Card }[];
}

export interface DealLoopApi extends DealLoopState {
  playCard: (seat: number, cardId: string) => Card | null;
  clearTrick: () => void;
}

function dealFreshHands(): Card[][] {
  const rng = createRng(Date.now() & 0xffffffff);
  const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
  const seats: Card[][] = Array.from({ length: SEAT_COUNT }, () => []);
  deck.slice(0, SEAT_COUNT * HAND_SIZE).forEach((card, i) => {
    seats[i % SEAT_COUNT].push(card);
  });
  return seats;
}

// Deliberately excludes trick-winner logic (confirmed with the user, see
// docs/superpowers/specs/2026-07-23-animation-playground-design.md) — turnSeat
// always advances 0 -> 1 -> 2 -> 3 -> 0 regardless of who "wins" a trick, purely to
// generate a continuous stream of realistic play events to animate. Once every
// seat's hand is empty, reshuffles and redeals automatically.
export function useDealLoop(): DealLoopApi {
  const [state, setState] = useState<DealLoopState>(() => ({
    seats: dealFreshHands(),
    turnSeat: 0,
    currentTrick: [],
  }));

  const playCard = useCallback((seat: number, cardId: string): Card | null => {
    let played: Card | null = null;
    setState(prev => {
      if (prev.turnSeat !== seat) return prev;
      const hand = prev.seats[seat];
      const index = hand.findIndex(c => c.id === cardId);
      if (index === -1) return prev;
      played = hand[index];
      const nextSeats = prev.seats.map((h, i) => (i === seat ? h.filter(c => c.id !== cardId) : h));
      return {
        ...prev,
        seats: nextSeats,
        currentTrick: [...prev.currentTrick, { seat, card: played as Card }],
        turnSeat: (seat + 1) % SEAT_COUNT,
      };
    });
    return played;
  }, []);

  const clearTrick = useCallback(() => {
    setState(prev => {
      const allEmpty = prev.seats.every(hand => hand.length === 0);
      if (allEmpty) {
        return { seats: dealFreshHands(), turnSeat: 0, currentTrick: [] };
      }
      return { ...prev, currentTrick: [] };
    });
  }, []);

  return { ...state, playCard, clearTrick };
}
```

- [ ] **Step 2: Create `apps/playground/src/animation/demos/Demo06CompleteSequence.tsx`**

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT, SIMPLE_CARD_WIDTH } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';
import { SEAT_COUNT, useDealLoop } from '../state/useDealLoop';

const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const TRAVEL_DISTANCE = 260;
const TRAVEL_DURATION_MS = 450;
const TRICK_HOLD_MS = 1100;
const RESTING_SCALE = 0.7;
const RESTING_GLYPH_SCALE = 0.75;
const AI_THINK_DELAY_MS = 900;
const HAND_TOP_OFFSET = 30;
const HUMAN_SEAT = 0;

// Fixed offset each non-human seat's card travels FROM, relative to its own resting
// trick-slot position (see TrickCard) — deliberately not measured from a rendered
// opponent hand, since opponents are represented only by a card-count label here
// (this demo's animation focus is the travel itself, not opponent hand visuals).
const SEAT_ORIGIN_OFFSET: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: SELECT_LIFT_PX + TRAVEL_DISTANCE }, // human — overridden per-play, see below
  1: { x: 220, y: 0 }, // right
  2: { x: 0, y: -180 }, // top
  3: { x: -220, y: 0 }, // left
};

// Small stagger per seat so 4 resting trick cards don't perfectly overlap.
const TRICK_SLOT_OFFSET: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 20 },
  1: { x: 20, y: 0 },
  2: { x: 0, y: -20 },
  3: { x: -20, y: 0 },
};

type HumanStage = 'idle' | 'selected';

function TrickCard({
  card,
  seat,
  originOffset,
}: {
  card: Card;
  seat: number;
  originOffset: { x: number; y: number };
}) {
  const motion = useCardMotion({
    initial: idleKeyframe({ x: originOffset.x, y: originOffset.y }),
    defaultDurationMs: TRAVEL_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Animates from its origin offset down to {0,0,scale:RESTING_SCALE,...} — its
    // own resting position, laid out via TRICK_SLOT_OFFSET below.
    motion.retarget(idleKeyframe({ scale: RESTING_SCALE, glyphScale: RESTING_GLYPH_SCALE }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotOffset = TRICK_SLOT_OFFSET[seat] ?? { x: 0, y: 0 };
  // The per-seat stagger is applied via `transform`, not by overriding left/top —
  // styles.trickSlot's left/top: '50%' (plus its negative margins) is what centers
  // this card in trickArea in the first place; setting left/top here directly would
  // clobber that centering instead of composing with it (RN merges array styles by
  // later-key-wins, it doesn't add them).
  return (
    <View
      style={[
        styles.trickSlot,
        { transform: [{ translateX: slotOffset.x }, { translateY: slotOffset.y }] },
      ]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} glyphStyle={{ transform: [{ scale: motion.glyphScale }] }} />
      </Animated.View>
    </View>
  );
}

function HumanHandCard({
  card,
  slot,
  isTurn,
  onPlay,
}: {
  card: Card;
  slot: FanSlot;
  isTurn: boolean;
  onPlay: (originOffset: { x: number; y: number }) => void;
}) {
  const [stage, setStage] = useState<HumanStage>('idle');
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: 200,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    if (!isTurn) return;
    if (stage === 'idle') {
      setStage('selected');
      motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: -SELECT_LIFT_PX }));
      return;
    }
    // originOffset is TrickCard's own start-relative-to-its-resting-slot vector, not
    // a Demo03-style same-component destination — a different reference frame, found
    // and fixed by task review. TrickCard animates FROM originOffset TO {x:0,y:0} at
    // its own laid-out trick-slot position, so the Y term must be POSITIVE (the
    // human's hand sits below the trick area — matching SEAT_ORIGIN_OFFSET[HUMAN_SEAT]
    // above, which uses this same positive sign). x: -slot.x is just a per-card
    // horizontal variation for visual character (no real cross-component measurement,
    // same deliberate simplification as the 3 AI seats' fixed offsets).
    onPlay({ x: -slot.x, y: SELECT_LIFT_PX + TRAVEL_DISTANCE });
  }

  return (
    <Pressable
      testID={`demo06-human-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 06: everything from Demos 01-05 combined, driven by useDealLoop's continuous
// 4-seat turn cycle. Only the human seat (0) is tap-interactive; seats 1-3 auto-play
// their first card after a short delay once it's their turn.
export function Demo06CompleteSequence() {
  const { seats, turnSeat, currentTrick, playCard, clearTrick } = useDealLoop();
  const humanOriginsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Auto-play for AI seats (1-3): plays the first card in hand shortly after it
  // becomes that seat's turn. No legality constraint exists in this playground (no
  // trump, no suit-following), so "auto-play" just means "play the first card."
  useEffect(() => {
    if (turnSeat === HUMAN_SEAT) return;
    const hand = seats[turnSeat];
    if (hand.length === 0) return;
    const timer = setTimeout(() => {
      playCard(turnSeat, hand[0].id);
    }, AI_THINK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [turnSeat, seats, playCard]);

  // Once all 4 seats have played into the current trick, hold briefly (matching
  // this repo's existing "trick completing" pause convention) then clear.
  useEffect(() => {
    if (currentTrick.length < 4) return;
    const timer = setTimeout(() => {
      humanOriginsRef.current.clear();
      clearTrick();
    }, TRICK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [currentTrick, clearTrick]);

  const humanHand = seats[HUMAN_SEAT];
  const totalWidth = computeFanWidth(humanHand.length, FAN_CONFIG);
  // turnSeat advances immediately on each play, so after the 4th (last) card of a
  // trick lands, turnSeat has already wrapped back around to HUMAN_SEAT even though
  // currentTrick is still sitting there mid-hold, waiting for the TRICK_HOLD_MS
  // pause above to clear it. Without the currentTrick.length check, the human could
  // tap and play a 5th card into that same not-yet-cleared trick during the hold
  // window.
  const isHumanTurn = turnSeat === HUMAN_SEAT && currentTrick.length < SEAT_COUNT;

  return (
    <View style={styles.container}>
      <View style={styles.opponentRow}>
        {[2, 1, 3].map(seat => (
          <Text key={seat} style={styles.opponentLabel}>
            Seat {seat}: {seats[seat].length} cards {turnSeat === seat ? '(thinking...)' : ''}
          </Text>
        ))}
      </View>
      <View style={[styles.trickArea, { width: SIMPLE_CARD_WIDTH + 80, height: SIMPLE_CARD_HEIGHT + 80 }]}>
        {currentTrick.map(({ seat, card }) => (
          <TrickCard
            key={card.id}
            card={card}
            seat={seat}
            originOffset={
              seat === HUMAN_SEAT
                ? humanOriginsRef.current.get(card.id) ?? SEAT_ORIGIN_OFFSET[HUMAN_SEAT]
                : SEAT_ORIGIN_OFFSET[seat]
            }
          />
        ))}
      </View>
      <View style={[styles.hand, { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 40 }]}>
        {humanHand.map((card, i) => (
          <HumanHandCard
            key={card.id}
            card={card}
            slot={computeFanSlot(i, humanHand.length, FAN_CONFIG)}
            isTurn={isHumanTurn}
            onPlay={originOffset => {
              humanOriginsRef.current.set(card.id, originOffset);
              playCard(HUMAN_SEAT, card.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingVertical: 12 },
  opponentRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12 },
  opponentLabel: { color: '#fff', fontSize: 12 },
  trickArea: { alignSelf: 'center', position: 'relative' },
  trickSlot: { position: 'absolute', left: '50%', top: '50%', marginLeft: -SIMPLE_CARD_WIDTH / 2, marginTop: -SIMPLE_CARD_HEIGHT / 2 },
  hand: { alignSelf: 'center', position: 'relative' },
  cardSlot: { position: 'absolute' },
});
```

- [ ] **Step 3: Wire Demo 06 into the switcher**

In `AnimationPlaygroundScreen.tsx`, add the import and `case 'complete-sequence': return <Demo06CompleteSequence />;`. At this point every `case` in the `switch` has a real demo — remove the now-unused `PlaceholderDemo` function and its import if no longer referenced.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p apps/playground/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Manually verify against `CLAUDE_ANIMATION_RULES.md`'s checklist**

Run the app, open Demo 6. Confirm: on load, the human hand shows 13 cards and the 3 opponent labels show 13 cards each; turn order cycles human → seat 1 → seat 2 → seat 3 → human, with each AI seat's label briefly showing "(thinking...)" before its card count drops by one; tapping a human card lifts it, tapping again sends it flying into the trick area from its own lifted position; each of the 4 trick cards visibly arrives from a different direction; once all 4 are down, they hold briefly then clear and turn order continues; after 13 full rounds, all hands reach 0 and a fresh shuffle/deal happens automatically with no manual restart. Also spot-check: no console errors/warnings during a full 13-round loop.

- [ ] **Step 6: Commit**

```bash
git add apps/playground/src/animation/state/useDealLoop.ts apps/playground/src/animation/demos/Demo06CompleteSequence.tsx apps/playground/src/animation/AnimationPlaygroundScreen.tsx
git commit -m "Implement Demo 06: complete sequence with continuous 4-seat deal loop"
```

---

## Post-plan note

Per `apps/playground/CLAUDE_ANIMATION_RULES.md`'s "Final Objective," do not begin porting any of this into `apps/mobile`/Batak until every demo above has been visually validated against its own checklist and, ideally, played with for a while to confirm it holds up. Porting is a separate, later sub-project with its own plan.
