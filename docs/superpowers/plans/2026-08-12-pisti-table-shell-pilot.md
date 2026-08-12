# Pişti Table Shell Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Pişti's `TableFelt`/`HandFrame`(background)/`PlayerBadge`/`PlayerAvatar` table chrome with `TableShell` + `SeatIdentity` from `packages/ui`, using a new merged wood-frame+felt asset, real engine-driven turn state, and the animated turn-indicator ring.

**Architecture:** `TableShell`'s 4 seat anchors hold nameplates only (`SeatIdentity` — name/avatar/turn ring); the pile becomes `TableShell`'s `children`. Face-down opponent card stacks, `HandFrame`, and the human hand fan keep their current self-relative positioning logic, now layered around the floating `TableShell` object instead of over full-bleed felt.

**Tech Stack:** React Native (Expo), TypeScript, Jest + `@testing-library/react-native`, `sharp` (asset scripts, already a repo devDependency).

## Global Constraints

- Batak and Home are not touched by this plan — only Pişti (`apps/mobile/src/games/pisti/`) and the shared `packages/ui` components it depends on.
- `PlayerBadge`/`PlayerAvatar` are not deleted — Batak still uses both.
- `SeatIdentity`'s bare default (no `turnStateFrames` supplied) stays the plain `glowShadow` placeholder — the new ring art is passed explicitly from Pişti, not baked as `SeatIdentity`'s own global default.
- Avatar assignment is fixed by seat position: `top` → `female-01`, `left` → `male-01`, `right` → `male-02`, human (`bottom`) → `female-02`.
- New asset filenames (exact, per the spec): `packages/ui/assets/table/table-shell-surface.png`, `avatar-frame-idle.png`, `avatar-frame-next.png`, `avatar-frame-active.png`.
- Source files for the copies: `docs/references/GPT-powerful-assets-review/assets-v1/TABLE-ASSEMBLED-TRY-02-GLOW.png` and `apps/playground/assets/table-shell-versions/v1-badge-{idle,next,active}.png`.
- `REVEAL_ORIGIN_OFFSETS` (`apps/mobile/src/table/seating.ts:115-120`) may need visual re-tuning once seats move to `TableShell`'s anchors — this is a tuning pass against the running app in Task 5, not something to guess numerically in an earlier task.
- Full spec: `docs/superpowers/specs/2026-08-12-pisti-table-shell-pilot-design.md`.

---

### Task 1: `TableShell` adopts the merged table-shell-surface asset

**Files:**
- Modify: `packages/ui/src/TableShell.tsx`
- Modify: `packages/ui/src/TableShell.test.tsx`
- Create (copy): `packages/ui/assets/table/table-shell-surface.png`
- Delete: `packages/ui/assets/table/table-shell-frame.png`, `packages/ui/assets/table/felt-green-bordered-masked.png`

**Interfaces:**
- Produces: `TABLE_SHELL_ASPECT_RATIO` (updated numeric value, same export name), `TableShell` component (same props: `seats`, `tilt`, `children` — unchanged), seat anchors now positioned for the new frame's plaque bars.

- [ ] **Step 1: Copy the new asset into `packages/ui`**

```bash
cp "docs/references/GPT-powerful-assets-review/assets-v1/TABLE-ASSEMBLED-TRY-02-GLOW.png" "packages/ui/assets/table/table-shell-surface.png"
```

- [ ] **Step 2: Delete the now-unused old assets**

```bash
git rm packages/ui/assets/table/table-shell-frame.png packages/ui/assets/table/felt-green-bordered-masked.png
```

- [ ] **Step 3: Write the failing test — no more separate felt layer**

Replace the first test in `packages/ui/src/TableShell.test.tsx` (currently asserts both `table-shell-felt` and `table-shell-frame` exist):

```tsx
describe('TableShell', () => {
  it('renders the single merged surface image', async () => {
    await render(<TableShell />);
    expect(screen.getByTestId('table-shell-surface')).toBeTruthy();
    expect(screen.queryByTestId('table-shell-felt')).toBeNull();
  });
```

