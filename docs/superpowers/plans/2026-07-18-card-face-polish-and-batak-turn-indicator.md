# Card Face Polish + Batak Turn Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Q/K/J court-card decorative frame to the corner index's suit-glyph center, redesign the spade/club `SuitIcon` glyphs to match user-supplied reference photos, and simplify Batak's turn indicator to rely solely on the existing glowing player badge.

**Architecture:** Three independent, presentation-only edits — two in the shared `packages/ui` package (consumed by both `apps/mobile` and `apps/playground`), one in `apps/mobile/src/games/batak`. No shared code between the three tasks; no engine or game-logic changes.

**Tech Stack:** React Native, `react-native-svg`, TypeScript, Jest (existing suites only — see Global Constraints).

## Global Constraints

- **No new automated tests.** Per this project's standing 2026-07-07 testing policy, decorative/presentational mobile UI changes do not get new tests written proactively — every task in this plan instead re-runs the *existing* suite and a typecheck to catch regressions. This supersedes the TDD default this skill normally assumes.
- **No proactive screenshot/visual verification.** Per the user's explicit 2026-07-17 direction, do not launch the browser/Playwright visual-verification workflow unless the user asks for it in this session.
- **Pişti is out of scope.** Do not touch anything under `apps/mobile/src/games/pisti/` in this plan — the Batak turn-indicator change (Task 3) is explicitly Batak-only, per the design spec.
- **Hearts/diamonds are out of scope.** Task 2 only touches the spade and club paths in `SuitIcon.tsx`.

---

### Task 1: Align the court-card frame to the suit-glyph center

**Files:**
- Modify: `packages/ui/src/CourtCardFrame.tsx:29-44` (the `GEOMETRY` table)

**Interfaces:**
- Consumes: nothing new — `CourtCardFrame` keeps its existing `{ size: PlayingCardSize }` prop and rendering logic unchanged; only the coordinate data changes.
- Produces: nothing new — no other file imports from `CourtCardFrame.tsx` beyond the existing `CourtCardFrame` component export, which keeps its current signature.

**Background:** The two bracket paths currently start their horizontal segments at a fixed edge-inset (17px/11px) instead of the corner index's actual suit-glyph vertical center. Per the approved design spec (`docs/superpowers/specs/2026-07-18-card-face-polish-and-batak-turn-indicator-design.md`), that center is 37px from the top/bottom edge at `normal` size and 26px at `small` size, computed from `PlayingCard.tsx`'s corner-index layout constants. Only the y-coordinate of each bracket's horizontal segment changes (and the y at the two endpoints touching it) — x-coordinates and the vertical segments' far endpoints are unchanged, since their clearance from the corner-index boxes doesn't depend on this y-value.

- [ ] **Step 1: Update the `normal` size geometry**

In `packages/ui/src/CourtCardFrame.tsx`, inside the `GEOMETRY` object's `normal` entry, change:

```ts
    topRightBracket: 'M32.5,17 L82,17 L82,83.5',
    bottomLeftBracket: 'M12,48.5 L12,115 L61.5,115',
```

to:

```ts
    // Horizontal segments sit at y=37 (top) / y=95 (bottom) — the corner index's suit-glyph
    // vertical center at this size (top:1 + rank lineHeight 25 + gap 2 + suitIcon 18/2 = 37;
    // mirrored corner is symmetric at cardHeight(132)-37=95), not an arbitrary edge inset.
    // See docs/superpowers/specs/2026-07-18-card-face-polish-and-batak-turn-indicator-design.md.
    topRightBracket: 'M32.5,37 L82,37 L82,83.5',
    bottomLeftBracket: 'M12,48.5 L12,95 L61.5,95',
```

- [ ] **Step 2: Update the `small` size geometry**

In the same `GEOMETRY` object's `small` entry, change:

```ts
    topRightBracket: 'M22,11 L56,11 L56,52',
    bottomLeftBracket: 'M8,34 L8,75 L42,75',
```

to:

```ts
    // Suit-glyph vertical center at this size: top:1 + rank lineHeight 18 + gap 1 + suitIcon
    // 12/2 = 26; mirrored corner is symmetric at cardHeight(86)-26=60.
    topRightBracket: 'M22,26 L56,26 L56,52',
    bottomLeftBracket: 'M8,34 L8,60 L42,60',
```

- [ ] **Step 3: Typecheck the `ui` package**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors (this is a data-only change to a `Record<PlayingCardSize, FrameGeometry>` literal — the shape is unchanged, only string values changed).

- [ ] **Step 4: Run the existing test suite for regressions**

