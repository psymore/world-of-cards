# World Cards — Purpose

**Owner:** Project owner. **Load:** onboarding, or when a change is genuinely architecture-shaped (per the WKA Decision Checklist in `WKA v0.1 Architecture.md`) — not every session.

This document instantiates the generic WKA Foundation Layer (`WKA Bootstrap Baseline v0.1.md`, `WKA v0.1 Architecture.md`, `WKA_Design_Baseline_v0.1.md`) for World Cards specifically. It does not redefine or duplicate those documents' generic concepts — it states this project's own Purpose and Quality Attributes, the way those documents say every WKA-based project should.

---

## Purpose

World Cards is a cross-platform mobile platform for traditional card games, built on Expo/React Native/TypeScript, designed to scale to 100+ games over years. The engine and UI are architected so that adding a new game is an additive operation — two new folders and a registry entry — never a change to shared plumbing.

## Quality Attributes

- **Extensibility.** Adding a game must not require editing shared/shell code. This is enforced structurally (the engine's registry pattern), not just by convention.
- **Testability.** The engine core (Card Engine, `RuleEngine`/`AIStrategy` implementations) is a pure functional core with no framework dependency, making every game's rules and AI mechanically verifiable via `simulateGames` — hundreds of simulated games checked for invariants like card conservation.
- **Reusability across platforms.** No game logic may depend on React Native, React, or Expo — the engine must be usable from React Native, React Web, Electron, or a future desktop app without modification.
- **Maintainability at scale.** Conventions (engine purity, the two-folder-per-game rule, one small global store + one per-session store) exist specifically to keep the codebase tractable as the game count grows from a handful toward 100+, not just for the current handful of games.
- **Discoverability of knowledge.** As of the Phase 1–3 knowledge-architecture work (`architecture/phase-1-knowledge-audit.md`, `architecture/phase-2-knowledge-architecture-design.md`), the project's own documentation is itself held to a Single-Source-of-Truth standard: architectural principles, standing process rules, domain knowledge, and short-lived project state each have exactly one canonical home, referenced rather than duplicated.

## Architectural intent

The engine is a pure functional core: no classes, no internal mutable state, no `Math.random()` (a seeded `RNG` only) — see `docs/governance/engineering-principles.md` for the full, current statement of these standing conventions. This document states *why* they exist; that one states *what* they currently are, and is the one that should be consulted (and kept current) as the actual working rule.