Leave the other four existing tests (`renders seat content only for seats that were provided`, `renders center content over the felt`, `applies no transform by default`, `applies the perspective tilt transform when tilt is true`) exactly as they are — none of them reference `table-shell-frame`/`table-shell-felt`, so they keep passing once Step 5 lands. Also fix the last test's expected perspective value, which is stale against the already-shipped tilt fix (`packages/ui/src/TableShell.tsx`'s `TILT_TRANSFORM` is `2500`, not `1400` — a pre-existing test/code mismatch unrelated to this task, but touched here since you're already editing this file):

```tsx
    expect(transformStyle.transform).toEqual([{ perspective: 2500 }, { rotateX: '20deg' }]);
```

- [ ] **Step 4: Run the test file to verify the new assertion fails**

Run: `npx jest packages/ui/src/TableShell.test.tsx`
Expected: FAIL — `getByTestId('table-shell-surface')` finds nothing yet (still `table-shell-frame`/`table-shell-felt` in the component).

- [ ] **Step 5: Update `TableShell.tsx`**

Replace the top of the file (asset requires + aspect ratio) with:

```tsx
import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

// A single pre-merged wood-frame + green-felt + ambient-glow image (source:
// docs/references/GPT-powerful-assets-review/assets-v1/TABLE-ASSEMBLED-TRY-02-GLOW.png) —
// already cleanly cut (alpha 0 outside the wood ring, ~253 inside), so unlike the frame this
// replaces, there's no separate felt layer to composite: this one image is the whole table
// surface.
const SURFACE_IMAGE = require('../assets/table/table-shell-surface.png');

// Matches table-shell-surface.png's pixel dimensions (1024x1536).
export const TABLE_SHELL_ASPECT_RATIO = 1024 / 1536;
```

Then replace `SEAT_ANCHOR_STYLE`'s definition and its comment:

```tsx
// Calibrated against table-shell-surface.png's own baked plaque-bar positions — measured by eye
// against the rendered image (see docs/superpowers/specs/2026-08-12-pisti-table-shell-pilot-design.md
// §2), the same percentages already validated in the Playground's v1 comparison tab
// (apps/playground/src/components/TableShellPreview.tsx's V1_SEAT_ANCHOR_STYLE) before this asset
// was adopted as the real default.
const SEAT_ANCHOR_STYLE: Record<TableSeatPosition, ViewStyle> = {
  top: { position: 'absolute', top: '5%', left: '31%', right: '29%', height: '4.6%' },
  bottom: { position: 'absolute', bottom: '10.5%', left: '31%', right: '29%', height: '4.9%' },
  left: { position: 'absolute', left: '7.3%', top: '34.8%', bottom: '38.2%', width: '13.7%' },
  right: { position: 'absolute', right: '7.3%', top: '34.8%', bottom: '38.2%', width: '13.7%' },
};
```

Then in `TableShellComponent`'s render, replace the two `<Image>` calls (felt then frame) with one:

```tsx
        <Image
          source={SURFACE_IMAGE}
          style={[StyleSheet.absoluteFill, styles.fill]}
          resizeMode="stretch"
          testID="table-shell-surface"
        />
```

(Keep everything else in the file — `TableSeatPosition`, `SEAT_POSITIONS`, `TableShellProps`, `TILT_TRANSFORM`, the `children`/seat-mapping JSX below the image, `React.memo` wrapper, and the `styles` object — unchanged.)

- [ ] **Step 6: Run the test file to verify it passes**

