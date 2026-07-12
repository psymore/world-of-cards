# Card Playground — Design

## Purpose

A standalone tool for experimenting with card front designs (border radius, border color, and an overlay image) across a full 52-card deck, previewed live in a gallery. This is a prototyping tool, not a shipping feature: the near-term goal is to let the user explore what custom card skins could look like. It's an intentional first step toward a possible future where users can buy/select alternate deck designs in the real game — but that integration is explicitly not part of this project; it's a decision to make later, once this tool proves the concept useful.

## Non-goals

- No per-card (as opposed to per-group) customization.
- No card *back* customization — front/face templates only.
- No "save as a sellable skin," export, or marketplace mechanism.
- No connection, deep link, or code reference from the real game app (`apps/mobile`) to this tool, in development or production.
- No gesture-based (pinch/drag) image manipulation — slider/button controls only.

## Isolation requirement (drove the architecture)

The user requires this to be **completely isolated** from the real game: no shared UI components, no shared dependencies beyond the pure-data engine package, and no possibility of playground-only libraries or code ending up in the production game bundle — not just "easy to exclude," but structurally impossible to include by accident.

This rules out building the playground as a screen inside `apps/mobile` (even behind a dev-only flag/guard), since that would put playground-only dependencies in `apps/mobile/package.json` and require an import (however guarded) from game code to playground code.

**Decision: `apps/playground` is a new, separate Expo app**, a sibling to `apps/mobile` in the existing npm workspace (`workspaces: ["apps/*", "packages/*"]` in the root `package.json` already covers it — no workspace config change needed). It is launched independently (`npm run playground` at the repo root, added as a convenience script matching the existing `npm run mobile` pattern) and is never reachable from within the real game app, in dev or production.

**What it shares with the rest of the repo:** only `packages/engine`, for the `Card` / `Suit` / `Rank` types and the `createDeck()` 52-card generator. That package is pure TypeScript with zero React/React Native/Expo dependency by design (see the core architecture spec) — it's the project's intended shared data foundation, not "game code" in the sense the isolation requirement is about. It does not import anything from `apps/mobile` (components, state, or otherwise).

**What it deliberately does not share:** `apps/mobile/src/components/PlayingCard.tsx` and its dependents (`SuitIcon`, `CardBackPattern`, `courtCardArt`, etc.) are not imported. `apps/playground` gets its own, independent card-face rendering component. `SuitIcon.tsx`'s SVG path data is small and self-contained enough to copy into the new app (for visual quality) without that copy constituting a dependency in either direction — a change to one file never affects the other.

**Why a sibling workspace app instead of a fully separate repo:** Metro (RN's bundler) builds each app starting only from that app's own entry point, pulling in only what's transitively imported from there. Since `apps/mobile` will never import anything from `apps/playground`, none of the playground's code or its extra libraries enter the game's JS bundle — this holds regardless of whether the two apps live in the same repo or not. Native modules (e.g. the file picker's native Android/iOS code) are linked per-app via Expo autolinking, scanning only that app's own `package.json` — so they never link into the game's native build either. The only monorepo-shared cost is disk space in the root `node_modules/` after `npm install` (workspace packages are installed for all workspaces), which has no effect on the shipped game bundle, binary size, permissions, or runtime memory. Given that, a full separate repo would add real overhead (separate git history/CI/install/tooling) for no additional isolation benefit over a sibling workspace app.

## Data model

Three template groups — not per-card, not one-shared-template:

| Group | Ranks | Card count |
|---|---|---|
| `number` | 2–10 | 36 |
| `face` | J, Q, K | 12 |
| `ace` | A | 4 |

```ts
interface CardTemplate {
  borderRadius: number;
  borderColor: string; // hex
  image: {
    uri: string;
    kind: 'png' | 'svg';
    svgXml?: string; // populated for kind === 'svg'; see "Image handling" below
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null;
}

type CardGroup = 'number' | 'face' | 'ace';

type PlaygroundTemplates = Record<CardGroup, CardTemplate>;
```

