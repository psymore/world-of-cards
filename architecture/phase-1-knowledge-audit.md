# Phase 1 — Architecture Alignment & Knowledge Extraction

**Status:** Draft for review. Analysis only — no files moved, renamed, deleted, or rewritten. Migration begins only after Phase 2 approval.
**Date:** 2026-08-03
**Inputs read in full:** `architecture/WKA Bootstrap Baseline v0.1.md`, `architecture/WKA v0.1 Architecture.md`, `architecture/WKA_Design_Baseline_v0.1.md`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `docs/animation/00-DocumentationMap.md`, `docs/animation/animation-architecture-constitution.md` (partial — enough to confirm shape), `docs/superpowers/specs/` and `docs/superpowers/plans/` index, repo file tree.

---

## 0. Headline finding, before the layer-by-layer analysis

**`docs/animation/` already _is_ a working WKA instance, scoped to one Knowledge Domain (animation).** It has a Constitution (permanent, implementation-agnostic principles), ADRs (project-specific decisions, e.g. the Reanimated-scope-narrowing sequence ADR-001→003), a Review Workflow (process), Audit/QuickAudit Templates (governed artifact templates), and Demo docs (task-level records) — with an explicit authority hierarchy and a documentation map almost identical in spirit to what WKA's Foundation/Conceptual/Representation layers describe. This was built by the project team independently, under pressure from real recurring bugs, _before_ the `architecture/` WKA docs existed in this repo.

This matters for Phase 2: it means the target pattern doesn't need to be designed from theory — it can be validated against a real, already-proven instance, and `docs/animation/` should most likely become the **reference implementation** other domains (engine, mobile/Expo, games) are asked to mirror, rather than a one-off exception. The rest of this document treats it that way.

**Everything else in the repo's knowledge — the other ~95% of what's in `CLAUDE.md` — has no such structure.** It is one long, chronologically-appended narrative file. That is the core problem this phase exists to address.

---

## 1. How existing knowledge maps onto the WKA layers

| WKA Layer                         | What it's supposed to own                                                   | Current state in this repo                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**                       | Why the project exists, stable, technology-independent                      | Implicit, one sentence in `CLAUDE.md`'s header ("cross-platform mobile platform for traditional card games... designed to scale to 100+ games over years"). Never separately stated or protected from edits — it sits inline in a file that gets edited constantly for unrelated reasons.                                                                                                                                          |
| **Quality Attributes**            | Extensibility, maintainability, testability, discoverability, etc.          | Implicit in the "Key conventions" bullets (2-folders-per-game extensibility, pure-functional testability) but never named as quality goals — they're stated as conventions, not as the _reasons_ the conventions exist.                                                                                                                                                                                                            |
| **Engineering Principles**        | Normative, stable, cross-domain decision rules                              | Present but scattered: engine purity, no-`Math.random()`, one-store-per-concern Zustand rule, the 2026-07-07 testing-policy override. All correct and load-bearing, but mixed at the same heading level as one-off implementation narrative — no visual or structural distinction between "this is a standing rule" and "this is what happened on 2026-07-18."                                                                     |
| **Governance**                    | Common rules for how domains are documented/validated/evolved               | Exists only as _habit_, restated inline dozens of times across the changelog (testing policy, branch workflow, commit-confirmation, cross-app visual-change discussion trigger, no-unsolicited-screenshots). No single governance document — each rule is discoverable only by reading the entire changelog once. `docs/animation/AnimationReviewWorkflow.md` is the one place this actually _is_ done properly, animation-scoped. |
| **Knowledge Domains**             | Bounded areas of knowledge with clear ownership                             | Domains exist structurally in code (`packages/engine`, `apps/mobile`, `apps/playground`, `packages/ui`, per-game folders) but have no matching _documentation_ domain — all narrative about all of them is interleaved in one file in arrival order, not grouped by domain.                                                                                                                                                        |
| **Knowledge Artifacts**           | Specs, ADRs, templates, maps                                                | `docs/superpowers/specs/*` and `docs/superpowers/plans/*` are a real, working Specification/Plan artifact system — this is already conformant and shouldn't change. ADRs exist only for animation (`docs/animation/ADR/`). No ADRs exist anywhere else, even though several CLAUDE.md decisions are clearly ADR-shaped (see §7).                                                                                                   |
| **Documentation Structure / Map** | Organizes and makes artifacts discoverable                                  | `docs/animation/00-DocumentationMap.md` is a correct, working instance. No repo-wide equivalent exists — `CLAUDE.md` is currently doing this job _and_ every other job at once.                                                                                                                                                                                                                                                    |
| **Knowledge Lifecycle**           | How knowledge evolves: proposed → accepted → active → deprecated → archived | Never modeled explicitly. In practice, `CLAUDE.md`'s changelog _is_ an unmodeled, append-only lifecycle log — nothing is ever marked deprecated or archived, so the file only grows. The user's separate auto-memory system (`memory/*.md` + `MEMORY.md` index) is, structurally, a better lifecycle model already: small, single-topic files, an index, and entries get corrected/removed when stale.                             |
| **Reference Implementations**     | Concrete realizations of specs                                              | The actual code, plus `docs/animation/demos/*`. Fine as-is.                                                                                                                                                                                                                                                                                                                                                                        |