Run: `npx jest packages/ui/src/TableShell.test.tsx`
Expected: PASS, all 5 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/TableShell.tsx packages/ui/src/TableShell.test.tsx packages/ui/assets/table/table-shell-surface.png
git add packages/ui/assets/table/table-shell-frame.png packages/ui/assets/table/felt-green-bordered-masked.png
git commit -m "feat(ui): swap TableShell to the merged table-shell-surface asset"
```

---

### Task 2: `SeatIdentity` — `trickCount` → `statusText`, ship the real ring assets

**Files:**
- Modify: `packages/ui/src/SeatIdentity.tsx`
- Modify: `packages/ui/src/SeatIdentity.test.tsx`
- Create (copy): `packages/ui/assets/table/avatar-frame-idle.png`, `avatar-frame-next.png`, `avatar-frame-active.png`

**Interfaces:**
- Consumes: none new.
- Produces: `SeatIdentityProps.statusText: string` (replaces `trickCount: number`) — Task 4 passes this. `SeatIdentityTurnStateFrames` type is unchanged (already exists).

- [ ] **Step 1: Copy the ring assets**

```bash
cp apps/playground/assets/table-shell-versions/v1-badge-idle.png packages/ui/assets/table/avatar-frame-idle.png
cp apps/playground/assets/table-shell-versions/v1-badge-next.png packages/ui/assets/table/avatar-frame-next.png
cp apps/playground/assets/table-shell-versions/v1-badge-active.png packages/ui/assets/table/avatar-frame-active.png
```

- [ ] **Step 2: Write the failing test**

In `packages/ui/src/SeatIdentity.test.tsx`, replace every `trickCount={N}` prop with `statusText="N tricks"` (or an equivalent literal) and update the one assertion that checks the rendered text. The full updated file:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SeatIdentity } from './SeatIdentity';

describe('SeatIdentity', () => {
  it('renders the avatar, badge, name, and status text', async () => {
    await render(<SeatIdentity name="West AI" statusText="3 tricks" />);
    expect(screen.getByTestId('seat-identity-avatar')).toBeTruthy();
    expect(screen.getByTestId('seat-identity-badge')).toBeTruthy();
    expect(screen.getByText('West AI')).toBeTruthy();
    expect(screen.getByText('3 tricks')).toBeTruthy();
  });

  it('applies no transform for the default horizontal orientation', async () => {
    await render(<SeatIdentity name="You" statusText="0 tricks" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    expect(styleArray.some((s: any) => s != null && s.transform != null)).toBe(false);
  });

  it('rotates 90deg for rotated-left', async () => {
    await render(<SeatIdentity name="West AI" statusText="0 tricks" orientation="rotated-left" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ rotate: '90deg' }]);
  });

  it('rotates -90deg for rotated-right', async () => {
    await render(<SeatIdentity name="East AI" statusText="0 tricks" orientation="rotated-right" />);
    const node = screen.getByTestId('seat-identity');
    const styleArray = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ rotate: '-90deg' }]);
  });

  it('renders a different avatar image when the avatar prop changes', async () => {
    const { rerender } = await render(<SeatIdentity name="You" statusText="0 tricks" />);
    const defaultSource = screen.getByTestId('seat-identity-avatar-image').props.source;

    await rerender(<SeatIdentity name="You" statusText="0 tricks" avatar="female-02" />);
    const femaleSource = screen.getByTestId('seat-identity-avatar-image').props.source;

    expect(femaleSource).not.toEqual(defaultSource);
  });
});
```

- [ ] **Step 3: Run the test file to verify it fails**

Run: `npx jest packages/ui/src/SeatIdentity.test.tsx`
Expected: FAIL — `SeatIdentity` still requires `trickCount`, and even where TypeScript doesn't hard-fail the test runner, `screen.getByText('3 tricks')` won't find it since the component currently renders `` `${trickCount} tricks` `` from a prop that no longer gets passed a plain number matching the literal.

- [ ] **Step 4: Update `SeatIdentity.tsx`**

In the `SeatIdentityProps` interface, replace:

```tsx
  trickCount: number;
```

with:

```tsx
  // Caller-formatted status text (e.g. Pişti's "🂠 N" captured-card count, or "N tricks" for a
  // trick-taking game) — SeatIdentity just lays it out, matching apps/mobile's PlayerBadge
  // pattern instead of assuming trick-taking terminology.
  statusText: string;
```

In `SeatIdentityComponent`'s destructured props, replace:

```tsx
  trickCount,
```

with:

```tsx
  statusText,
```

And in the JSX, replace:

```tsx
          <Text style={[styles.trickText, { fontSize: 5.5 * scale, lineHeight: 7 * scale }]} numberOfLines={1}>
            {trickCount} tricks
          </Text>
```

with:

```tsx
          <Text style={[styles.trickText, { fontSize: 5.5 * scale, lineHeight: 7 * scale }]} numberOfLines={1}>
            {statusText}
          </Text>
```

(The `trickText` style name stays as-is — renaming it is unrelated churn.)

- [ ] **Step 5: Run the test file to verify it passes**

