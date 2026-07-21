# Batak card-play & hand-reposition animation smoothness — design

**Date:** 2026-07-21
**Scope:** Batak (4-player standard) only. Pişti's separate, structurally different hand UI (a flat, unanimated row — see "Investigation findings" below) is explicitly out of scope for this branch; whether/how to bring it to the same standard is a distinct future effort, not decided here, per the standing per-game visual-change discussion rule in CLAUDE.md.

## Problem

Playing a card in Batak has two related but distinct issues, reported directly by the user from live play:

1. **Played-card departure jump.** The instant a card is played, it visually snaps — not eases — from its in-hand appearance into a different-looking object mid-flight. The user confirmed the *landing* is already seamless; the problem is entirely at the *start* of the flight, and the card "shakes" while traveling.
2. **Hand reposition isn't perfectly fluid.** When the remaining hand cards slide/rise to close the gap left by the played card, the motion doesn't read as fully smooth.

## Investigation findings

### Root cause 1: the played card is not one continuous object

Traced the full pipeline: `BatakTable.playWithMeasuredOrigin` → `BatakScreen.commitMove` (`setPendingPlay`) → `BatakTable`'s `humanHand` filter → `HumanHandFan`/`TrickCenter`.

The moment a card is played:
- It's synchronously filtered out of `humanHand` (`BatakTable.tsx`), unmounting its `AnimatedFanCard`/`SelectableCard` instance — which was rendered at `size="normal"` (94×132), rotated by its fan angle (`fanRotationDeg`), and scaled 1.05× (the "selected" lift scale).
- In the same commit, `TrickCenter` mounts a **brand-new** `TravelCard` instance for `pendingPlay`, rendering `<PlayingCard card={card} size="small" />` (70×101) — no rotation, no scale, only `translateX`/`translateY` interpolated from `originOffset` to `0,0`.

So in one frame the card cuts from "normal size, rotated ~N°, scaled 1.05×" to "small size (25% smaller), flat, scale 1×" — simultaneously with starting to translate. That combined size+rotation+scale pop at the exact instant motion begins is what reads as a jump/shake at departure; the translate-only interpolation for the rest of the flight is smooth, which matches the user's observation that landing feels fine.

`TravelCard` (`apps/mobile/src/table/TravelCard.tsx`) is a small, shared, single-`Animated.Value` component — currently only consumed by Batak's `TrickCenter`. It already interpolates `translateX`/`translateY` off one native-driven `progress` value; it just never carries rotation/scale.

### Root cause 2: full-tree re-renders compete with the reflow animation

Every play triggers `setPendingPlay` (and later, after a timer, `performMove` clearing it) — each a state update at the top of `BatakScreen`'s `ActiveGame`, cascading a full re-render through `BatakTable` → `HumanHandFan` (every remaining hand card) → `OpponentSeat` ×3 → `TrickCenter`. None of these are `React.memo`'d today. The per-card reposition animation itself is already native-driven (`useNativeDriver: true`, `Easing.inOut(Easing.ease)`, 220ms) and fine in isolation, but the JS-thread cost of reconciling the whole tree on every play is real, un-bounded work happening at the exact moment the animations need to start — a plausible source of the "not perfectly fluid" feel, and directly the risk the user asked to check ("unnecessary layout recalculations, state updates, or React re-renders during the animation").

