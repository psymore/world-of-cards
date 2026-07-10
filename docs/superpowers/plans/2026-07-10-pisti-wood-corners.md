# Pişti Wood-Grain Corner Accents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a decorative wood-grain corner accent (four quarter-circle wedges with a gold trim line) to the Pişti table, per the approved design spec.

**Architecture:** One new shared, zero-prop, `react-native-svg`-based decorative component (`TableWoodCorners`), following the exact pattern already established by `TableFelt`/`CardBackPattern`/`SuitIcon` (memoized, wrapped in the existing `AbsoluteOverlay`), wired into `PistiTable.tsx` next to the existing `<TableFelt />`.

**Tech Stack:** React Native, TypeScript, `react-native-svg` (already a project dependency — no new packages).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-10-pisti-wood-corners-design.md`
- No new tests for this component — pure decorative UI, matches how `TableFelt`/`CardBackPattern` shipped (per the project's testing policy in `CLAUDE.md`). Existing tests must still pass unchanged.
- Fixed pixel sizing (56dp wedges), not percentage/container-relative.
- Wood tone: dark mahogany (`#5c2a1e` → `#331209` gradient), gold trim `#ffd966`, matching the brainstormed mockup the user approved.
- No variant prop for the deferred full-frame/rail-only styles — do not build that abstraction.
- Must render behind all game content (same z-order rule as `TableFelt`) and work identically for both the 2-player and 4-player table layouts.

---

### Task 1: Add `TableWoodCorners` component

**Files:**
- Create: `apps/mobile/src/components/TableWoodCorners.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx:1-10` (imports), `apps/mobile/src/games/pisti/PistiTable.tsx:174-177` (render `<TableWoodCorners />` alongside `<TableFelt />`)

**Interfaces:**
- Consumes: `AbsoluteOverlay` from `apps/mobile/src/components/AbsoluteOverlay.tsx` (existing, no changes) — `export function AbsoluteOverlay({ children }: { children: React.ReactNode })`.
- Produces: `export const TableWoodCorners: React.MemoExoticComponent<() => JSX.Element>` — a zero-prop component, same call shape as `TableFelt` (`<TableWoodCorners />`).

- [ ] **Step 1: Create `TableWoodCorners.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Pattern, Stop } from 'react-native-svg';
import { AbsoluteOverlay } from './AbsoluteOverlay';

const WEDGE_SIZE = 56;
const TRIM_COLOR = '#ffd966';
const WOOD_LIGHT = '#5c2a1e';
const WOOD_DARK = '#331209';
const GRAIN_COLOR = '#ffab6b';

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface WedgeGeometry {
  fillPath: string;
  trimPath: string;
  positionStyle: { top?: number; bottom?: number; left?: number; right?: number };
}

const S = WEDGE_SIZE;

// Each wedge is a quarter-disc pie slice centered on the box's own outer corner (radius S),
// matching the CSS border-radius corner shape from the brainstormed mockup (see
// docs/superpowers/specs/2026-07-10-pisti-wood-corners-design.md). trimPath draws just the
// curved boundary (no straight radius lines) for the gold edge accent.
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

function Wedge({ corner }: { corner: Corner }) {
  const { fillPath, trimPath, positionStyle } = WEDGE_GEOMETRY[corner];
  const gradId = `woodGradient-${corner}`;
  const grainId = `woodGrain-${corner}`;
  return (
    <View style={[styles.wedgeWrap, positionStyle]} testID={`wood-corner-${corner}`}>
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={WOOD_LIGHT} />
            <Stop offset="100%" stopColor={WOOD_DARK} />
          </LinearGradient>
          <Pattern id={grainId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <Line x1={0} y1={0} x2={0} y2={6} stroke={GRAIN_COLOR} strokeOpacity={0.1} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Path d={fillPath} fill={`url(#${gradId})`} />
        <Path d={fillPath} fill={`url(#${grainId})`} />
        <Path d={trimPath} fill="none" stroke={TRIM_COLOR} strokeOpacity={0.85} strokeWidth={2} />
      </Svg>
    </View>
  );
}

