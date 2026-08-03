# Engine — Decisions

**Owner:** whoever maintains the shared engine contracts. **Load:** when asking "why is the engine built this way." **Not** a development diary — see `architecture/phase-2-knowledge-architecture-design.md` §6.1. Implementation history (what was built, in what order) lives in `docs/superpowers/specs/`, `docs/superpowers/plans/`, and git history instead.

---

## The engine must be completely platform-agnostic

**Decision:** no game logic may depend on React Native (or React, or Expo). The engine must be reusable from React Native, React Web, Electron, or a future desktop app without modification, with UI and business logic strictly separated.

**Why:** this was a key amendment made at the start of Phase 1 planning, before any game-specific code existed — it shapes every other engine decision below it. The project's horizon (100+ games, offline-first at launch, later online multiplayer) requires the engine to outlive any single UI framework choice.

## Randomness must be seeded, never `Math.random()`

**Decision:** all randomness goes through the injected `RNG` (`packages/engine/src/core/rng.ts`); the engine never calls `Math.random()` directly.

**Why:** makes every simulation and every game reproducible from a seed — this is what makes `simulateGames`-based testing (hundreds of games, checked for card-conservation invariants) actually deterministic and debuggable, rather than a source of flaky tests.

## A new game touches exactly two folders, no shared/shell code

**Decision:** `packages/engine/src/games/<id>/` (rules + AI) and `apps/mobile/src/games/<id>/` (screen), registered via `registerGame`. No other shared code should need editing.

**Why:** chosen specifically to keep the 100+-game horizon tractable — every game is additive to the registry, not a change to shared plumbing that risks regressing every other game.

## Batak was inserted ahead of Klondike in the build order

**Decision:** the original roadmap (Pişti → Klondike → Spider → ...) was reordered to insert Batak between Pişti and Klondike.

**Why:** the user explicitly asked for Batak next. When offered alternatives (reorder ahead of Klondike vs. treat it as "Spades but Turkish rules" vs. add it to the list for later), the user chose to reorder — Batak is closely related to the later-scheduled Spades (both bidding/trump trick-taking games) and was also already the app's chosen visual reference for Pişti's table art, but the user wanted it built as its own real game, not folded into the Spades slot. Scoped as three variants (4-player individual, 3-player gömmeli, 4-player eşli/partnered) under one `batak` registry entry with setup-option variants, built incrementally — mirroring how Pişti itself grew (2p → 4p free-for-all → partner mode).

## `RuleEngine.setup` was never given a generic `TOptions`

**Decision (deferred, not yet acted on):** `RuleEngine.setup(options: unknown, ...)` was left untyped across the options-passing chain in Phase 1, rather than introducing a `TOptions` generic immediately.

**Why:** flagged in the original Phase 1 whole-branch review as reasonable to defer until real games multiply enough to justify the added generic complexity — see `docs/domains/engine/known-issues.md` for the current state of this.
