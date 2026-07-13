# Shared UI package (`packages/ui`) design

**Date:** 2026-07-14
**Status:** approved

## Problem

`apps/playground` (the card/table visual design tool) maintains its own separate implementations of card and table rendering (`PlaygroundCard.tsx`, `SuitGlyph.tsx`, `TableBackdrop.tsx`) rather than the real, shipped components in `apps/mobile` (`PlayingCard.tsx`, `SuitIcon.tsx`, `TableFelt.tsx`, `TableWoodCorners.tsx`). This means:

- Playground's preview can silently drift from what the real app actually looks like (it already has — recent changes to `PlayingCard`'s corner rank font and `SuitIcon`'s glyph shapes exist only in `apps/mobile`, not playground).
- Every future visual change to the real cards/table needs a second, manual, easy-to-forget port into playground's duplicate implementation.

Separately, playground has a real cross-platform rendering bug: `CardGallery`'s grid cards are sized at `width: '22%'` of their parent, and `PlaygroundScreen`'s root container has no width cap (`{ flex: 1 }`). On a phone (native or a phone-width browser), 22% resolves against a reasonable phone screen width. On a desktop browser (`expo start --web`), the same container fills the full, much wider desktop window, so the same 22% produces cards several times larger than intended.

## Goals

- Playground previews the real, shipped `PlayingCard`/`SuitIcon`/`TableFelt`/`TableWoodCorners` — not a separate reimplementation — so drift becomes structurally impossible rather than a manual-sync discipline problem.
- `apps/mobile` and `apps/playground` remain two separate apps/builds. Playground's dependencies (file/image pickers, sliders) never touch `apps/mobile`'s dependency tree, and none of playground's editor UI ships inside the real game app. (See the conversation's earlier finding: Metro ships one JS bundle per app with no code-splitting, and native modules compile into the binary regardless of `__DEV__`-style runtime gating — so this separation has to be structural, not a runtime flag.)
- Fix the grid-sizing inconsistency between native and web.

## Non-goals

- No in-app, end-user-facing theme/skin editor inside `apps/mobile`. That's a real, separate, much narrower feature (curated presets, not arbitrary uploads) to design later if wanted.
- No change to `apps/mobile`'s default visual behavior. Every new override prop defaults to today's exact hardcoded look.
- No change to `CardBackPattern` (card back design isn't part of playground's template scope) or to `GameResultModal`/`GameScreenLayout`/`PlayerAvatar`/`SelectableCard`/`useCardSelection`/`useReducedMotion` (gameplay/interaction, not card/table "look").

## Design

### New package: `packages/ui` (`@world-cards/ui`)

The first RN-dependent shared package in `packages/` — unlike `packages/engine`, which is deliberately pure TypeScript with zero React/React Native dependency, `packages/ui` is real RN components consumed directly from source (`"main": "src/index.ts"`, no build step), exactly matching how `packages/engine` is already consumed by both apps via the npm workspace.

**Moves from `apps/mobile/src/components/` to `packages/ui/src/`:**
- `PlayingCard.tsx` + `PlayingCard.test.tsx`
- `SuitIcon.tsx`
- `TableFelt.tsx`
- `TableWoodCorners.tsx`
- `CardBackPattern.tsx`
- `AbsoluteOverlay.tsx`
- `glowShadow.ts`
- `courtCardArt.ts`, plus its referenced assets: `apps/mobile/assets/card-art/processed/ai-generated/**` moves to `packages/ui/assets/card-art/processed/ai-generated/**` (the `require(...)` paths in `courtCardArt.ts` must move with it, since Metro resolves them relative to the requiring file).

**Stays in `apps/mobile/src/components/`:** `GameResultModal.tsx`(+test), `GameScreenLayout.tsx`(+test), `PlayerAvatar.tsx`, `SelectableCard.tsx` (now imports `PlayingCard` from `@world-cards/ui`), `useCardSelection.ts`, `useReducedMotion.ts`.

**Barrel export** (`packages/ui/src/index.ts`): re-exports `PlayingCard`/`PlayingCardProps`, `SuitIcon`/`SuitIconProps`, `TableFelt`, `TableWoodCorners`, `CardBackPattern`, `AbsoluteOverlay`, `glowShadow` — matching `packages/engine/src/index.ts`'s existing barrel pattern.

### New override props (default to today's exact hardcoded look)

Investigated each component's actual current color ownership before designing this — two components needed nothing:

- **`TableFelt`**: needs no new prop. It already only draws a weave pattern + vignette overlay — it never owned the base green color (that's set by whichever screen renders it, e.g. `PistiScreen.tsx` passes `backgroundColor="#0b6623"` to `GameScreenLayout`). Playground already sets its own background to `table.feltColor` the same way; it just needs to render the real `<TableFelt />` on top instead of its own `TableBackdrop`.
- **`CardBackPattern`**: no new prop — out of scope (see Non-goals).
- **`TableWoodCorners`**: genuinely hardcodes `WOOD_LIGHT`/`WOOD_DARK`/`GRAIN_COLOR`/`TRIM_COLOR`. Gains one new optional prop, `woodColor?: string`. When provided, `WOOD_LIGHT`/`WOOD_DARK` are derived from it via a small lighten/darken helper (new `packages/ui/src/colorUtils.ts`) so the existing two-tone gradient look is preserved under any base color, rather than flattening to a single flat fill. `GRAIN_COLOR`/`TRIM_COLOR` stay fixed (playground's `TableTemplate` only models a single `woodColor` field — matching its actual current data model, not inventing new knobs it doesn't have).
- **`PlayingCard`**: gains optional override props, all defaulting to `undefined` (today's exact behavior):
  - `cardRadius?: number` — replaces the hardcoded `CARD_RADIUS = 6`.
  - `borders?: { width: number; color: string }[]` — replaces the fixed concentric white/grey ring frame with an arbitrary stack of rings (same nesting technique already used for the frame, generalized).
  - `overlayImage?: { uri?: string; svgXml?: string; scale?: number; offsetX?: number; offsetY?: number } | null` — when provided, takes precedence over the real `courtCardArt` lookup and the plain suit watermark (in that precedence order: explicit `overlayImage` > `courtCardArt` lookup > suit watermark). `packages/ui` defines this shape itself rather than importing playground's `CardImage` type — the dependency direction stays shared-package-owns-its-interface, consuming-app-adapts-to-it, not the reverse. Playground's `CardTemplateEditor` maps its own `CardTemplate` state to these prop names when calling the real `PlayingCard`; that mapping is playground's own adapter code, not shared.

### `apps/mobile` changes

- `package.json`: add `"@world-cards/ui": "*"` dependency (same pattern as the existing `"@world-cards/engine": "*"`).
- Update imports in `PistiTable.tsx` and `SelectableCard.tsx` from local relative paths to `@world-cards/ui` (confirmed via search: these are the only two files outside `components/` itself that reference the moving components).
- Remove the moved files and moved assets from `apps/mobile`.
- No behavior change: every new prop is optional and unused by `apps/mobile`, so its visual output is provably identical before/after.

### `apps/playground` changes

- `package.json`: add `"@world-cards/ui": "*"` dependency.
- Delete `PlaygroundCard.tsx`, `SuitGlyph.tsx`, `TableBackdrop.tsx` (the duplicate implementations these changes make obsolete).
- `CardGallery.tsx`, `CardTemplateEditor.tsx`, `TableTemplateEditor.tsx`: render the real `PlayingCard`/`TableFelt`/`TableWoodCorners` from `@world-cards/ui`, passing `usePlaygroundStore`'s existing `CardTemplate`/`TableTemplate` state through the new override props via a small local adapter (mapping `template.borderRadius` → `cardRadius`, `template.borders` → `borders`, `template.image` → `overlayImage`, `table.woodColor` → `TableWoodCorners`'s `woodColor`).
- `PlaygroundScreen.tsx`: fix the grid-sizing inconsistency by capping the content width (e.g. `maxWidth: 480`, centered) so the existing `22%`-based grid math in `CardGallery` always resolves against a phone-like width regardless of actual browser window width. This is the same value class as a typical large phone (~430dp) with a small margin, chosen so native rendering is visually unaffected (already narrower than the cap) while web rendering gets constrained to match.

### Testing / tooling

- New `packages/ui/jest.config.js`: `jest-expo` preset, copying `apps/mobile/jest.config.js`'s exact `transformIgnorePatterns` (needed since `packages/ui` contains real RN component tests, unlike `packages/engine`'s plain `ts-jest` setup).
- New `packages/ui/tsconfig.json`: extends `expo/tsconfig.base` (matching `apps/mobile`/`apps/playground`'s pattern — NOT `packages/engine`'s pure-TS `nodenext` config, since this package needs JSX/RN types).
- New `packages/ui/package.json`: `"name": "@world-cards/ui"`, `"main": "src/index.ts"`, `"types": "src/index.ts"`, devDependencies for typecheck only (matching `packages/engine`'s lightweight pattern — `react`/`react-native`/`react-native-svg` are provided by whichever consuming app's node_modules at runtime, same as how `packages/engine` declares no runtime dependencies of its own).
- Root `jest.config.js`: add `'<rootDir>/packages/ui'` to the `projects` array.
- No Metro config changes expected in either app — both already set `watchFolders`/`nodeModulesPaths` to the workspace root (confirmed by reading both `metro.config.js` files), the same mechanism that already resolves `@world-cards/engine`.
- No new automated tests beyond relocating `PlayingCard.test.tsx` unmodified — this remains decorative/tooling work per this project's standing testing policy. Verification is: existing tests pass after the move, typecheck is clean, and a browser/Playwright visual check confirms playground's card gallery now matches `apps/mobile`'s current look (PT Serif corner font, refined suit glyphs) and that the grid-sizing fix holds at both a narrow and a wide viewport width.

### `CLAUDE.md` update

The Card Playground section's isolation rule needs rewriting to name `packages/ui` as the new shared surface: playground now shares `packages/engine` **and** `packages/ui` with the rest of the repo, but still never imports `apps/mobile` directly, and `apps/mobile` never imports or links to `apps/playground` — the playground-only-dependencies-never-touch-`apps/mobile` half of the original rule is unchanged and remains load-bearing.

## Risks / follow-ups

- This is a precedent-setting architecture change (first RN-dependent shared package) — worth being deliberate about, which is why it's getting the full spec+plan treatment rather than a quick patch.
- `PlayingCard`'s new override props are a real, permanent expansion of its production API surface, even though every default preserves current behavior exactly. Future games building on `PlayingCard` should know these props exist (though none are required).
- The wood-color lighten/darken derivation is a new, small piece of color-math code — worth a quick visual sanity check across a couple of base colors, not just the default, once implemented.
- Not verified on a native on-device build (consistent with the standing, already-tracked native-verification gap for this project's UI work).
