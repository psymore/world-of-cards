# Pişti: Trick-Reveal Motion (Reference-Checklist Item 7/7, final item)

**Status:** Approved
**Date:** 2026-07-10
**Scope:** The last item on the Alper Games reference checklist — "per-seat trick layout" (see `docs/references/pisti/README.md` and the `pisti_table_visual_reference` memory).

## Context

The original checklist phrase, "per-seat trick layout," comes from Batak's trick-taking mechanic: every player contributes one card per round, each visible near its own seat, then the trick is swept away. Pişti's actual mechanic is different — a single continuously-growing shared pile that any match captures in one move; there is no "trick" to lay out per seat.

Scoping this literally (building real per-seat card slots around the table) would mean inventing UI for a game state Pişti doesn't have. Instead, the approved interpretation keeps Pişti's one-shared-pile model as-is and adds a **motion cue**: the just-played card visually travels in from the direction of whichever seat played it, landing at the same center pile it already lands at today. This captures the reference's intent (you can tell who played by watching the play happen) without a mechanic Pişti doesn't need.

Three interpretations were discussed; the user chose this one ("Animate reveal from the seat") over building real per-seat card slots or leaving the pile as-is.

## Mechanism

Extends the existing `RevealCard` component in `PistiTable.tsx` (currently: one `Animated.Value`, `useRef`-held, reset via `anim.setValue(0)` per new `revealCard.card.id`, driven by `Animated.timing` to interpolate opacity 0→1 and scale 0.6→1 over 200ms with the default easing, `useNativeDriver: true`).

**Changes to that same mechanism — no new Animated.Value, no new timers:**

- Add `translateX`/`translateY` interpolations on the same `anim` value, going from a fixed per-direction offset down to `0` (landing at the pile, same as today).
- Duration changes from `200`ms to **530ms** (1.7× faster than the 900ms first shown in the mockup, per your request — `900 / 1.7 ≈ 530`).
- Easing changes from the default to `Easing.out(Easing.cubic)`, matching the mockup's CSS `ease-out` deceleration feel.
- The "X played" text label is unchanged — it stays fixed above the pile; only the card itself travels. This keeps the change scoped to motion, not a label-layout rework.

**Direction resolution** (which offset a given reveal uses):
- Human plays → `bottom`.
- AI plays → look up that player's seat via the existing `assignSeats(opponentPlayerIds)` (from `pistiSeating.ts`) → `top` / `left` / `right`.
- 2-player games only ever produce `bottom`/`top` (the single opponent is always seated `top`, per `assignSeats`'s existing fallback for non-3-opponent counts); `left`/`right` only occur in 4-player mode.

**Offset values** are a **fixed direction-based map**, not a real measured seat position (no `onLayout` pixel measurement of actual seat coordinates) — the same simplification the approved mockup itself used (its CSS keyframes are fixed percentage transforms, not measured coordinates). This keeps the change self-contained (no new layout-measurement plumbing) while still reading clearly as "came from that direction." The map lives in `pistiSeating.ts` next to `assignSeats`, since it's pure geometry data with no RN dependency, matching that file's existing scope (`SeatPosition`, `fanRotationDeg`, `fanCurveY`, etc. all live there already).

## Performance

This reuses the exact native-driver pattern already established for `RevealCard` (per the `pisti_card_ui_perf` memory) — the interpolation runs on the native UI thread via `useNativeDriver: true`, not the JS thread, so adding two more interpolated outputs (translateX/Y) on the same driver is architecturally free relative to the existing opacity/scale interpolation.

For future multiplayer games sharing this UI pattern (Hearts, Spades — real trick-taking games where up to 4 cards could need this simultaneously, unlike Pişti's one-at-a-time play): the cost scales with the number of concurrent `Animated.Value`s driven natively, which remains trivial at this scale (single-digit concurrent animations, each a lightweight interpolation, no JS-thread work per frame). No generalization into a shared component is being built now — this stays local to Pişti's `PistiTable.tsx`/`pistiSeating.ts` until a second game actually needs the same "card flies in from a seat" behavior, matching the precedent already set by `TableFelt`/`CardBackPattern` (extracted only once a second consumer existed, not preemptively).

## Explicitly Not Building This Pass

- No capture/sweep animation when the pile is collected — out of scope, a different interaction than the reveal being changed here.
- No real per-seat card layout (cards resting at separate positions around the table instead of one shared pile) — this was one of the three discussed interpretations and was not the one chosen; Pişti's one-pile mechanic is unchanged.
- No `onLayout`-measured real seat coordinates — fixed direction-based offsets only, a deliberate simplification, not a deferred TODO.
- No generalization into a shared cross-game component yet (see Performance section above).
- No new tests — this is a timing/motion tweak to existing decorative UI, same policy as `TableWoodCorners`/`PlayerAvatar`/`CardBackPattern`.

## Verification Plan

- Typecheck + full existing mobile test suite pass unchanged.
- Visual verification via the `react-native-web` + Playwright/system-Chrome screenshot workflow (per `dev_sandbox_no_device_access` memory):
  - 2-player table: confirm the AI's played card visibly travels down from the top seat toward the pile, and the human's played card travels up from the bottom.
  - 4-player table (free-for-all or partner, either is fine): confirm all four directions (`top`, `left`, `right`, `bottom`) produce a visually distinct, correctly-directed travel for the seat that played.
  - Confirm the label ("X played") still appears in its existing fixed position, unaffected by the card's travel direction.
  - Confirm no new console warnings.