Run: `npx jest`
Expected: same pass count as before this change (this component has no dedicated test file today, so this step is confirming no other suite broke — e.g. any `PlayingCard`/court-card-art snapshot or rendering test).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/CourtCardFrame.tsx
git commit -m "fix(ui): align court-card frame to corner index's suit-glyph center"
```

---

### Task 2: Redesign the spade and club `SuitIcon` glyphs

**Files:**
- Modify: `packages/ui/src/SuitIcon.tsx:24-51` (the `SPADE_PATH` constant and the club's `<G>` JSX block)

**Interfaces:**
- Consumes: nothing new — `SuitIcon` keeps its existing `{ suit, size, color, opacity?, testID? }` prop signature.
- Produces: nothing new — every consumer (`PlayingCard`'s corner index and center watermark, Batak's trump-selection buttons and trick-center trump indicator, `apps/playground`) renders through the same `SuitIcon` component and needs no changes.

**Background:** Both shapes are replaced with the final geometry approved during brainstorming (recorded in the design spec) — a convex spade leaf + separate flared stem (removing the current concave "waist"), and a club built from three overlapping circles at a larger radius that closes the gap on its own, removing the current white punched-out center hole.

- [ ] **Step 1: Replace the spade path**

In `packages/ui/src/SuitIcon.tsx`, change:

```ts
// Same waist treatment as the heart, mirrored above the stem.
const SPADE_PATH =
  'M12,2 C13.5,8 22,11 21,14.5 C21,17.5 18.5,20 15.5,20 C14.1,20 12.85,19.3 12,18.2 C12.4,19.6 13.3,20.8 14.5,21.5 C14.9,21.7 14.7,22 14.3,22 L9.7,22 C9.3,22 9.1,21.7 9.5,21.5 C10.7,20.8 11.6,19.6 12,18.2 C11.15,19.3 9.9,20 8.5,20 C5.5,20 3,17.5 3,14.5 C2,11 10.5,8 12,2 Z';
```

to:

```ts
// Classic convex pip (no concave waist) matching the user-supplied reference photo at
// docs/references/card-art/SPADE.jpeg — see the 2026-07-18 design spec for the brainstorming
// history (this was the first candidate shown, confirmed after later "wider base" and "traced
// from a hand sketch" alternatives were both tried and rejected in its favor). Leaf and stem
// are two separate paths so the stem's flare can be tuned independently of the leaf curve.
const SPADE_PATH =
  'M12,1.5 C7.5,7 2,10.8 2,15 C2,18.6 4.9,21.2 8.2,21.2 C10,21.2 11.4,20.3 12,18.8 C12.6,20.3 14,21.2 15.8,21.2 C19.1,21.2 22,18.6 22,15 C22,10.8 16.5,7 12,1.5 Z';
const SPADE_STEM_PATH =
  'M9.3,22.7 C10.7,21.5 11.6,20 12,18.3 C12.4,20 13.3,21.5 14.7,22.7 C15,23 14.8,23.4 14.3,23.4 L9.7,23.4 C9.2,23.4 9,23 9.3,22.7 Z';
```

- [ ] **Step 2: Render the new spade as two paths**

Find this line in the component body:

```tsx
      {suit === 'spades' && <Path d={SPADE_PATH} fill={color} />}
```

Replace it with:

```tsx
      {suit === 'spades' && (
        <>
          <Path d={SPADE_PATH} fill={color} />
          <Path d={SPADE_STEM_PATH} fill={color} />
        </>
      )}
```

- [ ] **Step 3: Widen the club circles and drop the center hole**

Find this block:

```tsx
      {suit === 'clubs' && (
        <G>
          <Circle cx={12} cy={6} r={4.6} fill={color} />
          <Circle cx={7.67} cy={13.5} r={4.6} fill={color} />
          <Circle cx={16.33} cy={13.5} r={4.6} fill={color} />
          <Path d={CLUB_STEM_PATH} fill={color} />
          <Circle cx={CLUB_CENTER_HOLE.cx} cy={CLUB_CENTER_HOLE.cy} r={CLUB_CENTER_HOLE.r} fill="#ffffff" />
        </G>
      )}
```

Replace it with:

```tsx
      {suit === 'clubs' && (
        <G>
          <Circle cx={12} cy={6.3} r={5.3} fill={color} />
          <Circle cx={7.4} cy={14} r={5.3} fill={color} />
          <Circle cx={16.6} cy={14} r={5.3} fill={color} />
          <Path d={CLUB_STEM_PATH} fill={color} />
        </G>
      )}
