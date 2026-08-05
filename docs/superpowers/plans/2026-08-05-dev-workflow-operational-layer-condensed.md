# Dev Workflow Operational Layer — Condensed Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This is the primary execution document. For exact production-code bodies for any task, see the full plan: `docs/superpowers/plans/2026-08-05-dev-workflow-operational-layer.md` (same 11 tasks, same order, same interfaces).
>
> **Testing strategy superseded (this execution phase):** the full plan's `*_test.py` steps, TDD RED/GREEN framing, and per-task `unittest` files are **not** built in this phase — see §8. Take only the production code (dataclasses, functions, file layout) from the full plan; skip every step that creates a test file.

**Spec:** `docs/superpowers/specs/2026-08-05-dev-workflow-operational-layer-design.md` (frozen, Accepted).

---

## 1. Goal

Build the six commands from the accepted spec — `repo status`, `repo impacted`, `repo prepare`, `repo commit`, `repo publish`, and the Code Index freshness guard — as a Python CLI layered on top of the existing Code Index (`code-index/code_index.db`, `code-index/module_map.json`) and git.

## 2. Scope

- The five `repo <name>` commands (spec §2.1–§2.5) plus the Code Index freshness guard (spec §2.6).
- Shared infrastructure four modules depend on: git state, module resolution, staleness, Code Index queries.
- A single CLI dispatcher (`ops/repo.py`) and one `package.json` script.
- Integration of the freshness guard into the existing `code-index/update_codeindex.ps1`.

## 3. Out of scope

- **Consolidated WKA Validator** (spec §4) — a separate future plan.
- **Machine-readable domain-ownership manifest** — spec §5's open prerequisite; `repo impacted --check-docs` reports `mapping_not_available` for every module until it exists.
- **True incremental (per-file) Code Index extraction** — spec §2.6 descopes this to a memoized skip-if-unchanged guard, which is all Task 11 builds.
- **Task Planner / Edit Planner / Repository Health Dashboard** — dropped from the roadmap during the design review; nothing to implement.
- `ops/code_index_db.py`'s `module_edges` raw-row query — only the two aggregate queries this plan's commands actually use are built; a full `module_edges` reader is the WKA Validator plan's concern.

## 4. Existing assumptions

Binding constraints, carried over from the spec unchanged:

- No command ever calls `git commit`, `git push`, or creates a PR — `repo commit`/`repo publish` only ever return a draft.
- Every command reading `file_edges`/`module_edges`/`symbols` surfaces the Code Index's current staleness label; none of them triggers a rebuild on its own.
- The module boundary is exactly `code-index/module_map.json`'s four keys — no finer-grained boundary anywhere in this plan.
- The documentation-drift mapping (`DOC_MAPPING`) stays an empty dict — never invented, guessed, or inferred.
- Every shared computation (diff files, module resolution, staleness, Code Index queries) lives in exactly one module and is imported, never re-derived, by every consumer.
- No new Python or Node dependency is introduced anywhere in this plan.

Facts verified against this repo, not re-derived:

