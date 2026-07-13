# Card Corner-Rank Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `PlayingCard.tsx`'s system-default corner rank text (`A/2-10/J/Q/K`) with a bundled PT Serif Bold font, guaranteeing identical cross-device rendering, with Regular kept available as a one-line swap.

**Architecture:** Bundle both PT Serif weights as `.ttf` assets, load them app-wide via `expo-font`'s `useFonts` gated behind `expo-splash-screen` in `App.tsx`, expose the active weight as a single named constant in a new `apps/mobile/src/theme/fonts.ts`, and reference that constant from `PlayingCard.tsx`'s corner rank styles.

**Tech Stack:** Expo SDK 57, `expo-font`, `expo-splash-screen`, React Native, TypeScript.

## Global Constraints

- Expo SDK is pinned at `~57.0.2` — install new Expo packages via `npx expo install <pkg>` (not raw `npm install`) so versions match, per `AGENTS.md`.
- No new automated tests for this change (pure decorative/typography UI) — existing tests must still pass unmodified, per this project's testing policy.
- Font choice is PT Serif (SIL OFL license), sourced from the `google/fonts` GitHub repo's `ofl/ptserif/` directory — both `PTSerif-Bold.ttf` and `PTSerif-Regular.ttf` must be bundled even though only Bold is active initially.
- The active weight must be switchable by editing exactly one line: the `CARD_RANK_FONT_FAMILY` constant in `apps/mobile/src/theme/fonts.ts`.
- `fontWeight: 'bold'` must be removed from `cornerRankNormal`/`cornerRankSmall` once `fontFamily` is set, to avoid Android synthesizing a second faux-bold layer over an already-bold glyph.

---

### Task 1: Install expo-font and expo-splash-screen

**Files:**
- Modify: `apps/mobile/package.json` (via `npx expo install`, not hand-edited)

**Interfaces:**
- Produces: `expo-font` and `expo-splash-screen` packages available for import in later tasks.

- [ ] **Step 1: Install the packages with the Expo-aware installer**

Run (from the repo root):
```bash
cd apps/mobile && npx expo install expo-font expo-splash-screen
```
Expected: command completes without error; `apps/mobile/package.json`'s `dependencies` now includes `expo-font` and `expo-splash-screen` entries pinned to versions compatible with Expo `~57.0.2`.

- [ ] **Step 2: Verify install**

Run:
```bash
cat apps/mobile/package.json
```
Expected: `"expo-font"` and `"expo-splash-screen"` both present under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "Add expo-font and expo-splash-screen dependencies"
```
(If the workspace uses a different lockfile, e.g. `package-lock.json` at the repo root instead, add that path instead — check `git status` output for which lockfile actually changed.)

---

### Task 2: Bundle PT Serif font files and the theme/fonts module

**Files:**
- Create: `apps/mobile/assets/fonts/PTSerif-Bold.ttf`
- Create: `apps/mobile/assets/fonts/PTSerif-Regular.ttf`
- Create: `apps/mobile/src/theme/fonts.ts`

**Interfaces:**
- Produces: `FONTS` (object mapping font-family name strings to `require(...)` sources, for `useFonts` in Task 3) and `CARD_RANK_FONT_FAMILY` (string constant, for `PlayingCard.tsx` in Task 4) from `apps/mobile/src/theme/fonts.ts`.

- [ ] **Step 1: Create the fonts directory and download both font files**

Run:
```bash
mkdir -p apps/mobile/assets/fonts
curl -sL -o apps/mobile/assets/fonts/PTSerif-Bold.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Bold.ttf
curl -sL -o apps/mobile/assets/fonts/PTSerif-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Regular.ttf
```
(Note: the upstream repo's actual filenames are `PT_Serif-Web-Bold.ttf`/`PT_Serif-Web-Regular.ttf` — verified via `curl -w "HTTP:%{http_code}"` returning 200 and `file` reporting real TrueType data. They are saved locally as `PTSerif-Bold.ttf`/`PTSerif-Regular.ttf` to match the `theme/fonts.ts` keys below.)
Expected: both commands exit 0.

- [ ] **Step 2: Verify both files downloaded correctly (not an HTML error page)**

Run:
```bash
file apps/mobile/assets/fonts/PTSerif-Bold.ttf apps/mobile/assets/fonts/PTSerif-Regular.ttf
```
Expected: both report as TrueType font data (e.g. `TrueType Font data`), not `ASCII text` or `HTML document` — if either shows as text/HTML, the download failed (check the URL) and must be re-fetched before continuing.

- [ ] **Step 3: Write the theme/fonts module**

Create `apps/mobile/src/theme/fonts.ts`:
```ts
export const FONTS = {
  'PTSerif-Bold': require('../../assets/fonts/PTSerif-Bold.ttf'),
  'PTSerif-Regular': require('../../assets/fonts/PTSerif-Regular.ttf'),
};

