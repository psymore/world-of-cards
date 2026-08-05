# Dev Workflow Operational Layer — Design

**Type:** Specification (WKA v1.0 Artifact). **Status:** Proposed — not yet Accepted, not yet implemented.
**Owning Domain:** Governance-owned, cross-cutting — this layer spans every domain in the repo (it operates on git state and the Code Index, neither of which belongs to a single domain) and is exempt from single-domain ownership per `architecture/wka-v1.0-canonical-model.md` §3's cross-cutting-Artifact exemption.
**Traces to:** `docs/governance/engineering-principles.md` (build pipeline, testing policy) and `docs/governance/guardrails.md` (ask-before-commit/merge, rule 1) as the Governance Rules this layer must never contradict. Realizes no Code Index entity yet — it is not yet implemented (see §1a lifecycle: an unrealized Specification is a legitimate, visible state).

---

## 0. Purpose, philosophy, and constraints

**Primary objective: optimize context, never knowledge.** This layer's single reason to exist is to minimize the cost — in tokens, files, and queries — of obtaining context a human or an AI must already be able to trust, never to produce context of its own. It is an information-flow optimizer, not a new abstraction layer: every command exists to get an already-known answer in front of whoever needs it faster and cheaper, never to compute a new kind of answer WKA or the Code Index doesn't already produce.

**Division of responsibility.**
- **WKA remains solely responsible for architectural decisions** — domain ownership, governance rules, what a change means.
- **The Code Index remains solely responsible for structural facts** — what exists, what depends on what.
- **The Operational Layer decides neither.** It never becomes a second source of truth for anything WKA or the Code Index already answers; it only routes existing answers to the point of use faster, with fewer queries and lower token cost, for a human or for Claude — see item 6 below for the exact test this claim must satisfy.

If a future addition to this layer would need to decide something WKA doesn't already decide, or know something the Code Index doesn't already record, that addition belongs in WKA or the Code Index — not here.

Binding constraints on every command below, all in direct service of the primary objective:

1. **No new routing.** A command may *read* the Code Index or WKA docs; it may never introduce an alternative way to decide domain ownership, authority, or navigation order — that would add context to load, not remove it.
2. **No duplicated analysis.** If a fact is already derivable from `file_edges`/`module_edges`/`module_map.json`, a command queries it — it does not recompute it from a fresh filesystem scan. A filesystem scan is the most expensive way to answer a question this repository already has an index for, and is avoided whenever the Code Index already holds the answer.
3. **Recompute only when correctness requires it.** A command reuses a prior result — its own from an earlier invocation, or another command's — by default. It only recomputes when the underlying state has actually changed since that result was produced, never as a matter of habit or caution.
4. **Draft, never execute, for anything visible to others or hard to reverse.** Any command that touches `git commit`, `git push`, or PR creation produces a draft/proposal only. The actual mutating command still requires explicit human confirmation, per `guardrails.md` rule 1 — this layer does not change, weaken, or route around that rule.
5. **Deterministic.** Every command's output is a pure function of (current git state, current Code Index state, current docs on disk). No hidden state, no memory of prior invocations beyond what's observable in those three sources.
6. **The Operational Layer never becomes a source of knowledge.** It may aggregate, filter, compress, order, summarize, or reformat facts that already exist in git, the Code Index, or the docs — and only that. It must never introduce a new fact, a new architectural conclusion, an ownership decision, a piece of repository state, or an interpretation that isn't already present in one of those three sources. **The test:** if the Operational Layer were deleted entirely, every fact it ever surfaced must still be recoverable — slower, by hand, at higher cost, but recoverable — from git, the Code Index, or the docs directly. A fact that would become unrecoverable without this layer means the layer has stopped being operational and has become a fourth source of truth, which this spec forbids.
7. **Progressive narrowing (across the pipeline).** Each command in the core sequence (§2.1–§2.5) must reduce the amount of information its output holds relative to what a human or AI would otherwise have had to gather by hand at that step — never expand it. See §1's "context volume" and §3 for the expected shape at each step.
8. **Progressive disclosure (within a command).** Independent of item 7's across-pipeline narrowing, each individual command's *default* output exposes only what its own stated responsibility requires — never everything it could technically produce. Detail that exists but isn't needed by default stays available on request; it is never bundled into the default response merely because it's available. This is a correctness property of the layer, not a performance nicety: a command that pads its default output with unrequested detail reintroduces the context cost this layer exists to remove, even while the pipeline as a whole still narrows step to step. `repo status`'s pointer-only summary of roadmap/known-issues (§2.1 — counts and locations, never the underlying substantive content) is the existing worked example of this principle already in force.
9. **Composability.** Every command in §2 is independently invocable and independently testable on its own — never only reachable as a hidden internal step of another command. Where one command consumes another's output (`repo prepare` consuming `repo impacted`'s affected set, `repo commit` consuming `repo prepare`'s signal, `repo publish` consuming `repo commit`'s conventions — each already stated in that command's own "Interaction with other commands"), it does so through the upstream command's documented output, not by inlining or reimplementing its logic. Standalone usability and internal reuse are the same requirement here, not a trade-off — which is exactly why §2 gives every command a full, self-contained specification even though several are also consumed by others.

