# Table frame: swap SVG "sketch" corners/rails for photo frame assets

**Date:** 2026-07-18
**Status:** approved

## Problem

Pişti's and Batak's tables currently decorate their borders with `TableWoodCorners`/`TableEdgeRails` — hand-drawn SVG gradient+pattern wood shapes ("sketches"). The user supplied real photo-textured frame assets (`wooden-background-frame-1.png`, alongside the already-in-use `green.png` felt and `wooden-frame-long-Photoroom.png` hand frame) and wants the real game tables to use those instead.

## Scope

- **Pişti table**: replace `<TableWoodCorners />` with a new full-table photo frame overlay, layered on top of the existing `<TableFelt />` (green.png).
- **Batak table**: remove `<TableWoodCorners corners={['topLeft','topRight']} />` and `<TableEdgeRails edges={['top','left','right']} />`. Keep `<TableFelt />` and the existing `<HandFrame />` (wooden-frame-long-Photoroom.png) unchanged — with the SVG sketches gone, `HandFrame` is naturally the only (and therefore topmost) decorative frame layer left, satisfying "keep the wooden frame on the top level."
- **Out of scope**: `packages/ui/src/TableWoodCorners.tsx` and `TableEdgeRails.tsx` are NOT deleted or modified — `apps/playground`'s `CardGallery`/`TableTemplateEditor` still render `TableWoodCorners` for its live wood-color customization preview, which is a genuinely different concern (a configurable template editor, not a fixed decorative image) and stays as-is per user direction. Whether/how playground should also get a photo-frame option is an explicitly deferred, separate discussion — not decided here.

## Design

New shared component `packages/ui/src/TableFrame.tsx`, following the exact `TableFelt` shape (zero props, `React.memo`, `AbsoluteOverlay`-wrapped `Image`):

```tsx
const FRAME_IMAGE = require('../assets/table/wooden-background-frame-1.png');

function TableFrameComponent() {
  return (
    <AbsoluteOverlay>
      <Image source={FRAME_IMAGE} style={styles.image} resizeMode="stretch" />
    </AbsoluteOverlay>
  );
}
export const TableFrame = React.memo(TableFrameComponent);
```

`resizeMode="stretch"` (not `"cover"`, which `TableFelt` uses): the frame asset's wood border runs flush to its own image edges on all four sides (confirmed by inspecting the PNG — no transparent margin the way `HandFrame`'s asset has), so stretching to exactly fill the container is what puts the border flush against the table's real edges on any screen size, matching the same tradeoff already accepted for `HandFrame`. No alpha-margin measurement needed for this asset, unlike `HandFrame`.

Exported from `packages/ui/src/index.ts` alongside the other table components.

### Pişti (`apps/mobile/src/games/pisti/PistiTable.tsx`)

```tsx
<TableFelt />
<TableFrame />
```
(replacing the current `<TableWoodCorners />` line; import swapped in the `@world-cards/ui` import line.)

### Batak (`apps/mobile/src/games/batak/BatakTable.tsx`)

```tsx
<TableFelt />
```
(deleting the `<TableWoodCorners .../>` and `<TableEdgeRails .../>` lines and their now-unused imports; `<HandFrame ... />` further down is untouched.)

## Testing

No new automated tests — pure decorative UI swap, consistent with the standing 2026-07-07 mobile-UI testing policy (CLAUDE.md). Existing suite must still pass untouched (no behavior change, only JSX/asset swaps). No proactive screenshot/visual verification, per the user's 2026-07-17 direction (`feedback_no_unsolicited_screenshot_tests` memory) — the user is running the app live via Fast Refresh.
