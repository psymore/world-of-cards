# 00 — Documentation Map

**Purpose of this document:** the single navigation entry point for `docs/animation/`. It explains what every document in this folder is for, the authority relationship between them, the order to read them in, and when to use each one. It is not itself a source of architectural rules — if anything here ever conflicts with a document it describes, that document wins; fix this map, not the other document.

---

## Authority Hierarchy

```
Animation Constitution                 (permanent, implementation-agnostic principles)
        ↓
Architecture Decision Records (ADR)    (accepted, project-specific decisions)
        ↓
Animation Review Workflow              (the process by which the above two get applied and produced)
        ↓
Audit Template                         (the artifact Workflow's Architecture Audit step produces)
        ↓
Demo Documentation                     (task-level record: objective, ownership, audit, acceptance)
        ↓
Implementation                         (the actual code)
```

**What "authority" means at each link** — this chain is a dependency direction, not a strict override ladder. Stated precisely, so it can't be misread:

- **Constitution → everything.** Nothing below may contradict a ratified Foundational Principle. The only way to change one is the Constitution's own §10 amendment process — no document in this folder has that authority on its own.
- **ADRs → Workflow, Audit Template, Demo docs.** An Accepted ADR is a settled fact about the current project context (e.g. which animation engine is in use today). Every audit and every demo doc must treat Accepted ADRs as given, not re-litigate them each time. Workflow's own process is what *produces* ADRs (via its severity classification, §3) — "ADRs sit above Workflow" means "once accepted, a decision constrains future audits," not "the process document is somehow less real than its own output."
- **Workflow → Audit Template, Demo docs.** Workflow defines when an audit happens, what severity a finding gets, and what happens next. Audit Template and Demo docs are artifacts *produced by* following Workflow — they cannot redefine Workflow's process (a Demo doc cannot invent its own severity scale, for instance).
- **Audit Template → Demo docs.** A Demo doc's Architecture Audit content should be produced by filling out (or referencing) `AuditTemplate.md`, not by inventing an ad hoc audit format per demo.
- **Demo docs → Implementation.** Implementation should not begin until its Demo doc's Architecture Audit and Architecture Ownership sections are filled in and approved (`AnimationReviewWorkflow.md` §4).

No lower-level document may override a higher-level one. If a Demo doc's reasoning seems to require breaking a Constitution principle, that is a Stop Condition (`AnimationReviewWorkflow.md` §6) — the fix is to pause and escalate, not let the lower document quietly win.

---

## Document Index

| Document | What it is | Read it when |
|---|---|---|
| [`01-origins/README.md`](./01-origins/README.md) | Pointers to the two pre-Constitution Playground documents that directly motivated it. | Optional, for historical context — *why* the Constitution's principles are what they are. Not needed for current rules; the Constitution is self-contained. |
| [`animation-architecture-constitution.md`](./animation-architecture-constitution.md) | Permanent, implementation-agnostic Foundational Principles (§5), Layer Model (§4), Rejected Proposals (§6), Project Decisions (§7), Known Gaps (§8). The architectural authority. | Always, first — before any other document in this folder makes sense. |
| [`AnimationReviewWorkflow.md`](./AnimationReviewWorkflow.md) | The process: how an Architecture Audit runs, how findings get severity-classified, when implementation is approved, Stop Conditions, Regression Review, Definition of Done. | Before starting any animation task, and again mid-task if a Stop Condition is suspected. |
| [`audits/README.md`](./audits/README.md) | Explains the `audits/` folder's convention — templates and completed audit records live together, mirroring `ADR/`. | Before writing your first standalone audit, or if unsure where a completed one belongs. |
| [`audits/AuditTemplate.md`](./audits/AuditTemplate.md) | Reusable template for the Architecture Audit that Workflow §2 requires before every implementation. | Before writing any animation implementation — Playground demo or production feature. |
| [`audits/QuickAuditTemplate.md`](./audits/QuickAuditTemplate.md) | Lighter fast-path version of the Architecture Audit, gated by its own eligibility checklist. | Only for changes that are small, single-layer, and touch already-audited behavior — anything else falls back to `audits/AuditTemplate.md`. |
| [`ADR/README.md`](./ADR/README.md) | When to write an ADR vs. amend the Constitution instead; numbering; lifecycle. | Before recording any project-specific architectural decision (engine choice, sequencing, tradeoff). |
| [`ADR/TEMPLATE.md`](./ADR/TEMPLATE.md) | Template for one ADR. | Copy it once `ADR/README.md` has confirmed an ADR — not a Constitution edit — is the right artifact. |
| [`demos/DemoTemplate.md`](./demos/DemoTemplate.md) | Template for one Animation Playground demo's full record: objective, scope, ownership, audit, behavior, acceptance criteria, regressions. | Copy it for every new Playground demo (`Demo06`, `Demo07`, ...). |

