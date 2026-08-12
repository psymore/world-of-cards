export { PlayingCard, CARD_DIMS, SUIT_COLOR } from './PlayingCard';
export type { PlayingCardProps, PlayingCardSize, PlayingCardBorderSpec, PlayingCardOverlayImage } from './PlayingCard';
export { SuitIcon } from './SuitIcon';
export type { SuitIconProps } from './SuitIcon';
export { TableFelt } from './TableFelt';
export { GeminiTableBackground } from './GeminiTableBackground';
export { TableWoodCorners } from './TableWoodCorners';
export type { TableWoodCornersProps, Corner } from './TableWoodCorners';
export { TableEdgeRails } from './TableEdgeRails';
export type { TableEdgeRailsProps, Edge } from './TableEdgeRails';
export { HandFrame, HAND_FRAME_ASPECT_RATIO, HAND_FRAME_PEAK_FRACTION } from './HandFrame';
export type { HandFrameProps } from './HandFrame';
export { HeaderWoodFrame } from './HeaderWoodFrame';
export type { HeaderWoodFrameProps } from './HeaderWoodFrame';
export { SettingsIcon } from './SettingsIcon';
export type { SettingsIconProps } from './SettingsIcon';
export { PressableFeedback } from './PressableFeedback';
export type { PressableFeedbackProps } from './PressableFeedback';
export { AbsoluteOverlay } from './AbsoluteOverlay';
export { CourtCardFrame } from './CourtCardFrame';
export type { CourtCardFrameProps } from './CourtCardFrame';
export { glowShadow } from './glowShadow';
export { FONTS, CARD_RANK_FONT_FAMILY } from './fonts';
export {
  WOOD_TRIM_COLOR,
  WOOD_DEFAULT_LIGHT,
  WOOD_DEFAULT_DARK,
  WOOD_GRAIN_COLOR,
  WOOD_TRIM_STROKE_OPACITY,
  WOOD_TRIM_STROKE_WIDTH,
} from './woodPalette';
export {
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
} from './handAreaLayout';
export { TableShell, TABLE_SHELL_ASPECT_RATIO } from './TableShell';
export type { TableShellProps, TableSeatPosition } from './TableShell';
export { SeatIdentity } from './SeatIdentity';
// The per-turn-state avatar ring art, re-exported as plain asset handles so consuming apps can
// build a SeatIdentityTurnStateFrames object without reaching into this package's asset folder
// directly: package.json's `exports` map only publishes "." (./src/index.ts), so a consumer-side
// require('@world-cards/ui/assets/table/avatar-frame-idle.png') is not a resolvable subpath.
export const AVATAR_FRAME_IDLE_IMAGE: number = require('../assets/table/avatar-frame-idle.png');
export const AVATAR_FRAME_NEXT_IMAGE: number = require('../assets/table/avatar-frame-next.png');
export const AVATAR_FRAME_ACTIVE_IMAGE: number = require('../assets/table/avatar-frame-active.png');
export type {
  SeatIdentityProps,
  SeatIdentityOrientation,
  SeatIdentityAvatar,
  SeatIdentityTurnState,
  SeatIdentityTurnStateFrames,
} from './SeatIdentity';
