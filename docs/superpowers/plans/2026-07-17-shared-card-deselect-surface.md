# Shared DeselectableSurface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the "tap empty table space to clear the current card selection" wiring into one shared `apps/mobile/src/components/DeselectableSurface.tsx` component, migrate Batak's existing wrapper to use it, and give Pişti (which currently has no tap-away-to-deselect at all) the same behavior.

**Architecture:** `DeselectableSurface` is a thin wrapper around React Native's `Pressable` (`onDeselect` prop instead of `onPress`, same `style`/`children` shape). Both `BatakTable.tsx` and `PistiTable.tsx` swap their root element for it; nested `Pressable`s (cards, bid/trump buttons) keep claiming their own taps first via React Native's normal touch-responder negotiation, unaffected by this change.

**Tech Stack:** TypeScript, React Native (Expo), `@testing-library/react-native` (existing `PistiTable.test.tsx` suite, not expanded).

## Global Constraints

- No changes to `useCardSelection.ts` or `SelectableCard.tsx`.
- `DeselectableSurface` takes exactly `onDeselect: () => void`, `style?: StyleProp<ViewStyle>`, `children: React.ReactNode` — no other props.
- No new automated tests (mobile UI interaction wiring, per the project's standing 2026-07-07 testing policy) — existing tests are re-run for regression, not expanded.
- Typecheck command (confirmed clean against the current baseline): `npx tsc --noEmit` run from `apps/mobile/`.
- Full regression test command (confirmed clean against the current baseline, 39/39 suites, 229/229 tests): `npm test` run from the repo root (`D:/CodeSpace/world-of-cards`).

---

### Task 1: Create the DeselectableSurface component

**Files:**
- Create: `apps/mobile/src/components/DeselectableSurface.tsx`

**Interfaces:**
- Produces: `DeselectableSurface({ onDeselect, style, children }: DeselectableSurfaceProps)` — a React component. `DeselectableSurfaceProps` = `{ onDeselect: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode }`.

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';

export interface DeselectableSurfaceProps {
  onDeselect: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Wraps a game table's root content so tapping anywhere without a more specific Pressable
// (a card, a bid button, a suit picker) clears the current card selection. Nested Pressables
// claim their own taps first via RN's normal touch-responder negotiation, so this only fires
// on genuinely empty table space.
export function DeselectableSurface({ onDeselect, style, children }: DeselectableSurfaceProps) {
  return (
    <Pressable style={style} onPress={onDeselect}>
      {children}
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no output (clean compile). The component isn't consumed by anything yet — this only confirms the new file itself compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/DeselectableSurface.tsx
git commit -m "feat(mobile): add shared DeselectableSurface component"
```

---

### Task 2: Migrate BatakTable to DeselectableSurface

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx:665` (open tag) and `:753` (close tag)

**Interfaces:**
- Consumes: `DeselectableSurface` from `../../components/DeselectableSurface` (Task 1).

This is a pure refactor — Batak's `clearSelection`-wired `Pressable` already exists (`apps/mobile/src/games/batak/BatakTable.tsx:620-622` calls `useCardSelection`, producing `clearSelection`), it's just being swapped for the shared component. No behavior change. `Pressable` stays imported from `react-native` in this file — it's still used directly by `TrumpSelectionCenter`'s suit buttons and `BidControls`' bid/pass buttons, unrelated to this change.

- [ ] **Step 1: Add the import**

In `apps/mobile/src/games/batak/BatakTable.tsx`, find this line near the top of the file:

```tsx
import { SelectableCard } from "../../components/SelectableCard";
```

Add this line immediately after it:

```tsx
import { DeselectableSurface } from "../../components/DeselectableSurface";
```

- [ ] **Step 2: Swap the root Pressable for DeselectableSurface**

Replace this exact line:

```tsx
    <Pressable style={styles.container} onPress={clearSelection}>
```

with:

```tsx
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
```

Then replace this exact 2-line block (the very end of the component's returned JSX, immediately before the closing `);` of the `return` statement):

```tsx
    </Pressable>
  );
```

with:

```tsx
    </DeselectableSurface>
  );
```

Do not change anything else inside the component — every line between the opening and closing tags stays exactly as it is today.

- [ ] **Step 3: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no output (clean compile).

- [ ] **Step 4: Run the full regression suite**

Run (from the repo root, `D:/CodeSpace/world-of-cards`): `npm test`
Expected: `Test Suites: 39 passed, 39 total` / `Tests: 229 passed, 229 total` (there is no dedicated `BatakTable.test.tsx` today, so this is purely a regression check that nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "refactor(batak): use shared DeselectableSurface for tap-away deselect"
```

---

### Task 3: Migrate PistiTable to DeselectableSurface

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx:302` (open tag) and `:391-392` (close tag)
- Test: `apps/mobile/src/games/pisti/PistiTable.test.tsx` (existing suite, not expanded — run for regression)

**Interfaces:**
- Consumes: `DeselectableSurface` from `../../components/DeselectableSurface` (Task 1).

Unlike Task 2, this is a real behavior addition, not a pure refactor: `PistiTable`'s root is currently a plain `<View>` with no tap-away-to-deselect at all. `clearSelection` already exists locally in this component (from the existing `useCardSelection` call at `apps/mobile/src/games/pisti/PistiTable.tsx:274`) — it's just not wired to anything outside the `isHumanTurn`-change effect (`:275-277`) yet.

- [ ] **Step 1: Add the import**

In `apps/mobile/src/games/pisti/PistiTable.tsx`, find this line near the top of the file:

```tsx
import { SelectableCard } from '../../components/SelectableCard';
```

Add this line immediately after it:

```tsx
import { DeselectableSurface } from '../../components/DeselectableSurface';
```

- [ ] **Step 2: Swap the root View for DeselectableSurface**

Replace this exact line:

```tsx
    <View style={styles.container}>
```

with:

```tsx
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
```

Then replace this exact 3-line block (the very end of the component's returned JSX, immediately before the closing `);` of the `return` statement):

```tsx
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
    </View>
  );
```

with:

```tsx
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
    </DeselectableSurface>
  );
```

Do not change anything else inside the component. `View` stays imported from `react-native` — it's still used throughout the rest of the file (`middleRow`, `pileArea`, `pileMat`, the hand row wrapper, etc.).

- [ ] **Step 3: Typecheck**

Run (from `apps/mobile/`): `npx tsc --noEmit`
Expected: no output (clean compile).

- [ ] **Step 4: Run PistiTable's existing test suite**

Run (from the repo root, `D:/CodeSpace/world-of-cards`): `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx`
Expected: all 7 existing tests pass (`renders the pile top card and count`, `renders the opponent hand as face-down cards only`, `does not call onPlayCard on the first tap, only selects the card`, `calls onPlayCard when the already-selected card is tapped again`, `selecting a different card deselects the previous one instead of playing it`, `does not call onPlayCard when tapped during the AI turn`, `shows the banner text when provided`). None of these tests assert on the root container's element type, so swapping `View` for `DeselectableSurface` (a `Pressable`) should not affect any of them.

- [ ] **Step 5: Run the full regression suite**

Run (from the repo root, `D:/CodeSpace/world-of-cards`): `npm test`
Expected: `Test Suites: 39 passed, 39 total` / `Tests: 229 passed, 229 total`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "feat(pisti): add tap-away-to-deselect via shared DeselectableSurface"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers the spec's new `DeselectableSurface` component (exact prop shape: `onDeselect`/`style`/`children`, no extras). Task 2 covers Batak's refactor (no behavior change, `Pressable` import retained for its other two uses). Task 3 covers Pişti's new behavior (root swap, `clearSelection` wiring, existing `View` import retained for its other uses). The spec's non-goals (no `useCardSelection`/`SelectableCard` changes, no new tests) are correctly untouched by every task.
- **Type consistency:** `DeselectableSurface`/`DeselectableSurfaceProps`/`onDeselect` are named identically in Task 1 (where they're produced) and Tasks 2–3 (where they're consumed). `clearSelection` is the same function both games' existing `useCardSelection()` calls already produce — no renaming needed anywhere.
- **No placeholders:** every step shows the exact, complete code being added or replaced — no "similar to Task N" shorthand, no unshown diffs.
