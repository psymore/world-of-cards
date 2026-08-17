export { PlayingCard, CARD_DIMS, SUIT_COLOR } from "./PlayingCard";
export type {
  PlayingCardProps,
  PlayingCardSize,
  PlayingCardBorderSpec,
  PlayingCardOverlayImage,
} from "./PlayingCard";
export { SuitIcon } from "./SuitIcon";
export type { SuitIconProps } from "./SuitIcon";
export { TableFelt } from "./TableFelt";
export { GeminiTableBackground } from "./GeminiTableBackground";
export { DefaultTableFrame } from "./DefaultTableFrame";
export {
  MahoganyTableSurface,
  TABLE_SURFACE_ASPECT_RATIO,
} from "./MahoganyTableSurface";
export type {
  MahoganyTableSurfaceProps,
  TableSurfaceMaterial,
} from "./MahoganyTableSurface";
export { TableWoodCorners } from "./TableWoodCorners";
export type { TableWoodCornersProps, Corner } from "./TableWoodCorners";
export { TableEdgeRails } from "./TableEdgeRails";
export type { TableEdgeRailsProps, Edge } from "./TableEdgeRails";
export {
  HandFrame,
  HAND_FRAME_ASPECT_RATIO,
  HAND_FRAME_PEAK_FRACTION,
} from "./HandFrame";
export type { HandFrameProps } from "./HandFrame";
export { HeaderWoodFrame } from "./HeaderWoodFrame";
export type { HeaderWoodFrameProps } from "./HeaderWoodFrame";
export { SettingsIcon } from "./SettingsIcon";
export type { SettingsIconProps } from "./SettingsIcon";
export { PressableFeedback } from "./PressableFeedback";
export type { PressableFeedbackProps } from "./PressableFeedback";
export { ModalCloseButton, MODAL_CLOSE_BUTTON_IMAGE } from "./ModalCloseButton";
export type { ModalCloseButtonProps } from "./ModalCloseButton";
export { AbsoluteOverlay } from "./AbsoluteOverlay";
export {
  BottomAnchoredImage,
  computeBottomAnchoredImageHeight,
} from "./BottomAnchoredImage";
export type { BottomAnchoredImageProps } from "./BottomAnchoredImage";
export { CourtCardFrame } from "./CourtCardFrame";
export type { CourtCardFrameProps } from "./CourtCardFrame";
export { glowShadow } from "./glowShadow";
export { FONTS, CARD_RANK_FONT_FAMILY } from "./fonts";
export {
  DISPLAY_REGULAR,
  DISPLAY_BOLD,
  BODY_REGULAR,
  BODY_MEDIUM,
  BODY_SEMIBOLD,
  BODY_BOLD,
  TEXT_GOLD,
  TEXT_CREAM,
  TYPE_SCALE,
} from "./typography";
export type { TypeScaleLevel, TypeScaleEntry } from "./typography";
export {
  WOOD_TRIM_COLOR,
  WOOD_DEFAULT_LIGHT,
  WOOD_DEFAULT_DARK,
  WOOD_GRAIN_COLOR,
  WOOD_TRIM_STROKE_OPACITY,
  WOOD_TRIM_STROKE_WIDTH,
} from "./woodPalette";
export {
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from "./handAreaLayout";
export { TableShell, TABLE_SHELL_ASPECT_RATIO } from "./TableShell";
export type { TableShellProps, TableSeatPosition } from "./TableShell";
export { SeatIdentity } from "./SeatIdentity";
// The per-turn-state avatar ring art, re-exported as plain asset handles so consuming apps can
// build a SeatIdentityTurnStateFrames object without reaching into this package's asset folder
// directly: package.json's `exports` map only publishes "." (./src/index.ts), so a consumer-side
// require('@world-cards/ui/assets/table/avatar-frame-idle.png') is not a resolvable subpath.
export const AVATAR_FRAME_IDLE_IMAGE: number = require("../assets/avatars/avatar-frame-idle.png");
export const AVATAR_FRAME_ACTIVE_IMAGE: number = require("../assets/avatars/avatar-frame-active.png");
// A real portrait, its own circular gold ring already baked in (Photoroom export, portrait
// deliberately overflowing the ring's top/bottom edge) — apps/mobile's PlayerAvatar.tsx (the
// avatar actually shown on the live table, not SeatIdentity.tsx's still-dev-only "tableShell"
// comparison view) renders this directly in place of its old code-drawn silhouette, same asset
// for every seat rather than a per-player set. Same re-export-as-raw-handle reasoning as the
// AVATAR_FRAME_* images above.
export const PLAYER_AVATAR_PHOTO_IMAGE: number = require("../assets/avatars/avatar-female01-Photoroom.png");
export type {
  SeatIdentityProps,
  SeatIdentityOrientation,
  SeatIdentityAvatar,
  SeatIdentityTurnState,
  SeatIdentityTurnStateFrames,
} from "./SeatIdentity";
// A wood/brass/glass nameplate pill (scripts/assets/build-name-badge-pill-asset.js, cropped from
// BADGE-PILL-02A.png — a real alpha channel with a soft ambient glow halo, trimmed to that halo's
// own bounding box rather than alpha-punched from scratch). apps/mobile's PlayerBadge.tsx stretches
// this behind each seat's name/status text instead of the plain code-drawn pill it used before.
export const NAME_BADGE_PILL_IMAGE: number = require("../assets/plaques/name-badge-pill.png");
// Two glass/brass modal-card backgrounds (scripts/assets/build-modal-badge-rect-assets.js, same trim-
// only pipeline as NAME_BADGE_PILL_IMAGE above) — apps/mobile's modal shells stretch one of these
// behind their content instead of a plain white card. "Small" (landscape, BADGE-RECT-01A-dup) is
// for compact confirm-style dialogs; "large" (portrait, BADGE-RECT-01B) is for taller scrollable
// panels like the dev-tuning modal.
// "Small" now points at the green-felt/mahogany-frame candidate (2026-08-15, packages/ui/assets/
// modal/) — the original modal-card-small.png stays on disk unused, same keep-the-unused-
// candidates precedent as this repo's other asset swaps (e.g. the card-back image). Of the 4 new
// candidates, only this one (plus the mahogany-wood and glass-panel-glow ones) is a genuinely
// opaque panel — the folder's 4th, deep-charcoal-glass one is actually a transparent alpha-cut
// frame (near-0 alpha center) and breaks this single-image stretch usage if swapped in directly.
export const MODAL_CARD_SMALL_IMAGE: number = require("../assets/plaques/modal-card-small-green-felt.png");
export const MODAL_CARD_SMALL_ASPECT_RATIO = 942 / 630;
export const MODAL_CARD_LARGE_IMAGE: number = require("../assets/plaques/modal-card-large.png");
export const MODAL_CARD_LARGE_ASPECT_RATIO = 874 / 1462;
export const NAME_BADGE_PILL_ASPECT_RATIO = 1080 / 417;
// A carved mahogany-burgundy plaque (opaque rectangle, own black bezel baked in — not alpha-cut)
// meant to sit as a bottom bar/sign. Same re-export-as-raw-handle reasoning as the AVATAR_FRAME_*
// images above.
export const MAHOGANY_PLAQUE_IMAGE: number = require("../assets/table/default/TABLE-PLAQUE-MAHOGANY-BURGUNDY-WOOD.png");
// Bottom/left/right dead transparent canvas trimmed 2026-08-15 (top kept, matching this plaque's
// sibling variants in the same folder) — this ratio is the trimmed file's real 1449x976, not the
// original 1537x1023.
export const MAHOGANY_PLAQUE_ASPECT_RATIO = 1449 / 976;

// A three-layer "New Design" table surface, meant to stack bottom-to-top: TABLE_BACKDROP_GLASS_
// GOLD_GLOW_IMAGE (opaque, full-bleed ambient glass/gold-glow — the same "TRY-02-GLOW" ambient
// look as TABLE-FELT-PANEL-TRY-02-GLOW.png, but never alpha-cut) behind everything; TABLE_FELT_
// INSERT_MAHOGANY_BURGUNDY_IMAGE (alpha-cut: transparent rounded-rect cutout, opaque green felt
// fill) as the playing surface; TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE (alpha-cut the other
// way — hollow transparent center, opaque wood border with an integrated bottom plaque/sign baked
// into its own lower edge) on top. Frame and felt insert share identical 941x1672 source pixels
// (own aspect ratio below) so they align exactly when stacked at the same size; the frame's own
// baked-in plaque means this design needs neither HandFrame nor MAHOGANY_PLAQUE_IMAGE for its own
// bottom decoration.
export const TABLE_BACKDROP_GLASS_GOLD_GLOW_IMAGE: number = require("../assets/table/default/TABLE-BACKDROP-GLASS-GOLD-GLOW.png");
export const TABLE_FELT_INSERT_MAHOGANY_BURGUNDY_IMAGE: number = require("../assets/table/default/TABLE-FELT-INSERT-MAHOGANY-BURGUNDY.png");
// The original (untrimmed) 941x1672 file — deliberately NOT the "-trimmed" crop DefaultTableFrame
// uses (packages/ui/src/DefaultTableFrame.tsx, which requires that file directly, independent of
// this export): this export is paired pixel-for-pixel with other 941x1672 assets that share its
// exact canvas (TABLE_FELT_INSERT_MAHOGANY_BURGUNDY_IMAGE above, and the swappable interiors in
// MahoganyTableSurface.tsx) — cropping this one's canvas without cropping its partners identically
// would shift the frame's hollow window out of alignment with their opaque content. The trimmed
// crop only matters for DefaultTableFrame's own standalone full-bleed-stretch usage, which has no
// such alignment constraint (see that file's own doc comment for why the ~34px/33px dead
// transparent margin was safe to remove there).
export const TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE: number = require("../assets/table/default/TABLE-FRAME-MAHOGANY-BURGUNDY-photoroom.png");
export const TABLE_FRAME_INSERT_ASPECT_RATIO = 1000 / 2000;
// The frame image's own real pixel dimensions (read from its PNG IHDR, not eyeballed) — for
// callers that need the raw width/height rather than a precomputed ratio, e.g. BottomAnchoredImage's
// assetWidth/assetHeight props.
export const TABLE_FRAME_MAHOGANY_BURGUNDY_WIDTH = 941;
export const TABLE_FRAME_MAHOGANY_BURGUNDY_HEIGHT = 1672;
