# Phase 2 — Knowledge Architecture Design & Context Loading Strategy

**Status:** **Approved — Final Blueprint (Revision v1.2).** Design only — no files moved, renamed, deleted, or rewritten. Execution proceeds under Phase 3, following the migration sequence in §10, gated by the Safety Checkpoint defined within it.
**Date:** 2026-08-03
**Revision history:**
- v1.0 (2026-08-03) — initial draft, reviewed.
- v1.1 (2026-08-03) — integrates four approved review clarifications: (1) `docs/status/known-issues.md` scoped explicitly as an index, not a storage location; (2) architecture escalation triggers added to the governance/context-loading model, closing the feedback loop back into `architecture/`; (3) an explicit migration safety checkpoint gated before `CLAUDE.md` reduction in Phase 3, plus a stated migration priority ordering; (4) a long-term maintenance-discipline subsection in §10 clarifying that context growth is a signal for human review, not an automation trigger.
- v1.2 (2026-08-03) — integrates four further clarifications, none changing existing decisions: (1) §6.1 tightens `decisions.md`'s boundary (architectural/product reasoning only, never a development diary — with a "why vs. what happened" decision test); (2) §6.2 adds a routing decision framework for where new knowledge should live, using the existing tree unchanged; (3) §7 adds filtering guidance ("not every repetition is architectural") distinguishing a normal repeated bug from a genuine missing-design-knowledge pattern, applied *before* the five existing triggers are treated as firing; (4) §10 adds an explicit migration-vs-redesign discipline note, deferring any new architectural improvement, renaming, or stylistic rewrite to a later dedicated refinement phase.
**Builds on:** `architecture/phase-1-knowledge-audit.md` (primary input — all classifications and the migration map there are treated as settled unless revised below).
**Additional inputs read this phase:** `docs/animation/ADR/README.md`, `docs/animation/audits/README.md`, and the header/shape of one representative spec (`docs/superpowers/specs/2026-07-06-core-architecture-design.md`) and one representative plan (`docs/superpowers/plans/2026-07-06-core-architecture.md`), to ground the Knowledge Artifacts design in the conventions that already work in this repo rather than inventing new ones.

---

## 0. Design stance carried over from Phase 1

Three decisions from Phase 1 are treated as fixed inputs to this design, not re-litigated:

1. **`docs/animation/` is the reference implementation.** Its shape (Constitution → ADR → Workflow → Audit Template → Demo docs, with an explicit authority hierarchy and a `00-DocumentationMap.md`) is proven in this repo and is not being redesigned — it is the pattern new domains are asked to *approximate*, at whatever scale that domain actually needs.
2. **`docs/superpowers/specs/` and `docs/superpowers/plans/` already work and are global (not domain-partitioned).** They are dated, one-per-feature, and already correctly separate "what/why" (spec) from "how, task by task" (plan). This design does not partition them by domain — doing so would break the chronological/cross-referencing convention that already works, for no gain.
3. **Two genuine Single-Source-of-Truth risks are already known and must be resolved by this design, not deferred again:** (a) tooling notes and guardrails independently duplicated between `CLAUDE.md`'s narrative and the user's `memory/*.md` system, and (b) `.github/copilot-instructions.md` as a second, independently-authored operational-rules file. §8 and §9 below give each an explicit resolution.

---

## 1. Final proposed knowledge tree

