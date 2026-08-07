# Home + Setup Screens: Unified Emerald Felt Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace HomeScreen's purple-marquee background and the Pişti/Batak setup screens' flat navy background with the existing `TableFelt` component (the same emerald felt texture the in-game tables already use), and restyle the setup screens' option boxes from opaque navy to translucent glass, unifying Home → Setup → Table under one visual identity.

**Architecture:** No new components, no new assets. `TableFelt` (from `@world-cards/ui`) is rendered as the first child of each screen's root container, exactly the pattern `PistiTable.tsx`/`BatakTable.tsx` already use for the in-game table. Two files that only served the old purple identity (`HomeBackground.tsx`, `BaizeStrip.tsx`) are deleted outright rather than left dead. Setup-screen option-box styles get their color values changed in place — no structural change.

**Tech Stack:** React Native, TypeScript, `@world-cards/ui` (existing `TableFelt` component), Jest + React Native Testing Library (`jest-expo` preset) for regression checks only — no new tests, per the repo's standing testing policy.

## Global Constraints

- Per `docs/governance/engineering-principles.md` §4 (testing policy, supersedes general TDD default): do **not** write new tests proactively for this decorative/presentational work. Existing tests must still be run and kept green.
- Per the approved spec (`docs/superpowers/specs/2026-08-07-home-setup-emerald-felt-design.md`): no new image assets, no changes to `GeminiTableBackground`, no changes to the in-game tables (`PistiTable.tsx`/`BatakTable.tsx`), no changes to the hero-card entrance animation.
- Work happens on the existing branch `ui/home-setup-emerald-felt`. **Commit locally per task, on this branch only** — nothing gets pushed or merged to `master` until the user reviews and says so. This resolves an earlier ambiguity: the user's original "don't commit" instruction was about not pushing/merging without review, not about avoiding commits entirely — confirmed 2026-08-07 when the subagent-driven-development workflow's need for per-task commits (review packaging, ledger, fix-loop all diff between commit SHAs) was surfaced as a conflict. Each task's "stop for review" step below means: commit is fine, just don't push/merge.
- Exact color values are specified per-task below — do not invent new ones.

---

### Task 1: HomeScreen — swap background to TableFelt, delete now-redundant decoration

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Delete: `apps/mobile/src/screens/home/HomeBackground.tsx`
- Delete: `apps/mobile/src/screens/home/BaizeStrip.tsx`
- Test (regression only, no new tests): `apps/mobile/src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `TableFelt` exported from `@world-cards/ui` (`export { TableFelt } from './TableFelt';` in `packages/ui/src/index.ts:5`) — a zero-prop `React.memo` component that renders a full-bleed, `pointerEvents: 'none'` felt image via `AbsoluteOverlay`.
- Produces: nothing new consumed elsewhere — `HomeBackground` and `BaizeStrip` have no other importers (confirmed: only `HomeScreen.tsx` imports either).

- [ ] **Step 1: Confirm no other file imports `HomeBackground` or `BaizeStrip`**

Run: `grep -rn "HomeBackground\|BaizeStrip" apps/mobile/src --include=*.tsx --include=*.ts`
Expected: only `apps/mobile/src/screens/HomeScreen.tsx` (the two import lines) and the two component files themselves. If anything else shows up, stop and re-scope this task before deleting.

- [ ] **Step 2: Edit `HomeScreen.tsx` to use `TableFelt` and drop the deleted imports**

Replace the full file contents of `apps/mobile/src/screens/HomeScreen.tsx` with:

```tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getGames } from '@world-cards/engine';
import { TableFelt } from '@world-cards/ui';
import { HeroCard } from './home/HeroCard';
import { HomeWordmark } from './home/HomeWordmark';
import { GameMenuRow } from './home/GameMenuRow';

export interface HomeScreenProps {
  onSelectGame: (gameId: string) => void;
}

export function HomeScreen({ onSelectGame }: HomeScreenProps) {
  const games = getGames();
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
                entranceDelayMs={index * 60}
                testID={`game-menu-row-${game.id}`}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a2e1f' },
  content: { flexGrow: 1, paddingTop: 48, paddingBottom: 40 },
  menu: { paddingHorizontal: 22, marginTop: 20, gap: 12 },
  empty: { fontSize: 14, color: '#f2e6ff88', textAlign: 'center', marginTop: 20 },
});
```

Note: `container.backgroundColor` changes from `#1a0f2e` (purple) to `#0a2e1f` (dark emerald) — this is just the fallback color visible for a frame before `TableFelt`'s image paints; it should be close to the felt image's darkest edge tone, not pure black.