---

## 1. Shared concepts

These are referenced by more than one command below and are specified once here rather than per-command.

- **Module boundary.** The unit every command reasons about is the module boundary already defined in `code-index/module_map.json` (currently `mobile`, `playground`, `engine`, `ui`). No command introduces a finer-grained boundary than this file defines. If finer-grained (per-domain, e.g. `games/pisti` vs `games/batak`) reasoning is ever needed, that is a prerequisite change to `module_map.json` or a WKA ownership manifest — out of scope for this spec, called out explicitly in §5.
- **Staleness.** A single shared notion, computed one way and consumed by more than one command: the Code Index is *stale* if any source file under a module's path prefix has a modification time later than the Code Index's own last-build time. Staleness is a boolean signal, not an action — a command that observes staleness reports it; only §2.6 (Code Index freshness) acts on it.
- **Staleness consumption rule.** Every command that reads `file_edges`/`module_edges`/`symbols` — `repo impacted` (§2.2), `repo prepare` (§2.3, by inheritance from `repo impacted`), and the WKA Validator (§4) — must check the current staleness signal as part of producing its output and must surface it plainly whenever the index is stale: facts drawn from a stale index are labeled as such, never presented with the same confidence as facts from a fresh one. None of these commands may silently treat an incomplete or out-of-date indexed fact as a complete, current one. None of them rebuilds the Code Index on the consumer's behalf, automatically or otherwise — rebuilding remains owned exclusively by Code Index freshness (§2.6), invoked separately, by explicit choice, exactly as today. A consumer observing staleness reports it and stops there.
- **Draft vs. commit boundary.** A "draft" is inert text (a staged-file list, a message, a PR body) written for a human to read, edit, and approve. Producing a draft is never itself a mutating git operation. Crossing from draft to committed/pushed state is always a separate, explicit, human-confirmed step outside this layer's own responsibility. A draft is never repository knowledge in its own right: per Principle 6, it becomes a fact — recoverable from `git log`/PR history without this layer — only once that human-approved git operation has actually happened. Until then it is a proposal this layer holds no authority over, and one that leaves no trace at all if the human discards it instead.
- **Affected set.** The result of comparing a git diff (working tree, staged, or a ref range) against `file_edges`/`module_edges` to find which files/modules are touched and which other files/modules depend on them. Computed once, by `repo impacted` (§2.2), and reused by name (not recomputed) by every downstream command that needs it.
- **Context volume.** An informal but load-bearing measure this spec uses to state the progressive-narrowing constraint (§0, item 7): roughly, how much a human or AI must hold in mind to act correctly at a given step. It does not need to be quantified precisely — only observably smaller at each step in the core sequence: *whole-repo state* → *one diff's affected set* → *pass/fail per affected module* → *one draft commit message* → *one draft PR*. Each command's job is to make this measure smaller than it found it, never larger.

