# Batak: bid/trump decision modal + animated hand reflow

Date: 2026-07-18
Status: approved, ready for planning
Scope: `apps/mobile` only, Batak-specific — no engine changes, no changes to Pişti or `apps/playground`.

## Background

Two independent, user-requested polish items on the existing 4-player Batak table (`apps/mobile/src/games/batak/BatakTable.tsx`):

1. The bid (bildir) and trump-suit selection controls currently render inline inside the table's center panel and hand area, with no visual separation from the rest of the table.
2. The human's hand (`HandRow` inside `BatakTable.tsx`) recomputes each card's `marginLeft` every render via `fillWidthMarginPx` (in `apps/mobile/src/table/seating.ts`) as cards are played and the hand shrinks. This reflow currently snaps instantly — no animation.

Both are additive UI-polish changes to already-shipped, already-playable Batak. No new tests, per the standing 2026-07-07 mobile-UI testing policy (no test asserted on `BidControls`' or `TrumpSelectionCenter`'s current inline markup, so nothing to update either).

## 1. Centered decision modal for bid + trump selection

### Component: `CenteredDecisionModal`

New shared component: `apps/mobile/src/components/CenteredDecisionModal.tsx`.

```ts
export interface CenteredDecisionModalProps {
  visible: boolean;
  children: React.ReactNode;
}
```

Renders a transparent RN `Modal` (`animationType="none"` — RN's built-in `fade`/`slide` types don't support the scale-in this needs, so the entrance is hand-rolled, same reasoning already recorded as the deferred correct-fix for `GameResultModal`'s own `act()` warning) wrapping a plain `View` backdrop and an `Animated.View` content wrapper:

- Backdrop: `flex: 1, alignItems: 'center', justifyContent: 'center'`, **no background color** (fully transparent) — per explicit user direction this pass, the table stays fully visible with no dim behind the modal. The native `Modal` itself still intercepts all touches to whatever's behind it, so the table is non-interactive while the modal is open even without a visible scrim.
- Content wrapper: fades and scales in on the `visible: false → true` transition — `opacity` 0→1, `scale` 0.85→1, both driven by one `Animated.Value`, 220ms, `Easing.out(Easing.cubic)`, `useNativeDriver: true`. Mirrors the existing entrance-animation convention (`EntranceCard`, `SelectableCard`'s lift/scale) rather than inventing a new one.
- Respects `useReducedMotion()` (`apps/mobile/src/components/useReducedMotion.ts`, already used by `EntranceCard` and `SelectableCard`): when true, the value is set directly to 1 with no animation.
- No exit animation — closing (`visible: true → false`) just hides the `Modal` instantly, same as every other modal in this codebase (`GameResultModal`, `BatakSettingsModal`). Not part of the user's ask; can be added later as a separate, small follow-up if wanted.
- Generic/game-agnostic by construction (lives in `components/`, no Batak import), but this pass only wires it into Batak. Per the standing per-game visual-change rule, whether any other game adopts it is a separate future discussion — not silently mirrored.

### Wiring into `BatakTable.tsx`

The **ambient status text stays exactly where it is today** — only the interactive decision controls move into the modal:

- `BiddingCenter` (the "Bidding" heading + "Highest bid: N (name)" / "No bids yet" line) stays inline in the center panel, visible to everyone throughout the bidding phase, unchanged.
- The "`{name} is choosing trump…`" waiting message (the non-bid-winner branch of today's `TrumpSelectionCenter`) stays inline in the center panel, unchanged — it's passive status, not a decision, so it doesn't move.

What moves into a `CenteredDecisionModal`:

- **Bid modal** — `visible: state.phase === 'bidding' && isHumanInteractive` (the same condition that currently gates rendering `BidControls` in the hand area). Contains the existing bid-amount buttons + Pass, but re-laid-out: `BidControls`' current horizontal `ScrollView` becomes a wrapping grid (`flexWrap: 'wrap', justifyContent: 'center'`, fixed-width modal card) so every option is visible at once with no scroll gesture, reading as a compact grid rather than a stacked list.
- **Trump modal** — `visible: state.phase === 'trump-selection' && state.bidWinner === humanPlayerId`. Contains the existing "Choose trump (contract: N)" heading + the 4-suit-icon horizontal row, unchanged internally — just relocated from the center panel into the modal.

Both modals render as siblings near the top of `BatakTable`'s returned JSX (alongside the existing `DealFlightOverlay`), not nested inside `middleRow`, since `Modal` already portals to a top-level native layer regardless of where it's declared in the tree.

## 2/3. Animated hand reflow + progressive overlap

No changes to the overlap *formula* — `fillWidthMarginPx` and `HUMAN_HAND_MAX_GAP` (`apps/mobile/src/table/seating.ts`) already produce progressively-less-overlap as the hand shrinks and already cap the max gap at 24px so a near-empty hand doesn't spread widely. The only gap today is that this recalculation snaps instantly on every render.

Fix: trigger RN's `LayoutAnimation.configureNext(...)` exactly once, at the one place a human play actually removes a card from the rendered hand array — `apps/mobile/src/games/batak/BatakScreen.tsx`'s `commitMove`, immediately before the `setPendingPlay({ playerId, card, originOffset })` call, and only when `move.type === 'play' && playerId === HUMAN_ID`. (AI plays never touch the human's own hand array — `humanHand` in `BatakTable.tsx` only filters on `pendingPlay.playerId === humanPlayerId` — so they need no trigger.)

- Config: `LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity))` — 220ms to match the modal's own entrance timing, so the two new animations in this pass feel consistent with each other.
- Skipped entirely when `useReducedMotion()` is true — the `configureNext` call is just not made, so the state update (and resulting layout change) applies instantly, matching how reduced-motion is handled everywhere else in this codebase (no animation, not a faster animation).
- This is the first use of `LayoutAnimation` anywhere in the codebase (everywhere else uses explicit `Animated.Value` + `useNativeDriver: true` transforms) — a deliberate, user-chosen exception for this specific "many sibling views reflow together" case, not a new default pattern for future animation work.

## Files touched

- New: `apps/mobile/src/components/CenteredDecisionModal.tsx`
- `apps/mobile/src/games/batak/BatakTable.tsx` — wire the two modals in; `BidControls` restyled to a wrapping grid; `BiddingCenter`/`TrumpSelectionCenter` split into "ambient text stays inline" vs "interactive controls move to modal"
- `apps/mobile/src/games/batak/BatakScreen.tsx` — one `LayoutAnimation.configureNext` call in `commitMove`

## Testing

No new automated tests, per the standing 2026-07-07 mobile-UI testing policy. Existing suite must still pass unchanged (no existing test asserts on `BidControls`' or `TrumpSelectionCenter`'s current inline markup — confirmed by inspection before writing this spec). No proactive screenshot/visual verification, per the user's 2026-07-17 direction — verification happens live in the user's own running Expo session.
