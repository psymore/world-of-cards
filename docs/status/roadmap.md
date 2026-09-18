# Roadmap & Current Priorities

**Owner:** Project owner. **Scope:** short-lived project state — expected to churn often. **Load:** session start, or when planning next work. Not for "why is this built this way" (see each domain's `decisions.md`) or "what's currently broken" (see `docs/status/known-issues.md` and each domain's own `known-issues.md`).

---

## Game build order

Pişti → Batak → Pis Yedili → Klondike Solitaire → Spider Solitaire → FreeCell → Hearts → Spades → Gin Rummy → Crazy Eights → Blackjack → Texas Hold'em.

- Batak was inserted ahead of Klondike at the user's explicit direction; it was not on the original roadmap.
- Pis Yedili (a Turkish card game, not previously in this repo) was chosen as the next roadmap insertion, mirroring how Batak was inserted — brainstorming for it was paused mid-flow (before rules-sourcing was decided) when a UI review pass took priority.

## Current build status

- **Pişti** — complete and fully playable end-to-end (2p/4p, free-for-all and partner modes, all three AI difficulties). See `docs/domains/games/pisti/overview.md`.
- **Batak** — 4-player individual and 3-player gömmeli (buried-kitty) variants are both complete and fully playable end-to-end, including AI and mobile UI. The 4-player "eşli" (partnered) variant has not been started at any layer (rules, AI, or UI). See `docs/domains/games/batak/overview.md`.
- **Pis Yedili** — engine (rules, AI, registration) and mobile UI (setup + table) are both complete and fully playable end-to-end. Animation/timer polish is explicitly deferred, not built. See `docs/domains/games/pis-yedili/overview.md`.
- **Animation Playground** (`apps/playground`) — an isolated lab for animation-quality work, ongoing. See `docs/animation/00-DocumentationMap.md` for its own status.

## Next up (unstarted or in-progress candidates, not yet resequenced by the user)

1. **Pis Yedili** — engine and mobile UI are now complete and playable (see `docs/domains/games/pis-yedili/overview.md`); animation/timer polish remains unbuilt and unscheduled — the user's call next session on whether/when to pick it up.
2. **Demo 03's Rapid Play touch-target gap (Option B, deferred)** — cheapest, most immediately actionable item in the animation backlog. See `docs/animation/`'s own tracking.
3. **Batak trick-center smooth-resize problem** — genuinely unsolved, only worked around (see `docs/domains/games/batak/known-issues.md`). Squarely what the Animation Playground's Demo 05 exists to figure out before porting back.
4. **Batak bidding-AI miscalibration** — arguably the most urgent Batak-side item, since it affects the already-shipped 4-player game. See `docs/domains/games/batak/known-issues.md`.
5. **Human hand's card-travel-origin gap** — not yet decided/spec'd. See `docs/domains/games/batak/known-issues.md`.
6. **Batak "eşli" (partnered) variant** — not started at any layer.
7. **Illustrated court-card art** — status corrected 2026-09-08: this is **substantially built, not "not started."** `packages/ui/src/courtCardArtV2.ts` (introduced 2026-08-25) has dedicated per-suit K/Q/J illustrated art for all four suits, live by default (`cardFaceStyleStore.ts` defaults `cardFaceStyle` to `'v3'`). One concrete gap remains: **King of Spades has no dedicated art yet** and stands in with King of Clubs's image (`KING_OF_SPADES_IMAGE = KING_OF_CLUBS_IMAGE`, flagged in the source's own comment as temporary). Aces deliberately do **not** get illustrated art under v2/v3 — the code's own comment states both intentionally keep the plain suit-glyph watermark for every non-face rank rather than mixing in v1's Ace art; extending illustrated treatment to Aces would be a new scope decision, not a gap-fill. A reference image for the original ambition still sits in the repo (`docs/references/card-art/this what I want to achive.png`).
8. **Cross-table visual consistency pass** — partially resolved 2026-08-07 (Home + both setup screens now share one emerald-felt identity with the in-game tables; see `docs/superpowers/specs/2026-08-07-home-setup-emerald-felt-design.md`). The "only Batak has a settings/gear icon" asymmetry it also covered remains open and unowned — still tracked in `docs/domains/ui-visual-system/known-issues.md`, not yet resequenced onto this list as its own item.
9. **Klondike Solitaire** — per the original roadmap order, now behind Pis Yedili.
10. **Batak's visual polish against the Alper Games reference checklist** (the one Pişti went through) — explicitly deferred and unscheduled. Now that gömmeli has its own UI, whether to bring any of that checklist to gömmeli specifically is also an open, unscheduled question.
11. **Porting the Demo 01 fan-arc-smoothness fix into `apps/mobile`'s own `seating.ts`** (Pişti/Batak share the identical underlying bug) — raised with the user, explicitly not decided.
12. **Local "best score this week" / "longest win streak" stat** — low priority, unsized. Extends the existing `GameStats` shape (`packages/engine/src/statistics/types.ts`) with a time-windowed or streak stat, purely local, no analytics/networking involved. Surfaced 2026-09-04 by an Octalysis-lite core-drive audit as a low-cost way to add Accomplishment without a social/networked surface — see `docs/superpowers/specs/2026-09-04-ux-monetization-research-backlog.md` §2.3. Accepted onto this list 2026-09-05, not yet scoped or scheduled.
13. **Decide the fate of the dev-workflow operational-layer spec** (`repo status`/`impacted`/`prepare`/`commit`/`publish` + a Code Index freshness guard, per `docs/superpowers/specs/2026-08-05-dev-workflow-operational-layer-design.md`) — fully designed and planned, never implemented. Options: build it as originally scoped; cherry-pick just `repo prepare` (single-entry-point typecheck+test across all 4 modules) and the freshness guard, since a 2026-08-24 repo audit found those two are the actual missing pieces (see `docs/status/known-issues.md`); or formally shelve the spec. Not yet decided — the user's call next session.
14. **Cosmetic monetization prototype (card-back/table-theme skins + rewarded-ad free-unlock)** — direction accepted 2026-09-08, not scoped or scheduled. Combines Content/Customization-channel cosmetic packs (Luton's "4 C's") with a rewarded-video opt-in alternate unlock path (Tenjin 2025 benchmark), both confined to `docs/governance/monetization-principles.md`'s constraints (no pay-to-win, no randomized-outcome mechanics, rewarded-only/opt-in ads). Chosen over a plain one-time donation SKU because it turns already-generated-but-unwired art (`packages/ui/assets/table/{themes,default,alternatives}`) into an actual selectable feature rather than adding a new asset category from zero. See `docs/superpowers/specs/2026-09-04-ux-monetization-research-backlog.md` §0 for the full reasoning. No SKU, store UI, or theme-selection mechanism exists yet — this is a direction decision, not an implementation.

Also open, tracked as a pending design question rather than a bug: whether/how to resolve the human-hand card-travel-origin gap (item 5) — three approaches were discussed (analytic computation, real `measureInWindow` measurement, or a hybrid) with a lean toward the hybrid, but nothing was confirmed.
