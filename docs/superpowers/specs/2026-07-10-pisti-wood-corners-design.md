# Pişti: Wood-Grain Corner Accents (Reference-Checklist Item 5/7)

**Status:** Approved
**Date:** 2026-07-10
**Scope:** The "wood-grain table frame" item from the Alper Games reference checklist (see `docs/references/pisti/README.md` and the `pisti_table_visual_reference` memory) — a decorative wood accent around the Pişti table's felt playing surface. Remaining checklist items after this one: per-seat avatars, per-seat trick layout (biggest lift, done last).

## Context

The Batak HD / Spades Batak references use a wood-grain border around the green felt table. Three style directions were sketched with the user via the brainstorming visual companion (mockups saved under `.superpowers/brainstorm/794-1783669277/content/`, gitignored):

- **A — Full picture frame:** thick wood border all the way around, rounded corners. Closest literal match to the Batak HD screenshot.
- **B — Top/bottom rails only:** wood strip behind the top badge + a curved rail above the hand, felt open on the sides. Matches the in-game "Batak Online" reference shot.
- **C — Corner wedges only:** quarter-circle wood wedges tucked into the four corners.

**Decision: C (corner wedges).** A and B are kept as documented, deferred alternatives — not built now, no variant system added for them — should a future table redesign want a heavier treatment. Their mockup HTML persists on disk for reference.

Two follow-up visual decisions, also made via the companion:
- **Badges stay floating** (current pill badges, unchanged), not nested into the wedge shapes. Wedges are pure background decoration with no per-seat awareness.
- **Wood tone: dark mahogany**, not amber oak — sits closer to the app's existing navy-leaning palette (card backs, setup screen) than a brighter reference-matching amber would. Both tones included a thin gold (`#ffd966`) trim stroke along the wood/felt boundary, matching the app's existing gold accents (banner text, active-turn glow uses green, but title/setup accents are gold).

## Component & Rendering

New shared component: `apps/mobile/src/components/TableWoodCorners.tsx`.

- Same shape as `TableFelt.tsx`/`CardBackPattern.tsx`: `react-native-svg`-based, zero props, wrapped in `React.memo` — a one-time paint never redone by game-state re-renders, using the project's established `AbsoluteOverlay` wrapper.
- Four quarter-circle wedges pinned to the four corners of the table container. Each wedge: a dark-mahogany `LinearGradient` fill + faint diagonal grain lines (same repeating-`Line`-pattern technique `TableFelt` already uses for its weave), plus a thin gold (`#ffd966`) stroke along the wedge's curved inner edge.
- **Fixed pixel size**, not percentage-scaled — consistent with other fixed-size decorative constants already in `PistiTable.tsx` (`pileMat`'s 130×150, badge padding). A size around 56dp (matching the mockup) keeps it proportionate to card/badge scale without needing to read container dimensions.
- Rendered in `PistiTable.tsx` alongside the existing `<TableFelt />`, same position in the tree (early, so it paints behind all game content — cards, badges, pile sit above it, same z-order rule as the felt texture).
- Uniform across player counts — since it decorates the whole container's four corners rather than per-seat positions, it needs no interaction with `assignSeats` or the 2p/4p seat layout logic.

## Explicitly Not Building This Pass

- No variant prop for styles A (full frame) or B (rail-only) — they're recorded above and in memory as considered-but-deferred, not implemented, to avoid an unused abstraction.
- No per-seat "notch" badge integration — floating badges are unchanged.
- No new tests. This is a pure decorative UI component in the same territory as `TableFelt`/`CardBackPattern`, which shipped test-free per the project's testing policy (mobile UI/screens default to no new tests). The existing `PistiTable.test.tsx` (if any) and full mobile suite just need re-running to confirm no regression from the added element in the render tree.

## Verification Plan

- Typecheck + full existing mobile test suite pass unchanged.
- Visual verification via the `react-native-web` + Playwright/system-Chrome screenshot workflow (per `dev_sandbox_no_device_access` memory) on both the 2-player and 4-player tables, confirming: wedges render in all four corners, gold trim visible, no visual regression to badges/pile/hand, no new console warnings (watch specifically for the `pointerEvents` prop-vs-style deprecation already fixed once in `FeltTexture`/`CardBackPattern` — `TableWoodCorners` should use `AbsoluteOverlay`/`style.pointerEvents` from the start).