**Conclusion:** the WKA _meta_-architecture is a good fit for how this project already half-organically organizes itself (the animation domain proves it works here), but almost none of the layers below Purpose have a real document to live in yet outside of animation and the specs/plans folders. The gap is not "wrong architecture," it's "one file doing every layer's job at once."

---

## 2. Audit of `CLAUDE.md`, classified section by section

| Section / content block                                                                                                                                                           | Classification                                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header sentence ("cross-platform mobile platform... scale to 100+ games")                                                                                                         | **Architectural Knowledge** (Purpose)                                                   | Should be lifted out and protected as a standing Purpose statement, not buried as the file's first sentence.                                                                                                                                                                                                                                                                                                                                               |
| "Architecture" — repo structure (`packages/engine`, `apps/mobile`)                                                                                                                | **Architectural Knowledge**                                                             | Stable, rarely changes. Good candidate for a dedicated architecture-overview doc, referenced (not duplicated) from `CLAUDE.md`.                                                                                                                                                                                                                                                                                                                            |
| "Key conventions established in Phase 1" bullets                                                                                                                                  | **Architectural Knowledge / Engineering Principles**                                    | Stable rules, cross-cutting. Belongs in a principles doc.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Testing policy paragraph (2026-07-07 override of default TDD)                                                                                                                     | **Guardrail** (also ADR-shaped — see §7)                                                | This is a governance decision that overrides a broader default. It reads as a policy statement today; it should also exist as a traceable decision record, since "why we deviate from the general TDD default" is exactly what an ADR is for.                                                                                                                                                                                                              |
| "Card Playground" section — isolation rule + "raise it, don't auto-mirror" standing rule                                                                                          | **Architectural Knowledge** (isolation) + **Guardrail** (discussion trigger)            | The isolation rule is a real architectural constraint (enforced by no shared imports). The discussion-trigger is a process guardrail, not architecture — these are currently fused into one paragraph.                                                                                                                                                                                                                                                     |
| "Status" → Phase 1/2 summaries                                                                                                                                                    | **Historical Decision / Temporary Project Status**                                      | Already resolved; could shrink to one line + a pointer to the relevant spec/plan docs, which already hold the detail.                                                                                                                                                                                                                                                                                                                                      |
| Pişti design/plan doc bullet lists                                                                                                                                                | **Documentation Map fragment**                                                          | This is literally a mini per-domain documentation index, hand-maintained inline. Confirms a per-domain doc-map is the right shape — just needs to live in its own place instead of interleaved with narrative.                                                                                                                                                                                                                                             |
| The long paragraph blocks per dated entry (Pişti UI polish, Batak table polish, animation playground, HomeScreen redesign, etc.) — roughly 80% of the file's volume               | **Historical Decisions** + **Implementation Knowledge** + **Known Problems**, blended   | This is a development diary/changelog, one entry per completed sub-project, each mixing: what shipped, why a design choice was made over rejected alternatives (ADR-shaped rationale), specific file/line/function references (Implementation Knowledge — decays fast, already-stale in places), and lingering caveats (Known Problems). This is the single biggest thing to relocate.                                                                     |
| Guardrails restated inline across many entries: commit/merge confirmation, worktrees-opt-in/local-branches, no-unsolicited-screenshots, per-game visual-change discussion trigger | **Guardrails**                                                                          | Each one is stated once "for the record" the first time it's decided, then never centralized — a reader has to have read the whole file to know all standing guardrails exist. Several are _already_ separately captured in the user's auto-memory (`feedback_confirm_commits_merges.md`, `feedback_branch_workflow.md`, `feedback_no_unsolicited_screenshot_tests.md`) — meaning this knowledge currently has **two independent homes** that could drift. |
| Known Problems (Batak bidding AI miscalibration at both player counts, Batak trick-center resize workaround, human-hand travel-origin gap, the 4-item animation backlog)          | **Known Problems**                                                                      | Currently scattered at different points in the changelog rather than living in one "open issues" register. Also duplicated in `memory/project_batak_bidding_ai_too_aggressive.md` — again, two homes.                                                                                                                                                                                                                                                      |
| Tooling notes (no native device access → later "Android emulator now set up"; `adb` synthetic-tap unreliable; Node version note)                                                  | **Tooling Notes**                                                                       | Already _also_ captured in `memory/*.md` (`dev_sandbox_no_device_access.md`, `android_emulator_debugging_technique.md`, `node_version_reminder.md`, `feedback_adb_synthetic_tap_unreliable_gesture_handler.md`). This is the clearest existing Single-Source-of-Truth violation in the repo: the same tooling facts are independently maintained in `CLAUDE.md`'s prose _and_ in the memory system, with no cross-reference either direction.              |
| "No native on-device verification" caveat                                                                                                                                         | **Known Problems**, but literally repeated ~15+ times verbatim across different entries | The single most duplicated sentence in the file. Textbook case for "define once, reference many" — currently it's "define once, **restate** many."                                                                                                                                                                                                                                                                                                         |
| "Next up" section (current backlog/roadmap candidates)                                                                                                                            | **Temporary Project Status**                                                            | Genuinely useful, changes often, deserves to be easy to find without reading the whole changelog first — currently it's the very last thing in the file.                                                                                                                                                                                                                                                                                                   |
| "Known follow-up items deferred from Phase 1" (RuleEngine options typing, `rngState` non-exercise)                                                                                | **Known Problems** / **Historical Decision residue**                                    | Small, stable, low-churn — fine to keep centralized but should live with other Known Problems, not orphaned at the file's tail.                                                                                                                                                                                                                                                                                                                            |

