# 00 — Documentation Map

**Owner:** whoever adds/removes a domain or artifact type from the tree. **Load:** rarely — stable once correct; read once for onboarding, or when the tree structure itself changes.

**Purpose of this document:** the single repo-wide navigation entry point. It explains what every top-level knowledge location is for, who owns it, when to load it, and the order to read things in. It is not itself a source of architectural rules, domain knowledge, or process rules — if anything here ever conflicts with a document it describes, that document wins; fix this map, not the other document. Modeled directly on `docs/animation/00-DocumentationMap.md`, which is this repo's own proven instance of the same pattern, scoped to one domain.

---

## Authority hierarchy

```
architecture/                     (Foundation Layer — permanent, project-wide Purpose/Quality Attributes)
        ↓
docs/governance/                  (standing rules: engineering principles, behavioral guardrails, escalation)
        ↓
docs/domains/<domain>/            (per-domain overview, decisions, known issues — including docs/animation/,
                                    which predates this map and lives at its own historical path)
        ↓
docs/superpowers/specs/ + plans/  (per-feature: what was built and why / how, task by task)
        ↓
docs/status/                      (short-lived project state: roadmap, known-issues index)
        ↓
Implementation                    (the actual code)
```

**What "authority" means here** — a dependency direction, not a strict override ladder:
- **`architecture/` → everything.** Nothing below may contradict what it states. Changing it is a deliberate, rare act, not a side effect of routine feature work.
- **`docs/governance/` → domains, specs/plans, status.** A standing engineering principle or guardrail applies regardless of domain; a domain's own docs don't override it. `docs/governance/architecture-escalation.md` is what decides when a domain-level pattern has actually become an architecture-level question — see its own "five triggers" and filtering guidance before assuming a repeated problem needs escalating.
- **`docs/domains/` → specs/plans, status.** A domain's `overview.md`/`decisions.md` describe stable architecture and reasoning; a feature spec/plan for that domain should be consistent with them, not redefine them.
- **`docs/status/` never governs anything below it** — it only reflects current state. `docs/status/known-issues.md` specifically is an index, not a store (see `architecture/phase-2-knowledge-architecture-design.md` §5.1) — it never holds a domain-specific issue's actual detail, only a pointer into the owning domain's own `known-issues.md`.
- **`docs/references/` holds no authority over anything.** It's supporting visual/design source material, not a knowledge document — nothing in the hierarchy above depends on it, and it never governs a decision on its own (a domain's `decisions.md` may cite an image as evidence, but the reference material itself never overrides a document).

No lower-level document may override a higher-level one. If a domain's reasoning seems to require breaking a governance rule or an architectural principle, that's a signal to stop and check `docs/governance/architecture-escalation.md`, not to let the domain doc quietly win.

---

## Where things live

| Category | Location | Owner | Load when |
|---|---|---|---|
| Generic WKA meta-architecture | `architecture/WKA*.md` | Project owner | Onboarding, or a genuinely architecture-shaped change |
| WKA v1.0 canonical model (entities, relationships, lifecycle, invariants for the Code Index knowledge layer) | `architecture/wka-v1.0-canonical-model.md` | Project owner | Onboarding, or a genuinely architecture-shaped change |
| World Cards' own Purpose/Quality Attributes | `architecture/world-cards-purpose.md` | Project owner | Same as above |
| Standing engineering principles | `docs/governance/engineering-principles.md` | Project owner | Before writing code/tests/a structural decision |
| Standing behavioral guardrails | `docs/governance/guardrails.md` | Project owner, via direct correction | Always, before implementation |
| Architecture escalation triggers | `docs/governance/architecture-escalation.md` | Project owner | When a recurring-problem signal is suspected |
| Per-domain stable architecture | `docs/domains/<domain>/overview.md` | Domain maintainer | Touching that domain |
| Per-domain decision reasoning ("why X over Y") | `docs/domains/<domain>/decisions.md` | Domain maintainer | Asking why a domain is built the way it is |
| Per-domain current problems | `docs/domains/<domain>/known-issues.md` | Whoever found/confirmed it | Starting new work in that domain |
| Animation (its own full ecosystem) | `docs/animation/00-DocumentationMap.md` | Established via its own ADR/Workflow process | Any animation-touching change |
| Feature spec (what/why) | `docs/superpowers/specs/<date>-<feature>.md` | Feature author | Working on or investigating that feature |
| Feature plan (how, task by task) | `docs/superpowers/plans/<date>-<feature>.md` | Feature author | Same |
| Current roadmap/priorities | `docs/status/roadmap.md` | Project owner | Session start, planning next work |
| Known-issues index | `docs/status/known-issues.md` | Whoever adds/removes an entry | Starting new work, repo-wide quick check |
| Visual/design reference material (screenshots, mockups, source images) | `docs/references/<topic>/` | Whoever adds the reference | Design/UI work needing a visual source of truth |
| Claude-personal/sandbox facts | `memory/*.md` (outside the repo tree) | Claude, per the memory system's own rules | Governed entirely by that system, unaffected by this map |

---

## Recommended reading order

**First time in this codebase:**
1. `CLAUDE.md` (orientation, routing table, "before you start" checklist).
2. This document, for the full picture beyond `CLAUDE.md`'s condensed version.
3. `docs/governance/guardrails.md` and `docs/governance/engineering-principles.md` in full — small, and load-bearing for almost everything else.
4. `docs/status/roadmap.md` for current priorities.

**Starting a new task:**
1. `docs/domains/<domain>/overview.md` for the area you're touching (or `docs/animation/00-DocumentationMap.md` for animation work).
2. That domain's `known-issues.md`, to avoid duplicating known-broken territory.
3. The relevant `docs/superpowers/specs/` + `plans/` pair, if investigating or extending a specific past feature.

**Suspecting a recurring problem:**
1. `docs/governance/architecture-escalation.md` — apply its five triggers and filtering guidance before assuming either "just patch it again" or "this needs an architecture review."
2. `architecture/`'s own Decision Checklist (`WKA v0.1 Architecture.md`) if escalation is actually warranted.

**Recording a new decision:**
1. Confirm it's genuinely decision-shaped (alternatives considered, not just "what happened") via the test in `architecture/phase-2-knowledge-architecture-design.md` §6.1.
2. Add it to the relevant domain's `decisions.md`, or — for a cross-domain, time-bound, reversible decision — consider whether it's ADR-shaped instead (`docs/animation/ADR/README.md` is the model convention; no repo-wide or other-domain ADR folder exists yet, created opportunistically per `architecture/phase-2-knowledge-architecture-design.md` §6).

---

## Relationship to `CLAUDE.md`

`CLAUDE.md` is the first thing read, every session, in full — it stays deliberately small (a router, not an encyclopedia) precisely because of that. This document is what it points to for the complete picture; nothing here duplicates `CLAUDE.md`'s content, and nothing in `CLAUDE.md` should duplicate this document's content either. If the two ever drift apart, fix whichever one is wrong against the tree actually on disk — neither is authoritative over the other; the actual repo structure is.