Run: `npx jest packages/ui/src/SeatIdentity.test.tsx`
Expected: PASS, all 5 tests.

- [ ] **Step 6: Typecheck `packages/ui`**

Run: `npx tsc --noEmit -p packages/ui`
Expected: no errors (nothing else in `packages/ui` references `trickCount`).

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/SeatIdentity.tsx packages/ui/src/SeatIdentity.test.tsx
git add packages/ui/assets/table/avatar-frame-idle.png packages/ui/assets/table/avatar-frame-next.png packages/ui/assets/table/avatar-frame-active.png
git commit -m "feat(ui): SeatIdentity takes caller-formatted statusText instead of trickCount"
```

---

### Task 3: Pişti turn-state and avatar-assignment helpers

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`
- Test: `apps/mobile/src/games/pisti/PistiTable.test.tsx`

**Interfaces:**
- Consumes: `PistiState` (`@world-cards/engine/games/pisti`) — has `players: string[]`, `currentPlayerIndex: number`.
- Produces: `turnStateForPlayer(playerId: string, state: PistiState): SeatIdentityTurnState`, `AVATAR_BY_POSITION: Record<TableSeatPosition, SeatIdentityAvatar>` — both exported from `PistiTable.tsx`, consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/games/pisti/PistiTable.test.tsx` (needs a new import alongside the existing ones):

```tsx
import { turnStateForPlayer } from './PistiTable';
```

```tsx
describe('turnStateForPlayer', () => {
  const state = makeState(0); // players: ['human', 'ai'], currentPlayerIndex: 0

  it('marks the current player active', () => {
    expect(turnStateForPlayer('human', state)).toBe('active');
  });

  it('marks the next player in turn order as next', () => {
    expect(turnStateForPlayer('ai', state)).toBe('next');
  });

  it('marks everyone else idle', () => {
    const threePlayerState = { ...state, players: ['human', 'ai', 'ai2'], currentPlayerIndex: 0 };
    expect(turnStateForPlayer('ai2', threePlayerState)).toBe('idle');
  });

  it('wraps around to the first player when the current player is last', () => {
    const lastPlayerState = { ...state, players: ['human', 'ai'], currentPlayerIndex: 1 };
    expect(turnStateForPlayer('human', lastPlayerState)).toBe('next');
  });
});
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx`
Expected: FAIL — `turnStateForPlayer` is not exported from `PistiTable.tsx` yet.

- [ ] **Step 3: Implement in `PistiTable.tsx`**

Add this import to the existing `@world-cards/ui` import block (alongside `PlayingCard`, `TableFelt`, etc. — full replacement of that import happens in Task 4, so for now just add to it):

```tsx
import type { SeatIdentityTurnState, SeatIdentityAvatar } from '@world-cards/ui';
```

Add near the top of the file, after the existing `capturedStatusText` function:

```tsx
// Real turn order from engine state, replacing the Playground prototype's clockwise-seat-order
// approximation — active/next both derive from state.players/state.currentPlayerIndex, which is
// already a plain round-robin (packages/engine/src/games/pisti/rules.ts's nextIndex derivation).
export function turnStateForPlayer(playerId: string, state: PistiState): SeatIdentityTurnState {
  if (state.players[state.currentPlayerIndex] === playerId) return 'active';
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  if (state.players[nextIndex] === playerId) return 'next';
  return 'idle';
}

// Fixed by seat position, not derived from player identity (docs/superpowers/specs/2026-08-12-
// pisti-table-shell-pilot-design.md Decision 6) — the simplest deterministic scheme.
export const AVATAR_BY_POSITION: Record<'top' | 'left' | 'right' | 'bottom', SeatIdentityAvatar> = {
  top: 'female-01',
  left: 'male-01',
  right: 'male-02',
  bottom: 'female-02',
};
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx`
Expected: PASS — the 4 new `turnStateForPlayer` tests pass; the pre-existing tests still pass too (nothing about rendering changed yet).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx apps/mobile/src/games/pisti/PistiTable.test.tsx
git commit -m "feat(pisti): add turnStateForPlayer and AVATAR_BY_POSITION helpers"
```

---

