# Batak Dev Tuning Panel + App-Wide Press Feedback — Design Spec

**Status:** Approved (2026-08-07)

## Context

Two independent changes, bundled into one pass at the user's request:

1. A dev-only, on-device tuning tool for Batak: try the new `gemini-table-design_upscayl_6x_upscayl-standard-4x.png` table background against the real game, and make the human hand-fan's top and bottom rows independently tunable (they currently share one `overlap`/`spacingPx` via `HumanHandFan.tsx`'s single `STANDARD_RAIL_CONFIG`/`COMPACT_RAIL_CONFIG`, per `batakRailFan.ts`). This mirrors the playground's existing `Demo09BatakHandTuning`/`FanConfigControls` live-tuning workflow, but wired directly into the real game screen so numbers get tuned against real gameplay conditions instead of a synthetic demo. Confirmed dev-only (not a shipped end-user feature) — gated behind `__DEV__` so it's automatically stripped from release builds, no manual removal needed later.
2. An app-wide visual polish pass: the header's settings icon and Exit button text become 1.5× bigger, and every `Pressable`-based button in the app gets a shared press-feedback "blacken" effect (a semi-transparent black overlay while pressed) it currently lacks.

## 1. New table background asset

New file `packages/ui/src/GeminiTableBackground.tsx`, a sibling to `TableFelt.tsx` with the identical shape (wraps an `Image` in `AbsoluteOverlay`, `resizeMode="cover"`, no props, `React.memo`'d — a one-time paint, same as `TableFelt`'s own doc comment describes):

```tsx
const GEMINI_TABLE_IMAGE = require('../assets/table/gemini-table-design_upscayl_6x_upscayl-standard-4x.png');
```

`TableFelt.tsx` itself is **not modified** — Pişti keeps rendering it exactly as today, zero blast radius there. Both `TableFelt` and `GeminiTableBackground` are exported from `packages/ui`'s `index.ts`.

## 2. Dev tuning state

New `apps/mobile/src/state/devTuningStore.ts`, a plain zustand store mirroring `settingsStore.ts`'s existing shape:

```ts
export interface DevTuningState {
  tableBackground: 'felt' | 'gemini';
  topOverlap: number;
  bottomOverlap: number;
  topSpacingPx: number;
  bottomSpacingPx: number;
  setTableBackground: (v: 'felt' | 'gemini') => void;
  setTopOverlap: (v: number) => void;
  setBottomOverlap: (v: number) => void;
  setTopSpacingPx: (v: number) => void;
  setBottomSpacingPx: (v: number) => void;
}
```

Defaults: `tableBackground: 'felt'`, and `topOverlap`/`bottomOverlap`/`topSpacingPx`/`bottomSpacingPx` all default to `STANDARD_RAIL_CONFIG.overlap`/`STANDARD_RAIL_CONFIG.spacingPx` (imported from `batakRailFan.ts`) — opening the panel changes nothing visually until a control is actually touched. Session-only: no persistence middleware, resets on app restart (acceptable for a dev tool per the user's own confirmation).

## 3. Wiring overrides into real rendering

**`BatakTable.tsx`:** the store hook is called unconditionally at the component's top level (React's Rules of Hooks require this — it cannot live inside an `__DEV__ &&` expression or a conditionally-invoked helper), and only the *branch it feeds* is `__DEV__`-gated:

```tsx
const devTableBackground = useDevTuningStore(s => s.tableBackground);
// ...
{__DEV__ && devTableBackground === 'gemini' ? <GeminiTableBackground /> : <TableFelt />}
```

In a release build, `__DEV__` is replaced with the literal `false`, so Metro/Terser dead-code-eliminates the `GeminiTableBackground` JSX branch — the rendered output is provably unchanged from today's `<TableFelt />`. The hook call itself (a cheap zustand selector reading a value nothing in a release build ever mutates, since the panel/icon that would call its setter never renders) stays in the bundle; this is the standard, low-cost shape of a `__DEV__`-gated read in RN, not a claim that the store disappears entirely.

**`HumanHandFan.tsx`'s `slotPosition`:** currently resolves one `config` (`compact ? COMPACT_RAIL_CONFIG : STANDARD_RAIL_CONFIG`) shared by both rows before computing `angleStepDeg`/`angles`. `slotPosition` is a plain function called once per slot, not a component or custom hook — it must not call a store hook itself (conditionally, multiple times per render, would break Rules of Hooks). Instead, `HumanHandFan`'s own component body reads the four dev values once, unconditionally, at the top:

```tsx
const devTop = useDevTuningStore(s => ({ overlap: s.topOverlap, spacingPx: s.topSpacingPx }));
const devBottom = useDevTuningStore(s => ({ overlap: s.bottomOverlap, spacingPx: s.bottomSpacingPx }));
```

