# Batak Dev Tuning Panel + App-Wide Press Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `__DEV__`-gated Batak tuning panel (table-background switch + independent top/bottom hand-fan overlap/spacing controls) and an app-wide press-feedback "blacken" effect plus a 1.5× chrome-icon/exit-text size bump.

**Architecture:** A new dev-only zustand store (`devTuningStore`) feeds two `__DEV__`-gated read sites in existing Batak components (`BatakTable.tsx` for background, `HumanHandFan.tsx` for per-row fan config); a new modal (`BatakDevTuningModal`) writes to that store via stepper buttons, opened from a new emoji icon wired through a new generic `extraHeaderActions` slot on `GameScreenLayout`. Separately, a new shared `PressableFeedback` component (a `Pressable` drop-in with a press-time dark overlay) replaces every existing `Pressable` in `apps/mobile`.

**Tech Stack:** React Native, TypeScript, zustand (existing pattern from `settingsStore.ts`), no new dependencies.

## Global Constraints

- No new automated tests — mobile-UI default per `docs/governance/engineering-principles.md` §5/6. Verify with `tsc --noEmit` after every task instead.
- Every `__DEV__`-gated branch must leave release-build behavior byte-identical to today's (per the spec's own production-safety requirement) — hooks are always called unconditionally at each component's top level; only the *branch/value selection* is gated, never the hook call itself.
- `TableFelt.tsx` and `Pressable`'s own type surface are never modified — only added to/wrapped.
- Reference spec: `docs/superpowers/specs/2026-08-07-batak-dev-tuning-panel-and-press-feedback-design.md`.

---

### Task 1: `GeminiTableBackground` component

**Files:**
- Create: `packages/ui/src/GeminiTableBackground.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `GeminiTableBackground` — a no-props, memoized `React.ComponentType`, same call shape as the existing `TableFelt`.

- [ ] **Step 1: Create the component**

```tsx
// packages/ui/src/GeminiTableBackground.tsx
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { AbsoluteOverlay } from './AbsoluteOverlay';

const GEMINI_TABLE_IMAGE = require('../assets/table/gemini-table-design_upscayl_6x_upscayl-standard-4x.png');

// A dev-tuning alternative to TableFelt's green photo texture, for on-device A/B comparison via
// Batak's __DEV__-gated tuning panel (apps/mobile/src/games/batak/BatakDevTuningModal.tsx). Same
// shape as TableFelt: pure decoration, no props, painted once.
function GeminiTableBackgroundComponent() {
  return (
    <AbsoluteOverlay>
      <Image source={GEMINI_TABLE_IMAGE} style={styles.image} resizeMode="cover" />
    </AbsoluteOverlay>
  );
}

export const GeminiTableBackground = React.memo(GeminiTableBackgroundComponent);

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
```

- [ ] **Step 2: Export it**

In `packages/ui/src/index.ts`, immediately after the existing line `export { TableFelt } from './TableFelt';`, add:

```ts
export { GeminiTableBackground } from './GeminiTableBackground';
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/GeminiTableBackground.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add GeminiTableBackground dev-tuning table background"
```

---

### Task 2: `devTuningStore`

**Files:**
- Create: `apps/mobile/src/state/devTuningStore.ts`

**Interfaces:**
- Consumes: `STANDARD_RAIL_CONFIG` from `apps/mobile/src/games/batak/table/batakRailFan.ts` (`{ overlap: number; spacingPx: number; ... }`).
- Produces: `useDevTuningStore` (zustand hook) and `DevTableBackground` type, both imported by Tasks 3, 4, 8, 9.

- [ ] **Step 1: Create the store**

```ts
// apps/mobile/src/state/devTuningStore.ts
import { create } from 'zustand';
import { STANDARD_RAIL_CONFIG } from '../games/batak/table/batakRailFan';

export type DevTableBackground = 'felt' | 'gemini';

export interface DevTuningState {
  tableBackground: DevTableBackground;
  topOverlap: number;
  bottomOverlap: number;
  topSpacingPx: number;
  bottomSpacingPx: number;
  setTableBackground: (v: DevTableBackground) => void;
  setTopOverlap: (v: number) => void;
  setBottomOverlap: (v: number) => void;
  setTopSpacingPx: (v: number) => void;
  setBottomSpacingPx: (v: number) => void;
}

// __DEV__-only live-tuning state (BatakDevTuningModal.tsx) — session-only, no persistence.
// Overlap/spacing all default to STANDARD_RAIL_CONFIG's current production values, so opening the
// panel changes nothing visually until a control is actually touched.
export const useDevTuningStore = create<DevTuningState>((set) => ({
  tableBackground: 'felt',
  topOverlap: STANDARD_RAIL_CONFIG.overlap,
  bottomOverlap: STANDARD_RAIL_CONFIG.overlap,
  topSpacingPx: STANDARD_RAIL_CONFIG.spacingPx,
  bottomSpacingPx: STANDARD_RAIL_CONFIG.spacingPx,
  setTableBackground: (tableBackground) => set({ tableBackground }),
  setTopOverlap: (topOverlap) => set({ topOverlap }),
  setBottomOverlap: (bottomOverlap) => set({ bottomOverlap }),
  setTopSpacingPx: (topSpacingPx) => set({ topSpacingPx }),
  setBottomSpacingPx: (bottomSpacingPx) => set({ bottomSpacingPx }),
}));
```

- [ ] **Step 2: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/state/devTuningStore.ts
git commit -m "feat(batak): add devTuningStore for dev-only live tuning state"
```

