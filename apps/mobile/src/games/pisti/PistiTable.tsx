import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { Card } from "@world-of-cards/engine";
import type { PistiState } from "@world-of-cards/engine/games/pisti";
import {
  PlayingCard,
  TableShell,
  TABLE_SHELL_ASPECT_RATIO,
  SeatIdentity,
  TableFelt,
  MahoganyTableSurface,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  CARD_DIMS,
  CONTAINER_BOTTOM_PADDING,
  HAND_BADGE_HEIGHT,
  HAND_FRAME_REVEAL_MARGIN,
  HAND_FRAME_BOTTOM_OVERSHOOT,
  WOOD_TRIM_COLOR,
  AVATAR_FRAME_IDLE_IMAGE,
  AVATAR_FRAME_ACTIVE_IMAGE,
  MAHOGANY_PLAQUE_IMAGE,
  MAHOGANY_PLAQUE_ASPECT_RATIO,
  TABLE_BACKDROP_GLASS_GOLD_GLOW_IMAGE,
  TABLE_FELT_INSERT_MAHOGANY_BURGUNDY_IMAGE,
  TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE,
  TABLE_FRAME_INSERT_ASPECT_RATIO,
  TABLE_FRAME_MAHOGANY_BURGUNDY_WIDTH,
  TABLE_FRAME_MAHOGANY_BURGUNDY_HEIGHT,
  BottomAnchoredImage,
  BODY_REGULAR,
  BODY_SEMIBOLD,
} from "@world-of-cards/ui";
import type {
  SeatIdentityTurnState,
  SeatIdentityAvatar,
  SeatIdentityTurnStateFrames,
  TableSeatPosition,
} from "@world-of-cards/ui";
import { DeselectableSurface } from "../../components/DeselectableSurface";
import { useCardSelection } from "../../components/useCardSelection";
import { PlayerBadge } from "../../table/PlayerBadge";
import { turnStateForSeat } from "../../table/turnState";
import {
  OpponentSeatGroup,
  seatLayoutStyles,
} from "../../table/OpponentSeatGroup";
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from "./pistiSeating";
import type { Seat } from "./pistiSeating";
import { TravelCard } from "../../table/TravelCard";
import { DealFlightOverlay } from "../../table/DealFlightOverlay";
import type { DealFlightSeat } from "../../table/DealFlightOverlay";
import type { DealPhase } from "../../hooks/useDealSequence";
import { PistiHandFan, pistiCardRotationDeg } from "./table/PistiHandFan";
import { useCardMotion } from "../../table/useCardMotion";
import { useDevTuningStore } from "../../state/devTuningStore";
import type { PistiTableBackground } from "../../state/devTuningStore";

// The real per-state ring art (idle/active), replacing SeatIdentity's default glowShadow
// placeholder — see docs/superpowers/specs/2026-08-12-pisti-table-shell-pilot-design.md Decision 4.
// Sourced via named exports from @world-of-cards/ui rather than a direct
// require('@world-of-cards/ui/assets/...') — that package's `exports` map only publishes ".", so the
// asset subpath isn't resolvable from a consuming app. SeatIdentityTurnStateFrames still requires
// a 'next' key (SeatIdentity itself keeps its own 3-state ring, see turnState.ts's header comment
// for why the two components diverged) — mapped to the idle frame since turnStateForPlayer below
// never actually produces 'next' anymore, this is just satisfying the shared type.
const PISTI_TURN_STATE_FRAMES: SeatIdentityTurnStateFrames = {
  idle: AVATAR_FRAME_IDLE_IMAGE,
  next: AVATAR_FRAME_IDLE_IMAGE,
  active: AVATAR_FRAME_ACTIVE_IMAGE,
};

export interface PistiRevealCard {
  card: Card;
  playerId: string;
  originOffset?: { x: number; y: number };
  // The human's real fan-rotation angle at the moment this card was played, held fixed for the
  // whole flight and kept once landed (see pileRestingRotations below) — undefined/0 for AI plays
  // (no rendered AI hand card to derive an angle from, so they always land flat).
  originRotateDeg?: number;
}

export interface PistiTableProps {
  state: PistiState;
  humanPlayerId: string;
  // Ordered opponent seats: 1 entry seats them at the top (2-player table), 3 entries seat
  // them left/top/right around the human (4-player table).
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  onPlayCard: (
    cardId: string,
    originOffset?: { x: number; y: number },
    originRotateDeg?: number,
  ) => void;
  bannerText?: string | null;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  // Each already-landed pile card's angle, keyed by card id — kept once a human-played card lands
  // (see PistiScreen.tsx), so the pile reads as a natural, slightly messy stack instead of every
  // card snapping flat the instant it's buried. Defaults to {} (today's flat-everywhere look) so
  // callers that don't pass it (tests) are unaffected.
  pileRestingRotations?: Record<string, number>;
}

// How many of the most recent pile cards to render stacked, plus one extra slot reserved
// for the in-flight reveal card. Older cards are fully covered anyway, so capping this
// keeps the pile view cheap even late in a hand.
const MAX_STACKED_PILE_CARDS = 5;

// Precomputed per-index offsets so stacking cost is a plain array lookup, not per-render math.
const PILE_CARD_OFFSETS = Array.from(
  { length: MAX_STACKED_PILE_CARDS + 1 },
  (_, i) => ({
    x: i * 6,
    y: i * -4.5,
  }),
);

const SMALL_CARD_WIDTH = CARD_DIMS.small.width;
const SMALL_CARD_HEIGHT = CARD_DIMS.small.height;
// Opponent hands render flat (no rotation/curve). Spacing auto-scales via fillWidthMarginPx: a
// small hand (Pişti's max-4 opponent cards) spreads into an evenly-gapped row (capped at
// *_MAX_GAP so it doesn't look sparse); a larger hand compresses into overlap automatically as
// count grows — one continuous rule instead of two separate "row" vs. "fan" modes.
const TOP_FAN_WIDTH_FRACTION = 0.85; // fraction of window width the top seat's row may use
const TOP_FAN_MAX_GAP = 10;
const SIDE_STACK_HEIGHT_FRACTION = 0.82; // fraction of the measured middle-row height the side stack may use
const SIDE_FAN_MAX_GAP = 10;

