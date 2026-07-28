# Animation Review Workflow

**Applies to:** all animation work in scope of `animation-architecture-constitution.md` §2 (Scope).
**Authority:** subordinate to the Constitution and to any Accepted ADRs (`ADR/`). This document defines *process*, not architectural rules, and may be revised at any time through ordinary engineering judgment — it does not require the Constitution's §10 amendment bar. It governs `AuditTemplate.md` and `demos/DemoTemplate.md` below it in the authority chain (see `00-DocumentationMap.md`). If anything here ever conflicts with the Constitution or an Accepted ADR, that document wins and this one is wrong.
**Reference, not restatement:** every rule this document points at lives in `animation-architecture-constitution.md`. This document says *when* and *how* those rules get checked — never *what* they are. Principle text duplicated here is a bug in this document; replace it with a `§`-reference.

---

## 1. Purpose

The Constitution states what must always be true about this codebase's animation architecture. It does not say, on its own, at what point in a task that gets checked, who checks it, what happens when a check fails, or when a task is actually finished. This document closes that gap: it is the repeatable procedure every animation task — a new Playground demo, a production feature in `apps/mobile`, a bug fix — runs through, so "checked against the Constitution" (the Constitution's own §1 operational instruction) means the same specific thing every time, not a different ad hoc judgment call per task.

---

## 2. Architecture Audit

An Architecture Audit is the act of checking a proposed or implemented animation change against the Constitution. It runs twice per task — once against the **plan**, before implementation starts (this section), and once against the **diff**, before merge (§7, Regression Review).

**Procedure:**

1. Identify which layers (Constitution §4) the change touches.
2. Walk the Constitution's Architecture Review Checklist (§9), in the order given in §10 of this document, answering each applicable item against the change.
3. For any item that does not clearly pass, check whether it's already a recorded Known Architectural Gap (Constitution §8) or a live Rejected Proposal (Constitution §6) being reconsidered without a qualifying spike. If neither applies, it's a new finding.
4. Classify every new finding by severity (§3 below).
5. Record the findings using `audits/AuditTemplate.md`: for Playground work, filled in directly inside the demo's doc; for production work, as a standalone copy in `audits/`, linked from the PR description or task doc.

For changes small and obvious enough to pass `audits/QuickAuditTemplate.md`'s own eligibility checklist, that lighter template satisfies this same procedure — it is not an exemption from it, only a smaller artifact sized to a smaller change. It is not a way to skip a finding; a Critical or Major result on the quick path still means stop and switch to `audits/AuditTemplate.md` (§3, §4).

An audit only checks the specific guarantees the Constitution names. Style, naming, and structure questions that don't touch a Foundational Principle belong to ordinary code review, not this process.

---

## 3. Severity Classification