- `code-index/module_map.json` has exactly four keys: `mobile`, `playground`, `engine`, `ui`.
- Root `jest.config.js`'s three `projects` entries (`engine`, `ui`, `mobile`) have `displayName` values identical to their module keys — `repo prepare`'s `JEST_PROJECTS` mapping relies on this exact match. `playground` has no jest project; `repo prepare` skips the test step for it.
- All four modules (`apps/mobile`, `apps/playground`, `packages/engine`, `packages/ui`) have their own `tsconfig.json`; no module has a `typecheck` npm script today — `repo prepare` invokes `npx tsc --noEmit -p <tsconfig>` directly rather than delegating to a script that doesn't exist.
- Python 3.12 stdlib only; `pytest` is not installed and is not introduced.
- No proactive unit tests this phase — consistent with `docs/governance/engineering-principles.md` #4's standing default (don't write new tests proactively; the one standing exception is the engine core, which `ops/` is not). No `*_test.py` files, no test framework, no fixtures/mocks/harnesses. Verification is manual (§8); a test is added only if a real, otherwise-undiagnosable bug demands one.
- `code-index/find_violations.py` already prototypes the exact join-query shape `ops/code_index_db.py` parameterizes.
- `code-index/update_codeindex.ps1` already preserves `module_map.json` across cleanup (it's not in the deleted-artifacts list), so the freshness guard can read it before Phase 1 re-runs discovery.

## 5. Architecture overview

New `ops/` package at repo root, mirroring the spec's own dependency shape (spec §3):

```
ops/
├── git_utils.py        branch, working-tree status, diff files, commit log, remote tracking
├── module_map.py        loads module_map.json, resolves file path -> module key
├── staleness.py          the one staleness computation every consumer shares
├── code_index_db.py     blast-radius queries against code_index.db
├── repo_impacted.py      diff -> affected set (+ --check-docs, always "mapping_not_available")
├── repo_status.py        aggregated read-only report
├── repo_prepare.py       narrowest verification for repo_impacted's affected set
├── repo_commit.py        stage + draft commit message (never `git commit`)
├── repo_publish.py       draft PR + push preview (never `git push`/PR creation)
├── repo.py               argparse CLI dispatcher — imports the five command modules
└── staleness_cli.py      exit-code shim so update_codeindex.ps1 reuses staleness.py
```

Each command module exposes a plain function other modules import directly (Principle 9, composability) — `repo_prepare` and `repo_commit` both call `repo_impacted.compute_impacted` rather than re-deriving the affected set; `repo_status`, `repo_impacted`, and `staleness_cli` all call the same `staleness.check_staleness`. `ops/repo.py` only parses arguments and formats output — it contains no command logic of its own. `code-index/update_codeindex.ps1` gains a `-Force`-overridable guard clause at the top that calls `staleness_cli.py` and exits early when fresh.

## 6. Task list (ordered)

**Task 1 — Git state helpers.** One-line responsibility: wrap `git` subprocess calls (branch, working-tree status, diff files, commit log, remote tracking) so no other task shells out to git directly.
Files: `ops/__init__.py`, `ops/git_utils.py`.
Produces: `WorkingTreeStatus`, `CommitInfo`, `RemoteTrackingInfo`, `get_current_branch`, `get_working_tree_status`, `get_diff_files`, `get_commits_since`, `get_remote_tracking_state`.
Verify: run each function against this actual repo from a `python -c` one-liner; inspect output against `git status`/`git log` by eye.

**Task 2 — Module resolution.** One-line responsibility: load `module_map.json` and resolve a file path to its module key — the single place spec §1's "module boundary" is read.
Files: `ops/module_map.py`.
Produces: `ModuleMap`, `load_module_map`, `resolve_module`.
Verify: load this repo's real `code-index/module_map.json`; resolve a couple of known real paths (e.g. `apps/mobile/App.tsx`, `packages/engine/src/index.ts`) and inspect the returned key.

**Task 3 — Staleness check.** One-line responsibility: the one shared staleness computation (source mtimes vs. db mtime) every consumer calls instead of re-deriving.
Files: `ops/staleness.py`.
Produces: `StalenessResult`, `check_staleness`.
Verify: run against this repo's real `code-index/code_index.db` and `module_map.json`; inspect the reported staleness against a manual `Get-ChildItem`/`ls -la` mtime comparison.

**Task 4 — Code Index queries.** One-line responsibility: blast-radius lookups (`get_dependent_files`/`get_dependent_modules`) against `code_index.db`, parameterizing the join shape `find_violations.py` already prototypes.
Files: `ops/code_index_db.py`.
Produces: `get_dependent_files`, `get_dependent_modules`.
Verify: run against the real `code_index.db` with a file/module already known (from `code-index/LAYOUT.md`) to have dependents; inspect the returned list against that file.

**Task 5 — `repo impacted`.** One-line responsibility: diff → affected set (changed/dependent files and modules) plus a `--check-docs` mode that only ever reports `mapping_not_available` (spec §2.2/§4).
Files: `ops/repo_impacted.py`.
Produces: `AffectedSet`, `DOC_MAPPING` (empty), `compute_impacted`.
Verify: touch a real file in this repo, run `compute_impacted` against the real repo/db, inspect the affected set; confirm `--check-docs` output is `mapping_not_available` for every affected module.

**Task 6 — `repo status`.** One-line responsibility: aggregate branch/working-tree/staleness/roadmap-pointer/known-issues-count into one read-only report.
Files: `ops/repo_status.py`.
Produces: `StatusReport`, `compute_status`.
Verify: run against this real repo; cross-check branch/working-tree fields against `git status`, and the known-issues count against `docs/status/known-issues.md` by eye.

**Task 7 — `repo prepare`.** One-line responsibility: run the narrowest applicable `tsc`/`jest` verification per module in `repo impacted`'s affected set; surface (never enforce) the engine testing-policy reminder.
Files: `ops/repo_prepare.py`.
Produces: `ModuleVerification`, `PrepareReport`, `JEST_PROJECTS`, `ENGINE_TESTING_POLICY_REMINDER`, `run_prepare`.
Verify: touch a real file under `packages/engine`, run `run_prepare`, confirm it actually shells out to `npx tsc`/`npx jest` and the reminder appears when no `.test.ts` file is touched.

**Task 8 — `repo commit`.** One-line responsibility: stage the affected set's files and draft a commit message; never calls `git commit`. Per the boundary ruling, staging is added as a new `stage_files(repo_root, files)` function in `ops/git_utils.py` (Task 1's module) as part of this task — `repo_commit.py` itself never calls `git` directly.
Files: `ops/repo_commit.py`; **Modify:** `ops/git_utils.py` (add `stage_files`).
Produces: `CommitDraft`, `draft_commit`; `git_utils.stage_files`.
Verify: run against a real, currently-dirty file in this repo; confirm `git status` shows it staged afterward and `git log -1` is unchanged.