Checked for non-native-driver animations that could block the JS thread mid-flight: none found — every relevant `Animated.timing` in this pipeline (`SelectableCard`'s lift, `AnimatedFanCard`'s x/y, `TravelCard`'s progress, `EntranceCard`) already uses `useNativeDriver: true`. The fix here is reducing render/reconciliation cost, not switching animation drivers.

### Confirmed out of scope for this investigation

- Pişti's local hand row (`PistiTable.tsx`) has **no** per-card reposition animation at all today (a plain flex row that snaps via default RN layout) and its played-card reveal doesn't have a rotation to lose (no fan rotation in that hand). Different problem shape, deliberately deferred as its own future effort.
- No non-native-driver animation was found competing for the JS thread; this isn't an `Animated` API misuse issue.

## Design

### Fix 1: continuous transform for the played card's departure

Generalize `TravelCard` with two new **optional, additive** props so every existing/future consumer defaults to today's exact behavior:

- `originRotateDeg?: number` (default `0`) — interpolated `progress: 0→1` maps `originRotateDeg → 0`.
- `originScale?: number` / `restScale?: number` (both default `1`) — interpolated the same way.

All three (translate, rotate, scale) are interpolated off the **same single `progress` Animated.Value** already driving translate — never separate values — so they are guaranteed frame-perfect in sync on the native thread; no possibility of one lagging another and reading as a shake.

For Batak's own played card specifically (`TrickCenter`'s `pendingPlay` branch, human only):
- Render the traveling child at `size="normal"` (not `"small"`) for the entire flight — the underlying `PlayingCard` size prop never changes mid-flight, so only transform properties animate (no layout recalculation per frame, matching the user's explicit ask).
- `originRotateDeg` = the card's real fan angle in its hand slot, computed **analytically** from the same `fanRotationDeg` formula `HumanHandFan` already uses for rendering (not measured via `measureInWindow` — avoids any measurement-timing jitter as a possible shake contributor). Computed in `BatakTable.playWithMeasuredOrigin` at tap time, where the tapped card's `HandSlot` (index/row count) is already known, and threaded through `onPlayCard` → `commitMove` → `PendingBatakPlay` → `TrickCenter`.
- `originScale` = the existing `SELECTED_SCALE` constant (1.05) — always correct, since a card can only be played while selected/lifted (the tap-to-select-then-tap-to-play flow guarantees this).
- `restScale` = `CARD_DIMS.small.width / CARD_DIMS.normal.width` (≈0.745) — the ratio that makes the "normal card, scaled down" occupy the exact same footprint as the real small card at rest.

At rest, the scaled-down "normal" card and the real static `size="small"` card occupy an identical rect. The existing ~40ms gap between the travel animation finishing (530ms) and `pendingPlay` clearing (570ms, `PLAY_TRAVEL_DELAY_MS`) is where the hand-off to the plain static small card already happens — invisible, since nothing about the rect changes at that instant.

Only the human's own pending play gets this treatment. AI-played cards have no visible in-hand card to depart from (opponent hands render as a badge only, no per-card visual since the 2026-07-18 turn-indicator simplification) — their `TravelCard` usage is untouched.

### Fix 2: reduce re-render cost during a play

Scoped, targeted memoization — not a general app-wide performance pass:

- `AnimatedFanCard`: wrap in `React.memo`. Its current props include a fresh `slot` object and a `legalCardIds` Set rebuilt every render, both of which defeat a naive memo. Flatten to primitives at the `HumanHandFan` call site — pass a precomputed `interactive: boolean` and `selected: boolean` instead of the raw Set/`selectedCardId` string — and give the memo a comparator over `slot`'s actual fields (card id, row, indexInRow, rowCount, enterFromOffset) instead of relying on object identity.
- Stabilize the callback chain feeding these components: `playWithMeasuredOrigin` and `registerHandCardRef` in `BatakTable.tsx` are currently plain functions re-created every render, which would silently defeat any child `React.memo` since `useCardSelection`'s `selectCard` inherits a fresh identity from them each time. Wrap both in `useCallback` with correct dependencies.
- `OpponentSeat`: wrap in `React.memo`, flattening the props it actually needs (`name`, `statusText`, `active`) instead of passing the whole `state` object — so an opponent seat only re-renders when its own displayed values change, not on every state tick from an unrelated play.
- `assignSeats(opponentPlayerIds)` (called fresh in `BatakTable`'s body every render): wrap in `useMemo` so seat objects stay referentially stable across renders where `opponentPlayerIds` hasn't changed, letting the `OpponentSeat` memo above actually work.

No change to the reposition animation's own duration/easing (220ms, `Easing.inOut(Easing.ease)`) — it's already native-driven and reasonable in isolation. If it still doesn't feel fully smooth after the render-cost reduction above, that's a follow-up tuning pass, not a re-architecture.

## Non-goals

- Resizing trick-center cards to `size="normal"` globally (Approach B, declined) — a real visual/layout change to the trick-cross arrangement, out of scope for a pure animation-smoothness pass.
- Any change to Pişti.
- New automated tests — this is decorative/motion UI, covered by the standing 2026-07-07 testing policy (engine stays tested by default; mobile UI does not).

## Verification

No proactive screenshot/Playwright verification (per the user's standing 2026-07-17 direction) — verification is manual, live, in the user's own running Expo session, specifically checking: the played card no longer pops in size/rotation the instant it starts moving, no visible shake during flight, and the hand reflow feels smoother when several cards are played in sequence.

## Branch

`ui/batak-card-play-animation-smoothness`, local branch in the main repo (no worktree), per standing branch-workflow preference.
