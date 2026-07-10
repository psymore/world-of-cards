# Pişti Per-Seat Player Avatars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small per-seat avatar (generic silhouette icon, gold-ringed for the human seat) inline inside each existing player name/capture-count badge on the Pişti table, per the approved design spec.

**Architecture:** One new shared, low-prop, `react-native-svg`-based decorative component (`PlayerAvatar`), following the same conventions as `SuitIcon`/`TableWoodCorners` (memoized, simple SVG shapes). `PistiTable.tsx`'s existing `PlayerBadge` helper is extended to render it inline, before the name text, inside the same pill.

**Tech Stack:** React Native, TypeScript, `react-native-svg` (already a project dependency — no new packages).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-10-pisti-player-avatars-design.md`
- No new tests for this component — pure decorative UI, matches how `TableFelt`/`CardBackPattern`/`TableWoodCorners` shipped (per the project's testing policy in `CLAUDE.md`). Existing tests must still pass unchanged.
- `PlayerAvatar`'s prop is named `accent?: boolean` (generic — not `isHuman`). The component itself must have no concept of "the human player"; only its caller decides who gets the accent ring.
- Fixed size (~22dp diameter), identical across every seat type (top, side, human) — no per-seat-type sizing variation.
- Accent (gold `#ffd966`) ring applies only to the human seat, and only there — every AI seat (2-player's single opponent, or all three seats in 4-player mode) renders identically with a plain muted ring. This is a **static** "this is you" marker, independent of the existing `badgeActive` green active-turn glow — both can be true at once and must remain visually distinguishable when they are.
- Avatar renders **inline inside the existing pill**, before the name text — not stacked above it. Do not build the stacked-layout alternative; it was considered and explicitly rejected (doesn't fit the 64dp 4-player side-seat width).
- No per-AI-seat color/icon variation, no profile photos, no avatar picker.

---

### Task 1: Add `PlayerAvatar` component and wire it into `PlayerBadge`

**Files:**
- Create: `apps/mobile/src/components/PlayerAvatar.tsx`
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx` — add import (near the other component imports, currently lines 5-10); modify the `PlayerBadge` function (currently lines 76-82); modify the opponent-seat call site (currently line 102, inside `OpponentSeat`); modify the human-hand call site (currently line 234); modify the `badge` style (currently lines 247-256).

**Interfaces:**
- Produces: `export const PlayerAvatar: React.MemoExoticComponent<(props: PlayerAvatarProps) => JSX.Element>` where `interface PlayerAvatarProps { accent?: boolean }` (default `false`).
- Consumes (in `PistiTable.tsx`): nothing new from other files — `PlayerBadge` already receives everything it needs (`name`, `capturedCount`, `active`) as existing props; this task adds one more (`isHuman: boolean`) supplied directly by each call site, not threaded through any new prop on `OpponentSeatProps`/`OpponentSeatGroup` (opponents are never the human seat by construction, so that call site can pass a literal `false`).

- [ ] **Step 1: Create `PlayerAvatar.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export interface PlayerAvatarProps {
  accent?: boolean;
}

const SIZE = 22;
const GLYPH_SIZE = 14;
const ACCENT_COLOR = '#ffd966';
const MUTED_RING_COLOR = 'rgba(255, 255, 255, 0.15)';
const MUTED_GLYPH_COLOR = '#cbd5c9';

// A deliberately generic person silhouette (circle head + rounded-shoulder body) — no facial
// detail or per-player distinguishing marks, same "keep it simple at tiny render size" reasoning
// as SuitIcon/CardBackPattern. `accent` is generic, not "isHuman": this component has no concept
// of which seat is the human — the caller decides who gets the ring.
function PlayerAvatarComponent({ accent = false }: PlayerAvatarProps) {
  const ringColor = accent ? ACCENT_COLOR : MUTED_RING_COLOR;
  const glyphColor = accent ? ACCENT_COLOR : MUTED_GLYPH_COLOR;

  return (
    <View style={[styles.ring, { borderColor: ringColor }]} testID="player-avatar">
      <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
        <Circle cx={12} cy={8} r={4} fill={glyphColor} />
        <Path d="M4,20 C4,14 8,12 12,12 C16,12 20,14 20,20 Z" fill={glyphColor} />
      </Svg>
    </View>
  );
}

export const PlayerAvatar = React.memo(PlayerAvatarComponent);

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Import it in `PistiTable.tsx`**

Add next to the other component imports (after the existing `TableWoodCorners` import):

```tsx
import { TableWoodCorners } from '../../components/TableWoodCorners';
import { PlayerAvatar } from '../../components/PlayerAvatar';
```

- [ ] **Step 3: Extend `PlayerBadge` to render the avatar**

Replace the current `PlayerBadge` function:

```tsx
function PlayerBadge({ name, capturedCount, active }: { name: string; capturedCount: number; active: boolean }) {
  return (
    <View style={[styles.badge, active && styles.badgeActive]}>
      <Text style={styles.playerLabel}>{`${name} · 🂠 ${capturedCount}`}</Text>
    </View>
  );
}
```

with:

```tsx
function PlayerBadge({
  name,
  capturedCount,
  active,
  isHuman,
}: {
  name: string;
  capturedCount: number;
  active: boolean;
  isHuman: boolean;
}) {
  return (
    <View style={[styles.badge, active && styles.badgeActive]}>
      <PlayerAvatar accent={isHuman} />
      <Text style={styles.playerLabel}>{`${name} · 🂠 ${capturedCount}`}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Update the opponent-seat call site**

Inside `OpponentSeat` (the function containing `state.players[state.currentPlayerIndex] === playerId`), the current call:

```tsx
<PlayerBadge name={playerNames[playerId] ?? playerId} capturedCount={capturedCount} active={isCurrentTurn} />
```

becomes:

```tsx
<PlayerBadge name={playerNames[playerId] ?? playerId} capturedCount={capturedCount} active={isCurrentTurn} isHuman={false} />
```

(Opponents are never the human seat by construction — `opponentPlayerIds` explicitly excludes the human, per `PistiTableProps`'s existing doc comment — so this is a literal `false`, not a computed comparison.)

- [ ] **Step 5: Update the human-hand call site**

The current call (inside the `handArea` `View`, at the bottom of `PistiTable`):

```tsx
<PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} capturedCount={capturedHuman} active={isHumanTurn} />
```

becomes:

```tsx
<PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} capturedCount={capturedHuman} active={isHumanTurn} isHuman />
```

- [ ] **Step 6: Update the `badge` style to lay out as a row**

Replace:

```tsx
  badge: {
    alignSelf: 'center',
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
```

with:

```tsx
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
```

- [ ] **Step 7: Typecheck**

Run (from repo root): `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no new errors. (Pre-existing errors on `*.test.tsx` files from the tsconfig's missing `"types": ["jest"]` are a known, already-documented gap unrelated to this change — ignore those; confirm only that no error mentions `PlayerAvatar.tsx` or `PistiTable.tsx`.)

- [ ] **Step 8: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: same pass count as before this change (30 suites / 122 tests, all green, including `PistiTable.test.tsx`). No new tests are added in this task — this step only confirms nothing broke.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/components/PlayerAvatar.tsx apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "Add per-seat player avatars to Pişti table"
```

---

### Task 2: Visual verification

**Files:** none (verification-only task; no code changes expected unless the screenshot reveals a defect, in which case fix `PlayerAvatar.tsx` or the `PistiTable.tsx` badge wiring in place before committing).

**Interfaces:**
- Consumes: the running `expo start --web` dev server and the existing Playwright/system-Chrome screenshot workflow already used for the prior Pişti UI passes (per the `dev_sandbox_no_device_access` memory) — no new tooling.
- Produces: nothing consumed by later tasks; this is the last task in the plan.

- [ ] **Step 1: Start the web dev server**

Run: `npx expo start --web` from `apps/mobile`.
Expected: Metro bundles successfully, web preview reachable on localhost.

- [ ] **Step 2: Screenshot the 2-player table**

Navigate to Home → Pişti → 2-player, any difficulty → start a hand. Take a screenshot mid-hand (a few cards dealt/played).
Expected: the human's badge (bottom) shows a gold-ringed avatar; the opponent's badge (top) shows a plain-ringed avatar; both avatars render the same generic silhouette glyph; the pill still reads cleanly (no visual overlap between avatar and text); no layout shift compared to before this change.

- [ ] **Step 3: Screenshot the 4-player table**

Start a 4-player hand (free-for-all or partner mode, either is fine). Take a screenshot mid-hand.
Expected: same avatar treatment on all four seats (human gold-ringed, all three AI seats identically plain-ringed); specifically confirm the two 64dp-wide side seats (left/right) fit the avatar + name + capture-count text inside the pill without truncation, wrapping, or overflow outside the seat's column.

- [ ] **Step 4: Screenshot the human's active turn**

Advance the game (or start a fresh hand where it's the human's turn first) and screenshot the human's badge specifically while it's their turn.
Expected: the gold avatar ring and the green `badgeActive` glow are both visible simultaneously and are clearly distinguishable from each other (one on the small avatar circle, one on the pill's border/glow) — neither obscures the other.

- [ ] **Step 5: Check the browser console**

Expected: no new warnings attributable to `PlayerAvatar`/the badge change (in particular, no `props.pointerEvents is deprecated` warning — this component doesn't use `pointerEvents` at all, so none should appear; confirm rather than assume).

- [ ] **Step 6: Fix forward if anything looks wrong**

If the side-seat pill overflows/truncates: the fix is likely reducing `GLYPH_SIZE`/`SIZE` in `PlayerAvatar.tsx` slightly, or reducing `styles.badge`'s `paddingHorizontal`/`gap` in `PistiTable.tsx` — re-screenshot to confirm before proceeding. If the gold ring and green glow are hard to tell apart, that's a finding to report back rather than silently redesigning the color scheme (the spec's color choices are fixed; a genuine conflict here means escalating, not improvising a new palette).

- [ ] **Step 7: Commit if any fix was needed**

```bash
git add apps/mobile/src/components/PlayerAvatar.tsx apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "Fix player avatar sizing/layout"
```

(Skip this step if Step 6 required no changes — nothing to commit.)
