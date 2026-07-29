# Plan: Migrate Batak's `Animated` usage to Reanimated + Gesture Handler (Phase A)

Implements `ADR-002` (`docs/animation/ADR/ADR-002-reanimated-migration-apps-mobile.md`). Scope: the 5 Batak-only files with zero Pişti blast radius. Shared files (`SelectableCard.tsx`, `DealFlightOverlay.tsx`) are Phase B, a separate future plan — not touched here.

## Order (lowest-risk first)

1. `apps/mobile/src/table/GatherCard.tsx` — trick-sweep flip + fly-out. One `progress` value driving translate/opacity/rotateX-or-Y interpolations, no gesture.
2. `apps/mobile/src/table/KittyRevealCard.tsx` — `KittyRevealCard` (flip-reveal) + `KittyCollectCard` (fly-to-hand). Same shape as (1), no gesture.
3. `apps/mobile/src/components/CenteredDecisionModal.tsx` — modal entrance (opacity/scale/translateY). No gesture; only consumer today is Batak's `BatakTable.tsx`.
4. `apps/mobile/src/table/TravelCard.tsx` — played-card fly-in. Same shape as (1)/(2), no gesture, but consumed by both `TrickCenter.tsx` and `BurySlots.tsx` — the widest Batak-internal consumer count in this phase.
5. `apps/mobile/src/games/batak/table/HumanHandFan.tsx` — hand reflow/entrance/local-departure. The only file in this phase with a genuine multi-card reflow (`AnimatedFanCard`) and a nested `SelectableCard` dependency (out of scope, stays `Animated`-based until Phase B — this file must keep working with `SelectableCard`'s existing `Animated`-based props unchanged).

Each step: same visuals/timing/easing/behavior as today, verified via `npx tsc --noEmit` (no test suite changes — decorative/motion code, per the standing 2026-07-07 testing policy) before moving to the next file.

## Per-file conversion pattern

- `useRef(new Animated.Value(x)).current` → `useSharedValue(x)`.
- `Animated.timing(v, {toValue, duration, easing, useNativeDriver}).start()` → `v.value = withTiming(toValue, {duration, easing})` (Reanimated's `withTiming` runs on the UI thread unconditionally — no `useNativeDriver` equivalent needed).
- `Animated.parallel([...]).start()` → each shared value's own `withTiming` call, fired together in the same synchronous block (Reanimated has no `Animated.parallel` equivalent needed — independent `.value =` assignments in the same tick already run concurrently on the UI thread).
- `v.interpolate({inputRange, outputRange})` inside a `style` prop → `useAnimatedStyle(() => ({...}))` reading `interpolate(v.value, inputRange, outputRange)` from `react-native-reanimated`.
- `<Animated.View style={...}>` → `<Animated.View style={[staticStyles, animatedStyle]}>` (Reanimated re-exports its own `Animated.View`; static and animated styles are passed as an array, not merged into one object literal).
- `useReducedMotion()`'s existing boolean stays as the JS-thread gate deciding `withTiming(...)` vs. an instant `v.value = target` — same branching shape as today, just swapping which timing primitive each branch calls.
- No gesture changes in any Phase-A file — none of these 5 files use `Pressable`/touch handling directly (`HumanHandFan.tsx` renders `SelectableCard`, which owns its own `Pressable` and stays untouched in this phase).

## Verification per file

- `npx tsc --noEmit` on `apps/mobile` clean.
- Read the diff once more against the file's own doc comments (several encode subtle timing/sequencing reasoning — e.g. `TravelCard`'s "all four properties share one progress value for frame-perfect sync," `GatherCard`'s hard-cut opacity swap at the flip midpoint) to confirm the Reanimated rewrite preserves the exact same behavior those comments describe, not just a mechanical API swap.
- No new automated tests (motion-only, existing testing policy) — live verification is the user's own on-device test, per `[[feedback_no_unsolicited_screenshot_tests]]`/`[[feedback_adb_synthetic_tap_unreliable_gesture_handler]]`, not a sandbox screenshot pass.

## Infra (one-time, before file 1)

- Add `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets` to `apps/mobile/package.json` via `npx expo install` (matches how `apps/playground` added them for Demo08).
- `apps/mobile/babel.config.js`: add `react-native-worklets/plugin` (mirrors `apps/playground/babel.config.js`).
- `apps/mobile/App.tsx` (or wherever its root component lives): wrap in `GestureHandlerRootView`, matching `apps/playground/App.tsx`'s existing pattern — required even though Phase A introduces no new gestures, since Reanimated's worklet runtime and Gesture Handler are usually initialized together and Phase B will need it imminently.