// Mirrors TableShell's own `tableBox: { height: '92%', aspectRatio: TABLE_SHELL_ASPECT_RATIO }`
// (packages/ui/src/TableShell.tsx) — the box is height-driven, width follows from aspectRatio.
// TableShell exposes no ref or onLayout for its box, so the only way to position anything against
// that box from out here is to recompute its geometry from the container size the same way
// TableShell's own styles do. Keep in sync if that height fraction ever changes.
const TABLE_BOX_HEIGHT_FRACTION = 0.92;
// Where handStackOverlay's top/bottom edges and middleRow's left/right edges sit, as fractions of
// the TABLE BOX's own height/width (not the container's) — the box is what the baked plaque
// anchors are relative to, so these are the only numbers that keep the card stacks clear of the
// plaques at every viewport shape. Top lands just under the top plaque (whose lower edge is at
// 5% + 4.6% = 9.6% of box height per TableShell's SEAT_ANCHOR_STYLE); bottom shortens the middle
// row — the side stacks size themselves from its measured height — enough that their lower ends
// clear the human's plaque; the middle-row fraction pushes the side columns inboard of the side
// plaques. All three were chosen to reproduce the visually-verified 412x915 layout the earlier
// static percentages happened to produce there; unlike those, they now hold at any aspect ratio.
const STACK_OVERLAY_TOP_FRACTION = 0.1;
const STACK_OVERLAY_BOTTOM_FRACTION = 0.12;
const MIDDLE_ROW_INSET_BOX_FRACTION = 0.185;

// Named because two places need them: styles.pileMat/pileStack themselves, and the reveal layer's
// positioning ghost (styles.revealPileMatGhost), which only lands the traveling card correctly
// while it matches the real mat exactly.
const PILE_MAT_WIDTH = 195;
const PILE_MAT_HEIGHT = 225;
const PILE_STACK_WIDTH = 114;
const PILE_STACK_HEIGHT = 144;

// Where the human's hand fan sits, measured directly against table-shell-surface.png's actual
// green-felt pixels (sampled with sharp: felt spans roughly y 11.7%-83.1% of the box, narrowing
// sharply below ~y 80% as the oval tapers toward the bottom rim) — the hand renders inside
// TableShell's felt now, not on its own black backdrop below the table, so its anchor has to stay
// clear of the wood frame rather than just centering in a fixed-height strip. BOTTOM_FRACTION
// stops short of the measured 83.1% felt edge for margin; WIDTH_FRACTION matches the felt's width
// around y 70-75% (~58-61%), before it narrows further approaching the bottom.
const HAND_FAN_FELT_BOTTOM_FRACTION = 0.8;
const HAND_FAN_FELT_WIDTH_FRACTION = 0.58;

// Everything below is only used by the LEGACY table shape ('felt' | 'stretchedFelt' —
// see devTuningStore.ts's PistiTableBackground), reintroduced for the Dev Tuning "Table
// Background" comparison after the TableShell pilot replaced this as Pişti's default layout.
// Kept as a genuinely separate render path (see the pistiTableBackground branch in PistiTable
// below) rather than threaded through the new layout's own constants/styles, since the two
// shapes place the human's nameplate, hand, and banner in entirely different places (own dedicated
// areas below the table vs. inside TableShell's felt) — trying to parameterize one shared tree
// for both would obscure both.

// A plain felt panel (no carved wood frame) stretched to fill the whole screen non-uniformly —
// unlike TableShell's ornate merged asset, a flat texture has no fine detail for a non-uniform
// stretch to visibly distort.
const LEGACY_STRETCHED_FELT_IMAGE = require("../../../assets/pisti-legacy-felt-stretch.png");

// A carved-frame green felt panel (source: TABLE-FELT-PANEL-TRY-02-GLOW.png, docs/references/
// GPT-powerful-assets-review/assets-v1/ — same "TRY-02-GLOW" pass TableShell's own surface asset
// came from) — like TableFelt, covered (not stretched) over the full legacy
// table area so its own aspect ratio is preserved instead of distorted.
const LEGACY_REVISITED_IMAGE = require("../../../assets/pisti-legacy-revisited.png");

// First-pass constants for positioning HandFrame behind the human hand row, derived from this
// file's own layout below (not measured on a real device — tune these if the frame's arch peak
// doesn't line up with the hand row once visually checked). Simpler than Batak's version: Pişti's
// human hand is a single flat row (no curve/second row), so its "peak" is just the row's own top
// edge, uniform across every card.
const LEGACY_HUMAN_CARD_HEIGHT = CARD_DIMS.normal.height;
const LEGACY_HAND_AREA_HEIGHT = 177; // matches styles.legacyHandArea.minHeight
const LEGACY_HAND_CONTENT_HEIGHT = HAND_BADGE_HEIGHT + LEGACY_HUMAN_CARD_HEIGHT;
const LEGACY_HAND_AREA_TOP_INSET =
  (LEGACY_HAND_AREA_HEIGHT - LEGACY_HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit, since
// absolute positioning ignores the container's own paddingVertical) up to the hand row's top edge.
const LEGACY_HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING +
  LEGACY_HAND_AREA_HEIGHT -
  LEGACY_HAND_AREA_TOP_INSET -
  HAND_BADGE_HEIGHT;

// Pişti's nameplate shows a captured-card count (🂠 N) rather than Batak's bid/tricks text — each
// game formats its own statusText string, the shared SeatIdentity just lays it out.
function capturedStatusText(capturedCount: number): string {
  return `🂠 ${capturedCount}`;
}

// Real turn order from engine state, replacing the Playground prototype's clockwise-seat-order
// approximation — derives from state.players/state.currentPlayerIndex, which is already a plain
// round-robin (packages/engine/src/games/pisti/rules.ts's nextIndex derivation).
export function turnStateForPlayer(
  playerId: string,
  state: PistiState,
): SeatIdentityTurnState {
  return turnStateForSeat(playerId, state.players, state.currentPlayerIndex);
}

// Fixed by seat position, not derived from player identity (docs/superpowers/specs/2026-08-12-
// pisti-table-shell-pilot-design.md Decision 6) — the simplest deterministic scheme. top/bottom
// are the only two seats live in the default 2-player game (human always at "bottom", see
// pistiSeating.ts's own header comment) — "Computer" and "You" respectively — which is why both
// share the new self-framed avatar-female01-Photoroom.png art (SeatIdentity's
// SELF_FRAMED_AVATARS) rather than each getting a distinct face like the 3/4-player left/right
// seats do.
export const AVATAR_BY_POSITION: Record<
  "top" | "left" | "right" | "bottom",
  SeatIdentityAvatar
> = {
  top: "female-01-photoroom",
  left: "male-01",
  right: "male-02",
  bottom: "female-01-photoroom",
};

// The opponent's face-down card stack only. The nameplate half of what used to be one combined
// `OpponentSeat` now renders separately via renderOpponentNameplate below, because the two halves
// no longer live in the same place on screen: nameplates are handed to TableShell, which draws
// them inside its own baked plaque anchors, while the card stacks stay in this file's own
// top-row/middle-row flex layout.
interface OpponentHandStackProps {
  seat: Seat;
  state: PistiState;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  // Measured height of the middle row (see PistiTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentHandStack({
  seat,
  state,
  revealCard,
  dealPhase,
  sideStackHeight,
}: OpponentHandStackProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  // No face-down cards render until the deal-flight animation finishes, so the opponent's hand
  // doesn't pop in ahead of the cards that are still visually traveling toward them.
  const count =
    dealPhase !== "revealing"
      ? 0
      : Math.max(isRevealing ? hand.length - 1 : hand.length, 0);

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(
        SMALL_CARD_HEIGHT,
        count,
        sideStackHeight * SIDE_STACK_HEIGHT_FRACTION,
        SIDE_FAN_MAX_GAP,
      )
    : fillWidthMarginPx(
        SMALL_CARD_WIDTH,
        count,
        windowWidth * TOP_FAN_WIDTH_FRACTION,
        TOP_FAN_MAX_GAP,
      );
  // Precomputed per-index style array (stable reference when count/cardMargin/isSide don't
  // change) so PlayingCard's React.memo can still skip re-rendering unchanged face-down cards —
  // the same reasoning as the PILE_CARD_OFFSETS array above, just computed dynamically instead
  // of statically since the margin now depends on measured layout.
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0
          ? undefined
          : isSide
            ? { marginTop: cardMargin }
            : { marginLeft: cardMargin },
      ),
    [count, cardMargin, isSide],
  );

  return (
    <View
      style={[
        styles.opponentArea,
        isSide ? seatLayoutStyles.opponentAreaSide : styles.opponentAreaTop,
      ]}>
      <View
        style={isSide ? styles.opponentColumn : styles.opponentRow}
        testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}