**Task 9 — `repo publish`.** One-line responsibility: draft an editable PR (title/body from commits since `master`) and an inert push preview; never pushes or creates a PR.
Files: `ops/repo_publish.py`.
Produces: `PushPreview`, `PublishDraft`, `draft_publish`.
Verify: run against this real branch (`feature/dev-workflow`) vs. `master`; inspect the drafted title/body against `git log master..HEAD`.

**Task 10 — CLI dispatcher + npm script.** One-line responsibility: `argparse` subcommands wiring `status`/`impacted`/`prepare`/`commit`/`publish` to Tasks 5–9's functions — no command logic of its own.
Files: `ops/repo.py`; **Modify:** `package.json`.
Produces: `build_parser`, `main`.
Verify: `npm run repo -- status` (and each other subcommand) against this real repo; inspect printed output.

**Task 11 — Code Index freshness guard.** One-line responsibility: a CLI shim exposing Task 3's staleness check as an exit code, wired into `update_codeindex.ps1` as a skip-if-fresh guard (`-Force` bypasses it).
Files: `ops/staleness_cli.py`; **Modify:** `code-index/update_codeindex.ps1`.
Produces: `main` (exit 0/1); `-Force` switch on the `.ps1`.
Verify: run `update_codeindex.ps1` twice in a row (second run should skip); run once with `-Force` (should always rebuild).

## 7. Task dependencies

```
1 (git_utils)  ─┐
2 (module_map) ─┼─▶ 3 (staleness, needs 2) ─┐
                │                            ├─▶ 5 (repo_impacted, needs 1+2+3+4)
4 (code_index_db, standalone) ───────────────┘        │
                                                        ├─▶ 7 (repo_prepare, needs 2+5)
                                                        ├─▶ 8 (repo_commit, needs 2+5)
6 (repo_status, needs 1+2+3) ───────────────────────────┤
9 (repo_publish, needs 1, standalone otherwise) ────────┤
                                                        ▼
                                          10 (CLI dispatcher, needs 2+5+6+7+8+9)
                                                        │
                                                        ▼
                                          11 (freshness guard, needs 2+3;
                                              independent of 10, ordered last
                                              only because it modifies the
                                              existing .ps1 pipeline)
```

