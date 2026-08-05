# Batak — Overview

**Owner:** whoever last did substantial work on Batak. **Load:** when touching Batak-specific code.

Batak (Turkish bidding/trump trick-taking game, closely related to Spades) has two variants fully playable end-to-end: **4-player individual** (free-for-all) and **3-player gömmeli** (buried-kitty). The **4-player "eşli" (partnered)** variant has not been started at any layer — rules, AI, or UI.

Rules and state design: `docs/superpowers/specs/2026-07-14-batak-rules-and-state-design.md` (4-player, plan: `docs/superpowers/plans/2026-07-14-batak-state-model.md`) and `docs/superpowers/specs/2026-07-15-batak-gomeli-rules-and-state-design.md` (3-player gömmeli). Rule engine: `docs/superpowers/specs/2026-07-14-batak-rule-engine-design.md` (plan: `docs/superpowers/plans/2026-07-14-batak-rule-engine.md`) and, for gömmeli, `docs/superpowers/specs/2026-07-15-batak-gomeli-rule-engine-design.md` (plan: `docs/superpowers/plans/2026-07-15-batak-gomeli-rule-engine.md`). AI strategies: `docs/superpowers/specs/2026-07-14-batak-ai-strategies-design.md` (4-player, plan: `docs/superpowers/plans/2026-07-14-batak-ai-strategies.md`) and `docs/superpowers/specs/2026-07-20-batak-gomeli-ai-strategies-design.md` (gömmeli, plan: `docs/superpowers/plans/2026-07-20-batak-gomeli-ai-strategies.md`). UI: `docs/superpowers/specs/2026-07-15-batak-ui-design.md` (4-player, plan: `docs/superpowers/plans/2026-07-15-batak-ui.md`) and `docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md` (gömmeli, plan: `docs/superpowers/plans/2026-07-21-batak-gomeli-ui.md`). Gömmeli blind-bury rule fix: `docs/superpowers/plans/2026-07-21-batak-gomeli-blind-bury.md`.

**Full spec/plan index** (later Batak-titled sub-projects — polish, animation, and UI passes; each spec paired with its plan of the same date/name unless noted):
- Easy-mode handicap: `docs/superpowers/specs/2026-07-15-batak-easy-mode-handicap-design.md` / `docs/superpowers/plans/2026-07-15-batak-easy-mode-handicap.md`
- Deal sequence & hand UI polish: `docs/superpowers/specs/2026-07-15-batak-deal-sequence-and-hand-ui-design.md` / `docs/superpowers/plans/2026-07-15-batak-deal-sequence-and-hand-ui.md`
- Table UI polish (7-item pass — wood edge rails, fan tightening, hand reversal/flattening, front-stacked selection, tap-to-deselect, dim-toggle setting): `docs/superpowers/specs/2026-07-16-batak-table-ui-polish-design.md` / `docs/superpowers/plans/2026-07-16-batak-table-ui-polish.md`
- Deal selection & trick motion polish: `docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-polish-design.md` / `docs/superpowers/plans/2026-07-17-batak-deal-selection-and-trick-motion-polish.md`
- Bid modal & hand reflow animation: `docs/superpowers/specs/2026-07-18-batak-bid-modal-and-hand-reflow-animation-design.md` / `docs/superpowers/plans/2026-07-18-batak-bid-modal-and-hand-reflow-animation.md`
- Trick-gathering animation: `docs/superpowers/specs/2026-07-19-batak-trick-gathering-animation-design.md` / `docs/superpowers/plans/2026-07-19-batak-trick-gathering-animation.md`
- Trick-gather directional flip: `docs/superpowers/specs/2026-07-19-batak-trick-gather-directional-flip-design.md` / `docs/superpowers/plans/2026-07-19-batak-trick-gather-directional-flip.md`
- Bid button redesign: `docs/superpowers/specs/2026-07-19-batak-bid-button-redesign-design.md`
- Card-play animation smoothness: `docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md` / `docs/superpowers/plans/2026-07-21-batak-card-play-animation-smoothness.md`
- Setup-options typing & shared hand constants: `docs/superpowers/plans/2026-07-21-setup-options-typing-and-shared-hand-constants.md`
- Play-travel local departure: `docs/superpowers/specs/2026-07-22-batak-play-travel-local-departure-design.md`
- Travel preserve hand rotation: `docs/superpowers/specs/2026-07-22-batak-travel-preserve-hand-rotation-design.md`
- Reanimated migration: `docs/superpowers/plans/2026-07-29-batak-reanimated-migration.md` (see `docs/animation/ADR/ADR-002-reanimated-migration-apps-mobile.md` / `ADR-003-scope-reanimated-migration-to-evidenced-need.md` for the governing decision)
- Hand-fan Demo08 migration tuning: `docs/superpowers/specs/2026-07-30-batak-hand-fan-demo08-migration-design.md` / `docs/superpowers/plans/2026-07-30-batak-hand-fan-demo08-migration.md`
- Card-play animation pipeline walkthrough (living reference, not a spec — edited as the animation changes): `trick-card-animation-guide.md` (this folder)

Card face/turn-indicator, court-card-frame, and typography-polish specs that touched Batak as part of a *shared* `packages/ui` change are indexed from `docs/domains/ui-visual-system/overview.md` instead of duplicated here.

`getGame('batak')` returns a full `GameDescriptor` with all three AI difficulties for both variants, registered via `packages/engine/src/games/batak/index.ts` and `apps/mobile/src/games/registry.ts`.

Batak was inserted into the build order ahead of Klondike Solitaire — see `docs/domains/engine/decisions.md` for the roadmap decision itself (it's a cross-game build-order call, not Batak-specific reasoning).

## Boundaries: deliberately out of scope so far

Single-hand play only. Multi-hand match play, the cumulative target score across hands, and the bid-13 ("Draw") instant-match-win rule are all explicitly deferred to a future match-layer sub-project, not yet started.