interface LegacyOpponentSeatProps {
  seat: Seat;
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  sideStackHeight: number;
}

// Combined nameplate + card stack, exactly as Pişti rendered its opponents before the TableShell
// pilot — kept only for the legacy Dev Tuning table-background options (see
// LEGACY_STRETCHED_FELT_IMAGE's doc above), which use the old felt-panel/black-backdrop
// look with no baked plaque anchors for OpponentHandStack + renderOpponentNameplate to target.
function LegacyOpponentSeat({
  seat,
  state,
  playerNames,
  revealCard,
  dealPhase,
  sideStackHeight,
}: LegacyOpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  const count =
    dealPhase !== "revealing"
      ? 0
      : Math.max(isRevealing ? hand.length - 1 : hand.length, 0);
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(
        SMALL_CARD_HEIGHT,
        count,
        sideStackHeight * SIDE_STACK_HEIGHT_FRACTION,
        SIDE_FAN_MAX_GAP,
      )
    : fillWidthMarginPx(
        SMALL_CARD_WIDTH,
        count,
        windowWidth * TOP_FAN_WIDTH_FRACTION,
        TOP_FAN_MAX_GAP,
      );
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0
          ? undefined
          : isSide
            ? { marginTop: cardMargin }
            : { marginLeft: cardMargin },
      ),
    [count, cardMargin, isSide],
  );

  return (
    <View
      style={[
        styles.opponentArea,
        isSide
          ? seatLayoutStyles.opponentAreaSide
          : styles.legacyOpponentAreaTop,
      ]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={capturedStatusText(capturedCount)}
        turnState={turnStateForSeat(playerId, state.players, state.currentPlayerIndex)}
        isHuman={false}
        compact={isSide}
      />
      <View
        style={isSide ? styles.opponentColumn : styles.opponentRow}
        testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}

// The nameplate half of the old OpponentSeat: a plain function (not a component) because its
// output is handed to TableShell as a `seats` entry, which renders it inside its own anchor View
// — there's no separate element for a component wrapper to own here.
function renderOpponentNameplate(
  seat: Seat,
  state: PistiState,
  playerNames: Record<string, string>,
) {
  const { position, playerId } = seat;
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const orientation =
    position === "left"
      ? "rotated-left"
      : position === "right"
        ? "rotated-right"
        : "horizontal";
  return (
    <SeatIdentity
      name={playerNames[playerId] ?? playerId}
      statusText={capturedStatusText(capturedCount)}
      orientation={orientation}
      avatar={AVATAR_BY_POSITION[position]}
      turnState={turnStateForPlayer(playerId, state)}
      turnStateFrames={PISTI_TURN_STATE_FRAMES}
    />
  );
}

export function PistiTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  onPlayCard,
  bannerText,
  revealCard,
  dealPhase,
  pileRestingRotations = {},
}: PistiTableProps) {
  // __DEV__ hook usage is unconditional (required by React's Rules of Hooks); the value only
  // affects which render tree below actually gets returned.
  const pistiTableBackground = useDevTuningStore(s => s.pistiTableBackground);
  const tableSurfaceMaterial = useDevTuningStore(s => s.tableSurfaceMaterial);
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  // While the human's own play is revealing (traveling to the pile), the engine state hasn't
  // committed the move yet, so `isHumanTurn` alone would still say it's their turn. Hide the
  // in-flight card from the hand row (it's already rendered via TravelCard at the pile) and treat
  // the hand as non-interactive until the move actually commits.
  const isHumanRevealing =
    revealCard != null && revealCard.playerId === humanPlayerId;
  const isHumanInteractive = isHumanTurn && !isHumanRevealing;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    card => !(isHumanRevealing && card.id === revealCard!.card.id),
  );
  const pile = state.table.zones["pile"].cards;
  const stackedPile = pile.slice(-MAX_STACKED_PILE_CARDS);
  // Where the just-played card actually ends up once it commits and joins `pile`: stackedPile
  // always renders the newest card at its own last index, which is `pile.length` (pre-commit)
  // while the stack is still filling up, then pins to MAX_STACKED_PILE_CARDS - 1 once the pile
  // has enough cards that older ones start falling out of the slice(-N) window. RevealCard's
  // flight must target this same slot — a fixed "reserved 6th slot" only coincidentally matched
  // it once the pile already held 5+ cards, and was off by one slot even then, so the flight
  // eased to a stop at the wrong spot and then snapped to the real one once the card committed.
  const revealDestinationOffset =
    PILE_CARD_OFFSETS[Math.min(pile.length, MAX_STACKED_PILE_CARDS - 1)];
  const capturedHuman =
    state.table.zones[`captured-${humanPlayerId}`].cards.length;

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(
    playWithMeasuredOrigin,
  );
  useEffect(() => {
    if (!isHumanTurn) clearSelection();
  }, [isHumanTurn, clearSelection]);

  const seats = assignSeats(opponentPlayerIds);

  // Every seat's nameplate, keyed by the table position TableShell draws it at. The human's is
  // built inline (its data comes straight from this function's own scope); the opponents' come
  // from renderOpponentNameplate, which each seat's own zones supply.
  const tableShellSeats: Partial<Record<TableSeatPosition, React.ReactNode>> = {
    bottom: (
      <SeatIdentity
        name={playerNames[humanPlayerId] ?? "You"}
        statusText={capturedStatusText(capturedHuman)}
        avatar={AVATAR_BY_POSITION.bottom}
        turnState={turnStateForPlayer(humanPlayerId, state)}
        turnStateFrames={PISTI_TURN_STATE_FRAMES}
      />
    ),
  };
  for (const seat of seats) {
    tableShellSeats[seat.position] = renderOpponentNameplate(
      seat,
      state,
      playerNames,
    );
  }

  // Side seats live inside a centered (non-stretching) flex row, so there's no way to derive
  // their available vertical space from window height alone — measure the row itself. 280 is a
  // reasonable pre-layout guess (corrected after the first onLayout pass), the same pattern
  // BatakTable's handAreaWidth already uses for its own width-fill measurement.
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }

  // Same measure-don't-assume pattern, for the card-stack overlay's insets. TableShell's box
  // derives BOTH its height and its centering offsets from the container's *height* now (height:
  // 92%, then aspectRatio determines width), so a container-relative percentage inset only
  // tracks the plaques at whatever single viewport shape it was eyeballed at. Measuring tableArea
  // lets the insets be real pixels off the box's real edges instead.
  const [tableAreaSize, setTableAreaSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  function handleTableAreaLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setTableAreaSize(prev =>
      prev?.width === width && prev?.height === height
        ? prev
        : { width, height },
    );
  }
  // Null until the first layout pass; styles.handStackOverlay's/styles.middleRowInset's own
  // percentages stand in until then (close enough at phone shapes that there's no visible
  // settle), and these pixel values override them once the real box geometry is known.
  const stackOverlayInsets = useMemo(() => {
    if (!tableAreaSize) return null;
    // Height-driven, but clamped to width: table-shell-surface.png is portrait (aspectRatio
    // 1024/1536 ≈ 0.667), while a typical phone's own available area is comparably narrow —
    // once tableArea's height approaches most of the screen (reclaiming the old separate hand
    // area's space), a height-only derivation's implied width (height * aspectRatio) exceeds the
    // screen's actual width. Deriving from whichever axis is actually tighter keeps the box
    // fully on-screen either way, instead of assuming height is always the constraint.
    const desiredBoxHeight = tableAreaSize.height * TABLE_BOX_HEIGHT_FRACTION;
    const desiredBoxWidth = desiredBoxHeight * TABLE_SHELL_ASPECT_RATIO;
    const maxBoxWidth = tableAreaSize.width * TABLE_BOX_HEIGHT_FRACTION;
    const boxWidth = Math.min(desiredBoxWidth, maxBoxWidth);
    const boxHeight = boxWidth / TABLE_SHELL_ASPECT_RATIO;
    // TableShell's own tableBox is `{ height: '92%', aspectRatio }` — it always derives width
    // from whatever height ITS container gives it, never the other way around. So to make it
    // land on the boxWidth computed above (clamped or not), tableShellWrapperHeight below hands
    // TableShell a container height such that 92% of that height equals this boxHeight exactly;
    // TableShell's own aspectRatio math then reproduces boxWidth on its own, no CSS-side width/
    // height conflict ever arises (avoiding the ambiguity of trying to constrain both an explicit
    // height AND a max-width on the same box directly).
    const tableShellWrapperHeight = boxHeight / TABLE_BOX_HEIGHT_FRACTION;
    // TableShell centers the box on both axes in the container (backdrop's alignItems/
    // justifyContent: 'center'). Deliberately unclamped: on a narrow/tall container the box is
    // wider than the space it's given and overflows evenly left and right (and likewise top/
    // bottom on a short/wide one), so these go negative and the insets have to follow the box out
    // of bounds, or they'd snap back to tracking the container again exactly in the cases this
    // fix exists for.
    const boxTop = (tableAreaSize.height - boxHeight) / 2;
    const spaceBelowBox = tableAreaSize.height - boxTop - boxHeight;
    const boxLeft = (tableAreaSize.width - boxWidth) / 2;
    // Pile's own footprint is fixed pixels (PILE_MAT_HEIGHT), not a box fraction, so its bottom
    // edge (it's centered in the box via TableShell's centerContent) has to be computed the same
    // way here to find where the hand fan can safely start below it.
    const pileBottomY = boxTop + boxHeight / 2 + PILE_MAT_HEIGHT / 2;
    const feltBottomY = boxTop + boxHeight * HAND_FAN_FELT_BOTTOM_FRACTION;
    const handFanWidth = boxWidth * HAND_FAN_FELT_WIDTH_FRACTION;
    return {
      tableShellWrapperHeight,
      vertical: {
        top: boxTop + boxHeight * STACK_OVERLAY_TOP_FRACTION,
        bottom: spaceBelowBox + boxHeight * STACK_OVERLAY_BOTTOM_FRACTION,
      },
      middleRowPaddingHorizontal:
        boxLeft + boxWidth * MIDDLE_ROW_INSET_BOX_FRACTION,
      handFanAnchor: {
        top: pileBottomY,
        left: boxLeft + (boxWidth - handFanWidth) / 2,
        width: handFanWidth,
        height: Math.max(feltBottomY - pileBottomY, 0),
      },
    };
  }, [tableAreaSize]);

  // Where pileStack sits inside pileMat, measured because it isn't derivable: pileMat centers
  // pileStack together with the `N cards` label below it, so the stack's offset depends on that
  // text's rendered line height. The hoisted reveal layer (see the render tree) has to reproduce
  // this offset exactly, since the reveal card's translateX/Y are expressed in pileStack's
  // coordinate space. Defaults are the horizontal centering (195-114)/2 and the label-free
  // vertical centering, both corrected on the first layout pass.
  const [pileStackOffset, setPileStackOffset] = useState({
    x: (PILE_MAT_WIDTH - PILE_STACK_WIDTH) / 2,
    y: (PILE_MAT_HEIGHT - PILE_STACK_HEIGHT) / 2,
  });
  function handlePileStackLayout(event: LayoutChangeEvent) {
    const { x, y } = event.nativeEvent.layout;
    setPileStackOffset(prev =>
      prev.x === x && prev.y === y ? prev : { x, y },
    );
  }

  // Destination for the human's play-travel origin delta: the pile's on-screen center,
  // measured live (not derived from layout constants — see the design doc for why analytical
  // computation was rejected) and re-measured on every layout pass so window resize/rotation
  // can't leave it stale.
  const destRef = useRef<View>(null);
  const [destCenter, setDestCenter] = useState<{ x: number; y: number } | null>(
    null,
  );
  function handlePileMatLayout() {
    destRef.current?.measureInWindow((x, y, width, height) => {
      setDestCenter({ x: x + width / 2, y: y + height / 2 });
    });
  }

  const handFanRef = useRef<View>(null);
  const [handFanOrigin, setHandFanOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  function handleHandFanLayout() {
    handFanRef.current?.measureInWindow((x, y, width) => {
      setHandFanOrigin({ x: x + width / 2, y });
    });
  }

  const handMotionRef = useRef(
    new Map<string, ReturnType<typeof useCardMotion>>(),
  ).current;
  const registerHandMotion = useCallback(
    (cardId: string, motion: ReturnType<typeof useCardMotion> | null) => {
      if (motion) handMotionRef.set(cardId, motion);
      else handMotionRef.delete(cardId);
    },
    [handMotionRef],
  );

  // Replaces a direct onPlayCard(cardId) call: reads the tapped card's real, currently-committed
  // motion (position it's actually rendered at, lift included) directly from its own useCardMotion
  // controller, converted into a delta from the pile's measured center — no DOM re-derivation, no
  // staleness risk (mirrors BatakTable's playWithMeasuredOrigin, post-fix — see
  // docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §3). Falls back to
  // a plain onPlayCard(cardId) call (no origin — the pile-landing flight then uses the fixed
  // 'bottom' offset, same as today) whenever any measurement isn't ready, which is always the case
  // in this project's Jest/RNTL tests (host refs never resolve there) and is a defensive path on a
  // real device too.
  function playWithMeasuredOrigin(cardId: string) {
    const index = humanHand.findIndex(c => c.id === cardId);
    if (!handFanOrigin || !destCenter || index < 0) {
      onPlayCard(cardId);
      return;
    }
    const originRotateDeg = pistiCardRotationDeg(index, humanHand.length);
    const motion = handMotionRef.get(cardId);
    if (!motion) {
      onPlayCard(cardId);
      return;
    }
    const values = motion.getValues();
    onPlayCard(
      cardId,
      {
        x: handFanOrigin.x + values.x - destCenter.x,
        y: handFanOrigin.y + values.y - destCenter.y,
      },
      originRotateDeg,
    );
  }

  // Deal order: human first, then opponents in existing turn order. Card counts come from the
  // real dealt hand size, not a hardcoded 4, so this stays correct for both the 2-player and
  // 4-player table.
  const dealSeats: DealFlightSeat[] = [
    {
      origin: "bottom",
      cardCount: state.table.zones[`hand-${humanPlayerId}`].cards.length,
    },
    ...opponentPlayerIds.map(playerId => ({
      origin: resolveRevealOrigin(playerId, humanPlayerId, seats),
      cardCount: state.table.zones[`hand-${playerId}`].cards.length,
    })),
  ];

  if (pistiTableBackground !== "tableShell") {
    // Legacy shape: pre-TableShell-pilot layout (own dedicated hand/banner areas, PlayerBadge
    // nameplates) with a swappable full-bleed background — see LEGACY_STRETCHED_FELT_IMAGE's doc
    // comment above for why this is a genuinely separate tree rather than a parameterization of
    // the 'tableShell' tree below. HandFrame (the carved-wood arch behind the hand row) is only
    // drawn for 'felt': on stretchedFelt its wood tone clashed with that background, so
    // it's skipped there rather than styled to match. 'legacyRevisited' gets its own dedicated
    // bottom plaque instead (MAHOGANY_PLAQUE_IMAGE, below) rather than reusing HandFrame.
    const legacyHandFramePeakTarget =
      LEGACY_HAND_ROW_PEAK_DISTANCE_FROM_BOTTOM + HAND_FRAME_REVEAL_MARGIN;
    const legacyHandFrameBottomOffset = -HAND_FRAME_BOTTOM_OVERSHOOT;
    const legacyHandFrameHeight =
      (legacyHandFramePeakTarget + HAND_FRAME_BOTTOM_OVERSHOOT) /
      (1 - HAND_FRAME_PEAK_FRACTION);

    return (
      <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
        {pistiTableBackground === "stretchedFelt" ? (
          <Image
            source={LEGACY_STRETCHED_FELT_IMAGE}
            resizeMode="stretch"
            style={styles.legacyFullBleedBackground}
          />
        ) : pistiTableBackground === "legacyRevisited" ? (
          <Image
            source={LEGACY_REVISITED_IMAGE}
            resizeMode="cover"
            style={styles.legacyFullBleedBackground}
          />
        ) : pistiTableBackground === "newDesign" ? (
          <View style={styles.newDesignLayer}>
            <Image
              source={TABLE_BACKDROP_GLASS_GOLD_GLOW_IMAGE}
              resizeMode="cover"
              style={styles.legacyFullBleedBackground}
            />
            <View style={styles.newDesignSurfaceBox}>
              <Image
                source={TABLE_FELT_INSERT_MAHOGANY_BURGUNDY_IMAGE}
                resizeMode="stretch"
                style={[
                  StyleSheet.absoluteFill,
                  styles.legacyMahoganyPlaqueFill,
                ]}
              />
              <Image
                source={TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE}
                resizeMode="stretch"
                style={[
                  StyleSheet.absoluteFill,
                  styles.legacyMahoganyPlaqueFill,
                ]}
              />
            </View>
          </View>
        ) : pistiTableBackground === "frameOnly" ? (
          <MahoganyTableSurface material={tableSurfaceMaterial} />
        ) : (
          <TableFelt />
        )}
        <OpponentSeatGroup
          position="top"
          seats={seats}
          renderSeat={seat => (
            <LegacyOpponentSeat
              seat={seat}
              state={state}
              playerNames={playerNames}
              revealCard={revealCard}
              dealPhase={dealPhase}
              sideStackHeight={middleRowHeight}
            />
          )}
        />

        <View
          style={seatLayoutStyles.middleRow}
          onLayout={handleMiddleRowLayout}>
          <OpponentSeatGroup
            position="left"
            seats={seats}
            renderSeat={seat => (
              <LegacyOpponentSeat
                seat={seat}
                state={state}
                playerNames={playerNames}
                revealCard={revealCard}
                dealPhase={dealPhase}
                sideStackHeight={middleRowHeight}
              />
            )}
          />

          <View style={styles.legacyPileArea}>
            <View
              style={styles.pileMat}
              ref={destRef}
              onLayout={handlePileMatLayout}>
              <View style={styles.pileStack}>
                {stackedPile.map((card, i) => (
                  <View
                    key={card.id}
                    style={[
                      styles.pileCardSlot,
                      {
                        zIndex: i,
                        transform: [
                          { translateX: PILE_CARD_OFFSETS[i].x },
                          { translateY: PILE_CARD_OFFSETS[i].y },
                          {
                            rotate: `${pileRestingRotations[card.id] ?? 0}deg`,
                          },
                        ],
                      },
                    ]}>
                    <PlayingCard card={card} />
                  </View>
                ))}
                {revealCard && (
                  <>
                    <Text style={styles.revealLabel}>
                      {revealCard.playerId === humanPlayerId
                        ? "You played"
                        : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`}
                    </Text>
                    <View
                      style={[
                        styles.pileCardSlot,
                        {
                          zIndex: MAX_STACKED_PILE_CARDS + 1,
                          transform: [
                            { translateX: revealDestinationOffset.x },
                            { translateY: revealDestinationOffset.y },
                          ],
                        },
                      ]}>
                      <TravelCard
                        originOffset={
                          revealCard.originOffset ??
                          revealOriginOffset(
                            resolveRevealOrigin(
                              revealCard.playerId,
                              humanPlayerId,
                              seats,
                            ),
                          )
                        }
                        originRotateDeg={revealCard.originRotateDeg ?? 0}
                        resetKey={revealCard.card.id}>
                        <PlayingCard card={revealCard.card} highlighted />
                      </TravelCard>
                    </View>
                  </>
                )}
              </View>
              <Text
                style={
                  styles.pileCount
                }>{`${pile.length} card${pile.length === 1 ? "" : "s"}`}</Text>
            </View>
          </View>

          <OpponentSeatGroup
            position="right"
            seats={seats}
            renderSeat={seat => (
              <LegacyOpponentSeat
                seat={seat}
                state={state}
                playerNames={playerNames}
                revealCard={revealCard}
                dealPhase={dealPhase}
                sideStackHeight={middleRowHeight}
              />
            )}
          />
        </View>

        <View style={styles.legacyBannerArea}>
          {bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}
        </View>

        {pistiTableBackground === "felt" && (
          <HandFrame
            bottomOffset={legacyHandFrameBottomOffset}
            height={legacyHandFrameHeight}
          />
        )}
        {pistiTableBackground === "legacyRevisited" && (
          <View style={styles.legacyMahoganyPlaque}>
            <Image
              source={MAHOGANY_PLAQUE_IMAGE}
              resizeMode="stretch"
              style={[StyleSheet.absoluteFill, styles.legacyMahoganyPlaqueFill]}
            />
          </View>
        )}
        {pistiTableBackground === "frameBottomAnchored" && (
          <View style={styles.frameOnlyOverlay}>
            <BottomAnchoredImage
              source={TABLE_FRAME_MAHOGANY_BURGUNDY_PLAQUE_IMAGE}
              assetWidth={TABLE_FRAME_MAHOGANY_BURGUNDY_WIDTH}
              assetHeight={TABLE_FRAME_MAHOGANY_BURGUNDY_HEIGHT}
            />
          </View>
        )}
        <View style={styles.legacyHandArea}>
          <PlayerBadge
            name={playerNames[humanPlayerId] ?? "You"}
            statusText={capturedStatusText(capturedHuman)}
            turnState={turnStateForSeat(humanPlayerId, state.players, state.currentPlayerIndex)}
            isHuman
          />
          <PistiHandFan
            slots={
              dealPhase === "revealing"
                ? humanHand.map((card, index) => ({
                    card,
                    index,
                    count: humanHand.length,
                  }))
                : []
            }
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            registerHandMotion={registerHandMotion}
            handFanRef={handFanRef}
            onHandFanLayout={handleHandFanLayout}
            cardSize="normal"
          />
        </View>
        {dealPhase !== "revealing" && <DealFlightOverlay seats={dealSeats} showDeckStack />}
      </DeselectableSurface>
    );
  }

  return (
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      <View style={styles.tableArea} onLayout={handleTableAreaLayout}>
        <View
          style={
            stackOverlayInsets != null
              ? { height: stackOverlayInsets.tableShellWrapperHeight }
              : styles.tableShellWrapperFallback
          }>
          <TableShell seats={tableShellSeats}>
            <View
              style={styles.pileMat}
              ref={destRef}
              onLayout={handlePileMatLayout}>
              <View style={styles.pileStack} onLayout={handlePileStackLayout}>
                {stackedPile.map((card, i) => (
                  <View
                    key={card.id}
                    style={[
                      styles.pileCardSlot,
                      {
                        zIndex: i,
                        transform: [
                          { translateX: PILE_CARD_OFFSETS[i].x },
                          { translateY: PILE_CARD_OFFSETS[i].y },
                          {
                            rotate: `${pileRestingRotations[card.id] ?? 0}deg`,
                          },
                        ],
                      },
                    ]}>
                    <PlayingCard card={card} />
                  </View>
                ))}
              </View>
              <Text
                style={
                  styles.pileCount
                }>{`${pile.length} card${pile.length === 1 ? "" : "s"}`}</Text>
            </View>
          </TableShell>
        </View>

        <View
          style={[styles.handStackOverlay, stackOverlayInsets?.vertical]}
          pointerEvents="box-none">
          <OpponentSeatGroup
            position="top"
            seats={seats}
            renderSeat={seat => (
              <OpponentHandStack
                seat={seat}
                state={state}
                revealCard={revealCard}
                dealPhase={dealPhase}
                sideStackHeight={middleRowHeight}
              />
            )}
          />
          <View
            style={[
              seatLayoutStyles.middleRow,
              styles.middleRowInset,
              stackOverlayInsets != null
                ? {
                    paddingHorizontal:
                      stackOverlayInsets.middleRowPaddingHorizontal,
                  }
                : null,
            ]}
            onLayout={handleMiddleRowLayout}
            pointerEvents="box-none">
            <OpponentSeatGroup
              position="left"
              seats={seats}
              renderSeat={seat => (
                <OpponentHandStack
                  seat={seat}
                  state={state}
                  revealCard={revealCard}
                  dealPhase={dealPhase}
                  sideStackHeight={middleRowHeight}
                />
              )}
            />
            <View style={styles.pileSpacer} pointerEvents="none" />
            <OpponentSeatGroup
              position="right"
              seats={seats}
              renderSeat={seat => (
                <OpponentHandStack
                  seat={seat}
                  state={state}
                  revealCard={revealCard}
                  dealPhase={dealPhase}
                  sideStackHeight={middleRowHeight}
                />
              )}
            />
          </View>
        </View>

        <View
          style={[styles.handFanAnchor, stackOverlayInsets?.handFanAnchor]}
          pointerEvents="box-none">
          <PistiHandFan
            slots={
              dealPhase === "revealing"
                ? humanHand.map((card, index) => ({
                    card,
                    index,
                    count: humanHand.length,
                  }))
                : []
            }
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            registerHandMotion={registerHandMotion}
            handFanRef={handFanRef}
            onHandFanLayout={handleHandFanLayout}
            cardSize="small"
          />
        </View>

        {revealCard && (
          <View style={styles.revealLayer} pointerEvents="none">
            <View style={styles.revealPileMatGhost}>
              <View
                style={[
                  styles.pileStack,
                  styles.revealPileStackGhost,
                  { left: pileStackOffset.x, top: pileStackOffset.y },
                ]}>
                <Text style={styles.revealLabel}>
                  {revealCard.playerId === humanPlayerId
                    ? "You played"
                    : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`}
                </Text>
                <View
                  style={[
                    styles.pileCardSlot,
                    {
                      transform: [
                        { translateX: revealDestinationOffset.x },
                        { translateY: revealDestinationOffset.y },
                      ],
                    },
                  ]}>
                  <TravelCard
                    originOffset={
                      revealCard.originOffset ??
                      revealOriginOffset(
                        resolveRevealOrigin(
                          revealCard.playerId,
                          humanPlayerId,
                          seats,
                        ),
                      )
                    }
                    originRotateDeg={revealCard.originRotateDeg ?? 0}
                    resetKey={revealCard.card.id}>
                    <PlayingCard card={revealCard.card} highlighted />
                  </TravelCard>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bannerArea} pointerEvents="none">
          {bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}
        </View>
      </View>

      {dealPhase !== "revealing" && <DealFlightOverlay seats={dealSeats} showDeckStack />}
    </DeselectableSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: {
    minHeight: 135,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 4,
  },
  // Top opponent only: a fixed (not minHeight-floored) height and a top-anchored card row, so the
  // box doesn't move when the face-down row empties out at the end of a hand — with
  // justifyContent: 'center' (opponentArea's own default), a full row vs. one collapsed to 0
  // height (no cards) recenter to different positions, which reads as the row jumping at that
  // exact moment. Height is derived, not guessed: one row of face-down cards + the area's own
  // paddingVertical (4 top + 4 bottom). This box used to also contain the seat's badge (hence a
  // HAND_BADGE_HEIGHT term here too); that nameplate now renders in TableShell's own top plaque.
  opponentAreaTop: {
    height: SMALL_CARD_HEIGHT + 8,
    justifyContent: "flex-start",
  },
  // Legacy-shape counterpart of opponentAreaTop above — this one DOES include HAND_BADGE_HEIGHT,
  // since the legacy render path still shows the opponent's PlayerBadge in this same box (the
  // nameplate never moved out to TableShell there). zIndex above middleRow's own pile (10, see
  // legacyPileArea) — this box and middleRow are direct siblings (see the JSX just above), so
  // without an explicit value here the two stack by plain render order (middleRow paints second,
  // i.e. on top) regardless of legacyPileArea's own nested zIndex, which only ever ordered pileArea
  // against ITS OWN siblings inside middleRow, never against this box. That let the pile visibly
  // paint over the top badge whenever the two boxes' content overlapped even slightly (previously
  // guaranteed by HAND_BADGE_HEIGHT badly undersizing this box — see that constant's own doc
  // comment — but worth keeping as a real invariant rather than relying on the two heights lining
  // up exactly forever).
  legacyOpponentAreaTop: {
    height: HAND_BADGE_HEIGHT + SMALL_CARD_HEIGHT + 8,
    justifyContent: "flex-start",
    zIndex: 11,
  },
  // Legacy shape only: outranks the left/right OpponentSeatGroup siblings within middleRow, so a
  // reveal traveling from either side seat paints above that seat's own remaining cards too — the
  // legacy tree renders the reveal card inline inside this same pileArea (no TableShell, no
  // handStackOverlay z-index conflict to work around), so this one zIndex is sufficient here,
  // unlike the 'tableShell' shape's dedicated revealLayer/ghost-mat workaround above.
  legacyPileArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  // Legacy shape only: reserves its own strip below the table for transient status text, exactly
  // as Pişti did before the TableShell pilot (the 'tableShell' shape overlays this on the felt
  // instead — see bannerArea below).
  legacyBannerArea: {
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  legacyHandArea: {
    minHeight: 177,
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 4,
  },
  // Full-bleed, edge-to-edge — matches how TableFelt already sizes
  // itself for this same call site (no wrapper style needed for that; this Image
  // needs one since it's rendered directly, not via a self-sizing component).
  legacyFullBleedBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  // 'legacyRevisited' only: full-width, flush against the very bottom edge, with height following
  // MAHOGANY_PLAQUE_ASPECT_RATIO at that implicit width — natural, undistorted aspect, at full
  // width. left+right:0 (rather than an explicit width from useWindowDimensions() or an
  // onLayout-measured parent) let Yoga resolve the actual box width directly from this container's
  // own edges, so there's nothing to drift out of sync with: useWindowDimensions() drifted from
  // the container's real width whenever the two differ (e.g. a centered/max-width web preview
  // frame narrower than the browser window); an onLayout-measured wrapper drifted the same way if
  // its own first layout pass fired late — this has neither failure mode since sizing needs no
  // extra render pass to catch up to. This is a plain View, not the Image itself — TableShell.tsx's
  // own tableBox uses this exact aspectRatio-on-a-View pattern successfully; putting aspectRatio
  // directly on an Image retriggers the react-native-web quirk legacyMahoganyPlaqueFill works
  // around below (the Image renders at its raw source pixel size instead), so the Image inside
  // stays a plain absoluteFill + percentage fill child of this already-correctly-sized box.
  legacyMahoganyPlaque: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    aspectRatio: MAHOGANY_PLAQUE_ASPECT_RATIO,
  },
  // 'frameBottomAnchored' only now — 'frameOnly' itself moved to the shared, game-agnostic
  // MahoganyTableSurface component (packages/ui/src/MahoganyTableSurface.tsx), rendered up in the
  // main background ternary above (paired with the live tableSurfaceMaterial selection there, not
  // as a separate late overlay like this one). Kept here as a plain full-bleed wrapper so
  // BottomAnchoredImage's own measured-parent onLayout has a box to measure that's sized
  // independently of TableShell's box below.
  frameOnlyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Same react-native-web Image quirk TableShell.tsx's own `fill` style works around: absoluteFill
  // alone renders the <img> at the *source file's* native pixel size instead of filling its parent,
  // with an internal zIndex that sinks it behind the felt background. width/height:'100%' forces
  // the fill on web; a no-op on native, where absoluteFill already resolves this correctly.
  legacyMahoganyPlaqueFill: { width: "100%", height: "100%" },
  // 'newDesign' only: wraps TABLE_BACKDROP_GLASS_GOLD_GLOW_IMAGE (full-bleed, painted first) and
  // newDesignSurfaceBox (the felt+frame composite, centered horizontally via alignItems:'center' —
  // same reasoning as TableShell.tsx's own backdrop/tableBox split) — see
  // TABLE_BACKDROP_GLASS_GOLD_GLOW_IMAGE's own doc comment in packages/ui/src/index.ts for the
  // three-layer design this whole thing renders.
  newDesignLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  // Height-driven, aspectRatio-derived width (TABLE_FRAME_INSERT_ASPECT_RATIO) — same
  // aspectRatio-on-a-View pattern as legacyMahoganyPlaque/TableShell's own tableBox above. The felt
  // insert and wood frame stack inside via absoluteFill + legacyMahoganyPlaqueFill, at identical
  // 941x1672 source pixels, so they land in exactly the same box and stay aligned with each other.
  // 85% (not 100%, unlike TableShell's own tableBox): this source's aspect ratio is narrower than
  // TableShell's, so at full height the derived width already exceeds a typical phone's screen
  // width — backdrop's ambient glow would never actually show around it. 85% keeps the frame just
  // inside the screen edges, with the backdrop visible in the margin.
  newDesignSurfaceBox: {
    height: "85%",
    aspectRatio: TABLE_FRAME_INSERT_ASPECT_RATIO,
  },
  // Pre-measurement stand-in (same pattern as handStackOverlay/middleRowInset above) — a rough
  // percentage box so the hand fan is never fully unpositioned (mounts on the first render, in
  // Jest's test renderer where onLayout never fires at all, and briefly before the first real
  // layout on any platform). stackOverlayInsets.handFanAnchor overrides every one of these fields
  // with real pixels derived from the measured box + pile geometry once available.
  handFanAnchor: {
    position: "absolute",
    top: "58%",
    left: "21%",
    width: "58%",
    height: "15%",
  },
  opponentRow: { flexDirection: "row", justifyContent: "center" },
  opponentColumn: { flexDirection: "column", alignItems: "center" },
  // Wraps TableShell plus the overlaid opponent card-stacks and the human's own hand fan so they
  // share one positioning context — everything in here visually belongs to "the table," even
  // though the pile/nameplates render inside TableShell while the card stacks and hand fan render
  // as siblings above it. `flex: 1` (rather than an auto height) is what actually reserves the
  // table its share of the screen — there's no separate hand-area sibling anymore (the hand now
  // renders inside this same region, on the felt, via handFanAnchor below) — and without flex: 1,
  // TableShell's own root (also flex: 1) would collapse an auto-height parent to its intrinsic
  // aspect-ratio height instead of claiming the container's actual available space.
  tableArea: { flex: 1, position: "relative" },
  // Pre-measurement stand-in for TableShell's wrapper (see stackOverlayInsets.tableShellWrapperHeight)
  // — flex: 1 fills tableArea exactly as an unwrapped TableShell always did, so the very first
  // render (and every Jest render, which never fires onLayout) looks identical to before this
  // wrapper existed. Once tableAreaSize is measured, an explicit pixel height replaces this so the
  // box can be clamped to whichever of width/height is actually the tighter constraint.
  tableShellWrapperFallback: { flex: 1 },
  // The card stacks overlay TableShell rather than stacking below it: they're an absolute layer
  // over the exact same box, so they read as cards lying on the table instead of the whole
  // table+stacks column growing taller than the screen. `pointerEvents="box-none"` here and on
  // middleRow so the table underneath still receives taps. (Longhand rather than
  // StyleSheet.absoluteFillObject, which isn't a TypeScript-visible API on this RN version — see
  // TableShell.tsx's `fill` style for the same note.)
  //
  // The two vertical insets keep the stacks off TableShell's baked plaques, which the stacks would
  // otherwise cover completely: `top` drops the top seat's card row below the top plaque, and
  // `bottom` shortens the middle row — the side stacks size themselves from its measured height —
  // so their lower ends stay clear of the human's own plaque. The percentages here are only a
  // pre-measurement stand-in: top/bottom percentages resolve against this container's HEIGHT, and
  // while the table box those plaques belong to is now itself height-driven too, its centered
  // position still depends on how tall this container actually is — a static percentage still
  // only lines up at one viewport shape. `stackOverlayInsets.vertical` (computed from the
  // measured box geometry) overrides both with real pixels after first layout.
  handStackOverlay: {
    position: "absolute",
    top: "13%",
    left: 0,
    right: 0,
    bottom: "15%",
  },
  // Same idea on the other axis: pushes the left/right card columns inboard of the side plaques so
  // they sit on the felt beside each nameplate instead of on top of it. Kept as a Pişti-local
  // style rather than folded into the shared seatLayoutStyles.opponentAreaSide, which Batak's
  // table also uses. This 21% is only the pre-measurement stand-in (same reasoning as
  // handStackOverlay above — a static percentage of container width doesn't track a
  // height-driven box's width, which varies with the container's own aspect ratio);
  // stackOverlayInsets.middleRowPaddingHorizontal overrides it with a real pixel value derived
  // from the box's actual width. That derived value is still a compromise, not a clean fit — at
  // phone width the felt isn't wide enough for two card columns, the pile, AND both side plaques
  // to be mutually clear, so it leaves a few px of overlap at each column's inner and outer edge
  // instead of fully hiding either the plaques (a smaller inset) or the pile (a larger one).
  middleRowInset: { paddingHorizontal: "21%" },
  // Occupies the middle row's center slot now that the pile itself lives inside TableShell as
  // its `children` — without this, middleRow's `justifyContent: 'space-between'` would pull the
  // left/right card stacks together with no gap between them.
  pileSpacer: { flex: 1 },
  pileMat: {
    width: PILE_MAT_WIDTH,
    height: PILE_MAT_HEIGHT,
    borderRadius: 98,
    backgroundColor: "rgba(0, 0, 0, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  pileStack: { width: PILE_STACK_WIDTH, height: PILE_STACK_HEIGHT },
  // The in-flight reveal card renders here instead of alongside the resting pile cards inside
  // TableShell's children, purely for paint order: the opponents' face-down stacks live in
  // handStackOverlay, whose middleRow carries zIndex: 10 (seatLayoutStyles, shared with Batak), so
  // anything nested inside TableShell — an earlier sibling with no zIndex — paints underneath
  // them. A card traveling from a side seat would then fly *behind* that seat's own remaining
  // cards, since the left/right stacks overlap pileMat's horizontal span. A zIndex on TableShell
  // itself would lift the whole felt above the stacks too, so the reveal gets its own layer here:
  // last sibling, zIndex above middleRow's.
  revealLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  // Reproduces pileMat's box (same size, same centering inside the same container — TableShell's
  // backdrop fills tableArea and centers its box, which in turn centers pileMat) so the reveal
  // card's translateX/translateY, which are offsets in pileStack's coordinate space, keep landing
  // it on exactly the pile slot it did before this layer existed. Deliberately has no background:
  // it's a positioning ghost, not a second mat.
  revealPileMatGhost: { width: PILE_MAT_WIDTH, height: PILE_MAT_HEIGHT },
  revealPileStackGhost: { position: "absolute" },
  pileCardSlot: { position: "absolute", left: 0, bottom: 0 },
  revealLabel: {
    position: "absolute",
    top: -24,
    left: -32,
    width: 140,
    fontFamily: BODY_SEMIBOLD,
    fontSize: 12,
    color: "#fff8dc",
    textAlign: "center",
  },
  pileCount: { fontFamily: BODY_REGULAR, marginTop: 8, fontSize: 13, color: "#f5f0e6" },
  // Overlays the table surface's top edge instead of reserving its own strip below it — the
  // screen is just top-bar-then-table now (no separate banner row), so transient status text
  // ("Pişti! +10") floats over the felt near the top opponent instead of pushing the table down.
  bannerArea: {
    position: "absolute",
    top: 4,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: { fontSize: 16, fontWeight: "700", color: WOOD_TRIM_COLOR },
});