// Change this to 'PTSerif-Regular' to switch the card corner-index weight.
// Both weights are already bundled above — no other file needs to change.
export const CARD_RANK_FONT_FAMILY = 'PTSerif-Bold';
```

- [ ] **Step 4: Typecheck**

Run:
```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: no errors (the `require(...)` calls resolve because Expo/Metro's TypeScript setup already declares font-file module types via `expo/tsconfig.base` — this project's existing `courtCardArt.ts` already does the same `require('*.png')` pattern successfully, so `.ttf` requires follow the identical mechanism).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/assets/fonts/PTSerif-Bold.ttf apps/mobile/assets/fonts/PTSerif-Regular.ttf apps/mobile/src/theme/fonts.ts
git commit -m "Bundle PT Serif font files and theme/fonts module"
```

---

### Task 3: Gate app render behind font loading in App.tsx

**Files:**
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `FONTS` from `apps/mobile/src/theme/fonts.ts` (Task 2).

- [ ] **Step 1: Rewrite App.tsx with the font-loading gate**

Replace the full contents of `apps/mobile/App.tsx`:
```tsx
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { FONTS } from './src/theme/fonts';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <RootNavigator />
      <StatusBar style="auto" />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: exactly two **pre-existing** errors, unrelated to this task and already present on `master` before this branch existed:
```
src/components/PlayingCard.tsx(109,37): error TS2322: Type 'Suit | null' is not assignable to type 'Suit | undefined'.
src/components/PlayingCard.tsx(110,37): error TS2322: Type 'Suit | null' is not assignable to type 'Suit | undefined'.
```
Do not fix these — out of scope for this task. Confirm only that `App.tsx` itself introduces no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "Gate app render behind PT Serif font loading"
```

---

### Task 4: Apply PT Serif to PlayingCard's corner rank text

**Files:**
- Modify: `apps/mobile/src/components/PlayingCard.tsx`
- Test (existing, unmodified — regression check only): `apps/mobile/src/components/PlayingCard.test.tsx`

**Interfaces:**
- Consumes: `CARD_RANK_FONT_FAMILY` from `apps/mobile/src/theme/fonts.ts` (Task 2).

- [ ] **Step 1: Import the font constant**

In `apps/mobile/src/components/PlayingCard.tsx`, add near the existing imports (after the `COURT_CARD_ART` import on line 7):
```ts
import { CARD_RANK_FONT_FAMILY } from '../theme/fonts';
```

- [ ] **Step 2: Apply the font family and remove the now-redundant fontWeight**

In the `styles` `StyleSheet.create` block, change:
```ts
  cornerRankNormal: { fontSize: 24, fontWeight: 'bold', color: '#111', lineHeight: 25 },
  cornerRankSmall: { fontSize: 17, fontWeight: 'bold', color: '#111', lineHeight: 18 },
```
to:
```ts
  cornerRankNormal: { fontSize: 24, fontFamily: CARD_RANK_FONT_FAMILY, color: '#111', lineHeight: 25 },
  cornerRankSmall: { fontSize: 17, fontFamily: CARD_RANK_FONT_FAMILY, color: '#111', lineHeight: 18 },
