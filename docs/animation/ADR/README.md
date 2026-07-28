# Architecture Decision Records — Animation

**Authority:** subordinate to `../animation-architecture-constitution.md`. An Accepted ADR may never contradict a ratified Foundational Principle — if a decision seems to require that, it belongs in the Constitution via its own §10 amendment process, not here. Once Accepted, an ADR constrains `../AnimationReviewWorkflow.md`-driven audits and `../demos/` docs going forward (see `../00-DocumentationMap.md` for the full authority chain).

This folder holds Architecture Decision Records for the animation system defined in [`../animation-architecture-constitution.md`](../animation-architecture-constitution.md).

## What belongs here vs. what belongs in the Constitution

The Constitution holds permanent, implementation-agnostic architectural rules — Foundational Principles (§5) that must hold regardless of which animation engine executes them or which game consumes them. An ADR records a **specific, project-level decision**: a choice made at a point in time, under specific constraints, that could reasonably have gone a different way and might be revisited later.

**Update the Constitution when:**
- The finding is a genuinely new, implementation-agnostic invariant — something that must hold true regardless of engine or game, evidenced by a real bug this repository actually hit (the same evidentiary bar every existing principle was held to — see Constitution §10).
- The Layer Model (§4) itself needs to change.
- An existing principle's *rule* (not its evidence) turns out to be wrong.

Follow Constitution §10's process exactly. This ADR practice has no authority to edit the Constitution; only §10's own amendment process does.

**Create an ADR instead when:**
- The decision is project-specific, time-bound, or would reasonably differ in another project — e.g. which animation engine is running today, which order future card games are built in, how a fix is sequenced between the Playground and production.
- The decision is reversible with a different, comparably valid tradeoff — not a universal truth being discovered.

Constitution §7 ("Project Decisions") is exactly this shape of content, written before this ADR practice existed. Its three entries are the model to follow — read them before writing your first ADR here. They are **not** being moved out of the Constitution as part of introducing this folder (that would be a Constitution edit, out of scope for the change that added this folder). New decisions of this shape go directly into ADRs from here on; existing §7 entries migrate opportunistically, each through its own separately reviewed change, not as a blanket rewrite.

**Sometimes both, over time.** A decision can start as an ADR and later prove, through accumulated evidence, to actually be a universal invariant — at that point it gets promoted into the Constitution through §10's normal amendment bar, the same way a Rejected Proposal or a conditional principle would be. A promoted ADR is not deleted: mark its Status as `Superseded by Constitution §5.<principle>` and leave it as the historical record of how the decision was first reached.

## Numbering and lifecycle

- Files are named `ADR-NNN-kebab-case-title.md` — three digits, zero-padded, sequential (`ADR-001-...`, `ADR-002-...`). Numbers are never reused, even once a record is superseded.
- Status values: `Proposed` → `Accepted` → (optionally) `Superseded by ADR-NNN`, `Superseded by Constitution §5.X`, or `Deprecated`.
- ADRs are an append-only log. Don't rewrite a decision's Context/Decision/Consequences after the fact to match hindsight — write a new ADR that supersedes it and link both directions.

**Why sequential numbers, specifically:** a title can be edited later for clarity without breaking anything that cites the decision, because the citation is a stable number, not a slug. Other documents can reference a decision tersely and unambiguously ("per ADR-014," not a paraphrased summary of its title). Supersession chains stay legible at a glance ("ADR-023 supersedes ADR-014" reads as an ordered history; two titles compared side by side don't). And the sequence itself preserves chronology even if files are later reorganized into subfolders or renamed — the number is the permanent identity, everything else about the file is presentation. This is the same reasoning that makes RFC- and PEP-style numbering schemes hold up over long project lifetimes elsewhere; it matters more here as the count grows past a handful, which is exactly the scale this folder is meant to survive.

## Template

Copy [`TEMPLATE.md`](./TEMPLATE.md) for every new record.
