# Table frame: swap SVG "sketch" corners/rails for photo frame assets

**Date:** 2026-07-18
**Status:** implemented (superseded mid-flight — see "Iteration" below for how the final shape differs from the original plan)

## Problem

Pişti's and Batak's tables decorated their borders with `TableWoodCorners`/`TableEdgeRails` — hand-drawn SVG gradient+pattern wood shapes ("sketches"). The user supplied real photo-textured frame assets (`wooden-background-frame-1.png`, `wooden-frame-long-Photoroom.png`, alongside the already-in-use `green.png` felt) and wanted the real game tables to use those instead.

## Final state

- **Both tables**: `TableWoodCorners`/`TableEdgeRails` (the SVG sketches) are no longer rendered on either game table. `<TableFelt />` (green.png) is the only background layer on both.
- **Pişti table** (`apps/mobile/src/games/pisti/PistiTable.tsx`): gained a `<HandFrame />` (the same `wooden-frame-long-Photoroom.png` asset Batak already used) behind the human hand row. Pişti's human hand is a single flat row (no curve/second row, unlike Batak's two-row fan), so the positioning constants added to this file are a simplified version of Batak's — the frame's arch peak aligns to the hand row's own flat top edge, with no curve-offset math needed. First-pass constants, not measured on a real device (same caveat Batak's original version shipped with).
- **Batak table** (`apps/mobile/src/games/batak/BatakTable.tsx`): unchanged from before this whole sub-pass except the `TableWoodCorners`/`TableEdgeRails` removal — still `<TableFelt />` then `<HandFrame />`, same as it already was.
- **Out of scope, still true**: `packages/ui/src/TableWoodCorners.tsx`/`TableEdgeRails.tsx` are NOT deleted — `apps/playground`'s `CardGallery`/`TableTemplateEditor` still render `TableWoodCorners` for its live wood-color customization preview, a genuinely different concern (a configurable template editor, not a fixed decorative image). Whether/how playground should also get a photo-frame option remains an explicitly deferred, separate discussion.

## Iteration (for future-session context)

The original plan (see git history on this file) was a new shared `packages/ui/src/TableFrame.tsx` component — a `TableFelt`-shaped wrapper around `wooden-background-frame-1.png`, stretched full-bleed over the whole table, used by both games layered on top of `TableFelt`. That was built and briefly shipped on both tables, then explicitly reverted at the user's request ("remove the background-frame please") once seen live — it didn't read right full-bleed over the whole table. `TableFrame.tsx` and its `packages/ui/src/index.ts` export were deleted as dead code once nothing referenced it. The user then asked to bring `wooden-frame-long-Photoroom.png` back specifically — which turned out to mean extending Batak's existing `HandFrame` treatment (a frame behind just the hand, not the whole table) to Pişti too, rather than reviving the full-table `TableFrame`.

`wooden-background-frame-1.png`, `wooden-background-frame-.png`, and `wooden-background.png` remain in `packages/ui/assets/table/` unused by any current code — kept in case they're wanted for a future, different treatment; not wired up anywhere today.

## Testing

No new automated tests — pure decorative UI swap, consistent with the standing 2026-07-07 mobile-UI testing policy (CLAUDE.md). Full existing suite (39 suites/229 tests) verified passing against the final state. No proactive screenshot/visual verification, per the user's 2026-07-17 direction (`feedback_no_unsolicited_screenshot_tests` memory) — the user is running the app live via Fast Refresh.
