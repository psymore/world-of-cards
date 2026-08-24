# Guardrails

**Owner:** Project owner, established via direct correction (same mechanism as always). **Scope:** Claude's behavior in this repo — collaboration, workflow, process. **Load:** always, before any implementation work.

These are standing behavioral rules — generalized from specific past corrections, but stated here as rules that apply regardless of which task prompted them originally. Per `architecture/phase-2-knowledge-architecture-design.md` §8, the corresponding `memory/feedback_*.md` files now point back to this document instead of restating these rules; anything genuinely specific to this Claude sandbox's own environment (not a repo-wide rule) stays in memory only — see that file's own contents for what's still there.

**Size discipline for this file itself:** if an addition needs more than 2–3 lines of justification, it probably belongs in a domain's `decisions.md` or `known-issues.md` instead of growing this file. If the same class of problem is being patched here for the third time, that's a signal for `docs/governance/architecture-escalation.md`, not another guardrail bullet.

---

## 1. Ask before every commit and every merge

Ask before running `git commit` and before merging a branch (e.g. into `master`). Don't commit or merge autonomously just because a task/plan step says to, or because a subagent-driven-development task finished cleanly — this applies even mid-plan, task-by-task. A short confirmation is enough; it doesn't need to be a full formal question unless the situation is ambiguous. This rule has no exceptions for document type: a spec or plan doc is committed under the same ask-first rule as any other file — see the note below, which governs *priority/timing* only, never authorization.

The one recognized exception: at the start of a bulk multi-commit workflow (subagent-driven-development, executing-plans), it's fine to explicitly ask up front whether to run autonomously for that one execution — but ask each time; autonomy granted once does not carry over to the next plan or session.

**Prioritize proposing a commit for spec/plan docs early, not automatically.** Once a design spec or an implementation plan is written to disk, treat committing it (to the base branch, before creating the implementation branch) as a high-priority thing to *raise with the user* — the same way a design spec already gets proposed for commit at the end of brainstorming — rather than deferring it to the end of a long plan. Don't treat "saved to disk" as equivalent to "safe": an untracked file sitting in the working tree across multiple subagent dispatches and tool calls has no diff/log to recover from if anything removes it. This is a timing/priority preference only — it does **not** authorize committing a spec/plan doc without asking, and does not override the rule above in any case. No automation (hook, script, or otherwise) enforces this; it's a judgment call Claude applies the same way as any other guardrail.

## 2. Branch workflow: local named branches, worktrees opt-in

Default to a local branch directly in the main repo (`git checkout -b <category>/<short-description>`, e.g. `ui/improve-table-view`, `feature/hard-ai-improvements`, `game/klondike-solitaire`) rather than a sibling git worktree. Only reach for a worktree if the change genuinely seems to need isolation (large/risky, or needs a clean baseline) — and ask first before setting one up.

## 3. Screenshot/visual verification: proactive, but clean up before merge

As of 2026-08-14 (phone-connected development phase), take screenshots proactively whenever useful to verify UI-affecting work — don't wait to be asked. This supersedes the prior "only when explicitly asked" stance from 2026-07-17. Before merging a branch, delete any screenshot files produced during that work so they don't get committed or left in the working tree.

## 4. Cross-app visual-change discussion trigger

