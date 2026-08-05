# UI Visual System — Overview

**Owner:** whoever maintains `packages/ui`. **Load:** when touching shared visual components used by more than one app.

`packages/ui` holds the shared, reusable visual components consumed by both `apps/mobile` and `apps/playground`: `PlayingCard`, `SuitIcon`, `CardBackPattern`, `CourtCardFrame`, `TableFelt`, `TableWoodCorners`, `TableEdgeRails`, `HeaderWoodFrame`, `HandFrame`, `AbsoluteOverlay`, `glowShadow`, `SettingsIcon`, `colorUtils`, `courtCardArt`, `fonts`, `woodPalette`, `handAreaLayout`.

## The cross-app isolation rule

`apps/playground` is a separate, isolated Expo app (sibling to `apps/mobile`) for prototyping card/table visual designs. It shares `packages/engine` (pure TS) and `packages/ui` with the rest of the repo, but it **never** imports from `apps/mobile` directly, and `apps/mobile` never imports from or links to `apps/playground`, in development or production. This isolation is deliberate and load-bearing, not incidental. Playground-only dependencies (file/image pickers, sliders) are only ever added to `apps/playground/package.json`, never to `apps/mobile/package.json` or `packages/ui/package.json`.

**The one exception:** `packages/engine` itself, since `apps/playground` genuinely depends on it. Breaking changes there must be checked against both `apps/mobile` and `apps/playground` as a normal correctness matter — not treated as a "cross-app visual-change" discussion trigger (guardrail §4 below), since it isn't a visual change and isn't optional to check.

The one process rule that goes with this isolation: whenever a change is made to how cards or the table look in `apps/mobile` (or a deliberate update to the playground's look), that is a trigger to explicitly discuss with the user whether/how the other side should be updated to match or extend — see `docs/governance/guardrails.md` §4 for the canonical rule text. This file records the domain fact (the isolation exists and why); the guardrails file owns the process rule about it.

## Shared mobile-app interaction components

`apps/mobile/src/components/*` and `apps/mobile/src/table/*` (`SelectableCard`, `GameResultModal`, `PlayerBadge`, `TravelCard`, `GatherCard`, `DeselectableSurface`, `CenteredDecisionModal`, `PlayerAvatar`, `GameScreenLayout`, and others) are owned by this domain, not `mobile-expo` or any individual game. They're shared, cross-game visual/interaction components — the same kind of thing this domain already owns in `packages/ui` — just located in `apps/mobile` because they depend on app-level state (e.g. `useCardSelection`) that can't live in the pure-UI package. A new game's screen consumes these directly rather than rebuilding its own.

## Shared spec/plan index (cross-game `packages/ui` work)

Specs/plans for changes that touched shared visual components used by more than one game (rather than one game's own table/UI), so they're indexed here instead of duplicated across every game's own overview:
- Shared UI package extraction: `docs/superpowers/specs/2026-07-14-shared-ui-package-design.md`
- Card corner-rank font: `docs/superpowers/specs/2026-07-13-card-corner-rank-font-design.md`
- Suit icon glyph refinement: `docs/superpowers/specs/2026-07-14-suit-icon-glyph-refinement-design.md`
- Card layout & typography polish (corner-index centering, opponent auto-fit spacing — see `docs/domains/games/pisti/decisions.md` and `docs/domains/games/batak/decisions.md`): `docs/superpowers/specs/2026-07-17-card-layout-and-typography-polish-design.md`
- Court-card decorative frame: `docs/superpowers/specs/2026-07-17-court-card-decorative-frame-design.md`
- Shared card-deselect surface: `docs/superpowers/specs/2026-07-17-shared-card-deselect-surface-design.md`
- Card face polish + Batak turn indicator (spade/club redesign, court-card frame alignment — see `docs/domains/games/batak/decisions.md`): `docs/superpowers/specs/2026-07-18-card-face-polish-and-batak-turn-indicator-design.md`
- Hand wooden frame: `docs/superpowers/specs/2026-07-18-hand-wooden-frame-design.md`
- Header wood frame & settings icon: `docs/superpowers/specs/2026-07-18-header-wood-frame-and-settings-icon-design.md`
- Table frame photo swap: `docs/superpowers/specs/2026-07-18-table-frame-photo-swap-design.md`
- Court-card art pipeline: `docs/superpowers/specs/2026-07-11-court-card-art-pipeline-design.md`
- Card Playground (`apps/playground`, isolated design-prototyping app): `docs/superpowers/specs/2026-07-12-card-playground-design.md`
- Playground card browsing: `docs/superpowers/specs/2026-07-17-playground-card-browsing-design.md`
- HomeScreen redesign (see below): `docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md`

## HomeScreen

`apps/mobile/src/screens/home/*` is owned by this domain, not `mobile-expo` — its visual identity is this domain's concern even though the files live inside the `mobile` module. The app's Home screen is its own deliberate visual identity, distinct from the in-game felt/wood table look — see `docs/domains/ui-visual-system/decisions.md` for the reasoning.

## Animation Playground

`apps/playground` also hosts an "Animation Playground" mode — an isolated lab for perfecting card-travel animation quality before it's ported into production games, governed entirely by its own documentation ecosystem at `docs/animation/`. See that folder's `00-DocumentationMap.md` first for anything animation-related; this domain's own docs are about the static visual components, not motion.