- [ ] **Step 3: Delete the two now-unused files**

```bash
rm apps/mobile/src/screens/home/HomeBackground.tsx
rm apps/mobile/src/screens/home/BaizeStrip.tsx
```

- [ ] **Step 4: Run HomeScreen's existing tests to confirm no regression**

Run: `npx jest apps/mobile/src/screens/HomeScreen.test.tsx`
Expected: both existing tests pass unmodified (`'World Cards'` text and `'No games installed yet'` / tap-to-select assertions don't reference background markup or colors).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx
git rm apps/mobile/src/screens/home/HomeBackground.tsx apps/mobile/src/screens/home/BaizeStrip.tsx
git commit -m "feat(mobile): swap HomeScreen background to the shared emerald TableFelt"
```

Do not push, do not merge — local commit on `ui/home-setup-emerald-felt` only.

---

### Task 2: PistiSetupView — swap background to TableFelt, restyle option boxes to glass

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiSetupView.tsx`
- Test (regression only, no new tests): `apps/mobile/src/games/pisti/PistiSetupView.test.tsx`

**Interfaces:**
- Consumes: `TableFelt` from `@world-cards/ui`, same as Task 1.
- Produces: nothing consumed by later tasks — Task 3 (Batak) makes the analogous but independent change to a different file.

- [ ] **Step 1: Edit `PistiSetupView.tsx`**

Add `TableFelt` to the existing `@world-cards/ui` import (it currently only imports `PressableFeedback`):

```tsx
import { PressableFeedback, TableFelt } from '@world-cards/ui';
```

Render `<TableFelt />` as the first child inside the root `View`, immediately before `styles.header`:

```tsx
  return (
    <View style={styles.container}>
      <TableFelt />
      <View style={styles.header}>
```

Update the `styles` object: remove the flat navy background, and change `option`/`playerCountOption`/`optionDefault` to the glass values. Replace the full `styles` block with:

```tsx
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#0a2e1f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  backLink: { fontSize: 15, fontWeight: '600', color: '#cbb98a' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center', color: '#f5f0e6' },
  option: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#f4c542', backgroundColor: 'rgba(244, 197, 66, 0.2)' },
  optionText: { fontSize: 18, color: '#eee' },
  defaultBadge: { fontSize: 12, color: '#f4c542', marginTop: 2 },
  playerCountRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  playerCountOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
```

Note: `playerCountOption` doesn't currently have its own "selected" style — the existing code applies `optionDefault` (renamed meaning aside, same object) to it via `[styles.playerCountOption, value === playerCount && styles.optionDefault]`, so it already picks up the new glass-selected look for free. No JSX logic changes, only the `styles` object.

- [ ] **Step 2: Run PistiSetupView's existing tests to confirm no regression**

Run: `npx jest apps/mobile/src/games/pisti/PistiSetupView.test.tsx`
Expected: all three existing tests pass unmodified (they assert on text content and `onStart`/store calls, not colors).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiSetupView.tsx
git commit -m "feat(pisti): give the setup screen the shared emerald felt background"
```

Do not push, do not merge — local commit on `ui/home-setup-emerald-felt` only.

---

### Task 3: BatakSetupView — swap background to TableFelt, restyle option boxes to glass

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakSetupView.tsx`

**Interfaces:**
- Consumes: `TableFelt` from `@world-cards/ui`, same as Tasks 1–2.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Edit `BatakSetupView.tsx`**

Add `TableFelt` to the existing `@world-cards/ui` import:

```tsx
import { PressableFeedback, TableFelt } from '@world-cards/ui';
```

Render `<TableFelt />` as the first child inside the root `View`, immediately before `styles.header`:

```tsx
  return (
    <View style={styles.container}>
      <TableFelt />
      <View style={styles.header}>
```

Replace the full `styles` block with:

```tsx
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#0a2e1f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  backLink: { fontSize: 15, fontWeight: '600', color: '#cbb98a' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 16, marginTop: 8, textAlign: 'center', color: '#f5f0e6' },
  option: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#f4c542', backgroundColor: 'rgba(244, 197, 66, 0.2)' },
  optionText: { fontSize: 18, color: '#eee' },
  variantDescription: { fontSize: 13, color: '#cbb98a', marginTop: 2 },
  defaultBadge: { fontSize: 12, color: '#f4c542', marginTop: 2 },
});
```

- [ ] **Step 2: Confirm there is no existing test file to regress**

Run: `find apps/mobile/src/games/batak -iname "BatakSetupView.test.tsx"`
Expected: no output (confirmed during planning — there is no such file today). If one now exists, run it and confirm it passes before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/games/batak/BatakSetupView.tsx
git commit -m "feat(batak): give the setup screen the shared emerald felt background"
```

Do not push, do not merge — local commit on `ui/home-setup-emerald-felt` only.

---

### Task 4: Documentation — record the decision reversal and close the deferred sub-project

**Files:**
- Modify: `docs/domains/ui-visual-system/decisions.md`
- Modify: `docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md`

**Interfaces:** None — documentation only, no code interfaces.

- [ ] **Step 1: Append a new decision entry to `decisions.md`**

Add this section at the end of `docs/domains/ui-visual-system/decisions.md` (after the existing "Entrance animation used the full Constitution audit process..." section):

```markdown

## Home + Setup screens unified under one emerald-felt identity, superseding the marquee decision

**Decision:** the 2026-07-30 decision giving HomeScreen its own distinct purple-marquee identity (separate from the in-game felt/wood table) is superseded. As of 2026-08-07, Home and the Pişti/Batak setup screens share the same `TableFelt` background the in-game tables already use, and the setup screens' option boxes were restyled from opaque navy to translucent glass to sit correctly on felt. Full reasoning and the concept-exploration process: `docs/superpowers/specs/2026-08-07-home-setup-emerald-felt-design.md`.

**Why:** confirmed with the user via the brainstorming visual companion, choosing "unify" over "keep Home's marquee, reskin Setup only" when shown both side by side. The setup screens had no background identity at all (flat `#12121f`, a gap left open by the 2026-07-30 spec's sub-project 4). Giving Setup its own separate look would have produced three competing identities (Home / Setup / Table) instead of resolving to one — unifying reads as "already at the table" from app open, not "menu, then setup, then table." No new image assets were generated or sourced for this: the existing `TableFelt` component's photo texture already matched the desired mood.
```

- [ ] **Step 2: Mark sub-project 4 resolved in the prior spec**

In `docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md`, find this line near the top (in the "Sub-project 2 of 4" context paragraph):

```
**Sub-project 2 of 4** in the "UI review pass" decomposed 2026-07-30: (1) gear-icon investigation — closed, Expo Go dev-menu quirk, no code change; (2) **this spec**; (3) illustrated court-card art (deferred, one card sourced early as a dependency of this spec — see below); (4) cross-table visual consistency pass (not started; will also pick up the "only Batak has a settings icon" asymmetry noted during (1)).
```

Replace only clause (4) so the line reads:

```
**Sub-project 2 of 4** in the "UI review pass" decomposed 2026-07-30: (1) gear-icon investigation — closed, Expo Go dev-menu quirk, no code change; (2) **this spec**; (3) illustrated court-card art (deferred, one card sourced early as a dependency of this spec — see below); (4) cross-table visual consistency pass — resolved 2026-08-07 by unifying Home's background with the setup screens, see `docs/superpowers/specs/2026-08-07-home-setup-emerald-felt-design.md` (the "only Batak has a settings icon" asymmetry noted during (1) remains open, not part of that resolution).
```

- [ ] **Step 3: Commit**

```bash
git add docs/domains/ui-visual-system/decisions.md docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md
git commit -m "docs(ui): record the Home/Setup emerald-felt identity reversal"
```

Do not push, do not merge — local commit on `ui/home-setup-emerald-felt` only. Report a summary of all four tasks' combined diff and hand back to the user for on-device visual verification (per standing practice, this repo has no automated way to verify decorative UI actually looks right — the user checks on-device).

---

## Self-Review Notes (for whoever executes this plan)

- Task ordering is independent per-file except Task 4, which references specs produced by the earlier design step (already written, not part of this plan's tasks).
- No task introduces a new shared component — matches the spec's explicit call to keep the pre-existing per-screen style duplication rather than extracting one for a two-color-value change.
- `GeminiTableBackground`, `PistiTable.tsx`, `BatakTable.tsx`, and the hero-card animation are not touched by any task, matching the spec's "explicitly out of scope" list.
