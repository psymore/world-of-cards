# Origins

The two documents this folder points to predate the Animation Architecture Constitution and directly motivated it — several of the Constitution's own principles exist specifically because applying these two documents' rules surfaced a real bug. For one direct, traceable example: `../animation-architecture-constitution.md` §5.VI's own Rationale explains that `CLAUDE_ANIMATION_RULES.md`'s "Single Timeline Principle" prescribed a specific mechanism (one shared progress value) that caused a real, on-device-confirmed bug — the Constitution's principle ratifies the *outcome* that document was reaching for, not the *mechanism* it originally prescribed.

Read these first if you want the *history* of why the architecture looks the way it does. For the *current* rules themselves, `../animation-architecture-constitution.md` is authoritative and takes precedence wherever the two disagree (see its own header for the one place that currently applies).

These files are not duplicated here — they stay at their real location, colocated with the app they govern:

- [`apps/playground/ANIMATION_ARCHITECTURE.md`](../../../apps/playground/ANIMATION_ARCHITECTURE.md) — the original Playground scope and demo-structure spec, including a "Suggested Technology" section the Constitution's Project Decisions (§7, item 1) explicitly overrides.
- [`apps/playground/CLAUDE_ANIMATION_RULES.md`](../../../apps/playground/CLAUDE_ANIMATION_RULES.md) — the original day-to-day working methodology (One Problem at a Time, Demo First, the Single Timeline Principle). Still the active, current guide for Playground implementation work — the Constitution didn't replace this document, it was built on top of what was learned applying it.

**Why this folder holds pointers, not copies:** moving the real files out of `apps/playground/` would separate them from the app they actively govern day to day; copying them would create a second, driftable copy of content that's still being maintained at the original location. Both are exactly the kind of duplication the Constitution's own Single Source of Truth principle (§5.II) warns against — applied here to documentation, not code.
