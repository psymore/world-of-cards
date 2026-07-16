# Batak Table UI Polish: Edge Rails, Human Seat Reversal, Selection Fix, Dim Toggle — Design

**Status:** Approved
**Date:** 2026-07-16
**Scope:** UI-only changes to the existing, already-playable 4-player Batak mobile screen (`apps/mobile/src/games/batak/`), plus one small shared-package addition (`packages/ui`), one shared-geometry extension (`apps/mobile/src/table/seating.ts`), and one shared-settings addition (`apps/mobile/src/state/settingsStore.ts`). No engine (`packages/engine`) changes. No change to game rules/logic — this is presentation-only.

## Context

Seven related visual/interaction requests for Batak's table, given together and refined through brainstorming:

1. Wood table decoration should extend along every edge where a player sits, not just the four corners.
2. The human seat's card stack and "You" badge are in the wrong relative order — cards should hug the bottom edge, the badge should sit closer to the table's center.
3. The currently-selected hand card should lift *and* render in front of every other card (today it deliberately renders behind neighbors).
4. Tapping empty table space should deselect the current card.
5. A settings toggle to disable the "unplayable card" dimming.
6. AI 2's (the top seat's) fan currently looks loose/uneven — tighten it using the same percentage-overlap approach the human hand and side stacks already use.
7. The human hand's own fan should flatten slightly and spread to fill more of the screen width, with a fixed 15% gutter on each side.

**Decisions made during brainstorming (not re-litigated here):**
- Item 1 is new **edge rails** (straight wood decoration along each of the 4 edges), added *alongside* the existing 4 corner wedges — not a replacement, not a resize of the wedges.
- Item 2 is a reorder **within the existing bottom `handArea`** (badge first, hand rows last) — not a relocation into the middle row.
- Items 3+4's touch-safety conflict is resolved by **shrinking each card's hit-box** (negative `hitSlop` sized to the fan's overlap) so hit-testing no longer depends on which card is painted on top — only then is it safe to flip the paint order so the selected card is genuinely in front.
- Item 5's toggle lives in the **shared `settingsStore`** (global, so it's available to Pişti later with no migration), but the gear button/UI is **only added to Batak's screen for now** — Pişti's header is unchanged.
- Item 6 reuses the existing `overlapMarginPx` percentage-overlap helper (already used by the human hand and the side stacks) rather than the top seat's current fixed-pixel constant.
- Item 7's flatter slope needs new optional parameters on the shared `fanRotationDeg`/`fanCurveY` (defaulted to today's values) so AI 2's fan and Pişti are unaffected — only Batak's human hand passes the flatter numbers.

## 1. Table Decoration: Edge Rails

New `TableEdgeRails` component in `packages/ui/src/TableEdgeRails.tsx`, following the exact convention already established by `TableWoodCorners`/`TableFelt`: zero props (aside from the same optional `woodColor` override), `AbsoluteOverlay`-wrapped, `React.memo`'d so it paints once and is never re-rendered by game-state-driven re-renders.

- Four thin rectangular `Svg` rails (top/bottom/left/right), each spanning the corresponding edge between the two existing corner wedges (inset by `TableWoodCorners`'s `WEDGE_SIZE` so they meet the wedges without overlapping them), using the same two-tone wood gradient + faint diagonal-grain `Pattern` + gold trim stroke recipe as the wedges (factor the gradient/grain `Defs` into a small shared helper if that avoids duplicating the `Stop`/`Pattern` JSX literally — implementer's call; not worth a bigger shared abstraction for four rails).
- Rail thickness: a fixed constant, tuned small relative to the wedge size (e.g. ~24dp) so it reads as a border accent, not a picture frame — implementer picks the exact value during a visual pass, this isn't precision-critical.
- Rendered in `BatakTable.tsx` immediately after the existing `<TableWoodCorners />` (same z-order position, both purely decorative and `pointerEvents: 'none'`).
- **Batak-only.** Per the standing CLAUDE.md rule ("whenever a change is made to how cards or the table look in `apps/mobile`... treat that as a trigger to explicitly discuss with the user whether/how the other side should be updated"), this is flagged again at the end of implementation — not silently mirrored into Pişti's table.

## 2. Human Seat Reversal

In `BatakTable.tsx`'s bottom `handArea`, reorder the existing children:

```
handArea
  PlayerBadge          (was last, now first — closer to the middle row)
  BidControls          (bidding phase only, unchanged — still needs to sit above the cards to stay reachable)
  HandRow (top row)
  HandRow (bottom row)  (was first, now last — hugs the bottom edge)
```

Pure JSX reorder; no new components, no style changes to `PlayerBadge`, `BidControls`, or `HandRow` themselves. `handArea`'s existing `justifyContent: 'center'` and `gap` continue to apply — the visual effect is the badge (and bid controls, when present) sitting above the cards instead of below them.

## 3. AI 2 (Top Seat) Fan Density

