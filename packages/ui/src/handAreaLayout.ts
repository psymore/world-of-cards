// Layout constants shared by every game's human-hand-area positioning math (currently Pişti's
// PistiTable.tsx and Batak's BatakTable.tsx). Each file's own formula for its content height,
// top inset, and hand-row peak distance stays independently written per game — they genuinely
// differ (different HAND_AREA_HEIGHT, Batak has an extra content-gap term) — only the raw
// magic-number inputs that happened to be identical across both files are centralized here.

// Matches each table's own styles.container.paddingVertical.
export const CONTAINER_BOTTOM_PADDING = 12;
// Approx rendered height of PlayerBadge at normal size.
export const HAND_BADGE_HEIGHT = 34;
// Peak-aligning HandFrame exactly to the hand row's own top edge hides its gold trim behind the
// cards (they render in front, same height) — this extra margin lifts the frame's peak above the
// row instead, so the trim clears the cards and stays visible.
export const HAND_FRAME_REVEAL_MARGIN = 14;
// HandFrame's bottom edge sits this far below the screen's true bottom edge (rather than landing
// exactly flush) so it's guaranteed to fully cover the bottom regardless of small per-device
// rounding/safe-area differences — the overshoot itself is never visible, it's off-screen.
export const HAND_FRAME_BOTTOM_OVERSHOOT = 16;