---

## Folder Structure

```
docs/animation/
  00-DocumentationMap.md                  — this file, the entry point
  README.md                               — stub pointing here (for tools that only render README.md)
  01-origins/
    README.md                             — pointers to the pre-Constitution Playground docs, not copies
  animation-architecture-constitution.md  — the Constitution (unchanged by this documentation work)
  AnimationReviewWorkflow.md              — process
  audits/
    README.md                             — audits folder convention (templates + instances together)
    AuditTemplate.md                      — pre-implementation audit artifact
    QuickAuditTemplate.md                 — lighter audit artifact for small, obvious changes
    Demo06-07-RailFanAudit.md             — a completed standalone audit
  ADR/
    README.md                             — when to write one, numbering, lifecycle
    TEMPLATE.md                           — copy per decision
    ADR-001-....md                        — (none yet)
    ADR-002-....md
  demos/
    DemoTemplate.md                       — copy per Playground demo
    Demo01-....md                         — (none yet)
    Demo02-....md
```

The `00-`/`01-` numeric prefixes are deliberate, not cosmetic — they force this map and the origins folder to sort first in any file listing, regardless of tooling, and specifically put `01-origins/` immediately before `animation-architecture-constitution.md` to reflect that the origins documents came first and the Constitution was built from what applying them taught.

---

## Document Relationships

- The Constitution never references any other document in this folder — it must remain readable and correct in total isolation from process/tooling documents, consistent with its own implementation-agnostic scope.
- Workflow, Audit Template, ADR docs, and Demo docs all reference the Constitution by `§`-number and never restate its rule text. Restated principle text found in any of them is a bug in that document — replace it with a reference.
- ADRs may reference Constitution sections (to note what they must not contradict) and other ADRs (supersession). They do not reference Demo docs or Workflow.
- Demo docs reference the Constitution, relevant ADRs, Workflow, and Audit Template. Nothing references a Demo doc back, except another Demo doc explicitly noting a regression risk against an earlier one.
- `01-origins/` is a dead end by design: it points outward to `apps/playground/ANIMATION_ARCHITECTURE.md` and `CLAUDE_ANIMATION_RULES.md`, and nothing else in this folder references it back. It exists purely for historical context, not as a dependency any other document relies on.

---

## Recommended Reading Order

**First time in this codebase, animation work assigned:**
1. This document (orientation).
2. `01-origins/README.md` (optional, but recommended once, not every time) — the two documents that predate and directly motivated the Constitution.
3. `animation-architecture-constitution.md` §1–§4 (Philosophy, Scope, Goals, Layer Model) for the "why," then §5 in full.
4. `AnimationReviewWorkflow.md` in full.
5. Whichever of `audits/AuditTemplate.md` / `demos/DemoTemplate.md` matches the task at hand.

**Already familiar, starting a new task:**
1. `audits/AuditTemplate.md` (or `audits/QuickAuditTemplate.md` if it clearly qualifies) or `demos/DemoTemplate.md` (copy and fill in).
2. Constitution §9 (Architecture Review Checklist) and `AnimationReviewWorkflow.md` §10 (Recommended Review Order) as a working reference while auditing.

**Recording a decision, not a demo:**
1. `ADR/README.md` — confirm it's actually ADR-shaped, not a Constitution change.
2. `ADR/TEMPLATE.md`.