```

- [ ] **Step 4: Remove the now-unused center-hole constant and comment**

Find and delete this whole block (the constant is no longer referenced anywhere after Step 3):

```ts
// The three lobes sit at true equilateral spacing (each circle's center is the same distance from
// the shape's center, and none individually reaches it), so a real gap opens up on its own. The
// small white circle at the center punches that gap open further, guaranteeing it stays visible
// even at the corner index's smallest render size — this assumes a white/light card face behind
// the icon, true everywhere SuitIcon is used today.
const CLUB_CENTER_HOLE = { cx: 12, cy: 11, r: 1.4 };
```

- [ ] **Step 5: Typecheck the `ui` package**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors. (If `Circle` or `G` show as unused-import errors, they won't — both are still used by the club block and, for `G`, only by clubs as before.)

- [ ] **Step 6: Run the existing test suite for regressions**

Run: `npx jest`
Expected: same pass count as before. `PlayingCard.test.tsx` queries suit icons by `corner-suit-<suit>`/`corner-suit-mirror-<suit>` testID (per `CLAUDE.md`'s history), not by path shape, so this change should not break it — confirm the run shows no new failures.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/SuitIcon.tsx
git commit -m "feat(ui): redesign spade/club glyphs to match reference photos"
```

---

### Task 3: Simplify Batak's turn indicator

**Files:**
- Modify: `apps/mobile/src/games/batak/BatakTable.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BatakTable`'s exported props (`BatakTableProps`) are unchanged — this is purely internal simplification. No other file imports `OpponentSeat`, `OpponentSeatGroup`, or any of the removed constants directly (they're all module-private to this file), so no other file needs changes.

**Background:** Removes the gold `activeArea` background wash and the face-down opponent card-stack rendering, per the design spec's item 3. The existing green-glow `PlayerBadge`/`badgeActive` styling already reflects whose turn it is (via the same `isCurrentTurn`/`isHumanTurn` booleans) and needs no changes — it becomes the sole turn indicator. This task also removes the code that only existed to lay out and size the now-deleted face-down card stacks (dead-code cleanup implied by the removal, called out explicitly in the design spec).

- [ ] **Step 1: Simplify `OpponentSeat` to render only the badge**

Find the `OpponentSeatProps` interface and `OpponentSeat` function:

```tsx
interface OpponentSeatProps {
  seat: Seat;
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  // Measured height of the middle row (see BatakTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentSeat({
  seat,
  state,
  playerNames,
  pendingPlay,
  sideStackHeight,
}: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isPending = pendingPlay != null && pendingPlay.playerId === playerId;
  const count = Math.max(isPending ? hand.length - 1 : hand.length, 0);
  const isCurrentTurn =
    state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(SMALL_CARD_HEIGHT, count, sideStackHeight * SIDE_STACK_HEIGHT_FRACTION, SIDE_FAN_MAX_GAP)
    : fillWidthMarginPx(SMALL_CARD_WIDTH, count, windowWidth * TOP_FAN_WIDTH_FRACTION, TOP_FAN_MAX_GAP);
  // Precomputed per-index style array (stable reference when count/cardMargin/isSide don't
  // change) so PlayingCard's React.memo can still skip re-rendering unchanged face-down cards.
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0 ? undefined : isSide ? { marginTop: cardMargin } : { marginLeft: cardMargin },
      ),
    [count, cardMargin, isSide],
  );

  return (
    <View
      style={[
        styles.opponentArea,
        isSide && styles.opponentAreaSide,
        isCurrentTurn && styles.activeArea,
      ]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View
        style={isSide ? styles.opponentColumn : styles.opponentRow}
        testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}
```

Replace it with:

```tsx
interface OpponentSeatProps {
  seat: Seat;
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}

function OpponentSeat({ seat, state, playerNames, pendingPlay }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const isCurrentTurn =
    state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  return (
    <View style={[styles.opponentArea, isSide && styles.opponentAreaSide]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
    </View>
  );
}
```

- [ ] **Step 2: Drop `sideStackHeight` from `OpponentSeatGroup`**

Find:

```tsx
function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  pendingPlay,
  sideStackHeight,
}: {
  position: SeatPosition;
  seats: Seat[];
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  sideStackHeight: number;
}) {
  return (
    <>
      {seats
        .filter(seat => seat.position === position)
        .map(seat => (
          <OpponentSeat
            key={seat.playerId}
            seat={seat}
            state={state}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
            sideStackHeight={sideStackHeight}
          />
        ))}
    </>
  );
}
```

Replace it with:

```tsx
function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  pendingPlay,
}: {
  position: SeatPosition;
  seats: Seat[];
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}) {
  return (
    <>
      {seats
        .filter(seat => seat.position === position)
        .map(seat => (
          <OpponentSeat
            key={seat.playerId}
            seat={seat}
            state={state}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
          />
        ))}
    </>
  );
}
```

- [ ] **Step 3: Remove the three `sideStackHeight={middleRowHeight}` call sites and the `middleRowHeight` measurement**

In the `BatakTable` component, find the three `<OpponentSeatGroup ... />` call sites (`position="top"`, `position="left"`, `position="right"`) and remove the `sideStackHeight={middleRowHeight}` line from each. For example:

```tsx
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        pendingPlay={pendingPlay}
        sideStackHeight={middleRowHeight}
      />
```

becomes:

```tsx
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        pendingPlay={pendingPlay}
      />
```

Do the same for the `left` and `right` groups.

Then find and delete this block (only existed to measure space for the now-removed side card stacks):

```tsx
  // Side seats live inside a centered (non-stretching) flex row, so there's no way to derive
  // their available vertical space from window height alone — measure the row itself. 280 is a
  // reasonable pre-layout guess (corrected after the first onLayout pass), same pattern as
  // handAreaWidth's own default above.
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }
```

And remove the now-unneeded `onLayout` from the middle row `View`:

```tsx
      <View style={styles.middleRow} onLayout={handleMiddleRowLayout}>
```

becomes:

```tsx
      <View style={styles.middleRow}>
```

- [ ] **Step 4: Remove the `activeArea` style and its remaining usage on the human hand area**

Find:

```tsx
      <View
        style={[styles.handArea, isHumanInteractive && styles.activeArea]}
        onLayout={handleHandAreaLayout}>
```

Replace with:

```tsx
      <View style={styles.handArea} onLayout={handleHandAreaLayout}>
```

Then in the `styles` `StyleSheet.create` object, delete this line:

```tsx
  activeArea: { backgroundColor: "rgba(244, 197, 66, 0.14)" },
```

- [ ] **Step 5: Remove the now-dead face-down-card-stack constants and styles**

Delete these constants (no longer referenced anywhere in the file after Steps 1–4):

```tsx
const SMALL_CARD_HEIGHT = 86; // matches PlayingCard's 'small' size height
const SMALL_CARD_WIDTH = 64; // matches PlayingCard's 'small' size width
// Opponent hands render flat (no rotation/curve). Spacing auto-scales via fillWidthMarginPx: a
// small hand spreads into an evenly-gapped row (capped at *_MAX_GAP so it doesn't look sparse); a
// larger hand (Batak's 13-card starting hand) compresses into overlap automatically as count
// grows — one continuous rule instead of two separate "row" vs. "fan" modes.
const TOP_FAN_WIDTH_FRACTION = 0.85; // fraction of window width the top seat's row may use
const TOP_FAN_MAX_GAP = 10;
const SIDE_STACK_HEIGHT_FRACTION = 0.82; // fraction of the measured middle-row height the side stack may use
const SIDE_FAN_MAX_GAP = 10;
```

Delete these two now-unused styles from the `styles` `StyleSheet.create` object:

```tsx
  opponentRow: { flexDirection: "row", justifyContent: "center" },
  opponentColumn: { flexDirection: "column", alignItems: "center" },
```

Reduce `opponentArea`'s `minHeight` — it now only needs to fit a single badge, not a badge plus a card stack. Find:

```tsx
  opponentArea: {
    minHeight: 135,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 4,
  },
```

Replace with:

```tsx
  opponentArea: {
    minHeight: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 4,
  },
```

- [ ] **Step 6: Typecheck the mobile app**

Run: `npx tsc --noEmit -p apps/mobile/tsconfig.json`
Expected: no errors. If `fillWidthMarginPx`, `LayoutChangeEvent`, or `useWindowDimensions` show as unused-import errors, check whether they're still used elsewhere in the file before removing the import — `fillWidthMarginPx` is still used by the human hand's `topRowMargin`/`bottomRowMargin` computation, `LayoutChangeEvent` is still used by `handleHandAreaLayout`, and `useWindowDimensions` is still used for `handAreaWidth`, so none of these imports should actually need removing; this step is a safety check, not an expected change.

- [ ] **Step 7: Run the existing test suite for regressions**

Run: `npx jest`
Expected: same pass count as before. Batak has no dedicated `BatakTable` component test today (per this project's mobile-UI testing policy), so this step confirms no other suite (e.g. `apps/mobile`'s registry or engine suites) was accidentally affected.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/games/batak/BatakTable.tsx
git commit -m "fix(batak): remove turn-indicator overlay and face-down opponent card stacks"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec section 1 (frame alignment) exactly, including both sizes and both brackets. Task 2 covers spec section 2 (spade/club redesign) exactly, using the final approved paths verbatim from the spec, including removing the now-dead `CLUB_CENTER_HOLE`. Task 3 covers spec section 3 (Batak turn indicator) including every piece of dead code the spec calls out (`sideStackHeight` prop chain, `middleRowHeight`/`handleMiddleRowLayout`, the six spacing constants, `opponentRow`/`opponentColumn` styles) and the `opponentArea` `minHeight` reduction the spec leaves for implementation time.
- **Placeholder scan:** No TBD/TODO markers; every step shows exact before/after code.
- **Type consistency:** `OpponentSeatProps`/`OpponentSeat`/`OpponentSeatGroup` signatures are consistent across Steps 1–3 (all drop `sideStackHeight` together). No task references a type or function not defined either in the existing codebase or an earlier step in the same task.