### `AGENTS.md`

**Tooling Notes** (domain: mobile/Expo). One line, stable, correctly minimal. This is actually the _best-scoped_ file in the repo today — a good positive example to hold `CLAUDE.md`'s new form to.

### `.github/copilot-instructions.md`

**Operational Instructions**, for a different consumer (GitHub Copilot, not Claude). Classified separately because it is a second, independently-authored set of operational/guardrail rules that overlaps — and in places actually _disagrees_ — with the rules Claude currently operates under (e.g. it says "Never execute: git commit... git checkout... git stash" unconditionally, where this project's actual working agreement with Claude is "ask before every commit/merge," a softer rule). This is a live Single-Source-of-Truth risk sitting outside `CLAUDE.md` entirely — flagged in §7, not resolved in this phase.

### Memory system (`memory/*.md` + `MEMORY.md`)

Not itself part of `CLAUDE.md`, but directly relevant: it is, structurally, an already-working small-scale instance of Knowledge Artifacts + a Documentation Map (the index) + a Lifecycle (entries get corrected/removed when stale, per the memory system's own rules). Several facts inside `CLAUDE.md`'s changelog are now redundant with entries already in `memory/`. Phase 2 should treat memory as a peer knowledge store to reconcile with, not something to migrate _into_ `CLAUDE.md`, or vice versa.

---

## 3. Knowledge ownership

For the major knowledge categories identified above:

| Knowledge                                                                                                            | Should live in                                                                                                                                                                            | Owner (who decides changes)                                                                    | Read by                                                    | Load frequency                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Purpose / Quality Attributes (World of Cards-specific)                                                                  | `architecture/` (new project-specific doc, sibling to the generic WKA docs)                                                                                                               | Project owner (user)                                                                           | Everyone, once per onboarding                              | Rarely                                                                               |
| Engineering Principles (engine purity, Zustand rule, testing policy)                                                 | New `docs/governance/engineering-principles.md`                                                                                                                                           | Project owner                                                                                  | Anyone touching `packages/engine` or state management      | Conditionally (by domain)                                                            |
| Guardrails (commit/merge confirmation, branch workflow, no-unsolicited-screenshots, cross-app visual-change trigger) | New `docs/governance/guardrails.md` — reconciled with the overlapping `memory/feedback_*.md` entries, not duplicated                                                                      | Project owner (established via direct correction, same as today)                               | Always                                                     | **Always loaded** — small, cross-cutting, prevents repeated corrections              |
| Per-game rules/domain knowledge (Pişti rules, Batak bidding/gömmeli rules)                                           | `docs/domains/games/<game>/`                                                                                                                                                              | Whoever researches/confirms the ruleset (mix of user + web research, per the existing pattern) | Whoever works on that game                                 | By domain                                                                            |
| Engine architecture (Card/Rule/AI contracts, persistence interface, deferred Phase 1 follow-ups)                     | `docs/domains/engine/`                                                                                                                                                                    | Engine maintainer                                                                              | Anyone extending `packages/engine`                         | By domain                                                                            |
| Expo/RN tooling notes                                                                                                | `AGENTS.md` (already correct) + `docs/domains/mobile-expo/` for anything longer than one line                                                                                             | Whoever hits the Expo-version issue                                                            | Anyone touching `apps/mobile`                              | By domain                                                                            |
| Animation domain                                                                                                     | `docs/animation/` (already correct — no change)                                                                                                                                           | Established via `docs/animation/ADR/` process                                                  | Anyone touching animation                                  | By domain                                                                            |
| UI visual system (theme/color extraction backlog, wood/gold palette duplication)                                     | `docs/domains/ui-visual-system/`                                                                                                                                                          | Whoever owns `packages/ui`                                                                     | Anyone touching shared visual components                   | By domain                                                                            |
| Known Problems / open issues register                                                                                | `docs/status/known-issues.md`                                                                                                                                                             | Whoever finds/confirms the issue                                                               | Anyone starting new work (check before duplicating effort) | Loaded when picking next task, or when hitting a symptom that might be a known issue |
| Roadmap / "what's next"                                                                                              | `docs/status/roadmap.md`                                                                                                                                                                  | Project owner                                                                                  | Anyone starting a session                                  | Loaded at the start of planning work                                                 |
| Historical decision rationale (why X over Y)                                                                         | `docs/superpowers/specs/*` and `docs/superpowers/plans/*` (already exists) for feature-level; new lightweight ADRs (mirroring `docs/animation/ADR/`) for cross-cutting/standing decisions | Whoever made the call, same as today                                                           | Whoever needs "why is it built this way"                   | Only when needed                                                                     |
| `.github/copilot-instructions.md` vs. Claude's guardrails                                                            | Flagged, not resolved this phase — needs an explicit decision on whether both agents should derive from one shared Governance doc                                                         | Project owner                                                                                  | N/A until decided                                          | N/A                                                                                  |

---

## 4. `CLAUDE.md`'s new responsibility

Per the task brief, `CLAUDE.md` must become a **navigation entry point, a context-loading strategy, and a project-orientation document** — not the encyclopedia it is today.

**Proposed new `CLAUDE.md` shape** (illustrative structure, not yet written — Phase 2):

1. One-paragraph Purpose statement + pointer to `architecture/` for the full WKA meta-model.
2. "Where things live" — a compact table: architecture decisions → `architecture/` + a new project-architecture doc; engineering principles/guardrails → `docs/governance/`; per-domain knowledge → `docs/domains/<domain>/`; per-feature history → `docs/superpowers/specs/` + `plans/`; current status/roadmap → `docs/status/`; animation → `docs/animation/` (already a working example to point to explicitly, as the pattern other domains should eventually match).
3. A short "if you're about to..." decision guide (mirroring `docs/animation/00-DocumentationMap.md`'s "Recommended Reading Order"): if touching the engine, read X; if touching a specific game, read Y; if it's a cross-app visual change, remember the discussion-trigger guardrail in `docs/governance/guardrails.md`.
4. Nothing else. No changelog entries, no per-decision rationale, no file/line references, no "known issue" prose — all of that is reachable _through_ this document, never _inside_ it.

This mirrors exactly what `docs/animation/00-DocumentationMap.md` already does for one domain — `CLAUDE.md`'s new job is to be that same kind of map, one level up, for the whole repo.

---

## 5. Migration map

| Current location                                                                                                       | Proposed location                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` header sentence (Purpose)                                                                                  | `architecture/world-of-cards-purpose.md` (new)                                                                                                                                                                                   |
| `CLAUDE.md` "Architecture" repo-structure prose                                                                        | `docs/domains/engine/overview.md` (new) + `docs/domains/mobile-expo/overview.md` (new), referenced from `CLAUDE.md`                                                                                                           |
| `CLAUDE.md` "Key conventions" bullets                                                                                  | `docs/governance/engineering-principles.md` (new)                                                                                                                                                                             |
| `CLAUDE.md` testing-policy paragraph                                                                                   | `docs/governance/engineering-principles.md`, with a short ADR (`docs/governance/ADR/` or reuse `docs/animation/ADR/`'s pattern at repo scope) recording the 2026-07-07 override decision and rationale                        |
| `CLAUDE.md` Card Playground isolation rule                                                                             | `docs/domains/ui-visual-system/playground-isolation.md` (new), referencing the existing spec `docs/superpowers/specs/2026-07-12-card-playground-design.md`                                                                    |
| `CLAUDE.md` cross-app visual-change discussion trigger                                                                 | `docs/governance/guardrails.md` (new) — reconciled with memory, not duplicated                                                                                                                                                |
| `CLAUDE.md` Phase 1/Phase 2 status summaries                                                                           | Trimmed to 1–2 lines in `docs/status/roadmap.md` (new), full detail already exists in the linked spec/plan docs                                                                                                               |
| Pişti/Batak per-sub-project changelog narrative (the bulk of the file)                                                 | Split by domain into `docs/domains/games/pisti/decisions.md` and `docs/domains/games/batak/decisions.md` (new) — a lightweight running decision log per game, distinct from the full spec/plan docs which stay where they are |
| Known Problems scattered through the narrative (bidding AI, trick-center resize, travel-origin gap, animation backlog) | `docs/status/known-issues.md` (new), each entry referencing its originating spec/plan doc instead of re-explaining it                                                                                                         |
| "No native on-device verification" repeated caveat                                                                     | One entry in `docs/status/known-issues.md`, referenced (not restated) everywhere else                                                                                                                                         |
| Tooling notes duplicated between `CLAUDE.md` and `memory/*.md`                                                         | Reconciled into `memory/*.md` as the single home (already the more granular, better-indexed system) — `CLAUDE.md`/domain docs get a one-line pointer, not a copy                                                              |
| "Next up" roadmap section                                                                                              | `docs/status/roadmap.md` (new)                                                                                                                                                                                                |
| "Known follow-up items deferred from Phase 1"                                                                          | `docs/status/known-issues.md` (new)                                                                                                                                                                                           |
| `docs/animation/*`                                                                                                     | **No change** — already correctly structured; becomes the explicit reference pattern cited from the new `docs/00-DocumentationMap.md`                                                                                         |
| `docs/superpowers/specs/*`, `docs/superpowers/plans/*`                                                                 | **No change** — already a working Specification/Plan artifact system                                                                                                                                                          |
| `AGENTS.md`                                                                                                            | **No change** — already correctly minimal and domain-scoped                                                                                                                                                                   |
| `.github/copilot-instructions.md`                                                                                      | **Not migrated this phase** — flagged as needing a Phase-2-or-later decision on reconciling with `docs/governance/`                                                                                                           |

---

## 6. Knowledge that remains in `CLAUDE.md`

- The Purpose statement's _pointer_ (one line, linking out to `architecture/world-of-cards-purpose.md`), not its full text.
- The navigation table (where things live).
- The short "if you're about to touch X, read Y" decision guide.
- A one-line pointer to `docs/animation/00-DocumentationMap.md` as the model for domain-level documentation.

Everything else proposed above moves out. `CLAUDE.md` should shrink from its current size (a multi-thousand-word running diary) to something closer in spirit to `docs/animation/00-DocumentationMap.md`'s length.

## 7. Knowledge that moves elsewhere

Summarized from §5 above — in short: essentially all domain knowledge, all historical/decision narrative, all known-problems tracking, and all but the thinnest sliver of engineering-principle statements. The only genuinely _new_ documents this implies (nothing in `docs/animation/` or `docs/superpowers/` needs to change):

- `architecture/world-of-cards-purpose.md`
- `docs/00-DocumentationMap.md` (repo-wide, modeled directly on `docs/animation/00-DocumentationMap.md`)
- `docs/governance/engineering-principles.md`
- `docs/governance/guardrails.md`
- `docs/domains/engine/overview.md`
- `docs/domains/mobile-expo/overview.md`
- `docs/domains/ui-visual-system/*.md`
- `docs/domains/games/pisti/decisions.md`, `docs/domains/games/batak/decisions.md`
- `docs/status/roadmap.md`
- `docs/status/known-issues.md`

Whether each of these becomes a single file or a small folder (mirroring `docs/animation/`'s `ADR/`, `audits/`, `demos/` subfolder pattern once a domain grows enough to need it) is a Phase 2 design decision, not something to decide here.

---

## 8. Recommended context-loading strategy

**Always loaded:**

- `CLAUDE.md` (new, small navigation form)
- `AGENTS.md` (already tiny)
- `docs/governance/guardrails.md` (small, cross-cutting, exists specifically to prevent repeating corrections the user has already given once)

**Loaded by domain** (only when a task touches that area):

- `docs/domains/engine/*` — engine/rules/AI work
- `docs/domains/games/<game>/*` — work on that specific game
- `docs/animation/*` — any animation-touching change (already the working model)
- `docs/domains/ui-visual-system/*` — shared visual-component work
- `docs/domains/mobile-expo/*` — Expo/RN platform-specific issues
- `docs/governance/engineering-principles.md` — anytime a "should I write a test / should I add an abstraction" question comes up

**Loaded only when needed:**

- `architecture/*` (the generic WKA docs + the project Purpose doc) — onboarding, or when a change is genuinely architecture-shaped (per WKA's own Decision Checklist), not every session
- `docs/superpowers/specs/*`, `docs/superpowers/plans/*` — when working on that specific feature, or investigating "why is this built this way"
- `docs/status/known-issues.md` — when starting new work (quick check against duplicating known-broken territory) or when a symptom matches a known issue
- `docs/status/roadmap.md` — session start / planning
- `memory/*.md` — as already governed by the existing memory-system rules (unchanged by this phase)

---

## 9. Identified guardrails and recurring problem categories

**Guardrails currently enforced only by prose repetition (candidates for `docs/governance/guardrails.md`):**

1. Ask before every `git commit` and every merge, even mid-plan (already also in `memory/feedback_confirm_commits_merges.md` — reconcile, don't duplicate).
2. Default to local `category/name` branches; worktrees are opt-in, ask first (already also in `memory/feedback_branch_workflow.md`).
3. No unsolicited screenshot/visual verification unless requested (already also in `memory/feedback_no_unsolicited_screenshot_tests.md`).
4. Cross-app visual-change discussion trigger: any card/table visual change in `apps/mobile` or `apps/playground` must be explicitly raised with the user for the other side, never silently mirrored or silently skipped — currently stated only in `CLAUDE.md`, **not yet in memory** (worth adding).
5. Testing policy: don't proactively write new tests for mobile UI (ask first); engine/RuleEngine/AI/`simulateGames` stay test-covered by default.
6. Ask Quick-vs-Full audit template explicitly for any animation task, never self-select (already also in `memory/feedback_ask_audit_template_choice.md`).
7. When a targeted fix resists multiple attempts on the current animation engine, escalate to a scoped experiment (e.g. the Reanimated Playground detour) rather than keep patching (already also in `memory/feedback_animation_library_swap_escalation.md`).

**Recurring problem categories (candidates for a durable write-up per domain, not just a memory entry only this agent instance benefits from):**

1. **Boundary-crossing assumptions in animation code** — already fully documented in `docs/animation/animation-architecture-constitution.md` §1/§5 (Layered Ownership, Single Source of Truth, Explicit Contracts, Interactive Target Fidelity relearned twice independently). This is the model other domains should copy the _shape_ of, not just a one-off fix.
2. **"Find the extreme element" logic tested with only one candidate** — hit three separate times during Batak's RuleEngine work (auction-closing guard, trick-winner multi-trump resolution, mandatory-raise threshold), captured today only in `memory/project_trick_taking_test_gap_pattern.md`. Worth a durable note in `docs/domains/engine/` (or a shared `docs/domains/engine/testing-pitfalls.md`) so it survives beyond this agent's memory and is visible to a human reading engine code, not just to Claude.
3. **"No native on-device verification"** — a caveat repeated verbatim across roughly fifteen changelog entries. The single clearest, most mechanical instance of a Single-Source-of-Truth violation in the current file; trivially fixed by moving it to one `docs/status/known-issues.md` entry.
4. **Knowledge duplicated between `CLAUDE.md`'s narrative and the `memory/*.md` system** — tooling notes (dev sandbox device access, Android emulator setup, `adb` tap reliability, Node version) and the Batak bidding-AI issue all exist independently in both places today. Phase 2 should pick one home per fact (memory system is the better-suited one for anything genuinely session-spanning-but-informal; `docs/status/` for anything the user would also want a non-Claude reader to see).
5. **Lost/clobbered work during subagent-driven execution** — two documented incidents (a plan doc lost mid-session before commit; an unrelated pending reformat in `seating.ts` discarded by an implementer doing a full-file rewrite). Both already produced narrow fixes/lessons inline; worth confirming these are reflected in whatever supersedes `superpowers:subagent-driven-development`'s standing instructions, since the lesson is process-level, not project-level.

---

## 10. Long-term architecture risks identified during audit

The following risks are not current failures. They are patterns that commonly emerge as a repository grows and should be monitored during future phases, not treated as one-time findings to be fixed and forgotten.

### 1. Knowledge gravity

Frequently accessed documents tend to accumulate unrelated knowledge because they are convenient entry points.

Examples:

- `CLAUDE.md` becoming a project encyclopedia — the central finding of this audit (§2).
- Status documents becoming permanent storage — the exact risk flagged for the proposed `docs/status/known-issues.md` in Phase 2 (§5.1 there), before it even exists.
- README files becoming decision logs — not yet observed in this repo, but worth watching for once `docs/domains/*/README.md` and `docs/governance/ADR/README.md` exist, per Phase 2's tree.

**Audit rule:** convenience of access must not override knowledge ownership. A document's proximity to daily work is not a license for it to absorb knowledge it doesn't own.

---

### 2. Documentation drift

Documentation represents the current mental model of the system, not historical events.

When implementation changes:

- obsolete knowledge should be removed, not left beside its replacement;
- affected artifacts should be updated;
- historical reasoning should move to specs/plans/ADRs when needed, rather than staying mixed into a document meant to describe the present state.

This is the exact failure mode already observed in `CLAUDE.md`'s "Status" section (§2 above): entries are appended chronologically and never retired, so the file has become a history of the system rather than a description of it. The "no native on-device verification" caveat, repeated verbatim across roughly fifteen entries because each was written as if standalone, is the clearest concrete instance of drift already present.

---

### 3. Premature abstraction

Repeated code or similar concepts do not automatically indicate a shared abstraction.

A pattern should be considered architectural only after:

- repeated occurrence,
- multiple consumers,
- stable intent.

This is the same evidentiary bar `docs/animation/animation-architecture-constitution.md` already applies before admitting a new Foundational Principle (its own §10), and the bar Phase 2's escalation triggers (Trigger 1 and Trigger 2, specifically) are designed to operationalize repo-wide: one occurrence is a bug, two is a coincidence worth noting, three with stable intent across multiple consumers is the point an abstraction — or an ADR — is actually warranted. The "extreme element, single-candidate test" pattern (§9 above) is a positive example of waiting for real repetition (three occurrences) before generalizing the lesson.

---

### 4. Temporary solution accumulation

Temporary workarounds should have:

- an owner,
- a reason,
- a review path.

A workaround without ownership tends to become invisible architecture — quietly load-bearing, but nowhere documented as a decision, so nobody revisits it and nobody notices when a second domain starts depending on it too.

`TrickCenter.tsx`'s constant-`size="normal"` sidestep for the landing-resize mismatch is an example already in this repo of a workaround that _does_ have an owner and a documented reason (its own doc comment explicitly calls it a sidestep, not a fix) but currently has no explicit review path — it is tracked as a known issue, not as something with a scheduled or triggered revisit. This is exactly the gap Phase 2's escalation triggers (Trigger 4, "workarounds become permanent") are designed to close going forward.

---

## 11. Explicit non-actions this phase

Per the task constraints, this document does **not**:

- change any architecture decision recorded in `CLAUDE.md`, `docs/superpowers/`, or `docs/animation/`;
- rewrite, move, rename, or delete any file;
- create the new folders/files named above (`docs/governance/`, `docs/domains/`, `docs/status/`, etc.) — they are proposals only;
- resolve the `.github/copilot-instructions.md` vs. Claude-guardrails conflict — flagged for a Phase-2-or-later decision;
- decide the exact file-vs-folder granularity for each new domain doc — deferred to Phase 2 design;
- **identify future scalability risks without converting them into governance rules prematurely.** This phase intentionally does not create new governance files, rewrite entry points, or introduce automation rules. However, during future phases, newly created always-loaded documents (`CLAUDE.md`, `AGENTS.md`, governance files, indexes, or other routing documents) must be monitored for context growth. A document that starts as a router or index should not gradually become a knowledge store. If a document repeatedly accumulates exceptions, explanations, historical context, or domain-specific details, that is a signal that ownership boundaries may need to be reviewed rather than continuously expanding the file.

  Long-term discipline:
  - Growth should trigger evaluation, not automatic expansion.
  - Repeated duplication between documents should trigger an ownership review.
  - Repeated fixes for the same class of problem should trigger architecture escalation rather than another local patch.
  - Human review remains required for structural decisions; these signals assist detection but do not replace architectural judgment.
