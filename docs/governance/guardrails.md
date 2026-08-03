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

## 3. No unsolicited screenshot or visual verification

Do not perform screenshot-based visual verification proactively. Only do it when explicitly asked for a visual/screenshot check. Finish UI-affecting work with typecheck/existing-test verification and say plainly that it hasn't been visually verified, rather than launching a browser/Playwright pass unprompted.

## 4. Cross-app visual-change discussion trigger

Whenever a change is made to how cards or the table look in `apps/mobile` (or, symmetrically, a deliberate update to `apps/playground`'s look), treat that as a trigger to explicitly discuss with the user whether/how the other side should be updated to match or extend. Never silently skip this conversation, and never auto-mirror the change either — there is no automation or lint enforcing this; it's a standing reminder for every session.

## 5. Ask Quick-vs-Full audit template explicitly for animation work

Before starting any animation-related task (Playground demos or `apps/mobile` animation work), ask the user which of `docs/animation/QuickAuditTemplate.md` or `docs/animation/AuditTemplate.md` applies — do not self-select based on the Quick template's own eligibility checklist, even though that checklist is objectively checkable. Template choice determines how much scrutiny a change gets, and misclassifying a task has asymmetric downside.

## 6. Escalate to a scoped experiment after repeated targeted-fix failures

When an animation-quality problem (stutter, jank) persists despite several well-reasoned, individually-justified mitigation attempts under the current engine, escalate to a scoped, isolated experiment (e.g. a different animation library) built and evaluated in `apps/playground` first, never directly in production — rather than continuing an open-ended series of further patches under the incumbent approach. Don't wait for the user to suggest this; once roughly three targeted fixes have failed to resolve a reported issue, proactively raise the scoped-experiment option as the next step. Record the outcome as an ADR with an explicit revisit trigger (see `docs/animation/ADR/` for the model instance). This is a specific instance of the more general pattern in `docs/governance/architecture-escalation.md` — see that document for when a recurring problem generally warrants stepping back from further local patches.