// Zero props, output never changes — memoize so it paints once and is never redone by the
// move-by-move re-renders that drive the rest of the table, same rule as TableFelt.
function TableWoodCornersComponent() {
  return (
    <AbsoluteOverlay>
      {CORNERS.map((corner) => (
        <Wedge key={corner} corner={corner} />
      ))}
    </AbsoluteOverlay>
  );
}

export const TableWoodCorners = React.memo(TableWoodCornersComponent);

const styles = StyleSheet.create({
  wedgeWrap: { position: 'absolute', width: S, height: S },
});
```

- [ ] **Step 2: Wire it into `PistiTable.tsx`**

In `apps/mobile/src/games/pisti/PistiTable.tsx`, add the import next to the existing `TableFelt` import (currently line 8):

```tsx
import { TableFelt } from '../../components/TableFelt';
import { TableWoodCorners } from '../../components/TableWoodCorners';
```

Then render it immediately after `<TableFelt />` inside the container (currently line 176):

```tsx
    <View style={styles.container}>
      <TableFelt />
      <TableWoodCorners />
      <OpponentSeatGroup position="top" seats={seats} state={state} playerNames={playerNames} revealCard={revealCard} />
```

- [ ] **Step 3: Typecheck**

Run (from repo root): `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no new errors. (Pre-existing errors on `*.test.tsx` files from the tsconfig's missing `"types": ["jest"]` are a known, already-documented gap unrelated to this change — ignore those; confirm only that no error mentions `TableWoodCorners.tsx` or `PistiTable.tsx`.)

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: same pass count as before this change (all suites green, including `PistiTable.test.tsx`, `PistiScreen.test.tsx`, the engine's `simulateGames`-based suites). No new tests are added in this task — this step only confirms nothing broke.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/TableWoodCorners.tsx apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "Add wood-grain corner accents to Pişti table"
```

---

### Task 2: Visual verification

**Files:** none (verification-only task; no code changes expected unless the screenshot reveals a defect, in which case fix `TableWoodCorners.tsx` in place before committing).

**Interfaces:**
- Consumes: the running `expo start --web` dev server and the existing Playwright/system-Chrome screenshot workflow already used for prior Pişti UI passes (per the `dev_sandbox_no_device_access` memory) — no new tooling.
- Produces: nothing consumed by later tasks; this is the last task in the plan.

- [ ] **Step 1: Start the web dev server**

Run: `npx expo start --web` from `apps/mobile` (background it or use whatever process the prior UI passes used).
Expected: Metro bundles successfully, web preview reachable on localhost.

- [ ] **Step 2: Screenshot the 2-player table**

Navigate to Home → Pişti → 2-player, any difficulty → start a hand. Take a screenshot of the table mid-hand (a few cards dealt/played so the pile and hands aren't empty).
Expected: four dark-mahogany wedges visible in the screen corners, each with a visible thin gold curved trim line; wedges look convex (bulging outward, pie-slice shape) — **not** concave/notched. Cards, badges, and pile render unchanged and unobstructed.

- [ ] **Step 3: Screenshot the 4-player table**

Start a 4-player hand (free-for-all or partner mode, either is fine — the corners don't depend on seating).
Expected: same four-corner wedge rendering, no overlap with the side-seat card stacks, no layout shift compared to before this change.

- [ ] **Step 4: Check the browser console**

Expected: no new warnings — specifically confirm no `props.pointerEvents is deprecated` warning (the component uses `AbsoluteOverlay`, which already uses `style.pointerEvents`, so this should be clean by construction, but confirm rather than assume).

- [ ] **Step 5: Fix forward if anything looks wrong**

If any wedge renders concave instead of convex (arc bulging toward the center instead of away from it), the fix is flipping that corner's `sweep` flag (the `0 0 <sweep>` value in the affected `fillPath`/`trimPath` in `WEDGE_GEOMETRY`) from `0` to `1` or vice versa in `TableWoodCorners.tsx`. Re-screenshot to confirm before proceeding.

- [ ] **Step 6: Commit if any fix was needed**

```bash
git add apps/mobile/src/components/TableWoodCorners.tsx
git commit -m "Fix wood corner wedge arc direction"
```

(Skip this step if Step 5 required no changes — nothing to commit.)
