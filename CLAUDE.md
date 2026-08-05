@AGENTS.md

# World Cards

A cross-platform mobile platform for traditional card games (Expo/React Native/TypeScript), designed to scale to 100+ games over years. Full Purpose and Quality Attributes: `architecture/world-cards-purpose.md`.

This file is a navigation entry point only. It routes you to where knowledge actually lives — it does not hold that knowledge itself. For the complete picture beyond this condensed version (full authority hierarchy, reading order for every situation), see `docs/00-DocumentationMap.md`.

## Where things live

| If you need... | Go to |
|---|---|
| The generic WKA meta-architecture | `architecture/WKA*.md` |
| The WKA v1.0 canonical model (entities, relationships, lifecycle, invariants) applied to this repository's Code Index | `architecture/wka-v1.0-canonical-model.md` |
| World Cards' own Purpose/Quality Attributes | `architecture/world-cards-purpose.md` |
| Standing engineering principles (engine purity, testing policy, build pipeline, etc.) | `docs/governance/engineering-principles.md` |
| Standing behavioral guardrails (commit/merge, branch workflow, cross-app visual changes, etc.) | `docs/governance/guardrails.md` |
| Whether a recurring problem is architecture-shaped, not just another patch | `docs/governance/architecture-escalation.md` |
| A domain's stable architecture, why it's built this way, or its current problems | `docs/domains/<domain>/{overview,decisions,known-issues}.md` — domains: `engine`, `mobile-expo`, `ui-visual-system`, `games/pisti`, `games/batak` |
| Animation work (Playground or in-game) | `docs/animation/00-DocumentationMap.md` |
| A specific feature's design/why, or its implementation plan | `docs/superpowers/specs/` / `docs/superpowers/plans/` |
| Current roadmap and priorities | `docs/status/roadmap.md` |
| Known problems, repo-wide index (pointers only — full detail lives in each domain) | `docs/status/known-issues.md` |
| Full repo-wide documentation map, authority hierarchy, and reading order | `docs/00-DocumentationMap.md` |

## Before you start

- Touching a specific game (Pişti, Batak)? Read that game's `docs/domains/games/<game>/overview.md` first.
- Touching shared visual components (`packages/ui`) or the isolation between `apps/mobile`/`apps/playground`? Read `docs/domains/ui-visual-system/overview.md`.
- Touching the engine (`packages/engine`)? Read `docs/domains/engine/overview.md`.
- Touching animation, in the Playground or in a game? Start at `docs/animation/00-DocumentationMap.md`, not here.
- About to write code, tests, or make a structural decision? Re-check `docs/governance/engineering-principles.md`.
- About to commit, merge, or touch anything involving cross-app visual consistency? Re-check `docs/governance/guardrails.md`.
- Noticing the same class of problem fixed more than once? Check `docs/governance/architecture-escalation.md` before patching it a third time.

## Current priorities

What's being worked on now, and what's next: `docs/status/roadmap.md`. Known problems: `docs/status/known-issues.md`.