```
architecture/                                  [FOUNDATION LAYER — Purpose, Quality Attributes, Engineering stance]
  WKA Bootstrap Baseline v0.1.md                (unchanged — generic WKA meta-model)
  WKA v0.1 Architecture.md                      (unchanged — generic WKA meta-model)
  WKA_Design_Baseline_v0.1.md                   (unchanged — generic WKA meta-model)
  phase-1-knowledge-audit.md                    (this analysis's own record — kept, not a live doc)
  phase-2-knowledge-architecture-design.md      (this document)
  world-of-cards-purpose.md                        [NEW] World of Cards' own Purpose + Quality Attributes,
                                                 instantiating the generic WKA Foundation Layer for this
                                                 specific project. Rarely changes.

docs/
  00-DocumentationMap.md                        [NEW] Repo-wide navigation entry point.
                                                 Modeled directly on docs/animation/00-DocumentationMap.md.
                                                 This is what CLAUDE.md POINTS TO, not a duplicate of it.

  governance/                                    [CONCEPTUAL LAYER — Governance]
    engineering-principles.md                    [NEW] Standing, cross-cutting engineering rules:
                                                   engine purity, no Math.random(), Zustand one-store
                                                   discipline, the "adding a game = 2 folders" convention,
                                                   the 2026-07-07 testing-policy override.
    guardrails.md                                [NEW] Standing BEHAVIORAL rules for how Claude (and,
                                                   per §9, eventually Copilot) operates in this repo.
                                                   See §5 for the exact contents and the test that keeps
                                                   this file small.
    architecture-escalation.md                   [NEW] The five escalation triggers + the feedback-loop
                                                   procedure defined in §7. A distinct artifact from
                                                   guardrails.md — this one is a detection/escalation
                                                   procedure, not a behavioral rule, even though both are
                                                   Governance-owned.
    ADR/                                         [NEW, created empty — populated opportunistically]
      README.md                                  Same convention as docs/animation/ADR/README.md:
                                                   when a decision is Governance-shaped (cross-domain,
                                                   time-bound, reversible) vs. Foundation-shaped
                                                   (belongs in architecture/world-of-cards-purpose.md instead).
      TEMPLATE.md                                 Copy of docs/animation/ADR/TEMPLATE.md's shape.

  domains/                                       [KNOWLEDGE DOMAINS]
    README.md                                    [NEW] One paragraph per domain: what it is, where its
                                                   docs live (including domains that still live at their
                                                   historical path — see note below), who owns it.
    engine/
      overview.md                                 Card/Rule/AI engine contracts, registry, persistence
                                                   interface, statistics — the stable architectural shape
                                                   of packages/engine.
      known-issues.md                             Engine-specific technical debt/edge cases (e.g. the
                                                   deferred RuleEngine<TOptions> generic; rngState
                                                   non-exercise). Full detail lives HERE and only here —
                                                   see §5.1 for why docs/status/known-issues.md must not
                                                   duplicate this content.
      ADR/                                        Created only once engine gets its first genuinely
                                                   ADR-shaped decision — not pre-populated.
    mobile-expo/
      overview.md                                 Expo/RN platform notes longer than AGENTS.md's one line
                                                   (e.g. version-specific gotchas as they accumulate).
    ui-visual-system/
      overview.md                                 packages/ui ownership, the cross-app isolation rule
                                                   (playground never imports mobile, vice versa).
      known-issues.md                             Theme/color literal duplication across TableWoodCorners/
                                                   TableEdgeRails/etc. (already-tracked, not yet fixed).
    games/
      pisti/
        overview.md                                Current status pointer + rules summary.
        decisions.md                                Lightweight running decision log (why X over Y),
                                                     distinct from the full specs/plans, which stay in
                                                     docs/superpowers/.
      batak/
        overview.md
        decisions.md
        known-issues.md                             Full detail on bidding-AI miscalibration (4p and
                                                     3p-gömmeli), trick-center resize workaround,
                                                     human-hand travel-origin gap — lives here, only here.
    animation/
      — NOT a new folder. This entry in domains/README.md is a POINTER to the existing,
        already-correct docs/animation/ tree (00-DocumentationMap.md, the Constitution, ADR/,
        audits/, demos/). Per WKA's own "refinement over expansion" and "avoid unnecessary
        deletion" principles, a working domain does not get relocated just for tree-shape
        consistency. domains/ is the pattern new domains follow; animation is the domain that
        already proves the pattern, wherever it physically sits.

  status/                                        [EVOLUTION LAYER — short-lived project state]
    roadmap.md                                    [NEW] Game build order, current "Next up" list.
                                                   Rewritten often; expected to churn.
    known-issues.md                               [NEW] **An INDEX only — see §5.1.** Holds a one-line
                                                   pointer per domain-owned issue, linking into that
                                                   domain's own known-issues.md, PLUS the small set of
                                                   issues that are genuinely cross-cutting and owned by
                                                   no single domain (e.g. "no native on-device
                                                   verification exists anywhere in this repo yet"), whose
                                                   full text lives directly here because there is no
                                                   more-specific home for it. Never a second copy of a
                                                   domain-owned issue's actual detail.

  superpowers/
    specs/                                        Unchanged. Global, dated, one per feature.
    plans/                                         Unchanged. Global, dated, one per feature.

CLAUDE.md                                         [Repo entry point — see §3 for full final design]
AGENTS.md                                         Unchanged. Already correctly minimal (one Expo tooling line).
.github/copilot-instructions.md                    Not restructured this phase — see §9 for the
                                                   resolution direction, deferred to a later, explicitly
                                                   scoped decision.
memory/*.md + MEMORY.md                            Not part of the repo tree (lives outside version control,
                                                   per-user). Its relationship to docs/governance/ is
                                                   resolved explicitly in §8 rather than left ambiguous.
```

---

## 2. Knowledge ownership map

