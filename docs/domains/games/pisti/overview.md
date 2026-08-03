# Pişti — Overview

**Owner:** whoever last did substantial work on Pişti. **Load:** when touching Pişti-specific code.

Pişti (Turkish fishing-style card game) is complete and fully playable end-to-end: Home → pick a difficulty → 2-player or 4-player (free-for-all or partner mode) → play a full hand against Easy/Medium/Hard AI → see the result → play again or return home.

Rules and state-model design: `docs/superpowers/specs/2026-07-07-pisti-rules-and-state-design.md` (plan: `docs/superpowers/plans/2026-07-07-pisti-state-model.md`). Rule engine: `docs/superpowers/specs/2026-07-07-pisti-rule-engine-design.md` (plan: `docs/superpowers/plans/2026-07-07-pisti-rule-engine.md`). AI strategies: `docs/superpowers/specs/2026-07-07-pisti-ai-strategies-design.md` (plan: `docs/superpowers/plans/2026-07-07-pisti-ai-strategies.md`). UI: `docs/superpowers/specs/2026-07-07-pisti-ui-design.md` (plan: `docs/superpowers/plans/2026-07-07-pisti-ui.md`).

**Full spec/plan index** (later Pişti-titled sub-projects, each spec paired with its plan of the same date/name unless noted):
- Wood-grain table corners: `docs/superpowers/specs/2026-07-10-pisti-wood-corners-design.md` / `docs/superpowers/plans/2026-07-10-pisti-wood-corners.md`
- Per-seat player avatars: `docs/superpowers/specs/2026-07-10-pisti-player-avatars-design.md` / `docs/superpowers/plans/2026-07-10-pisti-player-avatars.md`
- Trick-reveal motion: `docs/superpowers/specs/2026-07-10-pisti-trick-reveal-motion-design.md` / `docs/superpowers/plans/2026-07-10-pisti-trick-reveal-motion.md`

Several later polish passes touched Pişti as part of a *shared* `packages/ui` change (card corner-index/typography, card face/suit-icon redesign, the shared card-deselect surface, the Card Playground itself) rather than a Pişti-only sub-project — those specs are indexed from `docs/domains/ui-visual-system/overview.md` instead of duplicated here.

`getGame('pisti')` returns a full `GameDescriptor` with all three AI difficulties, registered via `packages/engine/src/games/pisti/index.ts` and `apps/mobile/src/games/registry.ts`.

The Pişti table went through a full visual-polish pass against an explicit reference (Alper Games' Batak HD / Spades Batak) — see `docs/domains/games/pisti/decisions.md` for the reasoning behind that reference choice and what shipped against it.

## Boundaries: deliberately out of scope so far

Save/resume via `PersistenceAdapter`, `stats:<gameId>` recording, multi-hand match play, and human-vs-human pass-and-play were all deliberately deferred from the original UI sub-project and have not been picked up since. `useAITurn` was originally Pişti-only but has since been lifted into a shared, game-agnostic hook (`apps/mobile/src/hooks/useAITurn.ts`) once Batak became its second real consumer.
