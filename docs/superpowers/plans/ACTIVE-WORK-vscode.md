---
vscode: true
vscode-copilot: true
author: "Claude Code"
vscode-note: "Shared continuity record. Claude Code and VS Code Copilot may update this file when work changes hands."
status: "active"
last-agent: "Claude Code"
updated: "2026-08-22"
---

# Active Work Handoff

This is the shared, repository-local continuity record for Claude Code and VS Code Copilot. It is not a transcript. Keep it short, factual, and current.

## Objective

- **Task:** Implement the Pis Yedili rule engine (`packages/engine/src/games/pis-yedili/`).
- **Canonical plan:** `docs/superpowers/plans/2026-08-21-pis-yedili-rule-engine.md`
- **Canonical specification:** `docs/superpowers/specs/2026-08-21-pis-yedili-rules-and-state-design.md`

## Current state

- **Completed:** All three tasks in the rule engine plan are implemented and committed — data model/`setup`/terminal-state functions (`e61ab1e`), `getLegalMoves`/`validateMove` (`abf587e`), `performMove` (`920b51b`), plus a follow-up fix for `activeSuit` corruption on a Jack-of-clubs opening and a `pendingDraw` deadlock on pass (`b361147`). The plan file's own checkboxes were never ticked despite the work being done — cosmetic only, not a sign of missing work.
- **In progress:** Nothing in-flight; working tree is clean apart from this handoff file and the Copilot Agent Kit onboarding files.
- **Next action:** Per the plan's own "Next Step" — brainstorm and plan the Pis Yedili `AIStrategy` (Easy/Medium/Hard) sub-project, building on `pisYedeliGame`, `PisYedeliState`/`PisYedeliMove`, and `canDraw` from the completed rule engine. That sub-project also owns the `index.ts`/`registerGame` wiring and the first `simulateGames`-based invariant tests, matching the Pişti/Batak precedent of registering a game only once its `AIStrategy` set exists.
- **Blocker:** None.

## Decisions and constraints

- `packages/engine` has zero dependency on React/React Native/Expo — see `docs/domains/engine/overview.md`.
- Pis Yedili is 2–4 players, free-for-all only, single 52-card deck, no jokers — no ranking rule anywhere in play except the one-time "lowest club starts" bootstrap in `setup` (see the plan's "Global Constraints").

## Files and symbols

- **Changed:** `packages/engine/src/games/pis-yedili/{types.ts,rules.ts,rules.test.ts}` — full rule engine (`pisYedeliGame: RuleEngine<...>`), plus `findStartingPlayerIndex` and `canDraw` as separately exported/tested helpers.
- **Relevant:** `docs/status/roadmap.md` currently still describes Pis Yedili as "resume brainstorming (rules-sourcing wasn't yet decided)" — that's stale relative to the completed spec and rule engine; worth reconciling next time the roadmap is touched, but not corrected here since it's out of scope for this handoff record.

## Validation

- **Checks run:** full `npm test` (root Jest, all three projects — engine/mobile/ui), 2026-08-22, after verifying the Copilot Agent Kit onboarding files (`docs/knowledge-map.md`, `.github/copilot-instructions.md`, this file, the `CLAUDE.md` routing row) against the repo's actual state. No source or test files were touched this pass.
- **Result:** `packages/engine` — all suites pass, including `pis-yedili/rules.test.ts` — the committed rule engine (`e61ab1e`→`b361147`) still holds. `packages/ui` and `apps/mobile` have pre-existing failures unrelated to this handoff: every `apps/mobile/**` suite fails at collection with `Cannot find module '@world-of-cards/engine'` (workspace symlink not resolving under Jest on this machine — root `node_modules/@world-of-cards/engine` exists and is a valid symlink, but `apps/mobile`'s Jest run doesn't resolve it), and `packages/ui/src/SeatIdentity.test.tsx` has one failing assertion (`renders a different avatar image when the avatar prop changes` — the two avatar sources compare equal). Neither is caused by or relevant to the Pis Yedili engine work; not investigated further here as out of scope for this handoff.
- **Not yet run:** nothing pis-yedili-specific remains — the AI-strategy sub-project can start from a verified-green engine baseline.

## Handoff notes

- **From:** Claude Code
- **To:** either agent
- **Read first:** this file, `docs/superpowers/plans/2026-08-21-pis-yedili-rule-engine.md`, `docs/superpowers/specs/2026-08-21-pis-yedili-rules-and-state-design.md`, and `packages/engine/src/games/pis-yedili/rules.ts`.
- **Do not:** infer missing decisions, duplicate canonical knowledge, or perform risky Git operations without explicit approval in the current chat.