| Severity | Meaning | What happens |
|---|---|---|
| **Critical** | Violates a ratified Foundational Principle (Constitution §5, excluding conditional ones) in a way that reproduces a bug category the Constitution already names from this repository's own history. | Blocks approval (§4) and blocks Definition of Done (§9). Must be fixed before the task proceeds. |
| **Major** | Violates a ratified principle's intent, or carries a clear risk of the same bug category, without (yet) a confirmed reproduction. | Should be fixed before merge. If genuinely infeasible within this task's scope, must be explicitly escalated — recorded as a new Constitution §8 gap (via §10) or spun out into an ADR — never silently shipped as "we'll get to it." |
| **Minor** | A structural or stylistic deviation that doesn't touch a Foundational Principle's actual guarantee. | Can ship. Should still be noted (PR comment or the doc's "Notes" section) so it isn't rediscovered from scratch later. |
| **Acceptable Technical Debt** | A deliberate, reasoned deviation the team is knowingly accepting, with a stated reason. | Can ship, but **must** be recorded somewhere durable — a new Constitution §8 entry (via §10) or an ADR. A debt item that exists only in a merged PR's conversation history is not tracked; it is lost. |

This mirrors the vocabulary the Constitution already uses for itself — its own §8 entries are exactly "Acceptable Technical Debt" that already went through this process. This table just gives that vocabulary a name a reviewer can apply mid-task, before something becomes a permanent Constitution entry.

---

## 4. Implementation Approval Process

1. Architecture Audit (§2) runs against the plan.
2. Zero Critical/Major findings → implementation is approved, proceed to §5.
3. Any Critical finding → the plan must change. Re-audit before proceeding.
4. Any Major finding → resolve it in the plan, or explicitly escalate it (§3) before implementation starts, not after.

This is deliberately one lightweight gate, not a review board. For Playground work it is usually a self-check against the checklist before writing code; for production work it slots into whatever planning/review process is already in use for the task — it supplements that process, it does not replace it.

---

## 5. Implementation Rules

Day-to-day implementation method (one problem at a time, Demo First, preserve working code, incremental iteration) is already defined in `apps/playground/CLAUDE_ANIMATION_RULES.md` and is not repeated here. This document adds exactly one rule on top of it:

**Implementation may not begin until §4 has approved the plan.** If something discovered mid-implementation invalidates the audit — a different layer turns out to be involved, a principle turns out to be at risk that wasn't flagged — stop and re-audit rather than finishing first and hoping the Regression Review (§7) catches it.

---

## 6. Stop Conditions

Architecture Audit (§2) and Regression Review (§7) are checkpoints *before* and *after* implementation. Stop Conditions apply **during** it — mid-task signals that the work in progress is no longer describable in Constitution terms and needs to return to Architecture Audit rather than be patched around.

Implementation must stop immediately if:

- **A responsibility crosses architectural boundaries** (Constitution §5.I) — code written for one layer starts reaching into another layer's concern.
- **Geometry becomes duplicated** (Constitution §5.II, §5.IV) — the same position, rotation, or size fact starts being computed in two places instead of one being consumed by the other.
- **Rendering performs business logic** (Constitution §4, layer 5; §5.I) — a component whose job is to paint current values starts deciding game/domain facts instead of receiving them.
- **The Animation Runner requires game knowledge** (Constitution §4, layer 4; §5.I) — the layer that should only know about frames, timing, and interpolation starts needing to know whose turn it is, what a trick is, or any other Domain/Game State (Constitution §4, layer 1) fact.
- **Coordinate ownership becomes ambiguous** (Constitution §5.III) — a value is being passed between two pieces of code and neither the code nor its documentation can say, with certainty, whose coordinate space it is currently in.
- **Stable component identity cannot be preserved** (Constitution §5.I) — the change would require the rendering framework to unmount/remount an element to achieve some visual effect, discarding animation state that should have carried through. This is exactly the failure mode in Constitution §5.I's own evidence — treat any new instance of it as a Stop Condition, not a special case.
- **Constitution ownership cannot be identified** — nobody working the task can say which Foundational Principle, Layer, or existing ADR governs the situation. This one differs from the rest: it isn't evidence the work is wrong, it's evidence the Constitution itself may have a real gap (Constitution §8, via §10). Treat it as a research task, not an implementation blocker to route around.

**When any Stop Condition triggers:** pause. Return to Architecture Audit (§2) — do not ship a workaround to keep the current plan intact. A Stop Condition "solved" by narrowing scope, adding a special case, or reaching around the boundary anyway is not resolved; it has only been hidden from the next audit.

---

## 7. Regression Review

Runs once implementation is believed complete, before merge.

1. Re-run the Architecture Audit (§2) against the actual diff, not the original plan — plans and diffs drift.
2. Confirm every Critical/Major finding from §4 was actually resolved, not just planned to be.
3. Check Constitution §8: does this change make any existing gap better, worse, or newly relevant? Update it via Constitution §10's process if so — this document has no authority to edit the Constitution itself.
4. Verify live, per this repository's current standing practice. Constitution §5.VIII is still conditional — until Constitution §7 item 3 is resolved, "verified" means real on-device or Playwright confirmation, not an automated test, *unless* the change adds new Layout Engine geometry, in which case Constitution §9's checklist item on this must be explicitly resolved for this change, not silently skipped.
5. Confirm no new dependency on observing live animation progress was introduced without justification against Constitution §6's rejected-proposal reasoning.
6. Confirm no Stop Condition (§6) was worked around instead of resolved.

---

## 8. Permanent Constitution Checklist

This workflow does not define its own checklist. The checklist is `animation-architecture-constitution.md` §9 — it is not reproduced here. §2 above defines when it's applied; §10 of this document (below) defines the order to apply it in.

---

## 9. Definition of Done

An animation task is done when all of the following hold:

- [ ] Architecture Audit (§2) ran against both the plan and the final diff (Regression Review, §7).
- [ ] No unresolved Critical or Major findings remain.
- [ ] No Stop Condition (§6) was worked around instead of resolved.
- [ ] Any Acceptable Technical Debt is recorded in Constitution §8 (via §10) or a new ADR — not left implicit in a PR thread.
- [ ] For Playground work: the demo's doc (based on `demos/DemoTemplate.md`) is filled in and current, including its Architecture Ownership section.
- [ ] Live verification has happened per this repo's current standing practice (§7.4).
- [ ] The Constitution itself is unchanged — **or**, if the work genuinely surfaced evidence that a Foundational Principle is incomplete or wrong, a Constitution amendment has been proposed through §10's process, as a separate, explicit change from this task's own merge.

---

## 10. Recommended Review Order

When walking Constitution §9's checklist (§2 and §7 above), check in this order, not the order items happen to be printed in:

1. **§5.I (Layered Ownership)** first — if the change is structurally in the wrong layer, every other finding below is checking the wrong thing.
2. **§5.II (SSOT) and §5.III (Explicit Contracts)** — data/value ownership and meaning, before motion quality.
3. **§5.IV (Pure Layout)** — if layout math is touched.
4. **§5.V (Visual State Continuity) and §5.VI (Coordinated Property Timelines)** — if animation execution is touched.
5. **§5.VII (Interactive Target Fidelity)** — if the element is interactive.
6. **§5.VIII (Testable Core)** last — it's conditional and process-level, not a design-correctness gate; it shouldn't block earlier findings from being recorded.

**Rationale:** a layering violation (1) invalidates any conclusion drawn from checking motion quality (4) on top of it — there is no value in auditing whether a transition's timelines are coordinated if the code implementing it doesn't belong in that layer at all.

If, while walking this order, any Stop Condition (§6) is met, stop the audit at that point and follow §6's guidance rather than continuing down the list.