### Task 4: Split `OpponentSeat` and restructure `PistiTable`'s JSX around `TableShell`

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.tsx`

**Interfaces:**
- Consumes: `turnStateForPlayer`, `AVATAR_BY_POSITION` (Task 3); `TableShell`, `SeatIdentity`, `SeatIdentityTurnStateFrames` (`@world-cards/ui`, `SeatIdentity` props: `name`, `statusText`, `orientation?`, `avatar?`, `turnState?`, `turnStateFrames?`).
- Produces: the final rendered `PistiTable` tree, consumed by Task 5's tests/visual pass.

- [ ] **Step 1: Replace `OpponentSeat` with two pieces**

The current `OpponentSeat` function (lines 126-173) mixes nameplate rendering (the `<PlayerBadge>` call) with card-stack rendering (the face-down `PlayingCard` row/column) in one wrapping `<View>`. Split it:

```tsx
interface OpponentHandStackProps {
  seat: Seat;
  state: PistiState;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  sideStackHeight: number;
}

function OpponentHandStack({ seat, state, revealCard, dealPhase, sideStackHeight }: OpponentHandStackProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  const count = dealPhase !== 'revealing' ? 0 : Math.max(isRevealing ? hand.length - 1 : hand.length, 0);

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(SMALL_CARD_HEIGHT, count, sideStackHeight * SIDE_STACK_HEIGHT_FRACTION, SIDE_FAN_MAX_GAP)
    : fillWidthMarginPx(SMALL_CARD_WIDTH, count, windowWidth * TOP_FAN_WIDTH_FRACTION, TOP_FAN_MAX_GAP);
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0 ? undefined : isSide ? { marginTop: cardMargin } : { marginLeft: cardMargin }
      ),
    [count, cardMargin, isSide]
  );

  return (
    <View
      style={[
        styles.opponentArea,
        isSide ? seatLayoutStyles.opponentAreaSide : styles.opponentAreaTop,
      ]}>
      <View style={isSide ? styles.opponentColumn : styles.opponentRow} testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}

function renderOpponentNameplate(seat: Seat, state: PistiState, playerNames: Record<string, string>) {
  const { position, playerId } = seat;
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const orientation = position === 'left' ? 'rotated-left' : position === 'right' ? 'rotated-right' : 'horizontal';
  return (
    <SeatIdentity
      name={playerNames[playerId] ?? playerId}
      statusText={capturedStatusText(capturedCount)}
      orientation={orientation}
      avatar={AVATAR_BY_POSITION[position]}
      turnState={turnStateForPlayer(playerId, state)}
      turnStateFrames={PISTI_TURN_STATE_FRAMES}
    />
  );
}
```

This references `SeatIdentity` and `PISTI_TURN_STATE_FRAMES`, added in the next step below — both are in this same task, so there's no ordering gap to worry about (unlike the earlier draft of this plan, which split these across two tasks with no independent test boundary between them; merged here since a reviewer couldn't meaningfully approve one without the other).

- [ ] **Step 2: Update the `@world-cards/ui` import**

Replace:

```tsx
import {
  PlayingCard,
  TableFelt,
  GeminiTableBackground,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
  WOOD_TRIM_COLOR,
} from '@world-cards/ui';
```

with:

```tsx
import {
  PlayingCard,
  TableShell,
  SeatIdentity,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
  WOOD_TRIM_COLOR,
} from '@world-cards/ui';
import type { SeatIdentityTurnState, SeatIdentityAvatar, SeatIdentityTurnStateFrames } from '@world-cards/ui';
```

(This drops `TableFelt`/`GeminiTableBackground` — Pişti no longer has a separate dev-tuning background toggle; that toggle stays meaningful for Batak, which still uses `TableFelt`.)

Remove the now-unused import of `PlayerBadge`:

```tsx
import { PlayerBadge } from '../../table/PlayerBadge';
```

Remove the now-unused `devTuningStore` import and its one call site (the `devTableBackground` read) — search the file for `devTuningStore`/`devTableBackground` and delete both the import line and the `const devTableBackground = ...` line inside `PistiTable`.

- [ ] **Step 3: Add the turn-state-frames constant**

Near the top of the file, after the `@world-cards/ui` imports:

```tsx
// The real per-state ring art (idle/next/active), replacing SeatIdentity's default glowShadow
// placeholder — see docs/superpowers/specs/2026-08-12-pisti-table-shell-pilot-design.md Decision 4.
const PISTI_TURN_STATE_FRAMES: SeatIdentityTurnStateFrames = {
  idle: require('@world-cards/ui/assets/table/avatar-frame-idle.png'),
  next: require('@world-cards/ui/assets/table/avatar-frame-next.png'),
  active: require('@world-cards/ui/assets/table/avatar-frame-active.png'),
};
```

If `require` with that path doesn't resolve (Metro resolves package subpaths differently than plain Node — verify by running the app, Step 8 below), fall back to importing the images as named exports from `packages/ui/src/index.ts` instead: add

```tsx
export const AVATAR_FRAME_IDLE_IMAGE = require('../assets/table/avatar-frame-idle.png');
export const AVATAR_FRAME_NEXT_IMAGE = require('../assets/table/avatar-frame-next.png');
export const AVATAR_FRAME_ACTIVE_IMAGE = require('../assets/table/avatar-frame-active.png');
```

to `packages/ui/src/index.ts`, then in `PistiTable.tsx`:

```tsx
import { AVATAR_FRAME_IDLE_IMAGE, AVATAR_FRAME_NEXT_IMAGE, AVATAR_FRAME_ACTIVE_IMAGE } from '@world-cards/ui';