| Document / area | Owner (decides changes) | Updated by | Read by | Load frequency |
|---|---|---|---|---|
| `architecture/world-of-cards-purpose.md` | Project owner (user) | Rare, deliberate edits only | Anyone onboarding, or proposing an architecture-shaped change | Rarely |
| `docs/00-DocumentationMap.md` | Whoever adds/removes a domain or artifact type | Whenever the tree structure itself changes | Anyone navigating unfamiliar territory | Rarely (stable once correct) |
| `docs/governance/engineering-principles.md` | Project owner | When a standing convention changes (rare) or a new one is established (e.g. the 2026-07-07 testing-policy precedent) | Anyone about to write code, tests, or a new game module | Before implementation |
| `docs/governance/guardrails.md` | Project owner, via direct correction (same mechanism as today) | Every time the user gives feedback that should generalize beyond the current task | Always | **Always loaded** |
| `docs/governance/architecture-escalation.md` | Project owner | Rarely — the five triggers are themselves meant to be stable; only a new trigger class discovered in practice would add to it | Claude, whenever a recurring-problem signal is suspected (see §7) | Escalation-triggered (§4, §7) |
| `docs/governance/ADR/*` | Project owner | Once per cross-cutting decision | Anyone asking "why do we work this way" | Only when needed |
| `docs/domains/<domain>/overview.md` | The domain's de facto maintainer (whoever last did substantial work there) | As the domain's stable shape changes | Anyone about to touch that domain | Domain-loaded |
| `docs/domains/<domain>/decisions.md` | Same as overview.md | Per significant decision within the domain | Anyone asking "why is this game/domain built this way" | Domain-loaded, or task-loaded if investigating one decision |
| `docs/domains/<domain>/known-issues.md` | Whoever found/confirmed the issue | When found, and when resolved (removed, not just marked done — see §5) | Anyone starting new work in that domain | Domain-loaded |
| `docs/status/roadmap.md` | Project owner | Every session where priorities shift | Anyone starting a session, or planning next work | Task-loaded (session start / planning) |
| `docs/status/known-issues.md` | Whoever adds a domain's issue to the index (not the same person who necessarily owns the underlying issue) | Whenever a domain's known-issues.md gains or loses an entry (the index line is added/removed to match), and directly for cross-cutting entries | Anyone starting new work, repo-wide | Task-loaded |
| `docs/superpowers/specs/*`, `plans/*` | Whoever authored the feature | Append-only, per feature | Whoever works on that feature or investigates its history | Task-loaded |
| `docs/animation/*` | Established via its own `ADR/README.md`/`AnimationReviewWorkflow.md` process (unchanged) | Per its own existing rules | Anyone touching animation | Domain-loaded |
| `CLAUDE.md` | Project owner | When the map itself needs to change (rare — see §3) | Always, first | **Always loaded, in full** |
| `AGENTS.md` | Project owner | When Expo version guidance changes | Always | **Always loaded** |
| `.github/copilot-instructions.md` | Project owner (Copilot's own audience) | Independently for now — see §9 | Copilot only | N/A to Claude's loading strategy |
| `memory/*.md` + `MEMORY.md` | Claude, per the existing auto-memory rules | Continuously, per the existing memory rules | Claude, across sessions | Governed by the existing memory system, unchanged — see §8 for its relationship to `docs/governance/` |

---

## 3. `CLAUDE.md` final design

### Responsibility
`CLAUDE.md` is **only**: the project entry point, the context-routing table, and the reading-order guide. It is the thing read first, every session, in full — which is exactly why it must stay small. It answers "where do I go to learn X," never "what is X."

### Recommended sections (in order)

1. **Header** — one or two sentences: what World of Cards is, pointer to `architecture/world-of-cards-purpose.md` for the full Purpose/Quality Attributes statement. (Not the Purpose statement itself.)
2. **`@AGENTS.md` include** — unchanged, stays at the top exactly as today.
3. **"Where things live" table** — the routing table: knowledge category → path → when to read it. This is the single most load-bearing section; it should look like a condensed version of §4 below, not a copy of the whole ownership map.
4. **"Before you start" checklist** — 3–5 lines, mirroring `docs/animation/00-DocumentationMap.md`'s "Recommended Reading Order" but repo-wide: e.g. "Touching a specific game? Read `docs/domains/games/<game>/overview.md`. Touching animation? Start at `docs/animation/00-DocumentationMap.md`. About to commit/merge or start a big refactor? Re-check `docs/governance/guardrails.md`. Noticing the same fix for the third time? Check `docs/governance/architecture-escalation.md`."
5. **Pointer to `docs/status/roadmap.md`** — one line: "current priorities and what's next live there, not here."
6. **Nothing else.** No changelog, no per-decision rationale, no file/line references, no known-problem prose, no per-game rules detail. If a future edit to `CLAUDE.md` would add any of those, that edit belongs in a domain/status/governance doc instead, referenced from here.

### Approximate size
Target **under ~100–150 lines / ~800–1200 words** — comparable to `docs/animation/00-DocumentationMap.md`'s length, not to `CLAUDE.md`'s current multi-thousand-word form. If it grows past that, that's a signal content has leaked back in that belongs elsewhere (a self-check this document should be judged against later, not a hard rule enforced by tooling).

### Loading behavior
Always loaded, in full, every session — which is only acceptable *because* of the size constraint above. This is the justification for being strict about keeping it a pure router: its cost is paid on every single session regardless of task, so its content must be the minimum needed to get anywhere else correctly.

---

## 4. Context loading model

| Tier | Contents | When |
|---|---|---|
| **Always** | `AGENTS.md`, `CLAUDE.md` | Every session, unconditionally |
| **Before implementation** (a lightweight second "always," gated only by "about to write or change something") | `docs/governance/guardrails.md`, `docs/governance/engineering-principles.md` | Before writing code, tests, or making a structural decision — not needed for a pure Q&A/read-only session |
| **Domain-loaded** | `docs/domains/<domain>/*`, or `docs/animation/*` for animation work | Only when the task touches that domain |
| **Architecture-loaded** (its own tier — rarer than domain, more expensive to read) | `architecture/*` (the generic WKA docs + `world-of-cards-purpose.md`) | Only when the change is genuinely architecture-shaped per WKA's own Decision Checklist — i.e., almost never for routine feature work |
| **Task-loaded** | `docs/superpowers/specs/<feature>.md`, `docs/superpowers/plans/<feature>.md`, the relevant domain's `known-issues.md` entry (never `docs/status/known-issues.md` for the detail itself — see §5.1), relevant `docs/domains/<domain>/decisions.md` entries, relevant ADRs | Only for the specific feature/decision/bug at hand |
| **Session-start** | `docs/status/roadmap.md`, `docs/status/known-issues.md` (as the index, to see what's already flagged before starting something new) | When planning next work, not needed mid-task |
| **Escalation-triggered** (see §7 — new in this revision) | `docs/governance/architecture-escalation.md`, then `architecture/`'s Decision Checklist/Architectural Compass, then the owning domain's (or `docs/governance/`'s) `ADR/README.md` | Only when one of the five triggers in §7 fires — i.e., rarely, and only ever *in addition to* the tiers above, never instead of them |
| **Claude-personal, outside the repo tree** | `memory/*.md` | Governed entirely by the existing memory system's own rules — unaffected by this design, see §8 |

**Worked example, to make the model concrete:** a session that starts with "fix the Batak trick-center resize jump" would load, in order: `CLAUDE.md` (always) → `docs/governance/guardrails.md` (about to change code) → `docs/domains/games/batak/known-issues.md` (confirms this is the known, already-diagnosed issue, and points at) → `docs/animation/00-DocumentationMap.md` → the Constitution's relevant principle (§IV/landing-mismatch class) → the specific spec/plan docs already tracking this problem. It never needs to load `docs/domains/games/pisti/*`, `architecture/*`, or anything about the HomeScreen redesign — the current single-file design has no way to avoid pulling all of that in together. If, on inspecting `known-issues.md`, this turns out to be the *third* recorded landing-resize-style mismatch across different components, that itself is Trigger 1 from §7 — worth surfacing to the user as "this looks like it wants an architecture review, not a fourth patch" before proceeding.

---

## 5. Guardrails vs. Known Issues — separation model

These two categories are the ones most tangled together in the current `CLAUDE.md`, so they need a crisp, mechanical test, not just a description.

**The test:** *Would this statement still need to be true/enforced even if the specific bug, feature, or technical limitation that originally prompted it were fixed or had never existed?*

- **Yes → Guardrail** (`docs/governance/guardrails.md`, permanent until explicitly revised). A guardrail is a rule about *how work gets done* — process, collaboration, or a standing behavioral constraint. It does not reference a specific bug by name; it generalizes from one.
- **No → Known Issue** (domain-scoped `known-issues.md`, expected to eventually be deleted once fixed — see §5.1 for exactly where). A known issue is a fact about *current system state* — something true today that a future change is expected to make false.

**Worked reclassification of everything Phase 1 flagged:**

| Item | Category | Why |
|---|---|---|
| Ask before every commit/merge | **Guardrail** | Applies regardless of what's being committed; it's about process, not a bug. |
| Local `category/name` branches, worktrees opt-in | **Guardrail** | A standing workflow preference, not tied to any defect. |
| No unsolicited screenshot/visual verification | **Guardrail** | A standing collaboration preference. |
| Cross-app visual-change discussion trigger | **Guardrail** | A permanent process rule about how a *class* of future change should be handled, not about any one past change. |
| Testing policy (don't proactively write UI tests; engine stays covered) | **Guardrail** | A standing default, explicitly stated as overriding the general TDD default until revisited. |
| Ask Quick-vs-Full audit template explicitly | **Guardrail** | Process rule for a class of future task. |
| Escalate to a scoped Reanimated-style experiment after repeated targeted-fix failures | **Guardrail** | A generalized *strategy* for a recurring situation shape, not a fix for one bug — and now formalized further as Trigger 3/4 in §7. |
| Batak bidding AI too aggressive (49/200 at 4p, chance-level) | **Known Issue** (`docs/domains/games/batak/known-issues.md`) | Describes current system state; disappears from the list the day it's fixed. |
| Batak trick-center resize "settle" workaround | **Known Issue** (`docs/domains/games/batak/known-issues.md`) | Same — a specific, fixable technical gap. |
| Human-hand card-travel origin is a fixed generic offset | **Known Issue** (`docs/domains/games/batak/known-issues.md`) | Same. |
| The 4-item rail-fan animation backlog (deselect stutter, fly discontinuity, landing resize, reflow) | **Known Issue** (`docs/animation/`'s own existing tracking — unchanged) | Already correctly living as a backlog inside the animation domain's own docs. |
| "No native on-device verification has ever been done" | **Known Issue**, and specifically the cross-cutting kind that lives directly in `docs/status/known-issues.md` (see §5.1) rather than in any one domain | It's a fact about current verification coverage, not a process rule — and it will become false the day on-device testing becomes possible, at which point the entry is deleted, not "resolved" in place. |
| "Extreme element, single-candidate test" pattern (hit 3× in Batak RuleEngine) | **Borderline — Guardrail, not Known Issue** | This is the one item worth calling out as *not* fitting the simple test cleanly: it looks like a known bug-history item, but its value is entirely as a generalized rule for future test-writing ("when testing 'find the highest/first/last X' logic, use a multi-candidate case that can distinguish correct from plausible-but-wrong"). It passes the guardrail test (still true and useful even with all three original bugs long fixed), so it belongs in `docs/domains/engine/overview.md` or a `docs/domains/engine/testing-pitfalls.md` as a durable engineering guideline, not in a known-issues list. It is also a textbook instance of Trigger 1 in §7 — three recurrences is exactly the signal that should have triggered an architecture-level review of the engine's test-writing conventions, not just three independent bugfixes. |

**Consequence for `known-issues.md` files specifically:** unlike `guardrails.md` (append-and-rarely-shrink), every domain-owned `known-issues.md` is expected to shrink over time. An entry is deleted, not marked "done," once fixed — leaving a stale "fixed" entry around is exactly the kind of historical-note-becoming-permanent-clutter this whole redesign exists to avoid.

### 5.1 `docs/status/known-issues.md` is an index, not a store

This is a clarification added in this revision, because the file is otherwise exactly the kind of always-easy-to-reach-for location that could quietly become "the new `CLAUDE.md`" for known problems — solving the duplication this whole effort exists to remove in one place while silently recreating it in another.

**The rule:** `docs/status/known-issues.md` must never directly hold the substantive description of a domain-specific problem — root cause, reproduction steps, affected sub-systems. That detail lives exactly once, inside the domain that owns it (`docs/domains/<domain>/known-issues.md`, or `docs/animation/`'s own existing tracking). This file's only content, for a domain-owned issue, is a one-line description plus a link into the owning domain's file.

The **only** exception is an issue that is genuinely cross-cutting — owned by no single domain, such as "no native on-device verification has ever been performed anywhere in this repo." That kind of entry may hold its full text directly in this file, because there is no more-specific home for it to link to.

```
# docs/status/known-issues.md (illustrative shape, not literal content)

## Domain-owned issues (this list only links out — full detail lives in the linked file)
- [Batak bidding AI miscalibration](../domains/games/batak/known-issues.md#bidding-ai)
- [Batak trick-center resize workaround](../domains/games/batak/known-issues.md#trick-center-resize)

## Cross-cutting issues (owned by no single domain — held here directly, and only here)
- No native on-device verification has ever been performed anywhere in this repo.
```

Note that the engine's "single-candidate extreme-element test" pattern does **not** appear in either list here — per §5's table above, it was reclassified as a Guardrail, so it never enters a known-issues file at all, domain or index.

If an index entry is ever found holding more than a one-line pointer, that is itself a signal the discipline has slipped and the entry's detail should be moved back into its owning domain's file, leaving only the link behind.

---

## 6. Knowledge Artifacts — specs, plans, ADRs, audits

Formalizing the fourth category, grounded in the conventions already proven by `docs/superpowers/` and `docs/animation/ADR|audits/`:

- **Specs & Plans** (`docs/superpowers/specs/`, `docs/superpowers/plans/`) — unchanged, global, one dated pair per feature. Answer "what was built and why" / "how, task by task." Never partitioned by domain — their existing chronological, cross-linkable convention already works and partitioning would only break it.
- **ADRs** — domain-scoped by default (`docs/domains/<domain>/ADR/`, created only once a domain has its first genuinely ADR-shaped decision — not pre-populated for every domain up front, per Refinement over Expansion), *except* decisions that are inherently cross-domain or behavioral, which go in `docs/governance/ADR/`. `docs/animation/ADR/` is the existing, proven instance of the domain-scoped case and needs no change. Numbering, statuses (`Proposed → Accepted → Superseded/Deprecated`), and the append-only-log discipline all follow `docs/animation/ADR/README.md`'s conventions exactly — no new convention is being invented.
- **Audits** — domain-scoped, created only for domains whose work-type genuinely benefits from a pre-implementation architecture review gate (currently just animation, per its own demonstrated bug history). Not created preemptively for engine or games domains unless/until a comparable recurring-bug pattern justifies it — mirroring the same evidentiary bar the Animation Constitution itself uses for admitting a new principle (§10 in that document), and the same bar §7 below applies repo-wide via the five escalation triggers.

### 6.1 `decisions.md` boundary: a decision record, not a development diary *(clarification, added on review)*

Phase 1 and §1 above both introduce `docs/domains/<domain>/decisions.md` as "a lightweight running decision log," but that phrase alone under-specifies its boundary — and a decision log is exactly the kind of document that can drift into a changelog one entry at a time, the same "knowledge gravity" risk already named in `architecture/phase-1-knowledge-audit.md` §10. This does not change `decisions.md`'s ownership or its place in the tree (§1, §2 above are unchanged) — it only tightens what belongs inside it.

**The rule:**
- `decisions.md` stores **architectural or product decisions and the reasoning behind choosing one approach over the alternatives that were considered.**
- It must **not** become a chronological development diary, a changelog, or an implementation-history log.
- Historical implementation detail — what was built, in what order, task by task, and exactly how — belongs to:
  - `docs/superpowers/specs/` (what was built and why, for one feature),
  - `docs/superpowers/plans/` (how, task by task),
  - git history (the literal record of what changed and when).

**The decision test:**
- *"Would a future developer ask why this choice exists?"* → `decisions.md`.
- *"Would they ask what happened during development?"* → the spec, the plan, or git history — not `decisions.md`.

A `decisions.md` entry should read like a short ADR-in-miniature (choice made, alternatives rejected, why) — not like a diary entry describing what got shipped on a given date. If an entry can be fully satisfied by "here's what changed," it belongs in a spec/plan/commit, not here.

### 6.2 Routing guidance: where should new knowledge go? *(added on review — no new folders, no tree changes)*

This is a decision framework for locating new knowledge within the tree already defined in §1 — it adds routing guidance only, it does not create a new folder or alter any existing ownership decision. Ask, in order:

1. **Is this a permanent architectural truth** — stable regardless of which game, engine version, or library is in use? → `architecture/`
2. **Is this a standing rule about how work happens** — process, collaboration, or a behavioral constraint, independent of any one feature? → `governance/`
3. **Is this knowledge owned by one technical or product area** — engine, a specific game, the UI/visual system, mobile/Expo? → `domains/<domain>/`
4. **Is this temporary project state** — current priorities, open bugs expected to eventually close? → `status/`
5. **Is this a feature definition or an implementation plan** — the what/why or the task-by-task how for one piece of work? → `superpowers/specs/` or `superpowers/plans/`
6. **Is this a decision record with alternatives considered** — a specific, time-bound, reversible choice, not a universal truth? → `ADR/` (domain-scoped by default, or `governance/ADR/` for cross-domain decisions, per §6 above)

These questions are ordered from most-permanent to most-transient/specific deliberately — if an item satisfies an earlier question, stop there rather than also checking the later ones (e.g. something that's genuinely a permanent architectural truth doesn't also need a domain-level home just because it happens to relate to one domain today).

---

## 7. Architecture escalation triggers — the feedback loop back into `architecture/` *(new in this revision)*

Sections 1–6 correctly partition knowledge once it exists, but leave one loop open: what tells Claude that a recurring problem has stopped being a domain-level Known Issue and has become an architecture-level question? Without an explicit signal, every domain's `known-issues.md` will quietly absorb pattern-level problems as a growing list of individually-patched symptoms — precisely the failure mode `docs/animation/animation-architecture-constitution.md` §1 already names in its own history ("a single shape repeats... each was a boundary-crossing assumption that was never written down").

This section operationalizes, for World of Cards specifically, the generic Decision Checklist and Architectural Compass already defined in `architecture/WKA v0.1 Architecture.md` / `WKA Bootstrap Baseline v0.1.md` ("Does it change architecture? → Candidate ADR"). Those documents describe the *shape* of that decision; the five triggers below are the concrete, repo-specific signals that should make Claude actually stop and apply that checklist, instead of continuing to patch.

### The feedback loop

```
Implementation
      ↓
Recurring Problem          (the same failure shows up again, in a new place)
      ↓
Pattern Detection          (one of the five triggers below fires)
      ↓
Architecture Review        (apply architecture/'s Decision Checklist; consult the
                             owning domain's overview.md and known-issues.md first,
                             to confirm this really is recurring and not a one-off)
      ↓
Decision                   (most often: refine an existing concept. Rarely: a new
                             ADR in docs/governance/ADR/ or docs/domains/<domain>/ADR/)
      ↓
Updated Knowledge          (the domain's overview.md/known-issues.md is updated; a
                             fixed symptom is REMOVED from known-issues.md — per §5 —
                             not just annotated "resolved")
      ↓
      (loops back into Implementation)
```

### The five triggers

Claude should recommend an architecture review — and say so explicitly to the user, rather than silently attempting a further targeted patch — when any of the following holds:

1. **The same class of problem requires repeated fixes.** Not the identical bug recurring (that's a regression), but the same *shape* of bug appearing in different components — e.g. Interactive Target Fidelity, fixed once in `SelectableCard.tsx` and independently rediscovered in the Demo 6 rail-fan work; or the "extreme element, single-candidate test" gap hit three separate times across Batak's RuleEngine review cycles (see §5's table).
2. **Abstractions create recurring exceptions.** A shared component or contract needs a new special-case branch for a new consumer more than once. Two exceptions is a coincidence; three is a signal the abstraction's boundary — not the callers — is drawn in the wrong place.
3. **Library limitations block intended architecture.** The chosen tool cannot do what the design genuinely requires, not merely "is awkward to use for it." The Reanimated-vs-`Animated` sequence (ADR-001 → ADR-003 in `docs/animation/ADR/`) is the model instance already in this repo: a real, evidenced limitation (a Yoga layout-pass stutter under rapid reflow) triggered a scoped, isolated experiment before any wholesale migration decision was made — not a library swap on first suspicion.
4. **Workarounds become permanent.** A "temporary" mitigation has persisted across multiple sub-projects with no active plan to revisit it — e.g. `TrickCenter.tsx`'s constant-`size="normal"` sidestep for the landing-resize mismatch, which its own doc comment already records as a sidestep, not a fix.
5. **Multiple domains depend on the same workaround.** Once a workaround that originated in one domain (e.g. animation) is being relied on or copy-pasted into a second domain (e.g. a future game's table layout), that is a signal the workaround is actually load-bearing shared architecture and should be designed as one — not left as parallel, independently-drifting copies. This is the same risk the Constitution's own Principle II evidence already names re: `seating.ts` vs. the playground's `fanLayout.ts`.

The five triggers above are unchanged by this revision — the following subsection adds filtering guidance for applying them, not a sixth trigger.

### Filtering before escalating: not every repetition is architectural *(clarification, added on review)*

A trigger firing is a prompt to *evaluate*, not an automatic instruction to escalate. Repetition alone is not sufficient — the same visible symptom recurring can have a purely local cause. Before recommending an architecture review, weigh:

- **Is the issue caused by a missing abstraction or boundary?** — or is each occurrence actually an independent, unrelated mistake that happens to look similar on the surface?
- **Does the same solution pattern need to exist in multiple places?** — if the fix is fundamentally the same wherever it recurs, that's a stronger signal than if each fix, on inspection, is subtly different.
- **Would solving it locally create future duplication?** — a local fix that would need to be copy-pasted again next time is evidence for escalating; a local fix that's genuinely self-contained is not.
- **Is the workaround becoming part of the system's contract?** — i.e., are other components starting to depend on the workaround's specific behavior, not just tolerate its presence (this sharpens Trigger 4 and Trigger 5 above).

**The distinction that matters:**
- **A repeated bug or regression is still a normal issue.** The same defect resurfacing (e.g. a fix that got reverted, or a genuinely isolated mistake repeated by coincidence) belongs in the owning domain's `known-issues.md` like any other bug — it does not, by itself, justify an architecture review.
- **A repeated *pattern* caused by missing design knowledge is an architecture signal.** When the recurrence traces back to an absent convention, an undocumented boundary, or a contract nobody wrote down (the same "boundary-crossing assumption" root cause the Animation Constitution's §1 already identifies across its own bug history), that is what the five triggers exist to catch.

This filter does not change or replace the five triggers — it is the judgment step applied *before* deciding a trigger has actually fired, consistent with §10's later note that these signals assist detection but do not replace architectural judgment.

### Where this plugs into the rest of the design

- **Context loading (§4):** a sixth tier, **Escalation-triggered**, is added — loaded only when one of the five triggers fires: `docs/governance/architecture-escalation.md` itself, then `architecture/`'s Decision Checklist/Architectural Compass, then the relevant `ADR/README.md` (domain-scoped, or `docs/governance/ADR/` for a cross-domain trigger).
- **Governance ownership (§1, §2):** this trigger procedure lives in its own file, `docs/governance/architecture-escalation.md` — a distinct artifact from `guardrails.md`, since it is a detection/escalation *procedure* rather than a behavioral rule, even though both are Governance-owned and both load early relative to `architecture/*` itself.
- **Known Issues discipline (§5, §5.1):** this is the mechanism that keeps known-issues lists from silently absorbing pattern-level problems. A known issue that keeps reappearing across components or domains is exactly the signal that should escalate it out of a plain list and into an actual architecture review (Trigger 1 or 5), rather than accumulate as an ever-longer list of independently-patched symptoms.

---

## 8. Resolving the `CLAUDE.md` ↔ `memory/*.md` duplication

This is one of the two concrete SSOT risks Phase 1 flagged, and this design resolves it rather than deferring it again:

**Decision: `memory/*.md` is the single source of truth for anything Claude needs to recall about *how the user prefers to work with Claude specifically*, and for informal tooling/environment facts that are personal to this Claude-in-this-sandbox setup (no adb access, Node version quirks, etc.). `docs/governance/guardrails.md` is the single source of truth for anything that should be visible and enforceable independent of which agent (or human) is reading it.**

Concretely:
- Rules that are really "how the repo/team works" (branch naming, commit-confirmation, testing policy, cross-app visual-change discussion trigger) belong in `docs/governance/guardrails.md` as the canonical text. The corresponding `memory/feedback_*.md` entries should be trimmed to a one-line pointer ("see `docs/governance/guardrails.md` — <topic>") rather than restating the rule, once Phase 3 executes this.
- Rules that are genuinely about *this specific Claude sandbox's* environment (no device access, `adb` tap unreliability, Node version mismatch) stay purely in `memory/*.md` — they have no reason to be a repo-committed file a human collaborator or Copilot would ever need to read.
- Where a memory entry is currently a mix of both (common in the existing `feedback_*.md` files), Phase 3's migration should split it: the generalizable rule moves to `guardrails.md`; the sandbox-specific residue stays in memory.

This also directly answers "how does the project avoid duplicated knowledge going forward": the rule is *not* "never write the same fact in two places," it's "every fact has one designated canonical home, and the other location may only point at it, never restate it" — exactly the WKA principle already stated in `architecture/WKA_Design_Baseline_v0.1.md`, and the same principle §5.1 above applies to `docs/status/known-issues.md` specifically.

---

## 9. `.github/copilot-instructions.md` — resolution direction (not executed this phase)

Not restructured now, per the task's constraints, but a direction is worth recording so Phase 3 doesn't have to rediscover it: `.github/copilot-instructions.md` should eventually **reference `docs/governance/engineering-principles.md` and `docs/governance/guardrails.md` for the substantive rules it currently restates independently** (small-change discipline, no speculative fixes, root-cause-first debugging, ask-before-large-refactors), while keeping its own tool-specific behavioral deltas as genuinely tool-specific (e.g. Copilot's blanket "never run git commit/merge/push" is a stricter subset of Claude's "ask before every commit/merge," and that difference is legitimate — Copilot's operating model in this repo apparently doesn't get a confirmation prompt the way Claude's does, so a hard "never" is the correct compensating rule for that tool, not a discrepancy to eliminate). This is flagged as a candidate Phase-3-or-later task, not a blocker to the rest of this design.

---

## 10. Migration sequence for Phase 3

Ordered to front-load the lowest-risk, highest-value moves and leave the single highest-risk step (rewriting `CLAUDE.md` itself) last, once everything it currently holds has a proven new home to point to.

### Migration priority ordering *(clarified in this revision)*

The step sequence below was already ordered lowest-risk-first in v1.0; this makes explicit that the same sequence maps directly onto five priorities, in this fixed order, and no step may be reordered to jump ahead on this list:

1. **Preserve knowledge** — nothing is deleted or trimmed until its content has a confirmed destination (Steps 1–4 below).
2. **Establish ownership** — every relocated block gets an explicit owner per §2 before anything is reduced (Steps 1–4).
3. **Reduce duplication** — only once ownership is established does §8's guardrails/memory reconciliation and §5.1's known-issues-index discipline actually apply (Steps 1–3, and an ongoing discipline afterward).
4. **Optimize context loading** — the doc map and loading tiers (§4) are only meaningful once the tree they route to actually exists (Step 4).
5. **Simplify entry points** — `CLAUDE.md`'s own reduction is last, deliberately, because it is the one step that removes content from an existing file rather than only adding new ones (Step 5).

### Migration discipline: this is a migration, not a documentation redesign *(clarification, added on review — a migration principle, not a new governance rule)*

Phase 3 relocates existing knowledge to the ownership boundaries this document already defines. It is not an opportunity to re-derive, improve, or restyle that knowledge along the way — those are different activities with different risk profiles, and conflating them is exactly what would make Step 5's Safety Checkpoint (below) hard to verify, since "did this content survive the move" becomes unanswerable once the content was also rewritten in the same pass.

During migration:
- Move existing knowledge to its canonical owner (per §1's tree and §2's ownership map) — do not also revise it.
- Preserve existing decisions and their historical meaning exactly as recorded; a decision's rationale is being relocated, not re-argued.
- Avoid rewriting concepts unless the rewrite is strictly required to separate ownership (e.g. splitting a changelog entry that spans two domains, per Step 3's own note on this) — rewriting for clarity, tone, or style is out of scope here.
- Do not introduce new architectural decisions while migrating. If moving a piece of knowledge surfaces a gap or a question the current design doesn't answer, record it (e.g. as a candidate for `docs/governance/architecture-escalation.md` or a future ADR per §7) rather than deciding it on the spot as part of the move.
- Do not rename concepts simply for stylistic consistency. A term that reads a little inconsistently across two relocated documents is not a defect this migration needs to fix.

New architectural improvements — including tidying naming, resolving stylistic inconsistencies, or acting on gaps surfaced during the move — belong in a later, dedicated refinement phase, undertaken only once migration stability is confirmed (i.e., after Step 5's Safety Checkpoint has passed and the new tree has been lived with for a while). This keeps Phase 3 a knowledge-relocation exercise with a verifiable success condition ("nothing lost, everything owned once") rather than an open-ended redesign with no clear finish line.

| Step | Action | Depends on | Risk |
|---|---|---|---|
| **1** | Create `docs/governance/guardrails.md`, `docs/governance/engineering-principles.md`, and `docs/governance/architecture-escalation.md`; populate from `CLAUDE.md` + reconcile against overlapping `memory/feedback_*.md` entries per §8 | Nothing | **Low.** Small, mechanical extraction of already-identified, already-stable content. Highest value-per-effort step — do first. |
| **2** | Create `docs/status/roadmap.md` and `docs/status/known-issues.md` (as an **index only**, per §5.1); populate `known-issues.md` with links, not copied detail | Step 1 (so it's clear what's a guardrail vs. an issue before this step runs) | **Low.** Mechanical extraction; the only judgment call is the §5 test plus the §5.1 index-vs-store discipline, both already pre-applied above for every currently-known item. |
| **3** | Create `docs/domains/<domain>/overview.md` + `decisions.md` (+ `known-issues.md` where applicable, holding the actual detail) for engine, mobile-expo, ui-visual-system, games/pisti, games/batak; split `CLAUDE.md`'s changelog narrative across them | Steps 1–2 (guardrails/known-issues already extracted, so the remaining narrative is purely domain-specific decision history) | **Medium.** The main risk is information loss or misfiling where one changelog entry touches multiple domains at once (e.g. an entry that changes both engine state and mobile UI in the same sub-project) — mitigate by copying verbatim into the *primary* domain first and cross-linking from the secondary one, rather than splitting the prose itself. |
| **4** | Create `architecture/world-of-cards-purpose.md` and `docs/00-DocumentationMap.md` | Steps 1–3 (the map can only be written accurately once it knows what it's mapping to) | **Low-medium.** Low technical risk; the only real risk is the map becoming stale the moment step 5 changes `CLAUDE.md` again — write it last among the "content" steps, right before step 5. |
| **— Safety Checkpoint —** | **Required gate before Step 5 — see full checklist below.** Not itself a content step; a verification pass. | Steps 1–4 complete | N/A — this step exists specifically to catch the risk in Step 5 before it happens. |
| **5** | Rewrite `CLAUDE.md` to its final navigation-only form (§3) | All of steps 1–4 **and** a passed Safety Checkpoint | **Highest.** This is the one file every session depends on unconditionally. |
| **6 (optional, deferred)** | Reconcile `.github/copilot-instructions.md` per §9 | Steps 1 (guardrails must exist to reference) | **Low risk, but explicitly out of scope unless requested** — a separate, deliberately scoped decision, not a dependency of anything above. |

### Safety checkpoint — required before Step 5 *(new in this revision)*

Step 5 is the only migration step that removes content from a file another session already depends on, which makes it categorically riskier than Steps 1–4 (which only ever add new files). Before any trimming of `CLAUDE.md` begins, all four of the following must be independently verified — this is a gate, not a formality, and it is the concrete mechanism by which priorities 1–3 above ("preserve knowledge," "establish ownership," "reduce duplication") are confirmed actually done, not merely assumed done, before priority 5 ("simplify entry points") is allowed to proceed:

1. **Preserve current content through git history.** Confirm the pre-trim `CLAUDE.md` is committed (not merely staged or in the working tree) before the reduction commit is made, so the full current text remains recoverable via `git log`/`git show` regardless of what the trimmed version ends up looking like.
2. **Verify every knowledge block has a canonical destination.** Walk the current `CLAUDE.md` section by section against the Migration Map already produced in Phase 1 (§5 there) and confirm each block's destination file actually exists and actually contains that content — not just that a destination was *planned*.
3. **Ensure no information is lost.** A block that turns out to have no clean destination during this walk-through is a signal the tree design (§1) missed a category — fix the tree (add a section to a domain doc, extend a `known-issues.md`, etc.) rather than silently dropping the content to make the trim easier.
4. **Ensure every item has one source of truth.** For each relocated block, confirm the *old* copy is actually removed from `CLAUDE.md` once the new copy exists — a step that adds the new home but leaves the old text in place has doubled the duplication this whole effort exists to remove, not fixed it.

Only once all four are confirmed does the actual `CLAUDE.md` rewrite (§3's final design) proceed.

**Cross-cutting risk not tied to one step:** without an explicit ongoing discipline, `docs/governance/guardrails.md`, `docs/status/known-issues.md`, and the new, slimmed `CLAUDE.md` are exactly the kind of always-loaded/always-easy-to-reach-for files that quietly regrow to their old size over many future sessions, one "just add one more note" edit at a time — the same failure mode that produced today's problem in the first place. Worth `docs/governance/guardrails.md` itself stating its own size discipline (e.g., "if an addition needs more than 2–3 lines of justification, it probably belongs in a domain's `decisions.md` or `known-issues.md` instead," and, per §7, "if this is the third time a similar problem was fixed, that's an escalation trigger, not another guardrail bullet") so the guardrail against context bloat is itself a guardrail, not just an aspiration of this one-time migration.

### Long-term maintenance discipline after migration *(new in this revision)*

The migration in Steps 1–5 creates ownership boundaries, but maintaining those boundaries is a continuous responsibility, not a one-time outcome of Phase 3. The following principles apply *after* Phase 3 completes — they do not change anything about the architecture design, migration order, or ownership model defined above; they describe how that model stays true once it's in place.

1. **Context growth is a signal, not automatically a problem.**

   Documents such as:
   - `CLAUDE.md`
   - `AGENTS.md`
   - `docs/00-DocumentationMap.md`
   - `docs/governance/guardrails.md`
   - `docs/status/known-issues.md`

   are intentionally high-access documents. Their growth should be periodically reviewed because these files have a higher risk of becoming accidental knowledge stores — the same "knowledge gravity" risk named in `architecture/phase-1-knowledge-audit.md` §10.

   A larger file is not automatically wrong. The question is whether the growth preserves the document's intended ownership (§2–§3 above), not whether it crossed some line count.

2. **Automation assists detection, but humans own architectural decisions.**

   Future tooling may detect signals such as:
   - unusually large always-loaded documents,
   - duplicated text across canonical locations,
   - stale links,
   - unresolved ownership ambiguity,
   - repeated issue patterns.

   These signals should trigger review, not automatic restructuring.

   No automated process should:
   - move knowledge between domains,
   - create new architecture boundaries,
   - rewrite governance rules,
   - remove historical decisions,
   - classify issues without human confirmation.

3. **Use escalation signals before structural problems emerge.**

   The architecture escalation model in §7 should be applied proactively, not only once a problem has already fully materialized.

   Examples:
   - a known issue repeatedly appears in different locations,
   - a workaround spreads across domains,
   - a governance document keeps growing with exceptions,
   - a routing document starts containing implementation details.

   The correct response is not immediate expansion of the existing document. The correct response is reviewing whether the ownership model (§2) still matches reality.

4. **Periodic human review remains part of the system.**

   The knowledge architecture is designed to reduce unnecessary cognitive load, not eliminate judgment.

   At meaningful milestones (major releases, new game additions, major architectural changes), the project owner should review:
   - whether ownership boundaries still make sense,
   - whether documents still serve their original purpose,
   - whether context loading remains efficient,
   - whether new patterns deserve formalization.

---

## 11. Explicit non-actions this phase

Per the task constraints, this document does **not**:
- create any of the new files/folders proposed above;
- move, rename, or delete `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, or anything under `docs/animation/`, `docs/superpowers/`, or `memory/`;
- rewrite any architecture decision recorded anywhere in the repo;
- execute any part of the §10 migration sequence — that begins only once Phase 3 is invoked, and Step 5 within it specifically does not proceed until its Safety Checkpoint is passed.