```

- [ ] **Step 3: Run the existing PlayingCard test suite to confirm no regression**

Run:
```bash
cd apps/mobile && npx jest src/components/PlayingCard.test.tsx
```
Expected: all existing tests still PASS (this test suite asserts on rank/suit text content and testIDs, not on font family, so it should be unaffected).

- [ ] **Step 4: Run the full mobile test suite as a broader regression check**

Run:
```bash
cd apps/mobile && npx jest
```
Expected: same pass count as before this change (no new failures introduced).

- [ ] **Step 5: Typecheck both packages**

Run:
```bash
cd apps/mobile && npx tsc --noEmit
cd ../../packages/engine && npx tsc --noEmit
```
Expected: `packages/engine` has no errors. `apps/mobile` has exactly two **pre-existing** errors, unrelated to this task and already present on `master` before this branch existed:
```
src/components/PlayingCard.tsx(109,37): error TS2322: Type 'Suit | null' is not assignable to type 'Suit | undefined'.
src/components/PlayingCard.tsx(110,37): error TS2322: Type 'Suit | null' is not assignable to type 'Suit | undefined'.
```
Do not fix these — they're out of scope for this task (a `Suit | null` vs `Suit | undefined` mismatch introduced by an earlier, unrelated commit). Confirm only that no *new* errors appear beyond these two.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/PlayingCard.tsx
git commit -m "Render card corner rank text in PT Serif Bold"
```

---

### Task 5: Visual verification

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Start the web build**

Run (background):
```bash
cd apps/mobile && npx expo start --web
```
Expected: Metro bundler starts without errors and serves the web build.

- [ ] **Step 2: Screenshot the card corner index at both sizes**

Using the existing Playwright/browser screenshot workflow (system Chrome via `playwright-core`, per this project's established dev-sandbox visual verification approach — see the Pişti UI work in this repo's history for the exact script pattern), navigate to a screen showing `PlayingCard` at `size="normal"` (e.g. the Pişti table) and, separately, one showing `size="small"` if the app has a screen using it. Capture screenshots of the corner rank index.

Expected: rank text (`A`, `10`, `K`, etc.) renders in a visibly serif typeface (not the previous plain sans-serif system font) at both sizes, fully legible with no clipping, no overlapping with the suit icon, and no layout shift compared to before.

- [ ] **Step 3: Check for new console warnings/errors**

While the Playwright page is open, capture the browser console output.
Expected: no new warnings or errors beyond the pre-existing, already-documented third-party noise (e.g. `react-native-web`'s `textShadow`/`useNativeDriver` messages) — specifically, no font-loading errors and no `Failed to decode font` messages.

- [ ] **Step 4: Stop the web server**

Stop the background `expo start --web` process started in Step 1.

- [ ] **Step 5: Report results to the user**

Summarize what the screenshots show (serif rendering confirmed, no regressions) so the user can do a final visual sign-off, and note explicitly that this is browser-only verification, not a native on-device check (consistent with the standing, already-tracked native-verification gap for the rest of this project's UI work).

---

## Self-Review Notes

- **Spec coverage:** font choice (Task 2), dependencies (Task 1), font-loading gate (Task 3), `PlayingCard.tsx` changes including the `fontWeight` removal (Task 4), one-line weight-switch constant (Task 2), cross-device consistency rationale (documented in spec, mechanically delivered by Tasks 2-3's bundling approach), visual verification (Task 5) — all spec sections have a corresponding task.
- **Placeholder scan:** no TBDs; all code blocks are complete and copy-pasteable.
- **Type consistency:** `FONTS` and `CARD_RANK_FONT_FAMILY` (Task 2) are the only two exports from `theme/fonts.ts` and are consumed with matching names in Task 3 (`FONTS`) and Task 4 (`CARD_RANK_FONT_FAMILY`) — no drift.