Whenever a change is made to how cards or the table look in `apps/mobile` (or, symmetrically, a deliberate update to `apps/playground`'s look), treat that as a trigger to explicitly discuss with the user whether/how the other side should be updated to match or extend. Never silently skip this conversation, and never auto-mirror the change either — there is no automation or lint enforcing this; it's a standing reminder for every session.

## 5. Ask Quick-vs-Full audit template explicitly for animation work

Before starting any animation-related task (Playground demos or `apps/mobile` animation work), ask the user which of `docs/animation/QuickAuditTemplate.md` or `docs/animation/AuditTemplate.md` applies — do not self-select based on the Quick template's own eligibility checklist, even though that checklist is objectively checkable. Template choice determines how much scrutiny a change gets, and misclassifying a task has asymmetric downside.

## 6. Escalate to a scoped experiment after repeated targeted-fix failures

When an animation-quality problem (stutter, jank) persists despite several well-reasoned, individually-justified mitigation attempts under the current engine, escalate to a scoped, isolated experiment (e.g. a different animation library) built and evaluated in `apps/playground` first, never directly in production — rather than continuing an open-ended series of further patches under the incumbent approach. Don't wait for the user to suggest this; once roughly three targeted fixes have failed to resolve a reported issue, proactively raise the scoped-experiment option as the next step. Record the outcome as an ADR with an explicit revisit trigger (see `docs/animation/ADR/` for the model instance). This is a specific instance of the more general pattern in `docs/governance/architecture-escalation.md` — see that document for when a recurring problem generally warrants stepping back from further local patches.

## 7. "CMP" / "BCMP" shorthand: commit, (branch,) merge to master, push

When the user says "CMP" or "BCMP" (and only then), that word itself is the confirmation Rule 1 requires for that invocation. Run the matching script rather than the equivalent individual git commands — both already end with a code-index rebuild (Rule 10) baked in, so nothing further is needed after they finish:

- **CMP** — commits onto the branch already checked out (no new branch), merges it into `master`, pushes: `scripts/git/cmp.ps1 -Message "<msg>" -Force`.
- **BCMP** — branches off first, then commits/merges/pushes the same way: `scripts/git/sync-branch.ps1 -BranchName "<category>/<short-description>" -Message "<msg>" -Force`.

Still stop and surface anything ambiguous the script reports (merge conflict, diverged remote, failed commit) rather than forcing through — the scripts themselves refuse to force-push or discard work. Compose `-Message` (and `-BranchName` per Rule 2's convention) the same way you would for the manual commands; only the mechanical steps are collapsed into one call.

## 8. adb safety boundary during phone-connected development

Established 2026-08-14, when development began using the user's physical Android phone over adb. Unrooted `adb shell` already can't read other apps' private sandboxed data — but shared storage (`/sdcard`, i.e. Photos/DCIM, Downloads, WhatsApp media), package management (install/uninstall/clear-data of *any* app), system settings, screen capture, and input injection are all reachable and not sandboxed. Stay inside this whitelist without asking; ask first for anything outside it, every time:

- **Allowed:** install/launch/stop the dev build, `logcat` (optionally filtered to its package), `input tap`/`swipe`, `screencap`/`screenrecord`, `push`/`pull` restricted to a dedicated scratch folder (e.g. `/sdcard/Download/claude-scratch/`).
- **Never, without asking first:** `adb root`, `adb backup`, `pm uninstall`/`pm clear` on anything other than the dev build, `settings put`, or any `rm`/`push`/`pull` outside the scratch folder.
- Before a screenshot or input-injection, confirm the dev build is actually the foreground app (`dumpsys window` or just ask) rather than assuming.

## 9. Code-index: consult on demand, never as a blanket precheck

Consult it (`code-index/LAYOUT.md` / `LAYOUT_<module>.md` / a live SQL query via the MCP server / the viewer) before writing code only when one of these is true: the file/module isn't already open or read this session; you're adding a new cross-module import (check dependency direction in `LAYOUT.md` first); you're adding a new symbol (quick duplicate check); you're changing, removing, or renaming something with unknown blast radius (check in-degree/`file_edges` first); or the task is itself exploratory ("where does X live," "how is Y structured"). Skip it when the target file is already open/read this session, or the edit is small and self-contained with no new symbols and no new cross-module edges — the file itself is more current than the index at that point. If unsure: would this answer something not already known, more cheaply than reading/grepping the files directly? If yes, consult it; if you already have the answer, don't consult it as ritual.

## 10. Code-index: rebuild before trusting it, no automation keeps it fresh

`code-index/code_index.db` only reflects reality as of its last `update_codeindex.ps1` run — nothing hooks, lints, or reminds otherwise. Confirmed concretely on 2026-08-21: it had silently drifted 16 days (151 commits / 277 files changed) with no signal that it was stale. After any task that adds, removes, or renames files or exported symbols, run `.\code-index\update_codeindex.ps1` (and `python code-index\viewer\export_graph.py` if the viewer is in use) before relying on the next query or handing the index off as current. If a query result seems suspicious for something recently touched, check `code-index/code_index.db`'s mtime against `git log -1` before trusting it — don't assume freshness just because the file exists.

Also run it as the last step of every `git push` Claude performs — a push is a natural, hard-to-miss sync point that catches anything accumulated since the last rebuild, even changes not individually flagged under the trigger above. `scripts/git/cmp.ps1` and `scripts/git/sync-branch.ps1` (Rule 7's "CMP"/"BCMP") already do this automatically; for a push outside those two paths, run `.\code-index\update_codeindex.ps1` manually.