---

### Task 3: Wire table-background switch into `BatakTable.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: `GeminiTableBackground` (Task 1), `useDevTuningStore` (Task 2).

- [ ] **Step 1: Add imports**

In `apps/mobile/src/games/batak/BatakTable.tsx`, the current `@world-cards/ui` import block reads:

```tsx
import {
  TableFelt,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from '@world-cards/ui';
```

Change to:

```tsx
import {
  TableFelt,
  GeminiTableBackground,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from '@world-cards/ui';
```

Then, right after the existing `import { DeselectableSurface } from '../../components/DeselectableSurface';` line, add:

```tsx
import { useDevTuningStore } from '../../state/devTuningStore';
```

- [ ] **Step 2: Read the dev store unconditionally at the top of `BatakTable`**

Immediately after the `export function BatakTable({ ... }: BatakTableProps) {` opening line, before `const seats = useMemo(...)`, add:

```tsx
  const devTableBackground = useDevTuningStore((s) => s.tableBackground);
```

(This hook call is unconditional — required by React's Rules of Hooks — even though its *use* below is `__DEV__`-gated.)

- [ ] **Step 3: Swap the rendered background**

Find:

```tsx
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      <TableFelt />
```

Replace with:

```tsx
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      {__DEV__ && devTableBackground === 'gemini' ? <GeminiTableBackground /> : <TableFelt />}
```

- [ ] **Step 4: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "feat(batak): wire dev table-background switch into BatakTable"
```

---

### Task 4: Per-row hand-fan overlap/spacing overrides in `HumanHandFan.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/table/HumanHandFan.tsx`

**Interfaces:**
- Consumes: `useDevTuningStore` (Task 2), `RailAngleConfig` type from `apps/mobile/src/table/railFan.ts`.
- Produces: `slotPosition`'s signature changes from `(slot, compact: boolean, extraRadius)` to `(slot, config: RailAngleConfig, extraRadius)` — this is a local (non-exported) function, confirmed by reading the whole file that its only two call sites are inside this same file's `HumanHandFan` component body, both updated in this task.

- [ ] **Step 1: Add imports**

At the top of `apps/mobile/src/games/batak/table/HumanHandFan.tsx`, change:

```ts
import { STANDARD_RAIL_CONFIG, COMPACT_RAIL_CONFIG } from "./batakRailFan";
import { railAngleStepDeg, railAngles, railPosition } from "../../../table/railFan";
```

to:

```ts
import { STANDARD_RAIL_CONFIG, COMPACT_RAIL_CONFIG } from "./batakRailFan";
import { railAngleStepDeg, railAngles, railPosition } from "../../../table/railFan";
import type { RailAngleConfig } from "../../../table/railFan";
import { useDevTuningStore } from "../../../state/devTuningStore";
```

- [ ] **Step 2: Change `slotPosition` to take a resolved config instead of `compact`**

Find:

```ts
function slotPosition(
  slot: HandSlot,
  compact: boolean,
  extraRadius: number,
): { x: number; y: number; angleDeg: number } {
  const config = compact ? COMPACT_RAIL_CONFIG : STANDARD_RAIL_CONFIG;
  const angleStepDeg = railAngleStepDeg(config, slot.rowCount);
```

Replace with:

```ts
function slotPosition(
  slot: HandSlot,
  config: RailAngleConfig,
  extraRadius: number,
): { x: number; y: number; angleDeg: number } {
  const angleStepDeg = railAngleStepDeg(config, slot.rowCount);
```

(The rest of the function body — `angles`, `angleDeg`, `pos`, `rowYOffset`, the `return` — is unchanged; it already only reads `config`, never `compact`, so no further edits are needed inside the function.)

- [ ] **Step 3: Read dev overrides unconditionally at the top of `HumanHandFan`, and add a `configForRow` helper**

Immediately after the `export function HumanHandFan({ ... }) {` opening line (i.e., as the first lines of the function body, before `return (`), add:

```tsx
  const devTop = useDevTuningStore((s) => ({ overlap: s.topOverlap, spacingPx: s.topSpacingPx }));
  const devBottom = useDevTuningStore((s) => ({ overlap: s.bottomOverlap, spacingPx: s.bottomSpacingPx }));

  // Resolves each row's real rail config, applying the dev-only per-row overlap/spacing overrides
  // only in __DEV__ (dead-code-eliminated from a release build, per this file's own production-
  // safety requirement) — arcDegrees/maxRotationDeg/radius always stay shared across both rows.
  function configForRow(row: "top" | "bottom"): RailAngleConfig {
    const baseConfig = compact ? COMPACT_RAIL_CONFIG : STANDARD_RAIL_CONFIG;
    if (!__DEV__) return baseConfig;
    return { ...baseConfig, ...(row === "top" ? devTop : devBottom) };
  }
```

(Both `useDevTuningStore` calls are unconditional, satisfying Rules of Hooks; `configForRow` itself calls no hooks, it only closes over `devTop`/`devBottom`/`compact`, so it's safe to call conditionally or per-slot below.)

- [ ] **Step 4: Update the two `slotPosition` call sites**

Find:

```tsx
      {slots.map((slot) => {
        const restTarget = slotPosition(slot, compact, 0);
        const liftedTarget = slotPosition(slot, compact, SELECTED_LIFT_DISTANCE);
```

Replace with:

```tsx
      {slots.map((slot) => {
        const rowConfig = configForRow(slot.row);
        const restTarget = slotPosition(slot, rowConfig, 0);
        const liftedTarget = slotPosition(slot, rowConfig, SELECTED_LIFT_DISTANCE);
```

- [ ] **Step 5: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/batak/table/HumanHandFan.tsx
git commit -m "feat(batak): make hand-fan overlap/spacing independently tunable per row in dev builds"
```

---

### Task 5: `PressableFeedback` shared component

**Files:**
- Create: `packages/ui/src/PressableFeedback.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `PressableFeedback` component and `PressableFeedbackProps` type (extends RN's `PressableProps` with one added optional `overlayBorderRadius?: number`, default `0`), consumed by Tasks 6, 8, 9, 10–14.

- [ ] **Step 1: Create the component**

```tsx
// packages/ui/src/PressableFeedback.tsx
import React from 'react';
import { Pressable, PressableProps, StyleSheet, View } from 'react-native';

export interface PressableFeedbackProps extends PressableProps {
  // Matches the caller's own button corner radius so the press overlay's edges align with it.
  // Defaults to 0 (square) for callers with no rounding.
  overlayBorderRadius?: number;
}

// Drop-in Pressable replacement adding a shared press-feedback "blacken" cue: while pressed, a
// semi-transparent black layer overlays `children`, giving every button in the app the same
// tactile click confirmation instead of each one inventing its own (or having none at all).
// Does NOT force `overflow: 'hidden'` on the wrapping Pressable itself — an earlier draft did,
// which clipped BidControls.tsx's BidButton drop shadow (a same-size sibling view). The overlay
// carries its own borderRadius instead, so it never needs to touch the caller's own overflow.
export function PressableFeedback({
  style,
  children,
  overlayBorderRadius = 0,
  ...rest
}: PressableFeedbackProps) {
  return (
    <Pressable style={style} {...rest}>
      {(state) => (
        <>
          {typeof children === 'function' ? children(state) : children}
          {state.pressed && (
            <View
              style={[styles.overlay, { borderRadius: overlayBorderRadius }]}
              pointerEvents="none"
            />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
});
```

- [ ] **Step 2: Export it**

In `packages/ui/src/index.ts`, add (near the other component exports, e.g. after the `SettingsIcon` export lines):

```ts
export { PressableFeedback } from './PressableFeedback';
export type { PressableFeedbackProps } from './PressableFeedback';
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/PressableFeedback.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add PressableFeedback, a Pressable with a shared press-darken overlay"
```

---

### Task 6: `GameScreenLayout.tsx` — bigger exit text, `extraHeaderActions` slot, `PressableFeedback`

**Files:**
- Modify: `apps/mobile/src/components/GameScreenLayout.tsx`

**Interfaces:**
- Consumes: `PressableFeedback` (Task 5).
- Produces: new optional prop `extraHeaderActions?: React.ReactNode` on `GameScreenLayoutProps`, consumed by Task 9.

- [ ] **Step 1: Swap the import**

Change:

```tsx
import { Alert, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { HeaderWoodFrame, SettingsIcon } from '@world-cards/ui';
```

to:

```tsx
import { Alert, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { HeaderWoodFrame, PressableFeedback, SettingsIcon } from '@world-cards/ui';
```

- [ ] **Step 2: Add the `extraHeaderActions` prop**

Change:

```tsx
export interface GameScreenLayoutProps {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
  // When provided, renders a small gear button in the header. Omitted by call sites that don't
  // have a settings surface yet (e.g. Pişti today) — the header is visually unchanged for them.
  onSettingsPress?: () => void;
}

export function GameScreenLayout({
  title,
  onExit,
  children,
  backgroundColor,
  titleColor,
  onSettingsPress,
}: GameScreenLayoutProps) {
```

to:

```tsx
export interface GameScreenLayoutProps {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
  // When provided, renders a small gear button in the header. Omitted by call sites that don't
  // have a settings surface yet (e.g. Pişti today) — the header is visually unchanged for them.
  onSettingsPress?: () => void;
  // Extra header buttons rendered just before the settings button (e.g. Batak's __DEV__-only
  // tuning-panel icon). Generic React content so this layout stays game-agnostic — a caller with
  // nothing to add simply omits it, unchanged from today.
  extraHeaderActions?: React.ReactNode;
}

export function GameScreenLayout({
  title,
  onExit,
  children,
  backgroundColor,
  titleColor,
  onSettingsPress,
  extraHeaderActions,
}: GameScreenLayoutProps) {
```

- [ ] **Step 3: Render `extraHeaderActions`, swap both buttons to `PressableFeedback`**

Change:

```tsx
        <View style={styles.headerActions}>
          {onSettingsPress && (
            <Pressable onPress={onSettingsPress} accessibilityRole="button" testID="game-settings-button">
              <SettingsIcon />
            </Pressable>
          )}
          <Pressable onPress={handleExitPress} accessibilityRole="button">
            <Text style={styles.exit}>Exit</Text>
          </Pressable>
        </View>
```

to:

```tsx
        <View style={styles.headerActions}>
          {extraHeaderActions}
          {onSettingsPress && (
            <PressableFeedback onPress={onSettingsPress} accessibilityRole="button" testID="game-settings-button">
              <SettingsIcon />
            </PressableFeedback>
          )}
          <PressableFeedback onPress={handleExitPress} accessibilityRole="button">
            <Text style={styles.exit}>Exit</Text>
          </PressableFeedback>
        </View>
```

- [ ] **Step 4: Bump the exit text size 1.5×**

In `styles`, change:

```ts
  exit: { fontSize: 14, color: '#c0392b' },
```

to:

```ts
  exit: { fontSize: 21, color: '#c0392b' },
```

- [ ] **Step 5: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/GameScreenLayout.tsx
git commit -m "feat(mobile): bigger exit text, extraHeaderActions slot, press-feedback header buttons"
```

---

### Task 7: `SettingsIcon.tsx` — bump default size 1.5×

**Files:**
- Modify: `packages/ui/src/SettingsIcon.tsx`

- [ ] **Step 1: Change the default**

Change:

```tsx
function SettingsIconComponent({ size = 18 }: SettingsIconProps) {
```

to:

```tsx
function SettingsIconComponent({ size = 27 }: SettingsIconProps) {
```

Also update the doc comment above it, which currently reads:

```tsx
export interface SettingsIconProps {
  // Roughly matches the prior ⚙ glyph's visual size (fontSize: 16) at its default.
  size?: number;
}
```

to:

```tsx
export interface SettingsIconProps {
  // 1.5x the original default (18) — see docs/superpowers/specs/2026-08-07-batak-dev-tuning-panel-and-press-feedback-design.md §6.
  size?: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/SettingsIcon.tsx
git commit -m "feat(ui): bump SettingsIcon default size 1.5x (18 -> 27)"
```

---

### Task 8: `BatakDevTuningModal.tsx`

**Files:**
- Create: `apps/mobile/src/games/batak/BatakDevTuningModal.tsx`

**Interfaces:**
- Consumes: `useDevTuningStore` (Task 2), `PressableFeedback` (Task 5), `CARD_DIMS` from `@world-cards/ui`.
- Produces: `BatakDevTuningModal` component, `{ visible: boolean; onClose: () => void }` props — same shape as the existing `BatakSettingsModal`, consumed by Task 9.

- [ ] **Step 1: Create the modal**

```tsx
// apps/mobile/src/games/batak/BatakDevTuningModal.tsx
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CARD_DIMS, PressableFeedback } from '@world-cards/ui';
import { useDevTuningStore } from '../../state/devTuningStore';

export interface BatakDevTuningModalProps {
  visible: boolean;
  onClose: () => void;
}

const OVERLAP_STEP = 0.01;
const OVERLAP_MIN = 0;
const OVERLAP_MAX = 0.9;
const SPACING_STEP = 2;
// Same bounds the playground's FanConfigControls already uses for its own spacing slider.
const SPACING_MIN = CARD_DIMS.normal.width * 0.2;
const SPACING_MAX = CARD_DIMS.normal.width;

const STEPPER_BUTTON_RADIUS = 16;
const SWITCH_BUTTON_RADIUS = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function StepperRow({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <PressableFeedback
          onPress={() => onChange(clamp(roundTo2(value - step), min, max))}
          accessibilityRole="button"
          style={styles.stepperButton}
          overlayBorderRadius={STEPPER_BUTTON_RADIUS}>
          <Text style={styles.stepperButtonText}>{'\u2212'}</Text>
        </PressableFeedback>
        <Text style={styles.stepperValue}>{value.toFixed(2)}</Text>
        <PressableFeedback
          onPress={() => onChange(clamp(roundTo2(value + step), min, max))}
          accessibilityRole="button"
          style={styles.stepperButton}
          overlayBorderRadius={STEPPER_BUTTON_RADIUS}>
          <Text style={styles.stepperButtonText}>+</Text>
        </PressableFeedback>
      </View>
    </View>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <View style={styles.section}>
      <PressableFeedback
        onPress={() => setIsOpen((o) => !o)}
        accessibilityRole="button"
        style={styles.sectionToggle}>
        <Text style={styles.sectionToggleText}>{(isOpen ? '\u25be ' : '\u25b8 ') + title}</Text>
      </PressableFeedback>
      {isOpen && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

export function BatakDevTuningModal({ visible, onClose }: BatakDevTuningModalProps) {
  const tableBackground = useDevTuningStore((s) => s.tableBackground);
  const setTableBackground = useDevTuningStore((s) => s.setTableBackground);
  const topOverlap = useDevTuningStore((s) => s.topOverlap);
  const setTopOverlap = useDevTuningStore((s) => s.setTopOverlap);
  const bottomOverlap = useDevTuningStore((s) => s.bottomOverlap);
  const setBottomOverlap = useDevTuningStore((s) => s.setBottomOverlap);
  const topSpacingPx = useDevTuningStore((s) => s.topSpacingPx);
  const setTopSpacingPx = useDevTuningStore((s) => s.setTopSpacingPx);
  const bottomSpacingPx = useDevTuningStore((s) => s.bottomSpacingPx);
  const setBottomSpacingPx = useDevTuningStore((s) => s.setBottomSpacingPx);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.heading}>Dev Tuning</Text>

          <CollapsibleSection title="Table Background">
            <PressableFeedback
              onPress={() => setTableBackground(tableBackground === 'felt' ? 'gemini' : 'felt')}
              accessibilityRole="button"
              style={styles.switchButton}
              overlayBorderRadius={SWITCH_BUTTON_RADIUS}
              testID="dev-tuning-background-switch">
              <Text style={styles.switchButtonText}>
                {tableBackground === 'felt' ? 'Switch to Gemini table' : 'Switch to felt table'}
              </Text>
            </PressableFeedback>
          </CollapsibleSection>

          <CollapsibleSection title="Hand Fan">
            <StepperRow
              label="Top overlap"
              value={topOverlap}
              step={OVERLAP_STEP}
              min={OVERLAP_MIN}
              max={OVERLAP_MAX}
              onChange={setTopOverlap}
            />
            <StepperRow
              label="Bottom overlap"
              value={bottomOverlap}
              step={OVERLAP_STEP}
              min={OVERLAP_MIN}
              max={OVERLAP_MAX}
              onChange={setBottomOverlap}
            />
            <StepperRow
              label="Top spacing (px)"
              value={topSpacingPx}
              step={SPACING_STEP}
              min={SPACING_MIN}
              max={SPACING_MAX}
              onChange={setTopSpacingPx}
            />
            <StepperRow
              label="Bottom spacing (px)"
              value={bottomSpacingPx}
              step={SPACING_STEP}
              min={SPACING_MIN}
              max={SPACING_MAX}
              onChange={setBottomSpacingPx}
            />
          </CollapsibleSection>

          <PressableFeedback onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </PressableFeedback>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 300, maxHeight: '80%' },
  heading: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  section: { marginBottom: 12 },
  sectionToggle: { paddingVertical: 6 },
  sectionToggleText: { fontSize: 15, fontWeight: '600' },
  sectionContent: { paddingTop: 8, gap: 10 },
  switchButton: { backgroundColor: '#2f5fa8', borderRadius: SWITCH_BUTTON_RADIUS, paddingVertical: 10, alignItems: 'center' },
  switchButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperLabel: { fontSize: 14, flexShrink: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: STEPPER_BUTTON_RADIUS,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 18, fontWeight: '700' },
  stepperValue: { fontSize: 14, minWidth: 44, textAlign: 'center' },
  closeButton: { marginTop: 20, alignSelf: 'center' },
  closeText: { fontSize: 16, color: '#2f5fa8', fontWeight: '600' },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/BatakDevTuningModal.tsx
git commit -m "feat(batak): add BatakDevTuningModal (table background + per-row hand-fan steppers)"
```

---

### Task 9: Wire the dev icon + modal into `BatakScreen.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakScreen.tsx`

**Interfaces:**
- Consumes: `BatakDevTuningModal` (Task 8), `PressableFeedback` (Task 5), `extraHeaderActions` prop (Task 6).

- [ ] **Step 1: Add imports**

`BatakScreen.tsx` currently has no `react-native` or `@world-cards/ui` import at all. Add, right after the existing `import React, { useEffect, useRef, useState } from "react";` line:

```tsx
import { StyleSheet, Text } from "react-native";
import { PressableFeedback } from "@world-cards/ui";
```

Then, right after the existing `import { BatakSettingsModal } from "./BatakSettingsModal";` line, add:

```tsx
import { BatakDevTuningModal } from "./BatakDevTuningModal";
```

- [ ] **Step 2: Add modal-visibility state**

Find:

```tsx
  const [settingsVisible, setSettingsVisible] = useState(false);
```

Change to:

```tsx
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [devTuningVisible, setDevTuningVisible] = useState(false);
```

- [ ] **Step 3: Pass `extraHeaderActions` and render the modal**

Find:

```tsx
    <GameScreenLayout
      title="Batak"
      onExit={onBackHome}
      backgroundColor="#0b6623"
      titleColor="#f4c542"
      onSettingsPress={() => setSettingsVisible(true)}>
```

Replace with:

```tsx
    <GameScreenLayout
      title="Batak"
      onExit={onBackHome}
      backgroundColor="#0b6623"
      titleColor="#f4c542"
      onSettingsPress={() => setSettingsVisible(true)}
      extraHeaderActions={
        __DEV__ ? (
          <PressableFeedback
            onPress={() => setDevTuningVisible(true)}
            accessibilityRole="button"
            testID="batak-dev-tuning-button">
            <Text style={styles.devIcon}>{'\u{1F39B}\u{FE0F}'}</Text>
          </PressableFeedback>
        ) : undefined
      }>
```

Find:

```tsx
      <BatakSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </GameScreenLayout>
```

Replace with:

```tsx
      <BatakSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      {__DEV__ && (
        <BatakDevTuningModal
          visible={devTuningVisible}
          onClose={() => setDevTuningVisible(false)}
        />
      )}
    </GameScreenLayout>
```

- [ ] **Step 4: Add the `styles` block**

`BatakScreen.tsx` currently has no `StyleSheet.create` call — add one at the bottom of the file (after the component's closing `}`):

```tsx
const styles = StyleSheet.create({
  // Matches SettingsIcon's enlarged 27px default (see packages/ui/src/SettingsIcon.tsx) so both
  // header icons read as the same visual size.
  devIcon: { fontSize: 27 },
});
```

- [ ] **Step 5: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/batak/BatakScreen.tsx
git commit -m "feat(batak): wire dev-tuning icon and modal into BatakScreen"
```

---

### Task 10: Swap `Pressable` -> `PressableFeedback` in `BatakSettingsModal.tsx` + `GameResultModal.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakSettingsModal.tsx`
- Modify: `apps/mobile/src/components/GameResultModal.tsx`

**Interfaces:**
- Consumes: `PressableFeedback` (Task 5).

- [ ] **Step 1: `BatakSettingsModal.tsx`**

Change:

```tsx
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
```

to:

```tsx
import { Modal, StyleSheet, Switch, Text, View } from 'react-native';
import { PressableFeedback } from '@world-cards/ui';
```

Change:

```tsx
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
```

to:

```tsx
          <PressableFeedback onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </PressableFeedback>
```

- [ ] **Step 2: `GameResultModal.tsx`**

Change:

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
```

to:

```tsx
import { Modal, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from '@world-cards/ui';
```

Change:

```tsx
          <View style={styles.actions}>
            <Pressable onPress={onPlayAgain} accessibilityRole="button">
              <Text style={styles.actionText}>Play Again</Text>
            </Pressable>
            <Pressable onPress={onBackHome} accessibilityRole="button">
              <Text style={styles.actionText}>Back to Home</Text>
            </Pressable>
          </View>
```

to:

```tsx
          <View style={styles.actions}>
            <PressableFeedback onPress={onPlayAgain} accessibilityRole="button">
              <Text style={styles.actionText}>Play Again</Text>
            </PressableFeedback>
            <PressableFeedback onPress={onBackHome} accessibilityRole="button">
              <Text style={styles.actionText}>Back to Home</Text>
            </PressableFeedback>
          </View>
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/BatakSettingsModal.tsx apps/mobile/src/components/GameResultModal.tsx
git commit -m "feat(mobile): add press-feedback overlay to settings/result modal buttons"
```

---

### Task 11: Swap `Pressable` -> `PressableFeedback` in `BatakSetupView.tsx` + `PistiSetupView.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakSetupView.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiSetupView.tsx`

**Interfaces:**
- Consumes: `PressableFeedback` (Task 5).

- [ ] **Step 1: `BatakSetupView.tsx`**

Change:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
```

to:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from '@world-cards/ui';
```

Change:

```tsx
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </Pressable>
```

to:

```tsx
        <PressableFeedback onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </PressableFeedback>
```

Change:

```tsx
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
```

to (both `option` rows share `styles.option`'s `borderRadius: 8` — see file's `styles` block):

```tsx
      {VARIANTS.map(({ value, label, description }) => (
        <PressableFeedback
          key={value}
          onPress={() => setVariant(value)}
          style={[styles.option, value === variant && styles.optionDefault]}
          overlayBorderRadius={8}
          testID={`batak-variant-${value}`}
        >
          <Text style={styles.optionText}>{label}</Text>
          <Text style={styles.variantDescription}>{description}</Text>
        </PressableFeedback>
      ))}

      <Text style={styles.title}>Choose a difficulty</Text>
      {DIFFICULTIES.map(({ value, label }) => (
        <PressableFeedback
          key={value}
          onPress={() => handlePress(value)}
          style={[styles.option, value === defaultDifficulty && styles.optionDefault]}
          overlayBorderRadius={8}
        >
          <Text style={styles.optionText}>{label}</Text>
          {value === defaultDifficulty && <Text style={styles.defaultBadge}>Last played</Text>}
        </PressableFeedback>
      ))}
```

- [ ] **Step 2: `PistiSetupView.tsx`**

Change:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
```

to:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from '@world-cards/ui';
```

Change:

```tsx
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </Pressable>
```

to:

```tsx
        <PressableFeedback onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </PressableFeedback>
```

Change (the `PLAYER_COUNTS` row — `styles.playerCountOption` has `borderRadius: 8`):

```tsx
        {PLAYER_COUNTS.map(({ value, label }) => (
          <Pressable
            key={value}
            onPress={() => setPlayerCount(value)}
            style={[styles.playerCountOption, value === playerCount && styles.optionDefault]}
          >
            <Text style={styles.optionText}>{label}</Text>
          </Pressable>
        ))}
```

to:

```tsx
        {PLAYER_COUNTS.map(({ value, label }) => (
          <PressableFeedback
            key={value}
            onPress={() => setPlayerCount(value)}
            style={[styles.playerCountOption, value === playerCount && styles.optionDefault]}
            overlayBorderRadius={8}
          >
            <Text style={styles.optionText}>{label}</Text>
          </PressableFeedback>
        ))}
```

Change (the `FOUR_PLAYER_MODES` row, same `playerCountOption` style):

```tsx
            {FOUR_PLAYER_MODES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setFourPlayerMode(value)}
                style={[styles.playerCountOption, value === fourPlayerMode && styles.optionDefault]}
              >
                <Text style={styles.optionText}>{label}</Text>
              </Pressable>
            ))}
```

to:

```tsx
            {FOUR_PLAYER_MODES.map(({ value, label }) => (
              <PressableFeedback
                key={value}
                onPress={() => setFourPlayerMode(value)}
                style={[styles.playerCountOption, value === fourPlayerMode && styles.optionDefault]}
                overlayBorderRadius={8}
              >
                <Text style={styles.optionText}>{label}</Text>
              </PressableFeedback>
            ))}
```

Change (the `DIFFICULTIES` row, `styles.option`'s `borderRadius: 8`):

```tsx
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
```

to:

```tsx
      {DIFFICULTIES.map(({ value, label }) => (
        <PressableFeedback
          key={value}
          onPress={() => handlePress(value)}
          style={[styles.option, value === defaultDifficulty && styles.optionDefault]}
          overlayBorderRadius={8}
        >
          <Text style={styles.optionText}>{label}</Text>
          {value === defaultDifficulty && <Text style={styles.defaultBadge}>Last played</Text>}
        </PressableFeedback>
      ))}
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/BatakSetupView.tsx apps/mobile/src/games/pisti/PistiSetupView.tsx
git commit -m "feat(mobile): add press-feedback overlay to Batak/Pişti setup screen buttons"
```

---

### Task 12: Swap `Pressable` -> `PressableFeedback` in `BurySlots.tsx` + `KittyExchangeCenter.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/table/BurySlots.tsx`
- Modify: `apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx`

**Interfaces:**
- Consumes: `PressableFeedback` (Task 5).

- [ ] **Step 1: `BurySlots.tsx`**

Change:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard } from '@world-cards/ui';
```

to:

```tsx
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard, PressableFeedback } from '@world-cards/ui';
```

Change (the Pressable wraps a `PlayingCard`, which itself has a 6px corner radius — `CARD_RADIUS` in `packages/ui/src/PlayingCard.tsx`):

```tsx
              <TravelCard originOffset={HAND_TO_SLOT_OFFSET} resetKey={card.id}>
                <Pressable onPress={() => onTapCard(card.id)} accessibilityRole="button">
                  <PlayingCard card={card} size="small" />
                </Pressable>
              </TravelCard>
```

to:

```tsx
              <TravelCard originOffset={HAND_TO_SLOT_OFFSET} resetKey={card.id}>
                <PressableFeedback onPress={() => onTapCard(card.id)} accessibilityRole="button" overlayBorderRadius={6}>
                  <PlayingCard card={card} size="small" />
                </PressableFeedback>
              </TravelCard>
```

- [ ] **Step 2: `KittyExchangeCenter.tsx`**

Change:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { BatakState } from '@world-cards/engine/games/batak';
import { centerPanelStyles } from './centerPanelStyles';
```

to:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { BatakState } from '@world-cards/engine/games/batak';
import { PressableFeedback } from '@world-cards/ui';
import { centerPanelStyles } from './centerPanelStyles';
```

Change (`styles.confirmButton` has `borderRadius: 8`):

```tsx
          <Pressable
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}>
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
```

to:

```tsx
          <PressableFeedback
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            overlayBorderRadius={8}>
            <Text style={styles.confirmText}>Confirm</Text>
          </PressableFeedback>
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/table/BurySlots.tsx apps/mobile/src/games/batak/table/KittyExchangeCenter.tsx
git commit -m "feat(batak): add press-feedback overlay to bury-slot and confirm buttons"
```

---

### Task 13: Swap `Pressable` -> `PressableFeedback` in `PhaseCenterPanels.tsx` + `GameMenuRow.tsx`

**Files:**
- Modify: `apps/mobile/src/games/batak/table/PhaseCenterPanels.tsx`
- Modify: `apps/mobile/src/screens/home/GameMenuRow.tsx`

**Interfaces:**
- Consumes: `PressableFeedback` (Task 5).

- [ ] **Step 1: `PhaseCenterPanels.tsx`**

Change:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Suit } from '@world-cards/engine';
import type { BatakState, BatakMove } from '@world-cards/engine/games/batak';
import { SuitIcon } from '@world-cards/ui';
```

to:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import type { Suit } from '@world-cards/engine';
import type { BatakState, BatakMove } from '@world-cards/engine/games/batak';
import { PressableFeedback, SuitIcon } from '@world-cards/ui';
```

Change (`centerPanelStyles.suitButton` has `borderRadius: 22`, a 44x44 circle):

```tsx
        {SUITS.map((suit) => (
          <Pressable
            key={suit}
            onPress={() => onMove({ type: 'selectTrump', suit })}
            style={centerPanelStyles.suitButton}
            accessibilityRole="button">
            <SuitIcon suit={suit} size={28} color={suitColor(suit)} />
          </Pressable>
        ))}
```

to:

```tsx
        {SUITS.map((suit) => (
          <PressableFeedback
            key={suit}
            onPress={() => onMove({ type: 'selectTrump', suit })}
            style={centerPanelStyles.suitButton}
            overlayBorderRadius={22}
            accessibilityRole="button">
            <SuitIcon suit={suit} size={28} color={suitColor(suit)} />
          </PressableFeedback>
        ))}
```

- [ ] **Step 2: `GameMenuRow.tsx`**

Change:

```tsx
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
```

to:

```tsx
import { Animated, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from '@world-cards/ui';
```

Change (`styles.row` has `borderRadius: 12`):

```tsx
      <Pressable onPress={onPress} testID={testID} style={[styles.row, { borderLeftColor: accent }]}>
        <MiniCardFan />
        <View style={styles.textBlock}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </Pressable>
```

to:

```tsx
      <PressableFeedback
        onPress={onPress}
        testID={testID}
        style={[styles.row, { borderLeftColor: accent }]}
        overlayBorderRadius={12}>
        <MiniCardFan />
        <View style={styles.textBlock}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </PressableFeedback>
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/table/PhaseCenterPanels.tsx apps/mobile/src/screens/home/GameMenuRow.tsx
git commit -m "feat(mobile): add press-feedback overlay to trump-picker and home-menu buttons"
```

---

### Task 14: Swap `Pressable` -> `PressableFeedback` in `BidControls.tsx`'s `BidButton`

**Files:**
- Modify: `apps/mobile/src/games/batak/table/BidControls.tsx`

**Interfaces:**
- Consumes: `PressableFeedback` (Task 5).

**Note:** confirmed directly — the overlay stacks on top of `BidButton`'s existing pressed-state palette/glow swap (§7 of the spec). `overlayBorderRadius` matches `BID_BUTTON_RADIUS` (10), the same radius `styles.bidButtonClip` already uses.

- [ ] **Step 1: Swap the import**

Change:

```tsx
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { BatakMove } from '@world-cards/engine/games/batak';
import { glowShadow } from '@world-cards/ui';
```

to:

```tsx
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { BatakMove } from '@world-cards/engine/games/batak';
import { glowShadow, PressableFeedback } from '@world-cards/ui';
```

- [ ] **Step 2: Swap `BidButton`'s wrapping `Pressable`**

Change:

```tsx
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ width, height }}>
      {({ pressed }) => {
```

to:

```tsx
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      style={{ width, height }}
      overlayBorderRadius={BID_BUTTON_RADIUS}>
      {({ pressed }) => {
```

Change the closing tag:

```tsx
      }}
    </Pressable>
  );
}
```

to:

```tsx
      }}
    </PressableFeedback>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd d:/CodeSpace/world-cards && npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/games/batak/table/BidControls.tsx
git commit -m "feat(batak): add press-feedback overlay to bid buttons"
```

---

### Task 15: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck, both packages**

Run:
```bash
cd d:/CodeSpace/world-cards
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx tsc --noEmit -p packages/ui/tsconfig.json
```
Expected: no errors in either.

- [ ] **Step 2: Confirm no remaining bare `Pressable` usages outside the excluded files**

Run: `cd d:/CodeSpace/world-cards && grep -rn "Pressable" apps/mobile/src --include=*.tsx -l`

Expected: only `apps/mobile/src/components/DeselectableSurface.tsx` (excluded — see spec §7, it never actually renders a `Pressable`, only mentions it in comments) should still contain the bare string `Pressable` outside of `PressableFeedback` usages. Every other file in the list should be either a new file from this plan (`BatakDevTuningModal.tsx`) or importing `PressableFeedback` from `@world-cards/ui`, not RN's `Pressable` directly.

- [ ] **Step 3: Run the existing test suite (regression check only — no new tests added)**

Run: `cd d:/CodeSpace/world-cards && npx jest --selectProjects mobile` (or the repo's existing root test script if one wraps this — check `package.json`'s `scripts.test` first and use that instead if present, so this matches how the project's suite is normally invoked)

Expected: all existing tests still pass (this plan touches no engine logic, only UI wiring).

- [ ] **Step 4: Note for the user's own on-device pass**

Not automatable from this sandbox (no device/emulator access confirmed unavailable in prior sessions) — leave this checklist for the user, per the spec's §9 Process section:
- Dev icon (🎛️) appears next to the gear icon only in a `__DEV__`/Expo Go/dev-client build, never in a release build.
- Table-background switch button actually swaps between the felt and Gemini images live.
- Top/bottom hand-fan overlap and spacing steppers each visibly change only their own row.
- Settings gear icon and Exit text read as noticeably bigger (1.5×) in both Pişti and Batak headers.
- Pressing any swapped button shows a brief black-tint flash; `BidControls`' bid buttons show both their existing palette swap and the new tint together, not fighting each other.
- `BurySlots`' rounded card-slot buttons and `PhaseCenterPanels`' circular suit buttons show a correctly-rounded (not square-cornered) overlay.

- [ ] **Step 5: Final commit (only if any fixes were needed in Steps 1-3)**

```bash
git add -A
git commit -m "fix: address verification-pass findings for dev tuning panel + press feedback"
```

(Skip this step entirely if Steps 1-3 found nothing to fix.)
