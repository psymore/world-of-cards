# HomeScreen Redesign — Design Spec

**Status:** Approved (visual direction locked as v1.0.0 via the brainstorming visual companion, 2026-07-30)
**Sub-project 2 of 4** in the "UI review pass" decomposed 2026-07-30: (1) gear-icon investigation — closed, Expo Go dev-menu quirk, no code change; (2) **this spec**; (3) illustrated court-card art (deferred, one card sourced early as a dependency of this spec — see below); (4) cross-table visual consistency pass (not started; will also pick up the "only Batak has a settings icon" asymmetry noted during (1)).

## Context

`HomeScreen.tsx` is currently 50 lines: a plain navy `FlatList` of text-only `Pressable` rows, no animation, no per-game art, no signature visual moment — while the game tables (Pişti, Batak) have had years of iterative polish (felt/wood/gold identity, illustrated suit icons, court-card frame brackets, deal/travel/reflow animation). This is a real, measurable gap, not a subjective one. This spec is a general visual-quality pass, not a response to a specific complaint.

Two marketplace skills were installed ahead of this work: `expo` (official Expo/RN platform-correctness skills) and `frontend-design` (creative-direction judgment — web-oriented in its executable guidance, but its process of avoiding generic-AI-default aesthetics and building a deliberate palette/type/signature-element system transfers conceptually and shaped this design). Neither is invokable mid-session (both installed after this session's skill list loaded); a future session should actually invoke `frontend-design` before any *further* visual-direction work, and `expo` before implementation, to confirm this spec's choices against their guidance rather than only this session's manual application of `frontend-design`'s written principles.

## Visual Direction (locked v1.0.0)

Arrived at via 3 rounds in the visual-companion browser tool (`.superpowers/brainstorm/1826-1785370055/content/`, gitignored — `homescreen-directions.html` → `homescreen-combined-v1.html` → `homescreen-v1.0.0.html` is the approved final). Explicitly a **hybrid** of three initial directions, not a pure pick of one:

- **Base layout & marquee identity** from "Card Catalog / Marquee": Home gets its own distinct identity, separate from the in-game felt/wood tables — reads as a menu, not "another table." A deep navy-to-plum gradient background (`#1a0f2e` → `#2b1149` → `#180a26`), with a large hero illustrated court card near the top, tilted slightly (`rotate(-4deg)`) as if just dealt.
- **Menu-row content** from "Card Table Lobby": each game is a row showing a small fanned 3-mini-card preview (not a plain icon/dot) plus the game's name and a subtitle.
- **Wordmark style** from "Minimal Editorial": `World Cards` set in the app's existing **PT Serif** font (already bundled and loaded via `expo-font` in `packages/ui/src/fonts.ts` — reuse `'PTSerif-Regular'` or `'PTSerif-Bold'`, zero new font dependency), gold (`#f4c542`), light weight, wide letter-spacing, centered, with a thin gold divider rule beneath it.
- **Added during iteration, not from any single original direction:** a soft green glow blended into the hero card's shadow, and a thin green "baize" gradient strip grounding the bottom edge of the screen — a deliberate, minimal nod to the felt-table identity so Home doesn't feel completely disconnected from the games it leads into, without abandoning the marquee's own purple identity.

## Palette (named)

| Token | Hex | Use |
|---|---|---|
| `bg.top` | `#1a0f2e` | Background gradient start |
| `bg.mid` | `#2b1149` | Background gradient middle |
| `bg.bottom` | `#180a26` | Background gradient end |
| `accent.gold` | `#f4c542` | Wordmark, divider rule, hero card gold rim |
| `accent.green` | `#1f5c3a` (glow) / `#0d2818` (baize) | Hero-card ambient glow, bottom baize strip — the "table" nod |
| `card.face` | `#fdfaf3` | Hero card + mini-card fan faces |
| `text.onDark` | `#f2e6ff` | Game names, subtitles on the marquee background |

This is a genuinely new palette, not a reuse of the existing navy/gold shell tokens (`#12121f`/`#f4c542`) that `HomeScreen.tsx`/`BatakSetupView.tsx`/`PistiSetupView.tsx` currently share — HomeScreen intentionally gets its own identity per the direction above. **Setup-screen theming is out of scope for this spec** — whether/how to extend this palette to `BatakSetupView`/`PistiSetupView` is exactly the kind of question the deferred cross-table consistency pass (sub-project 4) should own, not something to decide as a side effect here.

## Typography

- **Wordmark ("World Cards"):** PT Serif (existing bundle), light/regular weight, ~26sp, letter-spacing ~3, gold.
- **Game name:** existing system sans-serif (matches current app-wide body-text convention — no new font), semibold, ~14sp, `text.onDark`.
- **Game subtitle:** same sans-serif, regular, ~11sp, `text.onDark` at reduced opacity (~55%).

## Layout & Components

Top to bottom, single scroll-free column (roadmap tops out at 11 games; if the list ever needs to scroll once more games ship, that's a future revisit, not designed for now):

1. **Hero card** — a single illustrated court card image (see "Hero art sourcing" below), fixed size, rotated, centered, with the gold+green glow shadow described above.
2. **Wordmark + divider rule.**
3. **Game menu rows** — one per entry from `getGames()` (`packages/engine`'s registry, already the `HomeScreen`'s existing data source — no new data plumbing needed):
   - **Fanned mini-card preview**: 3 small overlapping card shapes, tinted per-suit via existing `packages/ui` `SuitIcon`/color conventions — not per-game bespoke art. Reuses the existing card-face visual language instead of inventing new iconography per game (keeps this scaling cheaply to all 11 future roadmap games with zero bespoke art each time).
   - **Name**: `game.displayName`.
   - **Subtitle**: derived entirely from existing `GameDescriptor` fields already on every registered game — `` `${categoryLabel(game.category)} · ${playerRangeLabel(game.minPlayers, game.maxPlayers)}` `` (e.g. "Fishing · 2-4 players", "Trick-taking · 3-4 players"). `categoryLabel`/`playerRangeLabel` are two small new pure functions (`GameCategory` → display label; `minPlayers`/`maxPlayers` → "N players" or "N-M players"), not new engine fields — **no `packages/engine` changes required for this spec.**
   - **Accent color**: derived from `game.category` via a small static lookup (fishing → green-leaning, trick-taking → gold-leaning, patience → blue-leaning, etc. — exact mapping is an implementation-time color choice, not re-litigated here) — used for the row's left accent border, echoing the "Card Catalog" mockup's per-game accent-color rows.
4. **Green baize strip** — thin, absolutely positioned at the bottom edge, purely decorative (`pointerEvents: 'none'`, same convention as `TableFelt`/`AbsoluteOverlay`).

## Hero Art Sourcing

The hero card needs one real illustrated court-card image — not the full illustrated-card-art initiative (all ranks × suits, still deferred as sub-project 3). Scope for **this spec's implementation**: source (find/license, or generate and curate) exactly one illustrated card image matching the style of the existing reference (`docs/references/card-art/this what I want to achive.png` — a classic rider-style Queen of Hearts) at a resolution suitable for a ~100×140dp render target. This is a small, bounded asset-sourcing task, explicitly not a commitment to building the full per-rank/suit illustrated system now. Store the sourced asset under `apps/mobile/assets/` (mirroring where `wooden-frame-long-Photoroom.png` already lives) and license/attribution notes alongside it, matching `docs/references/pisti/README.md`'s existing precedent for recording image sourcing.

## Animation (signature moment)

Not yet mocked visually (the companion tool showed static frames) — proposed here for the plan to implement, subject to going through `docs/animation/`'s Workflow (Architecture Audit) before implementation, same as every other animation change in this repo:

- **On mount**, the hero card and menu rows perform a brief, staggered entrance (hero card settles into its tilted rest position first; each menu row fades/slides in ~60ms after the previous one) — a single orchestrated moment per `frontend-design`'s "an orchestrated moment usually lands harder than scattered effects" principle, not a per-element scattered effect.
- **Engine choice**: per the current, permanent two-vocabulary state recorded in `docs/animation/ADR/ADR-003-scope-reanimated-migration-to-evidenced-need.md`, this has no evidenced reflow-stutter/gesture-hit-testing need (it's a one-time mount entrance, not a reflowing multi-card hand) — default to plain `Animated` (`useNativeDriver: true`) unless the Architecture Audit finds a concrete reason otherwise. Do not default to Reanimated just because it exists elsewhere in `apps/mobile` now.
- Respect `useReducedMotion()` (existing app-wide convention) — instant appearance, no stagger, when enabled.

## Component Reuse vs. New

**Reused as-is:** `getGames()` registry data, `SuitIcon`/color conventions from `packages/ui`, `AbsoluteOverlay` convention for the baize strip, `expo-font`'s already-loaded PT Serif, `useReducedMotion()`.

**New, small, HomeScreen-only components** (not shared with game tables — this is a deliberately distinct identity per the Visual Direction section, so no shared-component extraction is expected from this pass): the hero card view, the wordmark+rule block, the game-menu-row component (fan preview + name + subtitle + accent border), the baize-strip overlay. All live under `apps/mobile/src/screens/` alongside `HomeScreen.tsx` — no `packages/ui` additions expected, since none of this is reused by any game table today.

## Testing

Per the standing 2026-07-07 testing policy: no new automated tests for this decorative/presentational UI work. `HomeScreen.test.tsx` (existing) gets updated only as needed to keep passing against the new markup (e.g. if it queries specific text/testIDs that change) — not expanded.

## Explicitly Out of Scope

- The full illustrated-card-art system (all ranks/suits) — sub-project 3, still deferred, still separate.
- Setup-screen (`BatakSetupView`/`PistiSetupView`) re-theming to match this new palette — a question for sub-project 4, not decided here.
- Per-game bespoke iconography (beyond the generic suit-tinted mini-card fan) — deliberately avoided so this scales to 11+ future roadmap games without bespoke art each time.
- Native on-device visual verification — same standing gap as every prior UI pass in this repo; will need the user's own on-device check once implemented, per `[[feedback_no_unsolicited_screenshot_tests]]`.
- Scroll behavior once the game list grows beyond what fits one screen — not designed for in this pass.
