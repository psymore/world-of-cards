# Architecture Escalation

**Owner:** Project owner. **Scope:** repo-wide — when a recurring problem stops being a domain-level Known Issue and becomes an architecture-level question. **Load:** whenever a recurring-problem signal is suspected (see the five triggers below), in addition to whatever domain/task-level docs are already loaded — never instead of them.

This document is the canonical source for the escalation model designed in `architecture/phase-2-knowledge-architecture-design.md` §7. It operationalizes, for World Cards specifically, the generic Decision Checklist and Architectural Compass already defined in `architecture/WKA v0.1 Architecture.md` / `WKA Bootstrap Baseline v0.1.md` ("Does it change architecture? → Candidate ADR"). Those documents describe the *shape* of that decision; this document is the concrete, repo-specific signal set that should make Claude actually stop and apply that checklist, instead of continuing to patch.

---

## The feedback loop

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
                             fixed symptom is REMOVED from known-issues.md, not just
                             annotated "resolved")
      ↓
      (loops back into Implementation)
```

## The five triggers

Recommend an architecture review — and say so explicitly to the user, rather than silently attempting a further targeted patch — when any of the following holds:

1. **The same class of problem requires repeated fixes.** Not the identical bug recurring (that's a regression), but the same *shape* of bug appearing in different components — e.g. Interactive Target Fidelity, fixed once in `SelectableCard.tsx` and independently rediscovered in the Demo 6 rail-fan work; or the "extreme element, single-candidate test" gap hit three separate times across Batak's RuleEngine review cycles.
2. **Abstractions create recurring exceptions.** A shared component or contract needs a new special-case branch for a new consumer more than once. Two exceptions is a coincidence; three is a signal the abstraction's boundary — not the callers — is drawn in the wrong place.
3. **Library limitations block intended architecture.** The chosen tool cannot do what the design genuinely requires, not merely "is awkward to use for it." The Reanimated-vs-`Animated` sequence (`docs/animation/ADR/ADR-001` → `ADR-003`) is the model instance already in this repo: a real, evidenced limitation (a Yoga layout-pass stutter under rapid reflow) triggered a scoped, isolated experiment before any wholesale migration decision was made — not a library swap on first suspicion.
4. **Workarounds become permanent.** A "temporary" mitigation has persisted across multiple sub-projects with no active plan to revisit it — e.g. `TrickCenter.tsx`'s constant-`size="normal"` sidestep for the landing-resize mismatch, which its own doc comment already records as a sidestep, not a fix.
5. **Multiple domains depend on the same workaround.** Once a workaround that originated in one domain (e.g. animation) is being relied on or copy-pasted into a second domain (e.g. a future game's table layout), that is a signal the workaround is actually load-bearing shared architecture and should be designed as one — not left as parallel, independently-drifting copies.

## Filtering before escalating: not every repetition is architectural

A trigger firing is a prompt to *evaluate*, not an automatic instruction to escalate. Repetition alone is not sufficient — the same visible symptom recurring can have a purely local cause. Before recommending an architecture review, weigh:

- **Is the issue caused by a missing abstraction or boundary?** — or is each occurrence actually an independent, unrelated mistake that happens to look similar on the surface?
- **Does the same solution pattern need to exist in multiple places?** — if the fix is fundamentally the same wherever it recurs, that's a stronger signal than if each fix, on inspection, is subtly different.
- **Would solving it locally create future duplication?** — a local fix that would need to be copy-pasted again next time is evidence for escalating; a local fix that's genuinely self-contained is not.
- **Is the workaround becoming part of the system's contract?** — i.e., are other components starting to depend on the workaround's specific behavior, not just tolerate its presence (this sharpens triggers 4 and 5 above)?

**The distinction that matters:**
- **A repeated bug or regression is still a normal issue.** The same defect resurfacing (e.g. a fix that got reverted, or a genuinely isolated mistake repeated by coincidence) belongs in the owning domain's `known-issues.md` like any other bug — it does not, by itself, justify an architecture review.
- **A repeated *pattern* caused by missing design knowledge is an architecture signal.** When the recurrence traces back to an absent convention, an undocumented boundary, or a contract nobody wrote down, that is what the five triggers exist to catch.

This filter does not replace the five triggers — it is the judgment step applied *before* deciding a trigger has actually fired.

## Long-term maintenance discipline

Applying this document is a continuous responsibility, not a one-time migration outcome:

1. **Context growth is a signal, not automatically a problem.** Always-loaded documents (`CLAUDE.md`, `AGENTS.md`, `docs/00-DocumentationMap.md`, `docs/governance/guardrails.md`, `docs/status/known-issues.md`) are intentionally high-access and therefore at higher risk of becoming accidental knowledge stores. A larger file is not automatically wrong — the question is whether growth still preserves the document's intended ownership.
2. **Automation assists detection; humans own architectural decisions.** Tooling may one day flag signals (unusually large always-loaded documents, duplicated text across canonical locations, stale links, unresolved ownership ambiguity, repeated issue patterns) — these should trigger review, never automatic restructuring. No automated process should move knowledge between domains, create new architecture boundaries, rewrite governance rules, remove historical decisions, or classify issues without human confirmation.
3. **Use these triggers proactively**, before a structural problem has fully materialized — a known issue reappearing in different locations, a workaround spreading across domains, a governance document accumulating exceptions, or a routing document starting to hold implementation details are all reasons to review the ownership model, not to expand the document in place.
4. **Periodic human review remains part of the system.** At meaningful milestones (major releases, new game additions, major architectural changes), the project owner should review whether ownership boundaries still make sense, whether documents still serve their original purpose, whether context loading remains efficient, and whether new patterns deserve formalization. This architecture reduces unnecessary cognitive load — it does not eliminate judgment.