const PISTI_TURN_STATE_FRAMES: SeatIdentityTurnStateFrames = {
  idle: AVATAR_FRAME_IDLE_IMAGE,
  next: AVATAR_FRAME_NEXT_IMAGE,
  active: AVATAR_FRAME_ACTIVE_IMAGE,
};
```

Prefer the named-export fallback if there's any doubt — it matches how every other `packages/ui` image asset is already exposed to consuming apps in this codebase (grep `index.ts` for the existing pattern before deciding).

- [ ] **Step 4: Build the `seats` object for `TableShell`**

Inside `PistiTable`, after `const seats = assignSeats(opponentPlayerIds);`, add:

```tsx
  const tableShellSeats: Partial<Record<'top' | 'bottom' | 'left' | 'right', React.ReactNode>> = {
    bottom: (
      <SeatIdentity
        name={playerNames[humanPlayerId] ?? 'You'}
        statusText={capturedStatusText(capturedHuman)}
        avatar={AVATAR_BY_POSITION.bottom}
        turnState={turnStateForPlayer(humanPlayerId, state)}
        turnStateFrames={PISTI_TURN_STATE_FRAMES}
      />
    ),
  };
  for (const seat of seats) {
    tableShellSeats[seat.position] = renderOpponentNameplate(seat, state, playerNames);
  }
