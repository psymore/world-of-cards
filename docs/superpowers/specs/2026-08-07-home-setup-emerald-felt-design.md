# Home + Setup Screens: Unified Emerald Felt Identity — Design Spec

**Status:** Approved (visual direction locked via the brainstorming visual companion, 2026-08-07)
**Supersedes:** the "HomeScreen redesign: its own distinct visual identity, not a reuse of the table look" decision in `docs/domains/ui-visual-system/decisions.md` (2026-07-30). Also closes sub-project 4 ("cross-table visual consistency pass") from `docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md`, which had left `PistiSetupView`/`BatakSetupView` re-theming as an open question.

## Context

The user proposed three AI-art-generation concept prompts (Midjourney/DALL-E style) for a new Home + Setup background: (A) pure emerald felt with glassmorphism, (B) dark mahogany wood frame around felt, (C) light oak frame around raised felt. These were explored via the brainstorming visual companion as CSS-approximation mockups applied in context to both a Home preview and a Setup/difficulty preview.

**Concept A won.** During exploration it became clear the repo already has an asset that closely matches Concept A's description ("dark emerald green felt poker table surface with subtle central radial lighting vignette, soft texture, minimalist") — `packages/ui`'s existing `TableFelt` component, backed by a real photo texture (`assets/table/green.png`), already used in both games' actual tables. No new image generation or sourcing is needed for this pass.

This also means the scope is not just "reskin Home" — the user chose to **unify** Home with the setup screens under this one felt identity, deliberately reopening and reversing the 2026-07-30 decision that gave Home its own distinct purple-marquee identity. That decision was correct for its time (games had years of felt/wood polish, Home had none); this spec's premise is that a shared identity now reads better than two competing ones.

## Decision: why reverse the marquee identity

**Old reasoning (2026-07-30):** Home should read as "a menu," not "another table," so it got a bespoke navy-to-plum gradient, gold serif wordmark, and hero court card — deliberately not felt/wood.

**New reasoning (2026-08-07):** confirmed directly with the user via the visual companion (`Unify` was picked over `Setup only` when shown both side by side). The practical driver: Setup screens currently have zero background identity (flat `#12121f`, an acknowledged gap left over from the last pass), and giving Setup its own felt look while leaving Home in purple would create three competing identities (Home / Setup / actual table) instead of resolving down to one. Unifying Home with Setup — both of which lead into the felt-and-wood tables — reads as "you're already at the table" from the moment the app opens, rather than "menu, then setup, then table."

The hero card, wordmark, and menu-row treatment are explicitly **kept**, not redesigned — only the background canvas changes.

## What changes

### Background (Home + both Setup screens)

Replace with the existing `TableFelt` component (`@world-of-cards/ui`, `AbsoluteOverlay` + `assets/table/green.png`, `resizeMode="cover"`) — the same component the in-game tables already use. No new props, no new asset.

- `apps/mobile/src/screens/home/HomeBackground.tsx` — delete; `HomeScreen.tsx` renders `<TableFelt />` in its place.
- `apps/mobile/src/games/pisti/PistiSetupView.tsx` — remove `backgroundColor: '#12121f'` from `container`, render `<TableFelt />` as the first child (absolute-fill behind content, same pattern as `PistiScreen`/`BatakScreen` already use for their tables).
- `apps/mobile/src/games/batak/BatakSetupView.tsx` — same change.

### HomeScreen

- `HeroCard.tsx` (Queen of Hearts illustration + glow) — **unchanged**.
- `HomeWordmark.tsx` (gold PT Serif "World of Cards" + divider rule) — **unchanged**.
- `GameMenuRow.tsx` — **unchanged**; it's already translucent (`rgba(255,255,255,0.06)` fill, `#d9b34a55` border), which was designed to sit on a dark gradient and continues to work on dark felt. A quick visual check during implementation confirms legibility; no style changes are pre-planned.
- `BaizeStrip.tsx` — **deleted**. It existed as a decorative nod toward "the table" from a screen that otherwise wasn't the table. Once the real background *is* `TableFelt`, a fake felt-colored gradient strip on top of real felt is redundant, not additive.

### Setup screens (Pişti + Batak)

Every option-row style currently using the flat opaque navy box becomes translucent glass, matching the mockup the user approved:

| State | Before | After |
|---|---|---|
| Default | `backgroundColor: '#1e1e33'`, `borderColor: 'rgba(244,197,66,0.35)'` | `backgroundColor: 'rgba(255,255,255,0.09)'`, `borderColor: 'rgba(255,255,255,0.22)'` |
| Selected (`optionDefault`) | `borderColor: '#f4c542'`, `backgroundColor: 'rgba(244,197,66,0.14)'` | `borderColor: '#f4c542'`, `backgroundColor: 'rgba(244,197,66,0.2)'` (slightly stronger tint so it still pops against the lighter glass default, not just against navy) |

Applies to every option-shaped row in both files: Pişti's `option` (difficulty) and `playerCountOption` (table size, 4-player mode); Batak's `option` (variant, difficulty). Each screen keeps its own local `StyleSheet` (matching the existing duplication already present between the two files pre-change) — no new shared component is introduced for this, since the visual rule is a two-line color swap, not shared logic.

Header/title text colors (`pageTitle` gold, `title` cream, `backLink` muted gold) are unchanged — already legible on dark green.

## Explicitly out of scope

- `GeminiTableBackground` (the wood-framed AI-generated asset) — unrelated to this pass, remains Batak's `__DEV__`-gated dev-tuning experiment only.
- The actual in-game tables (`PistiTable`/`BatakTable`) — untouched; they already have their own felt/wood table identity, which this spec extends toward rather than modifies.
- Illustrated card-art system beyond the existing hero Queen of Hearts — still deferred, unrelated.
- The hero-card mount entrance animation mechanism — unchanged.
- Any new image generation/sourcing — this spec deliberately uses an existing asset instead of the Midjourney prompts as originally proposed.
- Concepts B and C (wood-framed variants) — not pursued; recorded here in case a future pass wants them for a different surface.

## Testing

Per the standing testing policy: no new automated tests for this decorative/presentational work. `HomeScreen.test.tsx` queries text content (`'World of Cards'`, game names), not markup structure or colors, so it should continue passing unmodified. `PistiSetupView.test.tsx` should be checked for any assertions on the removed `backgroundColor` or now-changed style values and updated only if it breaks.

## Documentation follow-up (part of implementation, not this doc)

- Add a new entry to `docs/domains/ui-visual-system/decisions.md` recording this reversal and its reasoning (superseding, not deleting, the 2026-07-30 entry — decisions files are a record, not a diary that erases prior entries).
- Update `docs/superpowers/specs/2026-07-30-homescreen-redesign-design.md`'s sub-project list to mark sub-project 4 (cross-table visual consistency) as resolved by this spec.