Strict build order (respects the above, matches the full plan's task numbering): **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11**.

| Task | Depends on |
|---|---|
| 1 | — |
| 2 | — |
| 3 | 2 |
| 4 | — |
| 5 | 1, 2, 3, 4 |
| 6 | 1, 2, 3 |
| 7 | 2, 5 |
| 8 | 2, 5 |
| 9 | 1 |
| 10 | 2, 5, 6, 7, 8, 9 |
| 11 | 2, 3 |

## 8. Verification criteria

**Verification approach for this phase:** no test suite, no fixtures, no mocks. Each task is verified by hand, directly against this real repository, using the three tools available under a no-proactive-testing policy: **import checks** (does the module load and the function run without error), **command execution** (run the real CLI/subprocess path), and **expected-output inspection** (does the printed/returned value match what a human glance at `git status`/`git log`/the real DB/the real docs would show). No temp-directory fixtures, no hand-built databases — every check below runs against the actual `world-cards` repo state, which is safe because every command through Task 9 is read-only or draft-only (§0 constraint 4).

**Reactive testing trigger:** if a task's manual verification surfaces a bug that can't be pinned down by inspection alone (e.g. an intermittent result, a diff between expected and actual that isn't explainable by reading the code), add the minimum single test needed to reproduce and pin it down — nothing broader, and not before that point.

- **Per task:** run that task's "Verify" line from §6 after implementation; confirm the output by inspection. No fail→pass cycle to run — there is no test to fail first.
- **Task 8 (`repo commit`):** after `draft_commit()` runs against a real dirty file, confirm by hand: `git status` shows it staged, `git log -1 --pretty=%s` is unchanged (proves it never actually commits).
- **Task 10:** `npm run repo -- status` (and each other subcommand) against this real repo — inspect printed output line by line.
- **Task 11:** run `update_codeindex.ps1` twice in a row (second run must print the skip message, not re-run Phases 1–7); run once with `-Force` (must always rebuild).
- **Acceptance (spec conformance), checked once at the end:**
  - [ ] All five `repo <name>` commands are independently callable via `python ops/repo.py <name>` (Principle 9).
  - [ ] No code path in `ops/` calls `git commit`, `git push`, or creates a PR (spec §2.4/§2.5 Boundaries) — confirmed by Task 8's manual check plus inspection of every `subprocess`/`git` call site in `ops/`.
  - [ ] `repo_impacted.DOC_MAPPING` is empty; `--check-docs` reports `mapping_not_available` for every module (spec §2.2/§4/§5).
  - [ ] `repo_impacted`, `repo_prepare` (via `repo_impacted`), and `staleness_cli` all route through the one `ops/staleness.check_staleness` (spec §1 staleness consumption rule) — confirmed by inspection (grep for `check_staleness` call sites).
  - [ ] All `git` subprocess calls anywhere in `ops/` live in `ops/git_utils.py` only (boundary rule) — confirmed by inspection (grep for `subprocess` + `"git"` outside that file).
  - [ ] `update_codeindex.ps1` skips its pipeline when fresh, always rebuilds under `-Force` (spec §2.6).
  - [ ] No new Python or Node dependency was added (`package.json`/environment diff shows only the `repo` script line).

## 9. Commit boundaries

One commit per task, in order, each gated on that task's manual verification succeeding first:

1. `feat(ops): add git state helpers`
2. `feat(ops): add module resolution against module_map.json`
3. `feat(ops): add shared Code Index staleness check`
4. `feat(ops): add Code Index blast-radius queries`
5. `feat(ops): add repo impacted command`
6. `feat(ops): add repo status command`
7. `feat(ops): add repo prepare command`
8. `feat(ops): add repo commit command`
9. `feat(ops): add repo publish command`
10. `feat(ops): add repo CLI dispatcher and npm script`
11. `feat(ops): add Code Index freshness guard to update_codeindex.ps1`

No task's commit includes another task's files. No commit in this plan runs `git push` or opens a PR — per the standing guardrail (ask before every commit and merge), each commit above is proposed for confirmation individually during execution, not batched or run autonomously.