```

(`capturedHuman` is already computed earlier in the function — reuse it, don't recompute.)

`renderOpponentNameplate` (Step 1 above) already references `PISTI_TURN_STATE_FRAMES` by closure — it's a module-level constant defined above that function, so no signature change is needed; just confirm the file compiles once this step's constant is added.

- [ ] **Step 5: Replace the render tree**

Replace the entire `return (...)` block in `PistiTable` with:

```tsx
  return (
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      <View style={styles.tableArea}>
        <TableShell seats={tableShellSeats}>
          <View style={styles.pileMat} ref={destRef} onLayout={handlePileMatLayout}>
            <View style={styles.pileStack}>
              {stackedPile.map((card, i) => (
                <View
                  key={card.id}
                  style={[
                    styles.pileCardSlot,
                    {
                      zIndex: i,
                      transform: [
                        { translateX: PILE_CARD_OFFSETS[i].x },
                        { translateY: PILE_CARD_OFFSETS[i].y },
                        { rotate: `${pileRestingRotations[card.id] ?? 0}deg` },
                      ],
                    },
                  ]}
                >
                  <PlayingCard card={card} />
                </View>
              ))}
              {revealCard && (
                <>
                  <Text style={styles.revealLabel}>
                    {revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`}
                  </Text>
                  <View
                    style={[
                      styles.pileCardSlot,
                      {
                        zIndex: MAX_STACKED_PILE_CARDS + 1,
                        transform: [
                          { translateX: revealDestinationOffset.x },
                          { translateY: revealDestinationOffset.y },
                        ],
                      },
                    ]}
                  >
                    <TravelCard
                      originOffset={
                        revealCard.originOffset ??
                        revealOriginOffset(resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats))
                      }
                      originRotateDeg={revealCard.originRotateDeg ?? 0}
                      resetKey={revealCard.card.id}
                    >
                      <PlayingCard card={revealCard.card} highlighted />
                    </TravelCard>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.pileCount}>{`${pile.length} card${pile.length === 1 ? '' : 's'}`}</Text>
          </View>
        </TableShell>

        <OpponentSeatGroup
          position="top"
          seats={seats}
          renderSeat={(seat) => (
            <OpponentHandStack seat={seat} state={state} revealCard={revealCard} dealPhase={dealPhase} sideStackHeight={middleRowHeight} />
          )}
        />
        <View style={seatLayoutStyles.middleRow} onLayout={handleMiddleRowLayout} pointerEvents="box-none">
          <OpponentSeatGroup
            position="left"
            seats={seats}
            renderSeat={(seat) => (
              <OpponentHandStack seat={seat} state={state} revealCard={revealCard} dealPhase={dealPhase} sideStackHeight={middleRowHeight} />
            )}
          />
          <View style={styles.pileSpacer} pointerEvents="none" />
          <OpponentSeatGroup
            position="right"
            seats={seats}
            renderSeat={(seat) => (
              <OpponentHandStack seat={seat} state={state} revealCard={revealCard} dealPhase={dealPhase} sideStackHeight={middleRowHeight} />
            )}
          />
        </View>
      </View>

      <View style={styles.bannerArea}>{bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}</View>

      <HandFrame bottomOffset={handFrameBottomOffset} height={handFrameHeight} />
      <View style={styles.handArea}>
        <PistiHandFan
          slots={
            dealPhase === 'revealing'
              ? humanHand.map((card, index) => ({ card, index, count: humanHand.length }))
              : []
          }
          isHumanInteractive={isHumanInteractive}
          selectedCardId={selectedCardId}
          selectCard={selectCard}
          registerHandMotion={registerHandMotion}
          handFanRef={handFanRef}
          onHandFanLayout={handleHandFanLayout}
        />
      </View>
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
    </DeselectableSurface>
  );
```

Note what changed versus the original: `TableFelt`/`GeminiTableBackground` is gone (replaced by `TableShell` wrapping the pile); the top/left/right `OpponentSeatGroup`s now render `OpponentHandStack` (card stacks only, no badge) instead of the old combined `OpponentSeat`; a new `styles.pileSpacer` (Step 6) replaces the space the old `pileArea` occupied in the middle row, since the pile itself moved inside `TableShell`; the human's `<PlayerBadge>` call is gone from `styles.handArea` (that nameplate now lives in `tableShellSeats.bottom`).

- [ ] **Step 6: Add `styles.tableArea` and `styles.pileSpacer`; remove now-unused styles**

In the `StyleSheet.create` block, add:

```tsx
  // Wraps TableShell plus the overlaid opponent card-stacks so they share one positioning
  // context — everything in here visually belongs to "the table," even though the pile and
  // nameplates render inside TableShell while the card stacks render as siblings above it.
  tableArea: { position: 'relative' },
  // Occupies the middle row's center slot now that the pile itself lives inside TableShell as
  // its `children` — without this, middleRow's `justifyContent: 'space-between'` would pull the
  // left/right card stacks together with no gap between them.
  pileSpacer: { flex: 1 },
```

Remove the now-unused `pileArea`, `pileMat`'s old exact width/height if `TableShell`'s box changes it (verify visually in Step 8 whether `pileMat`'s existing `width: 195, height: 225` still reads correctly at the table's new proportions — resize only if it visibly overflows or looks tiny; don't guess a new value blind).

Do **not** remove `pileMat`, `pileStack`, `pileCardSlot`, `revealLabel`, `pileCount` — those are unchanged and still used inside `TableShell`'s children now.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile`
Expected: no errors. Fix any remaining references to removed imports (`TableFelt`, `GeminiTableBackground`, `PlayerBadge`, `devTuningStore`) the compiler flags — this file is large; a stray leftover reference is likely on the first pass.

- [ ] **Step 8: Run the existing test file**

Run: `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx`
Expected: the pile/opponent-hand/banner tests still pass (their assertions target `opponent-hand-${playerId}` and plain text content, both still produced identically by `OpponentHandStack`/the pile JSX). If any fail, read the failure — don't guess a fix; this is exactly the kind of regression Task 5 also checks for.

- [ ] **Step 9: Run the app and verify visually**

Start the mobile app (`cd apps/mobile && npx expo start`, or web via `--web` if faster to check in a browser) and play through a full hand: confirm `TableShell`'s surface renders, all opponent nameplates show inside its plaques with the crossfading turn ring, face-down card stacks render near their nameplates (not badly misaligned — nudge `opponentAreaTop`/`seatLayoutStyles.opponentAreaSide`/`middleRow` margins if a stack visibly floats away from its plaque), the pile sits centered inside the table, and play a card to confirm the travel animation still looks directionally correct (see Task 5 for the `REVEAL_ORIGIN_OFFSETS` tuning pass if it doesn't).

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.tsx
git commit -m "feat(pisti): pilot TableShell + SeatIdentity, real turn state, animated ring"
```

---

### Task 5: Test updates and final visual verification pass

**Files:**
- Modify: `apps/mobile/src/games/pisti/PistiTable.test.tsx`
- Possibly modify: `apps/mobile/src/table/seating.ts` (only if Step 3 below finds a real offset problem)

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: final, merged state of this plan.

- [ ] **Step 1: Add turn-state coverage at the render level**

Add to `PistiTable.test.tsx`:

```tsx
  it('gives the current player the active turn ring and the next player the next ring', async () => {
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES} onPlayCard={() => {}} dealPhase="revealing" />);
    // makeState(0): players ['human', 'ai'], currentPlayerIndex 0 — human is active, ai is next.
    const activeRings = screen.getAllByTestId('seat-identity-avatar-frame-active');
    const nextRings = screen.getAllByTestId('seat-identity-avatar-frame-next');
    expect(activeRings.length).toBeGreaterThan(0);
    expect(nextRings.length).toBeGreaterThan(0);
  });
```

This is intentionally coarse (checks the rings exist at all, not which specific seat) since `SeatIdentity` renders all three ring `testID`s simultaneously (opacity-animated, not conditionally mounted) — asserting exactly one active/next pair would require reading each `Animated.Image`'s live `opacity` style, which `Task 3`'s focused `turnStateForPlayer` unit tests already cover more precisely at the logic level. This test's job is just to catch "the wiring is completely missing" (e.g. `turnStateFrames` never passed), not to re-verify the animation math.

- [ ] **Step 2: Run the full test file**

Run: `npx jest apps/mobile/src/games/pisti/PistiTable.test.tsx`
Expected: PASS, all tests (the pre-existing 3 plus the new one).

- [ ] **Step 3: Visual pass — `REVEAL_ORIGIN_OFFSETS` tuning check**

With the app running (from Task 4 Step 9's session, or restart it), play at least 3-4 cards in both the 2-player and 4-player modes, watching each opponent's card-travel animation (deal, play, capture). If a travel animation's direction/distance now reads wrong (e.g. a card from the "left" seat travels a distance that looked right against the old full-bleed layout but overshoots or undershoots against the new floating table), adjust the specific `REVEAL_ORIGIN_OFFSETS` entry in `apps/mobile/src/table/seating.ts` (lines 115-120) — each is an independent `{x, y}` pixel delta per direction, so change only the one that looks wrong, re-run the app, and re-check. If everything already looks correct, make no changes here — this step exists to catch a problem, not to preemptively edit working code.

- [ ] **Step 4: Run the full `apps/mobile` and `packages/ui` test suites**

Run: `npx jest apps/mobile packages/ui`
Expected: PASS. This is the first full-suite run since Task 1 — confirms nothing in Batak, Home, or any other shared consumer of `TableShell`/`SeatIdentity`/`PlayerBadge` broke.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/games/pisti/PistiTable.test.tsx
# only if Step 3 changed anything:
git add apps/mobile/src/table/seating.ts
git commit -m "test(pisti): add turn-ring coverage for the TableShell pilot"
```
