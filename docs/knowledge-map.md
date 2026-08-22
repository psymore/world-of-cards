# Knowledge Map

This is a routing index, not an encyclopedia. It exists for tooling that expects a
`docs/knowledge-map.md` entry point; this repository's actual, fuller map is
`docs/00-DocumentationMap.md` (authority hierarchy, ownership, load triggers, reading
order). Read that document for anything beyond the quick lookup below — do not duplicate
its content here.

| Knowledge type         | Canonical source                                              | Owner                       | Load trigger                              |
| ----------------------- | -------------------------------------------------------------- | ---------------------------- | ------------------------------------------------ |
| Purpose and scope      | `architecture/world-of-cards-purpose.md`                       | Project owner                | Scope or product questions                |
| Governance             | `docs/governance/{engineering-principles,guardrails,architecture-escalation}.md` | Project owner | Before implementation or risky operations |
| Current status         | `docs/status/{roadmap,known-issues}.md`                        | Project owner                | Session start or planning                 |
| Domain knowledge       | `docs/domains/<domain>/{overview,decisions,known-issues}.md`   | Domain maintainer            | Work in that domain                       |
| Feature specifications | `docs/superpowers/specs/<date>-<feature>.md`                   | Feature author               | Feature changes                           |
| Implementation plans   | `docs/superpowers/plans/<date>-<feature>.md`                   | Feature author               | Starting planned work                     |
| Decisions              | `docs/domains/<domain>/decisions.md`                           | Domain maintainer            | Architectural changes                     |
| Runtime behavior       | source and tests under `packages/`, `apps/`                    | Whoever owns the module      | Bugs, regressions, validation             |
| Deep reference         | `docs/00-DocumentationMap.md`, `code-index/LAYOUT.md`           | Project owner                | Detailed investigation                    |

## Routing

Start with `CLAUDE.md` (or `AGENTS.md`), then `docs/00-DocumentationMap.md` for the full
authority hierarchy and reading order. Follow the relevant canonical source. Do not
duplicate canonical content here.

## Escalation

A recurring local problem may become architecture-shaped when repeated evidence shows
that local fixes do not address the underlying constraint. See
`docs/governance/architecture-escalation.md` for the triggers and filtering guidance
before creating or updating a decision source.
