# Demo NN: <Title>

*Copy this file to `docs/animation/demos/DemoNN-<slug>.md` for each new Animation Playground demo. Delete the italicized instructions as you fill each section in; keep the headings and their order.*

**Status:** Not Started / In Progress / Complete
**Playground location:** `apps/playground/src/animation/demos/DemoNN....tsx`
**Authority:** subordinate to `animation-architecture-constitution.md`, any Accepted ADRs, and `AnimationReviewWorkflow.md` (see `00-DocumentationMap.md` for the full chain). This document records this demo's own reasoning and results; it does not define process or principles.

---

## Objective

*One or two sentences: what single animation problem does this demo isolate? Per `CLAUDE_ANIMATION_RULES.md`'s "One Problem at a Time" — if this section needs "and," it's two demos.*

## Scope

*What this demo deliberately does not address, and which future demo (if any) picks that up instead. Mirror the Constitution's own §2 in-scope/out-of-scope shape.*

## Constitution References

*Which Foundational Principles (`§5.I`–`§5.VIII`) does this demo exist to validate, exercise, or close a gap against? Which Known Architectural Gap (`§8`), if any, does this demo attempt to close? List by section number — do not restate principle text here.*

## Architecture Ownership

*For every distinct behavior this demo implements, name which Constitution §4 layer owns it and why — including which alternative layer placements were considered and rejected. This section exists to force the ownership reasoning to happen before code is written, not be reverse-engineered from the diff during review. It is a mandatory section, not optional documentation.*

| Behavior | Owner Layer (§4) | Why This Layer Owns It | Alternatives Considered | Why Rejected |
|---|---|---|---|---|
| | | | | |

## Architecture Audit

*Fill this out using `../audits/AuditTemplate.md`'s structure directly in this section (Current Ownership / Proposed Ownership / Layer Responsibilities / Boundary Violations / Severity Classification / Risks / Open Questions / Approval / Review Date / Reviewer). For a demo large enough to warrant its own standalone audit doc, create it in `../audits/` and link it here instead of duplicating it inline — see `../audits/AuditTemplate.md`'s own note on when to do that.*

## Current Behavior

*What actually happens today, before this demo's change. If this demo exists to fix a known bug, describe the bug concretely and reproducibly.*

## Expected Behavior

*The target motion/interaction, in specific, observable terms — not "should feel smooth." E.g. "no visible discontinuity across select → lift → fly → land → reflow, confirmed at both minimum and maximum hand size."*

## Acceptance Criteria

*Concrete, checkable conditions. Per Constitution §5.VIII (still conditional as of Version 1.0), verification here means real on-device or Playwright confirmation, unless this demo adds new Layout Engine geometry — in that case, resolve the testing question explicitly (`AnimationReviewWorkflow.md` §7.4) rather than skipping it silently.*

- [ ]
- [ ]

## Risks

*Known tricky edges: interruption mid-animation, rapid replay/stress conditions, reduced-motion accessibility settings, or anything this demo's own history has already surfaced once and could regress.*

## Regression Checklist

*Run Constitution §9 against this demo's diff — see `AnimationReviewWorkflow.md` §7 for the full Regression Review process, and §6 for Stop Conditions if something stops making sense mid-implementation. Add demo-specific regressions below: does this change destabilize any earlier demo's already-established behavior?*

- [ ] Constitution §9 checklist re-run against the diff (`AnimationReviewWorkflow.md` §7)
- [ ] No Stop Condition (`AnimationReviewWorkflow.md` §6) was worked around instead of resolved
- [ ]

## Notes

*Iteration history, rejected alternatives, follow-ups. Freeform — this is where the "why we tried X first and reverted it" story lives.*
