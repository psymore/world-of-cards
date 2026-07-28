# Quick Audit: <Change Name>

**Used per:** `../AnimationReviewWorkflow.md` §2 — the fast path for changes that are genuinely small and obvious. This is not a shortcut *around* the Architecture Audit; it *is* the Architecture Audit, scaled to a change too small to justify `AuditTemplate.md`'s full ownership tables. If this template's own eligibility check below doesn't clearly pass, that's not a reason to fill it out anyway — it's the signal to switch to `AuditTemplate.md`.

---

## Eligibility

*Every box must be true to use this template instead of `AuditTemplate.md`. Checking a box you're not sure about defeats the point — when in doubt, escalate.*

- [ ] Touches exactly one Constitution §4 layer.
- [ ] Adds no new Layout Engine geometry or coordinate math (§5.IV).
- [ ] Does not change how multiple properties are coordinated on one transition (§5.VI).
- [ ] Adds or changes no interactive/tappable element's hit behavior (§5.VII).
- [ ] Is a tuning, cosmetic, or parameter-level change to behavior that's already shipped and already audited — not a new mechanism.

**If any box is unchecked: stop. Use `AuditTemplate.md` instead.**

---

## Change

**Name:**
**One-line description:**
**Layer touched (Constitution §4):**

## Quick Checks

*Answer directly, no tables. "No" or "not sure" on any of these means this isn't small — switch templates.*

- Does this duplicate a value another layer or file already owns? (§5.II)
- Does this leave any coordinate space, unit, or offset ambiguous to whoever reads it next? (§5.III)
- Does this depend on a static layout position that could drift from where the element actually renders? (§5.VII)

## Severity (only if something was found)

*Same scale as `AnimationReviewWorkflow.md` §3. A genuinely small change should land on "none" or Minor. A Critical or Major finding here means this template was the wrong choice — restart with `AuditTemplate.md`, don't try to resolve it in place.*

## Approval

**Approved to implement:** Yes / No
**Reviewer:**
**Date:**