`getCardGroup(rank: Rank): CardGroup` maps `'A'` → `ace`, `'J' | 'Q' | 'K'` → `face`, everything else (`'2'`–`'10'`) → `number`. `'joker'` is not used — the gallery is generated via `createDeck({ deckCount: 1, includeJokers: false })`, giving exactly the 52 standard cards.

## State & persistence

`src/state/playgroundStore.ts`: a zustand store holding `templates: PlaygroundTemplates`, wrapped in zustand's `persist` middleware over `@react-native-async-storage/async-storage` (the standard zustand pattern), so the design survives app restarts. This is independent of the engine's `PersistenceAdapter` interface, which is shaped for game-state/stats saves, not a fit for arbitrary settings persistence.

## Image handling

Images are picked via `expo-document-picker` (a general file picker, not `expo-image-picker`'s photo-library picker, since SVG files aren't indexed as "photos"). Handling branches on the picked file's extension:

- **PNG** (or other raster: jpg/heic): the picked file's `uri` is used directly as an `Image` `source`.
- **SVG**: the file's text content is read via `expo-file-system` and passed as a raw XML string to `react-native-svg`'s `SvgXml` component (`<SvgXml xml={svgString} .../>`). This is the stable, documented way to render arbitrary runtime SVG content in `react-native-svg` — deliberately not `SvgUri`, which has a rockier support history in that library.

The overlay renders centered within the card, above the corner rank/suit indices, scaled and offset per the template's `scale`/`offsetX`/`offsetY` — adjusted via sliders (`@react-native-community/slider`) and nudge/reset controls, not touch gestures.

## UI flow

Single screen, no navigation library needed (`App.tsx` renders `PlaygroundScreen` directly):

1. **Group selector** — a row of three plain buttons acting as a segmented control (no segmented-control library needed): "2–10" / "J·Q·K" / "Aces".
2. **Live editor** for the selected group's template:
   - One large preview card reflecting the current template.
   - Border radius slider.
   - Border color: a row of preset swatches (tap to select) plus a hex text-input for custom colors (invalid input falls back to the last valid color — no new color-picker dependency needed).
   - "Add Image" button → opens the document picker → sets `image`.
   - When `image` is set: scale slider, X-offset slider, Y-offset slider, "Remove image" button.
   - "Reset group" button — restores that group's template to defaults (no border color/radius override, no image).
3. **Gallery** — all 52 cards in a scrollable grid, grouped by suit, each card rendered via `PlaygroundCard` with its group's current template applied live. This is the whole-deck preview — the way to check the three templates read well together across every card.

## New `apps/playground/` structure

```
apps/playground/
  package.json          # name: world-cards-playground
  app.json
  tsconfig.json
  App.tsx                # renders PlaygroundScreen
  src/
    PlaygroundScreen.tsx  # the layout above
    components/
      PlaygroundCard.tsx  # standalone card-face renderer (corner index, border, overlay image)
      SuitGlyph.tsx        # copied SVG path data from apps/mobile's SuitIcon.tsx
    state/
      playgroundStore.ts   # zustand + persist(AsyncStorage)
    utils/
      cardGroups.ts         # getCardGroup(rank)
```

New dependencies (all confined to `apps/playground/package.json`): `expo-document-picker`, `expo-file-system`, `@react-native-community/slider`, `react-native-svg`, `zustand`, `@react-native-async-storage/async-storage`, `@world-cards/engine` (workspace link).

Root `package.json` gains one script: `"playground": "npm run start --workspace=world-cards-playground"`, matching the existing `"mobile"` script.

## Testing

No new tests by default, consistent with the project's existing testing policy (mobile/UI screens are not test-covered by default; ask first). Root `jest.config.js`'s `projects` array (`packages/engine`, `apps/mobile`) is left unchanged — `apps/playground` is not added to it.

## Future extensibility (not part of this project)

The three-group template model is a natural fit for a future "deck skin" concept if this is ever extended toward user-selectable or purchasable decks in the real game. If/when that's pursued, the integration approach (porting chosen template values into the game, vs. some other mechanism) is a deliberate future decision — not assumed or designed for here.
