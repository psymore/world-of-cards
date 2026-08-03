# Knowledge Domains

**Purpose of this file:** one paragraph per domain — what it is, where its docs live, who owns it. Not itself a source of domain knowledge; if anything here conflicts with a domain's own docs, the domain's own docs win.

---

## engine

`packages/engine` — the pure-TypeScript Card/Rule/AI engine shared by every game. Docs: `docs/domains/engine/`. Owner: whoever maintains the shared engine contracts (registry, `RuleEngine`/`AIStrategy`, persistence interface, statistics).

## mobile-expo

Expo/React Native platform-level concerns for `apps/mobile` that aren't specific to any one game. Docs: `docs/domains/mobile-expo/`. Owner: whoever last touched Expo/RN infra (deps, config, platform gotchas).

## ui-visual-system

`packages/ui` — shared visual components (`PlayingCard`, `TableFelt`, `TableWoodCorners`, `SuitIcon`, etc.) used by both `apps/mobile` and `apps/playground`, plus the cross-app isolation rule between those two apps. Docs: `docs/domains/ui-visual-system/`. Owner: whoever maintains `packages/ui`.

## games/pisti, games/batak

Per-game rules, current status, and running decision logs. Docs: `docs/domains/games/<game>/`. Owner: whoever last did substantial work on that game. One subfolder per game as the roadmap progresses (see `docs/status/roadmap.md` for build order) — a new game does not need a folder here until it has knowledge worth recording beyond its own specs/plans.

## animation

**Not a new folder under `docs/domains/`.** This entry is a pointer to the existing, already-correct `docs/animation/` tree (`00-DocumentationMap.md`, the Constitution, `ADR/`, `audits/`, `demos/`) — it predates this reorganization and was already a working instance of the same ownership pattern `domains/` establishes elsewhere. Per "refinement over expansion," it was not relocated just for tree-shape consistency. Owner: established via `docs/animation/ADR/README.md`'s own process.
