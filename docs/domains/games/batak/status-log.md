# Batak — Status Log

**Owner:** whoever last added an entry. **Load:** starting new Batak gameplay work, or checking whether a specific fix has actually been confirmed (automated test, and separately, real-device manual test) yet.

**Purpose:** a chronological, append-only record of gameplay-affecting work on Batak — what was done, what was tested (both automated, run by Claude, and manual, run by the user on a real device or emulator), and the current confirmation status of each item. This is *not* a replacement for `known-issues.md` (open problems, entries deleted once fixed, no history) or `decisions.md` (settled architectural reasoning) — this doc is the step-by-step trail of what happened and what's actually been verified, in order, including things that later turned out fixed. Newest entry first.

**Status vocabulary used below:**
- **Confirmed (automated)** — an automated check (typecheck, jest, local bundle export) passed.
- **Confirmed (on-device)** — the user verified it live on a real phone or emulator.
- **Pending** — implemented, not yet tested by either route.
- **Blocked** — testing was attempted and could not complete (with the reason noted).

---

## 2026-08-20 — Real `[BATAK-PERF]` data from the user's phone: quantifies and localizes the residual stutter

**What:** After the qualitative report below ("still some stutter, but better"), the user separately ran `expo start` and connected their real phone as an Expo dev client (not the preview APK — a proper `__DEV__` build, so `useFrameDropMonitor.ts`'s instrumentation actually fired), then pasted the live `[BATAK-PERF]` terminal output. Threshold, from reading `apps/mobile/src/hooks/useFrameDropMonitor.ts`: any `requestAnimationFrame` gap over 33ms (2× the 60fps budget) is logged and counted.

**Analysis of the pasted excerpt** (673 RAF ticks, drop counter 43 → 67, so 24 new drops in this window, ~1 every half-second of real play):

- **The `GatherCard` fix is directly confirmed by this data.** The one full mount→unmount gather cycle visible in the excerpt (`mounted 1,2,3,4` then `unmounted 3,2,1,0`) produced frame gaps of only **61.4ms and 70.1ms** — unremarkable, not spikes, nothing like the original bug's escalating multi-*second* stalls. `ADR-004`'s revert is doing its job.
- **A separate, smaller, still-open problem is visible in the same data.** All 24 drops in the window are 37–214ms — categorically smaller than the original bug, but frequent. The largest ones (214.4ms, 165.9ms, 162.1ms, 127.6ms) cluster tightly around *state-transition instants* logged by the adjacent `interactivity:` lines — the moment `isHumanTurn` flips true, the moment `localDeparture` starts, the moments immediately before/after the gather cycle — not during any animation's steady motion.
- **Drops also occur with zero animation and zero interactivity-state change nearby**: frames 864–1082 (~3.6s), six drops (36.7–100.9ms) during what reads as an idle "player deciding" stretch — no gather, no travel, no departure, no state-flag change logged anywhere near them. This rules out "it's just animation paint cost" as the sole explanation; something does recurring JS-thread work independent of visible motion (candidates, not yet investigated: AI move computation running synchronously and blocking, a polling/interval effect, or broad Zustand-selector re-renders on every store tick).

**Tests:** Manual, real device, real `__DEV__` instrumentation (not the preview APK). **Confirmed (on-device) with data**, superseding the qualitative-only entry below.

**Status:** `GatherCard` mount/unmount fix — **fully confirmed on real device with quantitative evidence**, delete-eligible from `known-issues.md` for that specific root cause. A **new, distinct, smaller issue** is now well-characterized enough to track on its own: frequent (~1/500ms of play) 37–215ms JS-thread frame gaps, worst at turn/phase-transition boundaries, present even during idle periods — cause not yet isolated between AI compute, interval/polling effects, or over-broad re-renders. Added to `known-issues.md` as its own entry rather than folded into the (now largely resolved) `GatherCard` one.

---

## 2026-08-20 — User's real-device test: `GatherCard` stutter fix is a real improvement, not a full fix

**What:** You installed build `fcc80a56` (same APK the emulator session below couldn't get past bidding on) on your own physical Android phone and played through actual hands. Reported result: a stutter is still visible during the card flight animation, but it's "indeed better" than before.

**Interpretation, not yet confirmed further:** this is a meaningful, real signal, but it needs a caveat — the original bug (`known-issues.md`'s "Animation stutter after several tricks") was specifically `GatherCard`'s Reanimated mount/unmount bookkeeping *growing monotonically worse*, reaching several seconds of stutter by trick 10+. "Better but still some stutter" is consistent with that specific escalating failure mode being fixed while a smaller, non-escalating baseline stutter remains from something else entirely — Batak's fuller game loop (AI move computation, rule-engine transitions, kitty/bid modals) competing with the animation for the JS thread, which `TravelCard`'s plain-`Animated` flight was never immune to in the first place. It is *not* automatically evidence the `GatherCard` revert (`ADR-004`) didn't work — it's evidence there's a second, smaller contributor still present.

**Tests:** Manual, real device. **Confirmed (on-device): improved.** Not yet isolated to a specific cause — open follow-up questions for next time you're testing: does the residual stutter get worse across a hand (trick 1 vs. trick 10+, like the original bug did) or stay roughly constant regardless of trick number? Does it happen on every card flight, or only some? That distinction is what would tell us whether this is "leftover from the same root cause" or "a different, smaller issue."

**Status:** `GatherCard` mount/unmount fix — **upgraded from Pending to Confirmed (on-device, partial): the escalating multi-second stutter is gone / much improved; a milder residual stutter during card flight remains, cause not yet isolated.** Superseded item's original "Pending" line, below, left as historical record of what was known before this test.

---

## 2026-08-20 — Claude attempted an Android-emulator pass on the three pending on-device items

**What:** Tried to make real progress on the three `Pending`/`Blocked` items above (stutter fix, freeze-callback fix, trick-center resize) using the tools available in this sandbox, rather than leaving them untouched. Steps taken, in order:

1. Started the existing `WorldCards_Pixel6_API35` AVD (`emulator -avd WorldCards_Pixel6_API35 -no-snapshot-load`), waited for `sys.boot_completed`.
2. Downloaded the already-built EAS preview APK (build `fcc80a56`, the one from the "let's take an expo build" request) via its `applicationArchiveUrl` rather than doing a slow local Gradle build — same code, much faster. `adb install -r` succeeded.
3. Launched the app (`monkey -p com.worldofcards.app`), confirmed via screenshot it renders correctly (Home → Batak setup → variant/difficulty selection all screenshot-verified).
4. Started a background `adb logcat` capture before beginning gameplay, intending to mine it for `[BATAK-PERF]` frame-gap data during a full trick-taking hand.
5. Navigated: tapped Batak → Standard/Medium (plain `Pressable`, worked immediately) → bid 8, auto-raised to contract 9 (You) → chose Hearts trump. All of this uses ordinary React Native touchables, and every tap landed correctly on the first try.
6. Reached the actual hand — tried to play the Ace of Hearts to lead the first trick. **This is where it stopped.** Three different synthetic-touch attempts, all no-ops (no visual change, no card played):
   - `adb shell input tap <x> <y>` on the card.
   - `adb shell input swipe <x> <y> <x> <y> 100` (tap-as-swipe, same point).
   - `adb shell input swipe <x> <y> <x> <y> 300` targeting the card's rank-label region specifically, longer press duration.
7. This reproduces `[[feedback_adb_synthetic_tap_unreliable_gesture_handler]]` exactly: the hand cards are wrapped in `react-native-gesture-handler`'s `TapGestureHandler` (`SelectableCard`), and synthetic ADB touch events don't reliably reach RNGH's recognizer on this emulator — while every plain-`Pressable` control in the same session (menu, difficulty, bid amount, trump suit, the Settings gear) worked first-try. This is an environment limitation, not new evidence the code is broken.
8. Checked the in-game Settings modal (reachable via the gear icon, a plain `Pressable`) as a fallback way to see *something* — it's the real user-facing "Dim Unplayable Cards" toggle, not the `__DEV__`-gated `BatakDevTuningModal`, since this is a release-mode preview build (`__DEV__` is false). Confirms there's no way to reach the dev-tuning panel in this build at all.
9. Stopped the logcat capture and inspected it: 3,381 lines total, **zero** `[BATAK-PERF]` lines (expected — that instrumentation is `__DEV__`-gated and this is a release build, so it can never fire here regardless of build success), and no `FATAL`/`AndroidRuntime`/app-level exceptions from `com.worldofcards.app` — only unrelated Google Play Services noise.

**Tests / results:**
- **Confirmed (on-device):** the app installs and launches cleanly on a real Android emulator API 35 image; Home, Batak setup, bidding, and trump-selection screens all render and respond correctly; no crash anywhere reached.
- **Trick-center resize:** still **Blocked** — never reached a completed trick.
- **Stutter fix (`GatherCard`):** still **Blocked** for a real measurement — couldn't play through any tricks, and even if I could, this release build carries no `[BATAK-PERF]` instrumentation to quantify it (that check needs a debug/dev-client build specifically, not a preview/production one).
- **Local-departure freeze fix:** still **Blocked** — same reason, never got to play a card.

**Why this doesn't just get retried harder:** the tap failure isn't a coordinate or timing bug on my end — it's the same documented RNGH-vs-adb gap already on record, now reconfirmed with 3 independent attempts on a range of durations/positions. Forcing it further (raw `sendevent` MotionEvent injection, mimicking exact kernel-level touch timing) is possible in principle but fragile and not a good use of effort against a limitation the project has already accepted needs a real device. **These three items still need your hands on the app** — either your physical phone, or Android Studio's own emulator UI/mouse (which sends real input events, not adb-injected ones) rather than headless adb control.

---

## 2026-08-20 — Removed `GeminiTableBackground` dev-tuning option from Batak's table

**What:** During an unrelated EAS build investigation, found `packages/ui/src/GeminiTableBackground.tsx` required a gitignored 23MB asset, breaking any clean-checkout build. It was a `__DEV__`-gated dev-tuning A/B table-background option in `BatakTable.tsx` (and Pişti's), never shipped. Per your decision, removed entirely: the component file, its export from `packages/ui/src/index.ts`, the render branch and import in `BatakTable.tsx`, and the dropdown option in `BatakDevTuningModal.tsx`. No gameplay logic touched — dev-tuning cosmetic option only.

**Tests:**
- `npx tsc --noEmit -p apps/mobile` — clean. **Confirmed (automated).**
- `npx expo export --platform android` (local bundle) — succeeded, no residual reference. **Confirmed (automated).**
- No manual/on-device test — nothing to see, since the option was never a default and is now gone.

**Status:** Done. Change is in the working tree, not yet committed.

---

## 2026-08-19 — Animation stutter after several tricks

**What:** Root-caused via temporary `[BATAK-PERF]` instrumentation (`apps/mobile/src/hooks/useFrameDropMonitor.ts`, `__DEV__`-gated, still on this branch — **strip before merge**): `GatherCard`'s Reanimated mount/unmount bookkeeping (4 simultaneous instances, up to 13×/hand) doesn't reclaim fast enough — frame-gap stalls grow monotonically worse over a hand, up to several *seconds* by trick 10+. Reverted `GatherCard` to plain `Animated`, matching `TravelCard`'s already-proven-safe same-frequency mount/unmount pattern. Decision recorded: `docs/animation/ADR/ADR-004-revert-gathercard-to-plain-animated.md`.

**Tests:**
- No unit/automated test applies — this is a runtime frame-timing issue, not logic.
- Manual: emulator frame-gap numbers were collected during investigation, but flagged as too noisy (own adb tooling + emulator overhead) to serve as a clean before/after signal. **Blocked** — needs a real-device pass.

**Status:** Fix implemented. **Pending — not yet confirmed on a real device.**

---

## 2026-08-19 — Local-departure completion callback can be dropped, freezing the human hand

**What:** Found *while* verifying the fix above, on an Android emulator: `BatakPlayTravelHandoff-Audit.md`'s fix (a Reanimated `withTiming` `onComplete` callback replacing a JS-thread duration guess) has no delivery guarantee — `useCardMotion`'s `onComplete` sometimes never fires, so `localDeparture` never clears and `canInteractWithHand` sticks `false` while it's still visibly the human's turn. No error, no recovery short of restarting the app. Fixed with a backstop timer (`BatakScreen.tsx`'s `departureBackstopTimeoutRef`) — idempotent with the real callback, whichever fires first wins.

**Tests:**
- Manual: the failure mode itself, and the fix's logic, were verified on the Android emulator via a temporary interactivity-diagnostic log in `BatakTable.tsx` (also strip before merge).
- A full repeat-repro could not complete — RNGH (`react-native-gesture-handler`) synthetic taps became unreliable mid-session on the emulator (see `adb_synthetic_tap_unreliable_gesture_handler` in memory). **Blocked** for that reason.

**Status:** Fix implemented. **Pending — not yet confirmed on a real device.**

---

## 2026-08-19 (approx.) — Trick-center resize shipped

**What:** Replaced the earlier "hold the card at full `size=\"normal\"` for the whole flight" workaround. Cards now genuinely shrink to trick footprint, in flight and at rest — `PlayingCard.contentScale` (new, `packages/ui`) independently compensates the corner index and suit watermark; `BatakHandCard`'s local-departure leg does the shrink for a human play; `apps/mobile/src/games/batak/table/trickCardScale.ts` is the single source for all three constants. See `docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md`.

**Tests:** None recorded yet, automated or manual.

**Status:** Shipped. **Pending — not yet on-device-verified** (`docs/animation/audits/BatakTrickResize-Audit.md`'s Approval is conditional on this). Two known sub-gaps, not blockers to verification but worth checking during the same pass:
- `contentScale` is discontinuous at the local-departure→`TravelCard` handoff (a small "landing pop" on a different channel than the resize itself).
- `LOCAL_DEPARTURE_SCALE`'s 100%-during-departure split is an unconfirmed tuning choice — retune toward spreading more into the flight if it reads as abrupt live.

---

## Open, not yet started

Carried here for visibility, not duplicated in full — see `known-issues.md` for detail:
- Human-hand travel-origin gap (fixed generic offset instead of the card's real position) — not spec'd, three approaches discussed.
- Reduced-motion timing gap (cards vanish ~530ms before the trick-won badge updates).
- Bidding AI miscalibration (Medium/Hard bids too aggressively) — separate from animation, `handStrength.ts`.

---

## How to add an entry

New entry at the **top** of the dated list (newest first), same shape as above: what was done, what was tested and by which route (automated vs. manual/on-device), and an explicit status using the vocabulary defined at the top of this doc. If a manual test is blocked (tooling limitation, environment issue), say so and why — don't leave it silently untested. When an item finally gets **Confirmed (on-device)**, also delete its corresponding entry from `known-issues.md` per that file's own convention (entries deleted once fixed, not marked done).
