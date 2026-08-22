// Layout constants shared by every game's human-hand-area positioning math (currently Pişti's
// PistiTable.tsx and Batak's BatakTable.tsx). Each file's own formula for its content height,
// top inset, and hand-row peak distance stays independently written per game — they genuinely
// differ (different HAND_AREA_HEIGHT, Batak has an extra content-gap term) — only the raw
// magic-number inputs that happened to be identical across both files are centralized here.

// Matches each table's own styles.container.paddingVertical.
export const CONTAINER_BOTTOM_PADDING = 12;
// Approx rendered height of PlayerBadge at normal size (top/bottom seats — compact/side seats
// have their own, much taller vertical-pill shape and don't use this constant). 74 = the row
// layout's own content height (max of the 66px avatar and the ~49px pill, since 2026-08-22's
// avatar-left/name-right redesign put them side by side instead of stacked) plus PlayerBadge's
// own 4px top/bottom marginVertical. Previously 34 — a stale value from well before that redesign
// (and undersized even for the older stacked layout) that let the badge silently overflow its
// reserved box downward into whatever rendered below it (e.g. Pişti's trick pile, which paints
// above via its own zIndex — see PistiTable.tsx's legacyPileArea).
export const HAND_BADGE_HEIGHT = 74;
// Peak-aligning HandFrame exactly to the hand row's own top edge hides its gold trim behind the
// cards (they render in front, same height) — this extra margin lifts the frame's peak above the
// row instead, so the trim clears the cards and stays visible.
export const HAND_FRAME_REVEAL_MARGIN = 14;
// HandFrame's bottom edge sits this far below the screen's true bottom edge (rather than landing
// exactly flush) so it's guaranteed to fully cover the bottom regardless of small per-device
// rounding/safe-area differences — the overshoot itself is never visible, it's off-screen.
export const HAND_FRAME_BOTTOM_OVERSHOOT = 16;
