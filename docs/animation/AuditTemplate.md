# Architecture Audit: <Feature Name>

**Used per:** `AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process). Complete this before implementation begins; re-run it against the actual diff for Regression Review (`AnimationReviewWorkflow.md` §7).

*For a Playground demo, this can be filled in directly inside that demo's own doc (see `demos/DemoTemplate.md`'s "Architecture Audit" section) instead of as a standalone file. Use a standalone copy of this template when the work spans multiple demos, touches production (`apps/mobile`), or is large enough that a Demo doc isn't the right container.*

*For a change small and obvious enough to pass `QuickAuditTemplate.md`'s own eligibility checklist, use that instead — it satisfies this same requirement with less ceremony. If it doesn't clearly pass that checklist, use this template, not a shortened version of it.*

---

**Feature Name:**

**Objective:** *What is this change trying to achieve? One or two sentences — if it needs "and," consider whether it's actually two features.*

**Constitution References:** *Which Foundational Principles (`§5.I`–`§5.VIII`), Known Gaps (`§8`), or Rejected Proposals (`§6`) are relevant here? Reference by section number — do not restate their text.*

---

## Current Ownership

*For every piece of state, geometry, or visual value this change touches that already exists: who owns it today (which layer, which file/module)? Leave rows blank for anything genuinely new.*

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| | |

## Proposed Ownership

*Same values/behaviors, after this change. Every row should map to exactly one Constitution §4 layer — if a row doesn't, that is a Boundary Violation (below), not a modeling gap to paper over.*

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| | |

## Layer Responsibilities

*What does this change actually do within each Constitution §4 layer? Leave a layer's row as "not touched" rather than forcing an entry.*

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | |
| 2. Layout Engine | |
| 3. Animation Planning | |
| 4. Animation Execution/Runtime | |
| 5. Rendering | |
| 6. Interaction | |

## Boundary Violations

*Does any single piece of this change require one layer to do another layer's job (Constitution §5.I)? List each one found — an empty list is a real, checked answer, not a skipped section. If any of `AnimationReviewWorkflow.md` §6's Stop Conditions apply, note which one(s) here.*

## Severity Classification

*Classify every finding above using `AnimationReviewWorkflow.md` §3 (Critical / Major / Minor / Acceptable Technical Debt). Critical and Major findings block approval — see Workflow §4.*

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| | | |

## Risks

*What could go wrong beyond a pure boundary violation — interruption mid-animation, rapid replay, reduced-motion settings, or anything this area's history has already surfaced once.*

## Open Questions

*Anything not yet resolved that implementation shouldn't start without an answer to. An audit with unresolved Open Questions is not yet approved (`AnimationReviewWorkflow.md` §4).*

## Approval

**Approved to implement:** Yes / No / Pending
**Conditions (if any):**

## Review Date



## Reviewer