and passes the resolved per-row `config` into `slotPosition` as a parameter instead of letting it re-derive `config` internally:

```tsx
const baseConfig = compact ? COMPACT_RAIL_CONFIG : STANDARD_RAIL_CONFIG;
const rowOverride = __DEV__ ? (slot.row === 'top' ? devTop : devBottom) : null;
const config = rowOverride ? { ...baseConfig, ...rowOverride } : baseConfig;
// slotPosition(slot, config, extraRadius) — config now a parameter, not re-resolved inside
```

Same production guarantee as above: in a release build the `rowOverride` branch is dead code, so `config` is always exactly `baseConfig` — `slotPosition`'s resolved output is byte-behaviorally identical to today's.

## 4. The panel

New `apps/mobile/src/games/batak/BatakDevTuningModal.tsx`, structurally modeled on the existing `BatakSettingsModal.tsx` (`Modal transparent animationType="fade"`, same backdrop/card shape), with two collapsible sections (plain `Pressable`-toggled disclosure rows, no accordion dependency — same pattern the playground's `FanConfigControls` already uses for its own show/hide toggle):

- **Table Background** — one button reading `useDevTuningStore`'s `tableBackground` and flipping it, labeled with whichever background it would switch *to* (e.g. "Switch to Gemini table" / "Switch to felt table").
- **Hand Fan** — four labeled stepper rows: Top overlap, Bottom overlap, Top spacing, Bottom spacing. Each is a `[−]  value  [+]` row of two `PressableFeedback` buttons (§7) nudging the store value by a fixed step (`0.01` for overlap, clamped `[0, 0.9]` matching the playground slider's own range; `2px` for spacing, clamped `[cardWidth * 0.2, cardWidth]`, same bounds `FanConfigControls` already uses) — no new slider dependency, per the user's explicit choice over installing `@react-native-community/slider`.

This is a second, fully separate modal from `BatakSettingsModal` — different trigger, different concerns (dev tuning vs. real user-facing settings), not merged into it.

## 5. The second icon

`GameScreenLayout.tsx` gains a new optional prop, `extraHeaderActions?: React.ReactNode`, rendered in `styles.headerActions` next to the existing settings `Pressable` (before the Exit button). Deliberately generic — `GameScreenLayout` has no knowledge of "dev tools" as a concept, keeping it exactly as game-agnostic as it is today (Pişti passes nothing and is unaffected).

`BatakScreen.tsx` supplies:

```tsx
extraHeaderActions={__DEV__ ? (
  <PressableFeedback onPress={() => setDevTuningVisible(true)} accessibilityRole="button" testID="batak-dev-tuning-button">
    <Text style={styles.devIcon}>{'\u{1F39B}\u{FE0F}'}</Text>
  </PressableFeedback>
) : undefined}
```

(the slider/control-knobs emoji, `🎛️`) — a plain glyph, not a new image asset; trivial to swap later. `styles.devIcon` sizes it to visually match the enlarged settings icon (§6).

## 6. Global chrome: bigger icons/exit text

Exactly 1.5× each, both defaults so every existing call site picks the change up automatically:

- `packages/ui/src/SettingsIcon.tsx`: default `size` prop `18 → 27`.
- `GameScreenLayout.tsx`: `styles.exit.fontSize` `14 → 21`.

Since `GameScreenLayout` is shared, this single change covers both Pişti's and Batak's header in one place — no per-game duplication. The new dev emoji icon (§5) is sized to the same ~27px scale from the start, not introduced small and resized later.

## 7. Press-feedback "blacken" effect, app-wide

New `packages/ui/src/PressableFeedback.tsx` — a drop-in wrapper matching RN `Pressable`'s prop surface (`style`, `onPress`, `children`, `accessibilityRole`, `testID`, etc., spread through unmodified), plus one new optional prop, `overlayBorderRadius?: number` (default `0`). While pressed, an absolute-fill `rgba(0,0,0,0.25)` overlay (`pointerEvents="none"`) renders on top of `children`, itself carrying `borderRadius: overlayBorderRadius` so it visually matches whatever corner radius the caller's button already has.

**Revised during plan file-mapping** from an earlier draft that forced `overflow: 'hidden'` onto the wrapping `Pressable` itself to achieve clipping: that approach broke `BidControls.tsx`'s `BidButton`, whose drop shadow lives on a sibling child view (`styles.bidButtonShadow`) the *same size* as the Pressable — forcing the parent's overflow to `hidden` would clip that shadow's visible bleed. Giving the overlay its own `borderRadius` directly sidesteps the Pressable's `overflow` entirely, so it can't conflict with any caller's own shadow/overflow needs (also relevant for `BurySlots.tsx`'s `.slot`, which explicitly sets `overflow: 'visible'` for its own reasons).

```tsx
export interface PressableFeedbackProps extends PressableProps {
  // Matches the caller's own button corner radius so the press overlay's edges align with it.
  // Defaults to 0 (square) for callers with no rounding.
  overlayBorderRadius?: number;
}

export function PressableFeedback({ style, children, overlayBorderRadius = 0, ...rest }: PressableFeedbackProps) {
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

**`BidControls.tsx`'s `BidButton`:** per direct confirmation, the overlay applies here too (stacked on top of its existing palette/glow pressed-state swap), passing `overlayBorderRadius={BID_BUTTON_RADIUS}` (10) to match `styles.bidButtonClip`'s own radius.

`style` is merged as a plain `[styles.clip, style]` array, not resolved through the pressed-state function form RN's `Pressable.style` also accepts — confirmed safe: a repo-wide check found no existing call site passes a function-of-pressed-state `style`, only plain objects/arrays. If a future caller needs pressed-aware styling of its own, `PressableFeedback`'s `style` prop would need extending to handle that form too; not needed for this pass.

**Every existing `Pressable` call site in `apps/mobile` swaps its import for this one** — confirmed exhaustive list (11 files, 50 occurrences of the literal component, from a repo-wide grep):
`components/GameResultModal.tsx`, `components/GameScreenLayout.tsx`, `games/batak/BatakSettingsModal.tsx`, `games/batak/BatakSetupView.tsx`, `games/batak/table/BurySlots.tsx`, `games/batak/table/BidControls.tsx`, `games/batak/table/KittyExchangeCenter.tsx`, `games/batak/table/PhaseCenterPanels.tsx`, `games/pisti/PistiSetupView.tsx`, `screens/home/GameMenuRow.tsx`, plus the new `BatakDevTuningModal.tsx` from the start.

**Explicitly excluded, not an oversight:**
- `components/DeselectableSurface.tsx` — its 4 grep hits are prose in comments explaining why it deliberately does *not* use `Pressable` (it's a `GestureDetector`-based full-screen tap-to-deselect backdrop, not a discrete button — wrapping it would blacken the entire table on any background tap).
- `BatakHandCard.tsx` / Pişti's hand-fan cards — already migrated off `Pressable` onto gesture-handler-driven components (per the recent `PistiHandFan`/`SelectableCard` deletion), out of scope by construction: they're playing cards with their own lift/selection animation, not buttons.

## 8. Cross-game safety

`GameScreenLayout.tsx` and `SettingsIcon.tsx` are the only genuinely shared files touched by §5/§6, and both changes are additive/parametric (`extraHeaderActions` defaults to nothing; `size`'s new default is the only behavior change, applied uniformly — there's no per-game special-casing to get wrong). `PressableFeedback` (§7) is a new component, not a modification to `Pressable` itself, so any file not migrated in this pass keeps working unchanged. `devTuningStore.ts`, `GeminiTableBackground.tsx`, `BatakDevTuningModal.tsx`, and the `HumanHandFan.tsx`/`BatakTable.tsx` `__DEV__` branches are Batak-only or dev-only; Pişti is untouched beyond the shared-chrome sizing in §6.

## 9. Process

No new automated tests (mobile-UI default, `engineering-principles.md` §5/6) — `tsc --noEmit` after each step, and a manual pass confirming release-mode behavior is unchanged (i.e., that `__DEV__`-gated branches genuinely vanish rather than just rendering falsy — checked by reading the compiled output or a production-mode `expo start`, not assumed). On-device verification (the user's own) covers: whether the gemini background reads well against real gameplay, whether independent top/bottom overlap/spacing actually solves the visual mismatch that motivated this, and whether the blacken overlay reads correctly across the app's different button shapes (pills, icon-only, text links, rounded card slots).

## 10. Explicitly deferred

- Persisting `devTuningStore` values across app restarts — not needed for a dev-only live-tuning tool; you'll hardcode the numbers you land on into `batakRailFan.ts` once satisfied, the same workflow `Demo09`/`Demo10` already established.
- Splitting `arcDegrees`/`maxRotationDeg`/`radius` per row, or exposing the vertical `HAND_ROW_OVERLAP_PX` row-to-row gap in this panel — not requested; only `overlap`/`spacingPx` per row, per the user's explicit choice.
- Installing `@react-native-community/slider` into `apps/mobile` — explicitly declined in favor of stepper buttons; revisit only if stepper granularity proves too coarse on-device.
- Removing/hiding the dev panel entirely once tuning is done — left as a manual follow-up whenever the user is satisfied with the numbers; `__DEV__` gating already means no code changes are required before shipping a release build in the meantime.
