# Shared Card-Selection Deselect Surface — Design

## Purpose

Extract the "tap empty table space to clear the current card selection" wiring into one shared component, so every future game's table reuses it instead of hand-rolling its own outer `Pressable`.

## Current state (verified against the code, not assumed)

- `useCardSelection` (`apps/mobile/src/components/useCardSelection.ts`) and `SelectableCard` (`apps/mobile/src/components/SelectableCard.tsx`) are already generic and already reused by both Pişti and Batak. **No change needed to either.**
- **Batak** (`apps/mobile/src/games/batak/BatakTable.tsx:665`) already wraps its whole table in `<Pressable style={styles.container} onPress={clearSelection}>`.
- **Pişti** (`apps/mobile/src/games/pisti/PistiTable.tsx:302`) does **not** have this — its table root is a plain `<View style={styles.container}>`, with no way to tap away to deselect at all today. (This corrects what was said during the earlier design discussion, which assumed both games already had this wired identically.)

So this task both (a) refactors Batak's existing wrapper into a shared component, and (b) gives Pişti the same tap-away-to-deselect behavior it currently lacks. Both are in scope, and both are the expected, correct outcome of "extract this as a shared primitive."

## Design

New component `apps/mobile/src/components/DeselectableSurface.tsx`:

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

Minimal by design (`style`/`onDeselect`/`children` only) — matches exactly what both current/soon-to-be call sites need, no speculative extra props.

**`BatakTable.tsx`:** replace the root `<Pressable style={styles.container} onPress={clearSelection}>...</Pressable>` with `<DeselectableSurface style={styles.container} onDeselect={clearSelection}>...</DeselectableSurface>`. `Pressable` stays imported from `react-native` (still used directly by `TrumpSelectionCenter`'s suit buttons and `BidControls`' bid/pass buttons, unaffected by this change) and a new import for `DeselectableSurface` is added.

**`PistiTable.tsx`:** replace the root `<View style={styles.container}>...</View>` with `<DeselectableSurface style={styles.container} onDeselect={clearSelection}>...</DeselectableSurface>`. `clearSelection` already exists locally (from the existing `useCardSelection` call at line 274) — it's just not wired to anything outside the `isHumanTurn`-changes effect yet. New import for `DeselectableSurface` added; `View` stays imported (still used throughout the rest of the file for `middleRow`, `pileArea`, etc.).

## Why not go further

No change to `useCardSelection`'s API, and no bundling of "what a second tap on the same card does" into this component — that part is genuinely game-specific today (Pişti commits the play directly; Batak holds a reveal/trick-completion pause first) and there's no third game yet to prove what's actually common across that behavior. This extraction is scoped to exactly the one piece of wiring that's either already duplicated (Batak) or straightforwardly missing (Pişti) with an obviously correct shared shape.

## Non-goals

- No changes to `useCardSelection.ts` or `SelectableCard.tsx`.
- No new settings/props beyond `onDeselect`/`style`/`children`.
- No test changes — this is mobile UI interaction wiring, covered by the project's standing no-new-tests-by-default policy. Existing test suites (`PistiTable`/`BatakTable`, if any exist — verify during implementation) are re-run for regression, not expanded.

## Files touched

- New: `apps/mobile/src/components/DeselectableSurface.tsx`
- Modified: `apps/mobile/src/games/batak/BatakTable.tsx`
- Modified: `apps/mobile/src/games/pisti/PistiTable.tsx`
