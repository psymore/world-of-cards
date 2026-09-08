# Session Checkpoint — How-to-Play Rules Summary

## Current Objective

Finish the "how to play" rules-summary feature on branch `feature/how-to-play-rules-summary`. Implementation is done; the session is mid-way through `superpowers:finishing-a-development-branch`, blocked at its Step 1 test-verification gate.

## Current State

- **Tasks 1–6 of the plan: complete, each passed its own task-scoped review.** 6 commits on the branch (`5f1906c..fdb891a`).
- **Task 7 (on-device/emulator verification of the nested info-icon touch target): deferred** at the user's explicit request — no Android device was connected (`adb devices` empty). Still open.
- **Final whole-branch review: skipped** at the user's explicit request (session usage was at 84%; first opus dispatch was killed mid-run).
- **Blocker:** root `npm test` failed with **exit code 4**. Cause not yet diagnosed — the captured output file retained only its tail, showing `act(...)` console noise that matches the *pre-existing, already-documented* `GameResultModal` act() warning (`docs/domains/games/pisti/known-issues.md#gameresultmodal-act-warning`), not a clear failure summary. It is **not yet known** whether the failure is pre-existing on `master` or caused by this branch.
- Root `npm test` runs jest over 3 projects: `packages/engine`, `packages/ui`, `apps/mobile` (playground is absent — a pre-existing documented gap).

## Files Changed

**On this branch (committed):**
- New: `apps/mobile/src/components/RulesSummaryModal.tsx` (game-agnostic modal + `GameRules`/`GameRulesSection` types)
- New: `apps/mobile/src/games/{pisti,batak,pis-yedili}/rules.ts` (per-game Turkish rules content)
- New: `apps/mobile/src/games/rulesRegistry.ts` (gameId → GameRules, mirrors `registry.ts`)
- Modified: `apps/mobile/src/screens/home/GameMenuRow.tsx` (adds `onInfoPress` + nested info-icon `PressableFeedback`)
- Modified: `apps/mobile/src/screens/HomeScreen.tsx` (single `rulesModalGameId` state, registry lookup, modal render)

**Already committed to `master` earlier this session (5f1906c):** `docs/governance/monetization-principles.md` (new), `CLAUDE.md`, `docs/status/roadmap.md`, `docs/status/known-issues.md`, `docs/domains/ui-visual-system/known-issues.md`, `docs/superpowers/specs/2026-09-04-ux-monetization-research-backlog.md`, `docs/superpowers/specs/2026-09-05-how-to-play-rules-summary-design.md`, `docs/superpowers/plans/2026-09-05-how-to-play-rules-summary.md`.

**Not ours — do not commit:** pre-existing uncommitted user work in `apps/mobile/src/games/batak/{BatakScreen,table/BatakHandCard,table/TrickCenter}.tsx` and `apps/mobile/src/table/TravelCard.tsx`.

## Important Decisions

- Monetization principles draft **accepted verbatim** → `docs/governance/monetization-principles.md` (no loot boxes, no pay-to-win, rewarded-only opt-in ads).
- Analytics SDK: **deferred, none adopted** — stay local-stats-only until there is a real audience.
- Octalysis-lite idea (local "best score this week" / win-streak stat) **accepted onto** `docs/status/roadmap.md` as item 12.
- Rules content authored from the **actual engine source**, not generic knowledge; user reviewed and approved the final Turkish text for all three games.
- Work done on a **local branch, not a worktree** (per guardrails Rule 2, user's choice).

## Constraints

- Guardrails Rule 1: **ask before every commit and merge** — nothing merges without explicit approval.
- Engineering Principle 1: `packages/engine` stays React-free; rules prose lives in `apps/mobile`.
- Engineering Principle 4: **no proactive tests** for mobile UI — none were added, by design.
- `finishing-a-development-branch` Step 1: the merge/PR menu only comes **after a green suite**.

## Problems / Unresolved Issues

1. **`npm test` exit code 4, undiagnosed.** Must determine whether it is pre-existing on `master` or introduced by this branch before the finishing menu can be presented.
2. **Task 7 never performed** — the nested info-icon touch target inside `GameMenuRow`'s row-wide `PressableFeedback` has never been exercised on a real device or emulator. Implemented per spec and reviewed as sound by code reading only.

## Failed Approaches

- Running root `npm test` unfiltered: exceeded the 5-minute foreground timeout, moved to background, and the retained output file kept only the tail — the actual pass/fail summary was lost. Next attempt should filter to summary lines (`Test Suites:` / `Tests:` / `FAIL`) or scope the run to `apps/mobile`.

## Next Steps

1. Re-run tests capturing a compact summary (filter to `FAIL`/`Tests:`/`Test Suites:` lines), scoped to `apps/mobile` first since that is this branch's entire blast radius.
2. Determine whether any failure is pre-existing (e.g. run the same scoped tests at merge-base `5f1906c` in a temporary worktree — do **not** switch branches in this checkout, the user has uncommitted work here).
3. If failures are ours: fix, then re-verify. If pre-existing: record that finding and proceed.
4. Present the `finishing-a-development-branch` menu (merge locally / push+PR / keep as-is) and wait for the user's choice.
5. Task 7 live verification with the user when a device is available: tapping the info icon must open the correct game's rules modal and must **not** also trigger `onSelectGame`; tapping elsewhere on the row must still open the game.

## Important Context

- **SDD ledger with the full task log and every ruling:** `.superpowers/sdd/2026-09-05-how-to-play-rules-summary/progress.md` (git-ignored). Workspace deliberately left in place because the final review never completed.
- **Spec:** `docs/superpowers/specs/2026-09-05-how-to-play-rules-summary-design.md` · **Plan:** `docs/superpowers/plans/2026-09-05-how-to-play-rules-summary.md`
- **Research backlog with open decisions:** `docs/superpowers/specs/2026-09-04-ux-monetization-research-backlog.md`
- **Published artifacts:** Kart Kataloğu (UX/monetization research catalog) `https://claude.ai/code/artifact/7364c818-20d8-4ae5-b98f-50e6614943cd` · Tasarım Panosu (index of this project's design artifacts) `https://claude.ai/code/artifact/fecc782c-fda9-421d-be95-806fc3cea00e`
- Known open research gaps the user asked about: paywalled academic full texts, proprietary market reports (Sensor Tower / data.ai / Newzoo), GameRefinery, and **no Turkish-market-specific research has been done at all** — the user expressed interest in a Turkish-focused research pass.