---

## 2. The six commands

### 2.1 `repo status`

**Responsibility.** Report the current, read-only state of the working copy and the Code Index in one place — the entry point that replaces separately running `git status`, checking Code Index freshness, and opening the roadmap/known-issues docs by hand. Nothing here is new information, it is an aggregated view of facts that already exist individually, assembled once to save the reader from gathering them one at a time.

**Inputs.** Current git working tree state; the Code Index's staleness signal (§1); the current headings/entries of `docs/status/roadmap.md` and `docs/status/known-issues.md`.

**Outputs.** A single report containing: current branch name; working-tree cleanliness (clean / N files modified / N untracked); Code Index freshness (fresh / stale, and which modules' files caused staleness if stale); a pointer-only summary of current roadmap position and open known-issues count — never the substantive content of either (consistent with `known-issues.md` itself being an index, not a store).

**Boundaries.** Read-only. Never mutates git state, the Code Index, or any doc. Never re-derives roadmap/known-issues content — only counts/points at it.

**Interaction with other commands.** Independent — every other command may optionally call into it for a human-readable summary, but nothing here depends on another command's output. It is the natural first command in the sequence because everything else benefits from knowing this state first, not because of a data dependency.

---

### 2.2 `repo impacted`

**Responsibility.** Given a diff, report the affected set (§1): which files changed, which modules they belong to (via `module_map.json`), and which other files/modules depend on them via the Code Index's existing `file_edges`/`module_edges` tables — collapsing what would otherwise be a manual trace through the dependency graph into a single lookup. A mode of this same command additionally reports documentation drift, but strictly bounded by whether an authoritative module→documentation mapping already exists — it never constructs, guesses, or infers that mapping itself (see Inputs/Outputs).

**Inputs.** A diff range (defaults to working tree + staged changes against the last commit; accepts an explicit ref range). The Code Index's `file_edges`/`module_edges` tables and its current staleness signal (§1). `module_map.json` for module resolution. For the documentation-drift mode: an authoritative module-key → `docs/domains/<domain>/` mapping, **consumed only if and where one already exists as a recorded artifact** — today, none exists for any module, not even at `module_map.json`'s own coarse level (see §4's open prerequisite, which this mode shares in full).

**Outputs.** The affected set: changed files, their modules, and the transitive set of dependent files/modules (blast radius) — labeled with the Code Index's staleness state per the staleness consumption rule (§1). In documentation-drift mode, for each affected module: either (a) a drift signal — its corresponding domain doc(s) were or weren't touched in the same diff — if and only if an authoritative mapping for that module already exists, or (b) an explicit **"mapping not available"** result if it doesn't. Per today's repo state, every module currently produces (b). Either way this is a signal, never a verdict (consistent with WKA's own rule that a Mechanism never produces authoritative content, only a signal, per canonical-model §6 invariant 8).

**Boundaries.** Read-only — never modifies git state or the Code Index. Never invents a dependency relationship the Code Index doesn't already record; if the Code Index's edge data is incomplete for a given file, this command under-reports rather than guessing. The same rule governs the documentation-drift mapping: its absence is reported as absence, never filled in by naming convention, path-pattern guesswork, or any other inference — creating that mapping is a separate WKA/documentation architecture decision (§5), not something this command may do on its own behalf.

**Interaction with other commands.** This is the one command every other git-touching command below depends on. `repo prepare` (§2.3) consumes its affected set directly. Absorbs what would otherwise be a separate "Documentation Drift Detection" tool — one command, one flag, not two names to remember — bounded by the mapping-availability rule above rather than by a separate scope of its own.

---

### 2.3 `repo prepare`

**Responsibility.** Surface the narrowest applicable verification result for the affected set from `repo impacted` — collapsing per-module type-checking/test output into one report, so the reader doesn't have to run and interpret each module's verification by hand. It never runs a full-repo verification when a narrower one is correct, and never re-derives what's affected — whether to actually commit remains a human/Claude judgment made from this report, not a verdict this command hands down.

**Inputs.** The affected set produced by `repo impacted` (called, not reimplemented), including whatever staleness label it carries. Whatever verification capability each affected module already has today — its own type definitions, its own test suite — in whatever form it currently exists; this spec does not define new verification and does not assume any of it is already wired as a runnable script. It orchestrates only what already exists per module, however that's currently reachable.

**Outputs.** A pass/fail-with-detail report per affected module: which verification ran, and its result. If an affected module is the engine (`packages/engine`), and the diff touches rule/AI logic without a corresponding test change, the report surfaces `engineering-principles.md`'s standing testing policy (engine stays test-covered by default; other code does not need proactive tests) as a reminder — not a block, and not this command's own judgment call on test-adequacy.

**Boundaries.** Read-only with respect to git and the Code Index — it runs existing verification commands and reports their results, but does not stage, commit, or modify source files itself. It must not re-implement affected-set computation; if `repo impacted`'s output changes, this command's behavior changes accordingly, by construction.

**Interaction with other commands.** Strictly downstream of `repo impacted`. Its pass/fail signal is the input `repo commit` (§2.4) checks before drafting. Per the staleness consumption rule (§1), it inherits — rather than re-checks — the staleness label `repo impacted` already attached to the affected set, consistent with Principle 9's requirement not to reimplement an upstream command's already-stated result.

---

### 2.4 `repo commit`

**Responsibility.** Draft a commit: stage the files already identified by `repo impacted`'s affected set, and condense the diff into a draft commit message. Nothing more. This is compression of facts already established upstream (the affected set, the diff itself) into a single readable draft — not new reasoning about the change's intent — and it absorbs what would otherwise be a separate "Commit Planner" for that reason: message-drafting is not an independent responsibility, it is what this command's draft consists of.

**Inputs.** The current diff; `repo prepare`'s pass/fail signal (a clean-or-explained result is expected before a draft is offered, though this command may still produce a draft for a failing state if the human asks — it never silently proceeds past a failure without surfacing it); this repository's own commit-message conventions (observable from `git log`, not hardcoded).

**Outputs.** A staged-file list and a drafted commit message, presented for review. Nothing is committed as part of producing this output.

**Boundaries.** **Never invokes `git commit`.** Producing a draft is the entire responsibility; crossing into an actual commit is categorically outside this command and remains gated by `guardrails.md` rule 1 exactly as it is today, with no exception carved out for this tool. This is the load-bearing boundary of the whole spec — restated here because it is the item most likely to be implemented wrong.

**Interaction with other commands.** Downstream of `repo prepare`. Upstream of `repo publish`, which reuses this command's message conventions rather than deriving its own.

---

### 2.5 `repo publish`

**Responsibility.** Produce two distinct kinds of output: an editable PR draft (title and body, condensed from the branch's existing commit messages, each already drafted via `repo commit`), and a push preview (an inert status summary of what a push would do). Nothing more — the PR draft is compression of what's already been said commit-by-commit, not new judgment about the branch's purpose; the push preview is a plain restatement of existing git state, not a proposal for anyone to edit.

**Inputs.** The commit history on the current branch since divergence from `master`; `repo commit`'s message conventions (reused, not reimplemented); current remote-tracking state.

**Outputs.** Two separate results: (1) an editable PR draft — title and body — meant for a human to revise before use; (2) a push preview — branch name, commit count, remote tracking state — a status summary, not something to edit. Nothing is pushed and no PR is created as part of producing either.

**Boundaries.** **Never invokes `git push` or PR creation.** Same category of boundary as §2.4, for the same reason: pushing and opening a PR are both "visible to others" actions this repo's own standing guidance already treats as requiring explicit confirmation. There is no CI in this repository today, so this command has nothing to gate on and does not claim to — it drafts content, it does not wait for or report on checks that don't exist.

**Interaction with other commands.** Downstream of `repo commit`; the last command in the sequence, run least often of the six.

---

### 2.6 Code Index freshness

**Responsibility.** Avoid unnecessary full Code Index rebuilds by acting on the staleness signal defined in §1: when invoked, if the Code Index is not stale, skip the rebuild pipeline entirely; if it is stale, fall through to the existing full-rebuild pipeline unchanged. This is explicitly **not** true incremental (per-file) extraction — that is a materially larger undertaking (diffing symbols/edges per changed file rather than regenerating them wholesale) that this spec deliberately declines to take on until the repo's actual size makes a full rebuild slow enough to justify it.

**Inputs.** The same staleness signal `repo status` (§2.1) already computes and reports — this command must consume that same computation, not a second implementation of it.

**Outputs.** Either "already fresh, no rebuild needed" or the existing full-rebuild pipeline's own output, unchanged.

**Boundaries.** Does not change what a rebuild produces — only whether one runs. Does not introduce a new database schema, a new extraction granularity, or a new artifact type. If a rebuild does run, everything downstream of it (LAYOUT*.md generation, MCP-served queries) behaves exactly as it does today.

**Interaction with other commands.** Produces the same staleness result `repo status` (§2.1) reports, and the same result every other consumer (§2.2, §2.3, §4) checks under the staleness consumption rule (§1) — one consistent computation of staleness, never a divergent second answer to the same question, regardless of how each caller is internally realized. Otherwise independent; nothing else in this spec depends on it.

---

## 3. Command interaction summary

Each step below narrows context volume (§1) relative to the one before it — the reader has strictly less to hold in mind at each arrow, never more (§0 constraint 7).

```
repo status ──(shares staleness check with)── Code Index freshness

  [whole-repo state: git + Code Index + docs, at a glance]
repo impacted
    │  (affected set — one diff's files/modules/blast-radius, not the whole repo)
    ▼
repo prepare
    │  (pass/fail-with-detail per affected module — not the affected set itself)
    ▼
repo commit
    │  (one draft commit message — not the raw diff)
    ▼
repo publish
  [one draft PR — the smallest unit in the sequence]
```

`repo status` and Code Index freshness sit off to the side of this chain — they read/act on staleness and are not inputs to the impacted → prepare → commit → publish sequence. No command in this diagram calls back "upward" into one that depends on it, and no command re-expands context a prior step already narrowed.

---

## 4. Consolidated WKA Validator (Phase 2, single item)

**Responsibility.** One validator, not three. It checks WKA's own canonical-model invariants (`architecture/wka-v1.0-canonical-model.md` §6) — one owning Domain per Module/File/Artifact, acyclic `SUPERSEDES`/`GOVERNS` — and, using the same `module_edges` data `repo impacted` already reads, dependency-direction rules already stated in `engineering-principles.md` (e.g. `apps/playground` and `apps/mobile` never importing each other). This single validator absorbs what the original roadmap proposed as three separate items (Ownership Validator, Documentation Drift Detection, Architectural Drift Detection) — the first is the same invariant as the model's own ownership rule, the second is already a mode of `repo impacted` (§2.2), and the third is a query shape the Code Index already prototypes today (`code-index/find_violations.py`).

**Inputs.** WKA's ownership declarations (currently prose inside each domain's `overview.md` — see the open prerequisite below); `module_edges`; the dependency-direction rules stated in `engineering-principles.md`.

**Outputs.** A signal, never a verdict — per canonical-model §6 invariant 8, a Mechanism never produces authoritative content. It reports invariant violations and dependency-direction violations found; it does not decide what to do about them, and it does not decide whether a flagged violation is acceptable — only WKA governance (a human decision, per the Division of responsibility in §0) does that. Consistent with the rest of this layer, it exists to put a conformance signal in front of a human faster and more cheaply than manually re-deriving it — it is not itself an architectural authority.

**Boundaries.** Read-only across WKA docs and the Code Index. Introduces no new entity type, no new relationship type, no new lifecycle state beyond what `wka-v1.0-canonical-model.md` already defines.

**Interaction with other commands.** Reads `module_edges` directly and independently of `repo impacted` (§2.2) — the two query the same read-only table for different purposes (this validator checks the whole graph's structural conformance; `repo impacted` scopes its query to one diff's affected set) and neither calls into the other. This is not a Principle 2/9 violation: they are two different queries over one shared data source, not two implementations of the same computation. Because it has no upstream command's output to inherit a staleness label from, it checks the Code Index's current staleness signal itself, per the staleness consumption rule (§1), and surfaces it the same way §2.2/§2.3 do.

**Open prerequisite, not solved by this spec — and shared in full by `repo impacted`'s documentation-drift mode (§2.2):** domain ownership is currently expressed only as prose inside `overview.md` files, not as a machine-readable manifest. This gap isn't limited to fine-grained domain boundaries (e.g. `games/pisti` and `games/batak` both living inside the `mobile`/`engine` module buckets) — it already applies at `module_map.json`'s own coarse four-bucket level: `playground`, for instance, has no corresponding `docs/domains/playground/` path at all today (its documentation lives inside `docs/animation/` instead). Both this validator's ownership check and `repo impacted --check-docs` depend on the same missing artifact and are bound by the same rule: neither may construct, guess, or infer a mapping in its absence — a missing mapping is surfaced as missing (§2.2's Outputs), and building the mapping itself is a separate WKA/documentation architecture decision, out of scope for this spec (§5). This spec does not propose building that manifest; it flags the gap so both consumers' first real increment is scoped to what's checkable today (dependency-direction rules via `module_edges` for this validator; documentation-drift reporting only where a mapping already exists for `repo impacted`) rather than assumed to cover full ownership or documentation coverage on day one.

---

## 5. Explicitly out of scope

- **Task Planner, Edit Planner** (original Phase 3 items) — duplicate routing and capability CLAUDE.md's documentation map, the Code Index's own query surface, and the existing `brainstorming` → `writing-plans` → `executing-plans` skill sequence already provide. Not part of this spec.
- **Repository Health Dashboard** (original Phase 4 item) — `repo status` (§2.1) already serves this role as plain output for a single-developer repository with no CI and no team to serve a dashboard to. Not part of this spec.
- **True incremental (per-file) Code Index extraction** — deliberately descoped to the memoized skip-if-unchanged behavior in §2.6. Revisit only if a measured full-rebuild time becomes an actual workflow cost.
- **A machine-readable domain-ownership manifest** — a real prerequisite for both the WKA Validator's full scope (§4) and `repo impacted`'s documentation-drift mode (§2.2), but its own design is not addressed here; today's ownership prose in each `overview.md` remains authoritative in the meantime, and both consumers report the mapping as unavailable rather than inferring one.

---

## 6. Traceability

This Specification traces to `docs/governance/engineering-principles.md` (build pipeline order, testing policy, multi-project Jest — §2.3's verification step) and `docs/governance/guardrails.md` (rule 1, ask before every commit/merge — §2.4 and §2.5's draft-only boundary), per the Traceability Model in `architecture/wka-v1.0-canonical-model.md` §5. It carries no `REFERENCES[implements]` edge to a Code Index entity yet — it is explicitly an unrealized Specification (§1a: "a legitimate, visible state; a silently unrealized one is the actual defect") until an implementation plan is written and approved.
