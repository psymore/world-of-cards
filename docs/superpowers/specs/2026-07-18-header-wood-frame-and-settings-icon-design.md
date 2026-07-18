# Header wood frame + settings icon — design

## Context

Every game's top header bar (title, optional settings gear, "Exit") is rendered by the shared
`GameScreenLayout` component (`apps/mobile/src/components/GameScreenLayout.tsx`) as a plain flat
color — no decoration, unlike the table/hand areas below it which already use wood-frame/felt
imagery (`TableWoodCorners`, `TableEdgeRails`, `HandFrame`). The user supplied two reference
assets: `packages/ui/assets/table/wooden-background-frame-1.png` (a portrait card-shaped wood
frame, already in the repo) and a new `packages/ui/assets/general/in-game-settings.png` (a 32×32
gear icon), asking for the frame's top portion behind the header bar and the new icon replacing
the current `⚙` Unicode-glyph settings button.

## Scope

Applies to every game via the shared `GameScreenLayout` (confirmed with the user — not scoped to
Batak only, even though the reference screenshot was Batak's). No new tests, per the standing
2026-07-07 mobile-UI testing policy.

## Measurements (from the asset's own alpha channel, not eyeballed)

`wooden-background-frame-1.png` is 1024×1536px. Scanning the alpha channel found:
- No transparent margin on the left/right edges (opaque content starts at x=1, ends at x=1021) —
  unlike `wooden-frame-long-Photoroom.png`, no margin-correction math is needed.
- The deepest point of the top region's opaque content (the corner-ornament block, deeper than the
  arch's own center dip) sits at 15.8% of the image's height. A crop fraction of **0.18** is used
  (small safety margin over the measured 0.158, so the ornament's anti-aliased edge is never
  clipped).

## New component: `HeaderWoodFrame` (`packages/ui/src/HeaderWoodFrame.tsx`)

Follows the same crop-via-`overflow:hidden` technique already established by `HandFrame` for its
own non-natural-aspect case: the source image is rendered at `height / HEADER_FRAME_CROP_FRACTION`
(so only the top `HEADER_FRAME_CROP_FRACTION` slice ends up visible within a same-`height`
container), `resizeMode="stretch"` (required whenever `height` overrides the natural aspect,
same reasoning as `HandFrame`'s own doc comment), full window width, `position: 'absolute'`,
`pointerEvents: 'none'`.

```ts
export const HEADER_FRAME_ASPECT_RATIO = 1536 / 1024; // height/width, same convention as HAND_FRAME_ASPECT_RATIO
export const HEADER_FRAME_CROP_FRACTION = 0.18;

export interface HeaderWoodFrameProps {
  height: number; // target visible strip height in dp — caller measures its own header row
}
```

Exported via `packages/ui/src/index.ts`, same as every other decorative table asset.

## New component: `SettingsIcon` (`packages/ui/src/SettingsIcon.tsx`)

Small wrapper around the `in-game-settings.png` `Image`, replacing the `⚙` glyph `Text`.

```ts
export interface SettingsIconProps {
  size?: number; // defaults to roughly the glyph's prior visual size
}
```

## `GameScreenLayout.tsx` changes

- The `header` View gains an `onLayout` handler measuring its own rendered height into state
  (mirroring `BatakTable.tsx`'s existing `handAreaWidth`/`handleHandAreaLayout` pattern) — the wood
  frame is sized to match the header's real content height rather than a hardcoded guess, so it
  stays correct if font scaling/accessibility settings change the title's rendered height.
- `HeaderWoodFrame` renders as the first child of `header` (so it paints behind the title/actions
  row, which — per the render-order stacking rule already relied on elsewhere in this codebase —
  paints on top of it automatically with no `zIndex` needed, since both are direct siblings and
  the row is added after the frame in JSX).
- The settings `Pressable`'s `<Text style={styles.settingsIcon}>⚙</Text>` becomes
  `<SettingsIcon />`.

## Testing

No new automated tests — decorative UI, per the standing 2026-07-07 mobile-UI testing policy.
Existing suite re-run for regression. Per the user's explicit direction, no screenshot/visual
verification this pass — they'll check it in the running app themselves.
