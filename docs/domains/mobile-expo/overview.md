# Mobile / Expo — Overview

**Owner:** whoever last touched Expo/RN infra. **Load:** when touching Expo/RN platform-level concerns in `apps/mobile` that aren't specific to any one game.

`apps/mobile` is the Expo app — the only place RN/Expo/Reanimated/Zustand/React Navigation code lives, consuming `packages/engine` and `packages/ui` via npm workspace links.

**Expo has changed since training-data knowledge of it** — see `AGENTS.md`, which is the canonical one-line pointer to read the exact versioned docs at `https://docs.expo.dev/versions/v57.0.0/` before writing any Expo-related code. This file exists for anything longer than that one line.

## Animation engine: two vocabularies, by design

`apps/mobile` deliberately runs two animation vocabularies side by side, not a single migrated one: plain React Native `Animated` as the default, and `react-native-reanimated` only where a specific multi-card reflow or gesture problem justifies it (currently `games/batak/table/HumanHandFan.tsx` and `GatherCard.tsx`). This is the accepted **permanent** end state, not a transient migration phase — see `docs/animation/ADR/ADR-003-scope-reanimated-migration-to-evidenced-need.md` for the full reasoning and the per-file engine table. Do not treat the presence of Reanimated in two files as license to migrate the rest opportunistically; each further migration needs its own evidenced justification, per that ADR.

Practically, this means: `babel.config.js` carries the worklets plugin, `App.tsx`'s root is wrapped in `GestureHandlerRootView`, and Jest needs a hand-rolled `apps/mobile/__mocks__/react-native-reanimated.js` (even Reanimated's own official mock transitively imports its native-initializing module) — a real, ongoing maintenance cost that scales with how many files use it, which is exactly why the scope is deliberately narrow.

## Dev environment note

The dev machine runs Node v22.11.0, while `react-native@0.86` (and Metro/related packages) declare an engines requirement of `^22.13.0 || ^24.3.0 || >=25.0.0`. `npm install` succeeds today with only an `EBADENGINE` warning — no functional problems have been observed. Not worth raising proactively; only relevant again if a build/Metro/install error appears that plausibly stems from this, or a new dependency hard-requires a newer Node and refuses to install/run.

## Visual verification workflow

No physical Android/iOS device or emulator was available in the original dev sandbox for most of this project's history; a workaround exists (`npx expo install react-native-web react-dom` + `expo start --web` + `playwright-core` driving the sandbox's system Chrome) that gives real, non-native visual verification — good for layout/color/typography/interaction-state, but it cannot verify native-only behavior (haptics, exact native font rendering, gesture-handler nuances, native navigation chrome) or animation *smoothness* specifically, since `react-native-web`'s `Animated` implementation doesn't exercise the same execution path as native's compositor thread.

An Android emulator was later set up (`D:\Android\Sdk`) for closer-to-production testing. Its `gfxinfo`-based frame timing is unreliable on this setup; `adb logcat`'s `EGL_emulation` `app_time_stats` lines give real per-frame GPU timing instead. Its synthetic `adb shell input tap` also does not reliably trigger `react-native-gesture-handler`'s native `TapGestureHandler` (plain RN `Pressable`/`Touchable` responds fine) — don't conclude a gesture-handler-based interaction is broken from a no-op synthetic tap alone; verify on a real device first.

Genuine physical-device verification (the user's own phone, via Expo Go) remains the authoritative check for animation smoothness and gesture-handler interactions specifically — see `docs/status/known-issues.md`'s cross-cutting entry for how far that verification currently extends across the app.