The top seat's opponent fan (`OpponentSeat`, `!isSide` branch) currently overlaps cards by a fixed `OPPONENT_CARD_OVERLAP = 21` px on 54px-wide `'small'` cards (~39%). Add a Batak-local constant, next to the existing `BATAK_SIDE_OVERLAP_PERCENT`:

```ts
const BATAK_TOP_OVERLAP_PERCENT = 85;
```

Replace the fixed `-OPPONENT_CARD_OVERLAP` margin with `overlapMarginPx(SMALL_CARD_WIDTH, BATAK_TOP_OVERLAP_PERCENT)` (a new `SMALL_CARD_WIDTH = 54` sibling constant to the existing `SMALL_CARD_HEIGHT`, matching `PlayingCard`'s `'small'` size). `fanRotationDeg`/`fanCurveY` (rotation + convex droop) are unchanged — only the horizontal overlap tightens. Kept local to `BatakTable.tsx`, same reasoning as `BATAK_SIDE_OVERLAP_PERCENT`: Pişti's top seat (2-4 player modes) is untouched.

## 4. Human Hand: Flatter Slope + Width-Filling Spread

**Flatter slope.** Add two optional parameters to the shared geometry functions in `apps/mobile/src/table/seating.ts`, both defaulting to today's constants so every existing caller (Pişti, AI 2) is unaffected:

```ts
export function fanRotationDeg(index: number, count: number, degreesPerStep: number = OPPONENT_FAN_DEGREES_PER_STEP): number

export function fanCurveY(index: number, count: number, direction: 1 | -1 = 1, curveMultiplier: number = OPPONENT_FAN_CURVE): number
```

Batak's human `HandRow` passes flatter values — proposed starting point `degreesPerStep = 4` (half of 8) and `curveMultiplier = 1.5` (half of 3), called out here as a first pass to visually tune, not a precision-critical constant (consistent with how `BATAK_SIDE_OVERLAP_PERCENT`/deal-animation timings were picked in prior specs).

**Width-filling spread with fixed gutters.** Replace the fixed-percentage `HUMAN_HAND_MARGIN` with a measured, width-aware calculation:

- The hand area (the `View` wrapping both `HandRow`s) measures its own width via `onLayout`.
- Target span per row = `measuredWidth * 0.7` (a fixed 15% gutter reserved on each side).
- For a row of `n` cards at the human card width (84px, `'normal'` size): if `n <= 1`, margin is `undefined` (nothing to space); otherwise `step = (targetSpan - CARD_WIDTH) / (n - 1)`, which can be negative (overlap, for a full 13-card hand) or positive (a gap, once enough cards are played that 84px cards alone would undershoot the target span).
- **Clamp** `step` to a small positive maximum (proposed `24px`) so a near-empty hand (1–2 cards left) doesn't scatter across the full 70% width with large gaps — past that cap, extra width is simply left as unused margin around a naturally-sized row rather than stretched further.
- Both rows (top/bottom, differing card counts) use the *same* `targetSpan` (derived once from the measured container width, not per-row), so their left/right bounds line up visually even though their per-card step differs.
- This replaces `HUMAN_HAND_MARGIN`'s fixed-percentage calculation. `HUMAN_HAND_OVERLAP_PERCENT` (`seating.ts`) has no consumer other than `BatakTable.tsx` today, so once this change lands it becomes dead exported code — remove it (and `HUMAN_HAND_MARGIN`) rather than leave it unused. `overlapMarginPx` itself stays (still used by the side-stack and new top-seat overlap calculations in Sections 3 and elsewhere in `BatakTable.tsx`).

## 5. Selected Card: Front Stacking, Lift-Toward-Camera, Tap-to-Deselect

**Hit-box safety first.** Add a `hitSlop` to `SelectableCard`'s inner `Pressable`, shrinking the touchable area on the left/right edges where the fan's rotation widens the visual overlap between neighbors (the existing code comment estimates ~25px at the fan's edges — derive the exact value from the same overlap math already used for the margin, rather than a separate hardcoded guess). This must land *before* the z-order flip below — it's what makes the flip safe.

**Front stacking.** With hit-testing no longer ambiguous:
- `EntranceCard`'s `zIndex` prop: selected card gets a high value (e.g. `10`) instead of `0`; unselected cards keep a low value (e.g. `1`).
- Remove `handFanRow`'s per-row `zIndex: 0` stacking-context isolation (currently each row is walled off from the other for z-ordering purposes — that isolation existed specifically to support the old inverted scheme). Without it, a selected bottom-row card's higher `zIndex` also wins against top-row cards, satisfying "in front of every other card," not just its own row.
- `collapsable={false}` (added last session for the old zIndex fix) stays — still needed so Android doesn't flatten the view and silently drop the (now-flipped) zIndex.

**Lift toward camera.** In `SelectableCard.tsx`, add a `scale` transform interpolated from the existing `lift` `Animated.Value` (no new Animated.Value): `lift` already ranges `0` (unselected) to `-liftDistance` (selected); interpolate that same range to `[1, 1.05]` for `scale`. Reuses the existing native-driven animation exactly as today (instant snap on select, animated drop on deselect, `useReducedMotion` handling unchanged) — purely an added output on the same driver, no new timing/perf cost.

**Tap-to-deselect.** Wrap `BatakTable`'s returned content in a `Pressable` with `onPress={clearSelection}`. Standard React Native touch-responder behavior means any nested `Pressable` (a hand card, a bid button, a trump-suit button) still claims its own tap first — this outer handler only fires for taps that land on felt, wood decoration, layout gaps, or opponent seat areas, i.e. genuinely "empty" table space. No change needed to `useCardSelection` itself; `clearSelection` already exists and is idempotent.

## 6. Settings: "Dim Unplayable Cards" Toggle

- `settingsStore.ts`: add `dimUnplayableCards: boolean` (default `true`, preserving today's look exactly) and `setDimUnplayableCards`, following the exact pattern of the existing `soundEnabled`/`defaultDifficulty` fields.
- `GameScreenLayout.tsx`: add an optional `onSettingsPress?: () => void` prop. When provided, render a small gear icon/button in the header next to the existing Exit button; when omitted (Pişti's current call site), the header is visually unchanged.
- `BatakScreen.tsx`: passes `onSettingsPress` to open a small modal (or simple inline popover — implementer's call on the lightest-weight option consistent with `GameResultModal`'s existing modal usage) containing exactly one row: a labeled switch for "Dim Unplayable Cards," reading/writing `useSettingsStore`.
- `SelectableCard.tsx`: the existing `disabledScrim` renders only when `disabled && dimUnplayableCards` (read from `useSettingsStore`) — `disabled` itself (blocking taps on off-turn/illegal cards) is completely unaffected; this only toggles the visual dimming.

## Files Touched

- `packages/ui/src/TableEdgeRails.tsx` — new component (Section 1); exported from `packages/ui/src/index.ts` alongside `TableWoodCorners`.
- `apps/mobile/src/table/seating.ts` — optional `degreesPerStep`/`curveMultiplier` params on `fanRotationDeg`/`fanCurveY` (Section 4). No changes to existing call sites' behavior (defaults preserve current output).
- `apps/mobile/src/games/batak/BatakTable.tsx` — edge rails render call; `handArea` reorder; `BATAK_TOP_OVERLAP_PERCENT`/`SMALL_CARD_WIDTH` constants; width-aware human-hand margin calculation + `onLayout`; `EntranceCard`/`handFanRow` zIndex changes; outer deselect `Pressable`.
- `apps/mobile/src/components/SelectableCard.tsx` — `hitSlop`; `scale` interpolation; `dimUnplayableCards`-gated scrim.
- `apps/mobile/src/components/GameScreenLayout.tsx` — optional `onSettingsPress` prop + gear button.
- `apps/mobile/src/games/batak/BatakScreen.tsx` — settings modal/popover wiring `onSettingsPress`.
- `apps/mobile/src/state/settingsStore.ts` — `dimUnplayableCards` field.

## Testing

Per this project's standing testing policy (2026-07-07, `CLAUDE.md`): no new tests are written for mobile UI/screens by default. This entire pass is UI/animation/layout plus one settings-store field; no engine changes. The existing full mobile suite must still pass untouched (regression check only, not new coverage).

## Manual Verification Plan

Since this sandbox has no native device access (browser/Playwright only, per standing project memory), verification will use the existing `expo start --web` + Playwright screenshot workflow:
- Edge rails render on all 4 sides without overlapping the corner wedges or opponent card areas.
- Human badge sits above the cards; cards reach the bottom edge.
- AI 2's fan reads as tightly overlapped, matching the side stacks' density.
- Human hand: flatter arc, consistent ~15% gutter on both sides at full (13-card) and near-empty hand sizes.
- Selecting a card: visually lifts, scales up slightly, and paints in front of both its own-row neighbors and the other row.
- Computed hit-testing check (`elementFromPoint`-style, as used in the prior selection-bug fix) confirming a tap near a neighbor's edge still resolves to the neighbor, not the selected card — **explicitly noted that this method only validates web; the same native-only risk flagged in the previous session (Android view-flattening/hit-testing not caught by browser verification) applies here too and should be spot-checked on-device when possible.**
- Tapping empty felt/wood/gap areas deselects a selected card; tapping a bid/trump button or another card still works normally.
- Settings gear button opens the toggle; turning "Dim Unplayable Cards" off removes the scrim from illegal/off-turn cards while they remain untappable; turning it back on restores today's look exactly.

## Out of Scope

- Any change to Pişti's table beyond the backward-compatible optional-parameter extension to `fanRotationDeg`/`fanCurveY` (defaults keep Pişti's output identical).
- Sound/haptics for selection or deselection.
- Persisting `dimUnplayableCards` across app restarts beyond whatever the existing `settingsStore` persistence (if any) already provides — no new persistence mechanism is introduced by this spec.
- The 3-player gömmeli variant (no UI yet).
- Any engine/rules change.

## Next Step

Write the implementation plan for this design.
