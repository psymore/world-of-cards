import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import type { Card, Suit } from "@world-cards/engine";
import type { BatakState, BatakMove } from "@world-cards/engine/games/batak";
import { compareRanks } from "@world-cards/engine/games/batak";
import {
  PlayingCard,
  SuitIcon,
  TableFelt,
  HandFrame,
  HAND_FRAME_PEAK_FRACTION,
  glowShadow,
} from "@world-cards/ui";
import { SelectableCard } from "../../components/SelectableCard";
import { DeselectableSurface } from "../../components/DeselectableSurface";
import { useCardSelection } from "../../components/useCardSelection";
import { PlayerAvatar } from "../../components/PlayerAvatar";
import { CenteredDecisionModal } from "../../components/CenteredDecisionModal";
import { useReducedMotion } from "../../components/useReducedMotion";
import { DealFlightOverlay } from "../../table/DealFlightOverlay";
import type { DealFlightSeat } from "../../table/DealFlightOverlay";
import type { DealPhase } from "../../hooks/useDealSequence";
import { TravelCard } from "../../table/TravelCard";
import { GatherCard } from "../../table/GatherCard";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  resolveRevealOrigin,
  revealOriginOffset,
} from "../../table/seating";
import type { Seat, SeatPosition } from "../../table/seating";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

function suitColor(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds" ? "#c0392b" : "#111";
}

const HUMAN_CARD_WIDTH = 94; // matches PlayingCard's 'normal' size width
const HUMAN_CARD_HEIGHT = 132; // matches PlayingCard's 'normal' size height
// A flatter arc than the opponents' default fan (half the rotation-per-card and curve
// multiplier) — first-pass values, tune during the manual visual verification pass if needed.
const HUMAN_HAND_DEGREES_PER_STEP = 4;
const HUMAN_HAND_CURVE_MULTIPLIER = 1.5;
// The bottom hand row overlaps the top row instead of sitting below it with a gap, so the two
// rows read as one imbricated fan rather than two stacked blocks.
const HAND_ROW_OVERLAP_FRACTION = 0.25;
const HAND_ROW_OVERLAP_PX = Math.round(
  HUMAN_CARD_HEIGHT * HAND_ROW_OVERLAP_FRACTION,
);
// Total footprint of the two-row fan (top row's full height, plus the bottom row's additional
// visible height once the overlap above is applied) — given explicitly to styles.handFan since
// its children are now absolutely positioned (see AnimatedFanCard) and can no longer contribute
// to an auto-computed parent height the way normal-flow children would.
const HAND_FAN_HEIGHT =
  HUMAN_CARD_HEIGHT + (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);

// First-pass constants for positioning HandFrame behind the two-row hand, derived from this
// file's own layout below (not measured on a real device — tune these if the frame's arch peak
// doesn't line up with the top row's peak once visually checked).
const CONTAINER_BOTTOM_PADDING = 12; // matches styles.container.paddingVertical
const HAND_AREA_HEIGHT = 300; // matches styles.handArea.minHeight
const HAND_BADGE_HEIGHT = 34; // approx rendered height of PlayerBadge at normal size
const HAND_AREA_CONTENT_GAP = 4; // matches styles.handArea.gap
// Content centered inside handArea: badge + gap + the two-row fan (top row's full height, plus
// the bottom row's additional visible height once the overlap above is applied).
const HAND_CONTENT_HEIGHT =
  HAND_BADGE_HEIGHT +
  HAND_AREA_CONTENT_GAP +
  HUMAN_CARD_HEIGHT +
  (HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX);
const HAND_AREA_TOP_INSET = (HAND_AREA_HEIGHT - HAND_CONTENT_HEIGHT) / 2;
// Distance from the container's true bottom edge (where HandFrame's own bottom:0 would sit,
// since absolute positioning ignores the container's own paddingVertical) up to the top row's
// peak — its center card's top edge, where curveOffsetY is 0.
const TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM =
  CONTAINER_BOTTOM_PADDING +
  HAND_AREA_HEIGHT -
  HAND_AREA_TOP_INSET -
  HAND_BADGE_HEIGHT -
  HAND_AREA_CONTENT_GAP;
// Peak-aligning the frame exactly to the top row's own top edge hides the frame's gold trim
// behind the cards (they render in front, same height). This extra margin lifts the frame's
// peak above the top row instead, so the trim clears the cards and stays visible.
const HAND_FRAME_REVEAL_MARGIN = 14;
// The frame's bottom edge sits this far below the screen's true bottom edge (rather than landing
// exactly flush) so it's guaranteed to fully cover the bottom regardless of small per-device
// rounding/safe-area differences — the overshoot itself is never visible, it's off-screen.
const HAND_FRAME_BOTTOM_OVERSHOOT = 16;
// Fixed per-card horizontal spacing (step between adjacent card slots) in the human's own hand —
// deliberately NOT recomputed from the current row length (that previously made the fan spread
// apart as cards were played, since fewer cards meant less overlap was needed to fit the same
// target width). The top row is spaced slightly wider apart (less overlap) than the bottom row
// for visual balance, mirroring HAND_ROW_OVERLAP_FRACTION's own intent for the vertical axis.
const HUMAN_HAND_BOTTOM_ROW_OVERLAP_FRACTION = 0.5;
const HUMAN_HAND_TOP_ROW_OVERLAP_FRACTION = 0.4;
const HUMAN_HAND_BOTTOM_ROW_STEP = Math.round(
  HUMAN_CARD_WIDTH * (1 - HUMAN_HAND_BOTTOM_ROW_OVERLAP_FRACTION),
);
const HUMAN_HAND_TOP_ROW_STEP = Math.round(
  HUMAN_CARD_WIDTH * (1 - HUMAN_HAND_TOP_ROW_OVERLAP_FRACTION),
);
// Shared timing for every hand-card reposition (a card played, remaining cards sliding/rising to
// close the gap) — see AnimatedFanCard. An ease-in-ease-out curve reads as a natural reflow
// rather than either a sudden snap (no easing) or a bouncy entrance (an "out" curve alone).
const HAND_CARD_REPOSITION_DURATION_MS = 220;
const HAND_CARD_REPOSITION_EASING = Easing.inOut(Easing.ease);

// 2.5x SelectableCard's own default (16px) lift — Batak-only override, see
// docs/superpowers/specs/2026-07-17-batak-deal-selection-and-trick-motion-polish-design.md
// section C. Selection no longer forces the card to the front via zIndex (below); this larger
// lift is what makes a selected card read as prominent instead.
const SELECTED_LIFT_DISTANCE = 40;
// Shrinks only the currently-selected card's touchable width — see SelectableCard's hitSlop doc
// comment. Deliberately conservative (not the full ~25px rotation-widened estimate) so the
// selected card stays comfortably tappable for the second tap that plays it.
const SELECTED_CARD_HIT_SLOP = { left: -20, right: -20 };
const HAND_SUIT_ORDER = ["hearts", "spades", "diamonds", "clubs"] as const;

function sortHandForDisplay(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff =
      HAND_SUIT_ORDER.indexOf(a.suit as Suit) -
      HAND_SUIT_ORDER.indexOf(b.suit as Suit);
    if (suitDiff !== 0) return suitDiff;
    return compareRanks(b.rank, a.rank); // descending within suit: A high ... 2 low
  });
}

export interface PendingBatakPlay {
  playerId: string;
  card: Card;
  originOffset?: { x: number; y: number };
}

// All 4 plays of a just-completed trick, captured before performMove commits (which resolves
// the trick atomically — winner computed and cards swept to won-<winner> within one call), so
// TrickCenter has a stable snapshot to animate away from while engine state is still mid-trick.
export interface GatheringTrick {
  entries: { playerId: string; card: Card }[];
  winnerId: string;
}

export type BatakDealPhase = DealPhase;

export interface BatakTableProps {
  state: BatakState;
  humanPlayerId: string;
  // Exactly 3 entries for this fixed-4-player scope.
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  // Legal moves for humanPlayerId's current turn, or [] when it isn't their turn / a move is
  // pending. Drives which bid amounts, trump suits, and hand cards are actually tappable.
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
  // Separate from onMove (which also carries bid/pass/selectTrump, none of which have an
  // origin) — called only for the human's own card plays, with a measured travel-origin offset
  // when available.
  onPlayCard: (cardId: string, originOffset?: { x: number; y: number }) => void;
  pendingPlay?: PendingBatakPlay | null;
  gatheringTrick?: GatheringTrick | null;
  dealPhase: BatakDealPhase;
}

function PlayerBadge({
  name,
  statusText,
  active,
  isHuman,
  compact,
}: {
  name: string;
  statusText: string;
  active: boolean;
  isHuman: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        active && styles.badgeActive,
      ]}>
      <PlayerAvatar accent={isHuman} size={compact ? "small" : "normal"} />
      <Text
        style={[styles.playerLabel, compact && styles.playerLabelCompact]}
        numberOfLines={1}>
        {`${name} · ${statusText}`}
      </Text>
    </View>
  );
}

function bidStatusText(state: BatakState, playerId: string): string {
  const bid = state.bids[playerId];
  if (bid === "pass") return "Pass";
  if (typeof bid === "number") return `Bid ${bid}`;
  return "—";
}

function statusTextFor(state: BatakState, playerId: string): string {
  return state.phase === "bidding"
    ? bidStatusText(state, playerId)
    : `${state.tricksWon[playerId]} tricks`;
}

interface OpponentSeatProps {
  seat: Seat;
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}

function OpponentSeat({
  seat,
  state,
  playerNames,
  pendingPlay,
}: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const isCurrentTurn =
    state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  return (
    <View style={[styles.opponentArea, isSide && styles.opponentAreaSide]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
    </View>
  );
}

function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  pendingPlay,
}: {
  position: SeatPosition;
  seats: Seat[];
  state: BatakState;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
}) {
  return (
    <>
      {seats
        .filter(seat => seat.position === position)
        .map(seat => (
          <OpponentSeat
            key={seat.playerId}
            seat={seat}
            state={state}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
          />
        ))}
    </>
  );
}

function BiddingCenter({
  state,
  playerNames,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
}) {
  const leaderId = state.players.find(p => state.bids[p] === state.highestBid);
  return (
    <View style={styles.centerPanel}>
      <Text style={styles.centerHeading}>Bidding</Text>
      <Text style={styles.centerLine}>
        {state.highestBid > 0
          ? `Highest bid: ${state.highestBid} (${playerNames[leaderId ?? ""] ?? leaderId})`
          : "No bids yet"}
      </Text>
    </View>
  );
}

// The "platform" — the shared bid/trump decision panel (styles.modalCard) — gets the same
// gradient+grain+trim wood recipe as TableWoodCorners/TableEdgeRails/HandFrame rather than a new
// material, so it reads as part of the same wooden-table identity. Brainstormed via the visual
// companion (mockup: .superpowers/brainstorm/994-1784508967/content/platform-style.html).
const PLATFORM_WOOD_LIGHT = "#5c2a1e";
const PLATFORM_WOOD_DARK = "#331209";
const PLATFORM_GRAIN_COLOR = "#ffab6b";
const PLATFORM_TRIM_COLOR = "rgba(255, 217, 102, 0.85)";
// Raises the panel above CenteredDecisionModal's default dead-center resting spot, per the
// approved mockup.
const PLATFORM_RAISE_BY = 40;

// Absolutely fills styles.modalCard (which clips via overflow:'hidden'). modalCard is a
// shrink-to-fit box (its size varies between the bid grid and the narrower trump suit row), and
// percentage width/height on <Svg> didn't reliably resolve against that dynamic parent size in
// practice (left gaps at the edges) — so this measures its own rendered box via onLayout instead,
// the same pattern already used for the trick center's destRef/handleDestLayout below, and gives
// the Svg/Rect explicit pixel dimensions like BidButton's own Svg already does successfully.
function PlatformWoodBackground() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.noPointerEvents]}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}>
      {size && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id="platformWoodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={PLATFORM_WOOD_LIGHT} />
              <Stop offset="100%" stopColor={PLATFORM_WOOD_DARK} />
            </LinearGradient>
            <Pattern
              id="platformWoodGrain"
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)">
              <Line x1={0} y1={0} x2={0} y2={6} stroke={PLATFORM_GRAIN_COLOR} strokeOpacity={0.1} strokeWidth={1} />
            </Pattern>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#platformWoodGradient)" />
          <Rect width={size.width} height={size.height} fill="url(#platformWoodGrain)" />
        </Svg>
      )}
    </View>
  );
}

function TrumpWaitingCenter({
  state,
  playerNames,
}: {
  state: BatakState;
  playerNames: Record<string, string>;
}) {
  return (
    <View style={styles.centerPanel}>
      <Text style={styles.centerHeading}>
        {`${playerNames[state.bidWinner ?? ""] ?? state.bidWinner} is choosing trump…`}
      </Text>
    </View>
  );
}

function TrumpSuitPicker({
  state,
  onMove,
}: {
  state: BatakState;
  onMove: (move: BatakMove) => void;
}) {
  return (
    <View style={styles.modalCard}>
      <PlatformWoodBackground />
      <Text style={[styles.centerHeading, styles.trumpModalHeading]}>
        {`Choose trump (contract: ${state.contract})`}
      </Text>
      <View style={styles.suitRow}>
        {SUITS.map(suit => (
          <Pressable
            key={suit}
            onPress={() => onMove({ type: "selectTrump", suit })}
            style={styles.suitButton}
            accessibilityRole="button">
            <SuitIcon suit={suit} size={28} color={suitColor(suit)} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type TrickPosition = "bottom" | SeatPosition;

// Resting offset from dead-center for each seat's slot — small enough (vs. the ~165-195px
// travel-origin offsets below) that adjacent slots' card rectangles overlap slightly at their
// inner corners ("loose, corner-touching" per the brainstorming visual companion mockup, chosen
// over a tighter ~40%-overlap alternative). First-pass values sized against the 'small' card's
// 64x86 dimensions (see PlayingCard's CARD_DIMS) — confirm via screenshot in the final
// verification pass.
const TRICK_SLOT_OFFSETS: Record<TrickPosition, { x: number; y: number }> = {
  top: { x: 0, y: -38 },
  bottom: { x: 0, y: 38 },
  left: { x: -30, y: 0 },
  right: { x: 30, y: 0 },
};

function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
  gatheringTrick,
  destRef,
  onDestLayout,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  gatheringTrick?: GatheringTrick | null;
  destRef: React.RefObject<View | null>;
  onDestLayout: () => void;
}) {
  function trickPositionFor(playerId: string): TrickPosition {
    if (playerId === humanPlayerId) return "bottom";
    return seats.find(s => s.playerId === playerId)?.position ?? "top";
  }

  function cardFor(playerId: string): Card | null {
    if (pendingPlay != null && pendingPlay.playerId === playerId)
      return pendingPlay.card;
    const entry = state.currentTrick.find(t => t.playerId === playerId);
    if (!entry) return null;
    return (
      state.table.zones["trick"].cards.find(c => c.id === entry.cardId) ?? null
    );
  }

  // Play order across both already-committed cards and the still-animating pendingPlay (always
  // the newest) — drives each slot's zIndex so the most recently played card renders on top of
  // earlier ones regardless of which seat played it. Trick slots are seat-fixed (TRICK_SLOT_OFFSETS
  // above), so without this the overlap stacking would silently depend on seat position instead
  // of when each card actually arrived.
  const playOrder: string[] = [
    ...state.currentTrick.map(t => t.playerId),
    ...(pendingPlay ? [pendingPlay.playerId] : []),
  ];

  function slotFor(position: TrickPosition) {
    const playerId =
      position === "bottom"
        ? humanPlayerId
        : seats.find(s => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    const isPending =
      playerId != null &&
      pendingPlay != null &&
      pendingPlay.playerId === playerId;
    const zIndex = playerId ? Math.max(playOrder.indexOf(playerId) + 1, 1) : 1;
    const offset = TRICK_SLOT_OFFSETS[position];

    return (
      <View
        key={position}
        testID={`trick-slot-${position}`}
        ref={position === "bottom" ? destRef : undefined}
        onLayout={position === "bottom" ? onDestLayout : undefined}
        style={[
          styles.trickSlot,
          {
            zIndex,
            transform: [{ translateX: offset.x }, { translateY: offset.y }],
          },
        ]}>
        {card ? (
          isPending ? (
            <TravelCard
              originOffset={
                pendingPlay?.originOffset ??
                revealOriginOffset(
                  resolveRevealOrigin(playerId!, humanPlayerId, seats),
                )
              }
              resetKey={card.id}>
              <PlayingCard card={card} size="small" />
            </TravelCard>
          ) : (
            <PlayingCard card={card} size="small" />
          )
        ) : null}
      </View>
    );
  }

  const gatherDestinationOffset = gatheringTrick
    ? revealOriginOffset(
        resolveRevealOrigin(gatheringTrick.winnerId, humanPlayerId, seats),
      )
    : null;

  return (
    <View style={styles.centerPanel}>
      <View style={styles.trumpRow}>
        <Text style={styles.centerLine}>Trump:</Text>
        <SuitIcon
          suit={state.trumpSuit!}
          size={16}
          color={suitColor(state.trumpSuit!)}
        />
        <Text style={styles.centerLine}>
          {`  Contract: ${state.contract} (${playerNames[state.bidWinner ?? ""] ?? state.bidWinner})`}
        </Text>
      </View>
      <View style={styles.trickCross}>
        {gatheringTrick
          ? gatheringTrick.entries.map(({ playerId, card }) => {
              const position = trickPositionFor(playerId);
              const offset = TRICK_SLOT_OFFSETS[position];
              return (
                <View
                  key={playerId}
                  style={[
                    styles.trickSlot,
                    {
                      transform: [
                        { translateX: offset.x },
                        { translateY: offset.y },
                      ],
                    },
                  ]}>
                  <GatherCard
                    card={card}
                    destinationOffset={gatherDestinationOffset!}
                  />
                </View>
              );
            })
          : (["top", "left", "bottom", "right"] as TrickPosition[]).map(
              slotFor,
            )}
      </View>
    </View>
  );
}

// Baldur's Gate 3-inspired bid button palette
// (docs/superpowers/specs/2026-07-19-batak-bid-button-redesign-design.md) — idle vs. "hover"
// colors, where RN's touch-only Pressable has no real hover, so the reference's :hover state maps
// onto Pressable's pressed state instead.
interface BidButtonPalette {
  fillTop: string;
  fillBottom: string;
  fillTopPressed: string;
  fillBottomPressed: string;
  borderIdle: string;
  borderPressed: string;
  textIdle: string;
  textPressed: string;
}

const BID_NUMBER_PALETTE: BidButtonPalette = {
  fillTop: "#31221B",
  fillBottom: "#341307",
  fillTopPressed: "#40291d",
  fillBottomPressed: "#4a2a10",
  borderIdle: "#B19B7E",
  borderPressed: "#CEB390",
  textIdle: "#cdaf87",
  textPressed: "#ffe5c2",
};

const BID_PASS_PALETTE: BidButtonPalette = {
  fillTop: "#31221B",
  fillBottom: "#341307",
  fillTopPressed: "#40291d",
  fillBottomPressed: "#4a2a10",
  borderIdle: "#8a5a4a",
  borderPressed: "#c98a6f",
  textIdle: "#d9a98f",
  textPressed: "#f0c9b8",
};

const BID_BUTTON_SIZE = 56;
const BID_BUTTON_RADIUS = 10;
const PASS_BUTTON_HEIGHT = 44;
const BID_GRID_COLUMNS = 3;
const BID_GRID_GAP = 10;
const BID_GRID_WIDTH =
  BID_BUTTON_SIZE * BID_GRID_COLUMNS + BID_GRID_GAP * (BID_GRID_COLUMNS - 1);

// The gradient fill/bevel/shine layers are drawn in react-native-svg (already a dependency, used
// the same way by TableWoodCorners/HeaderWoodFrame) rather than a gradient-clipped text label —
// this app has no masked-view dependency, so the label uses a solid idle/pressed color swap
// instead of the reference's literal text gradient.
function BidButton({
  label,
  onPress,
  palette,
  width,
  height,
  fontSize,
}: {
  label: string;
  onPress: () => void;
  palette: BidButtonPalette;
  width: number;
  height: number;
  fontSize: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ width, height }}>
      {({ pressed }) => {
        const fillTop = pressed ? palette.fillTopPressed : palette.fillTop;
        const fillBottom = pressed
          ? palette.fillBottomPressed
          : palette.fillBottom;
        const borderColor = pressed
          ? palette.borderPressed
          : palette.borderIdle;
        const textColor = pressed ? palette.textPressed : palette.textIdle;
        return (
          <View style={[styles.bidButtonShadow, { width, height }]}>
            <View
              style={[
                styles.bidButtonClip,
                pressed && glowShadow(borderColor, 8),
                {
                  width,
                  height,
                  borderColor,
                  borderWidth: pressed ? 1.6 : 1.4,
                },
              ]}>
              <Svg
                width={width}
                height={height}
                style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="bidFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset={0} stopColor={fillTop} />
                    <Stop offset={1} stopColor={fillBottom} />
                  </LinearGradient>
                  <LinearGradient id="bidBevel" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset={0} stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset={0.5} stopColor="#ffffff" stopOpacity={0.4} />
                    <Stop offset={0.5} stopColor="#000000" stopOpacity={0.3} />
                    <Stop offset={1} stopColor="#000000" stopOpacity={0} />
                  </LinearGradient>
                  <RadialGradient
                    id="bidShine"
                    cx="50%"
                    cy="0%"
                    rx="70%"
                    ry="60%">
                    <Stop offset={0} stopColor="#ffffff" stopOpacity={0.35} />
                    <Stop offset={1} stopColor="#ffffff" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width={width} height={height} fill="url(#bidFill)" />
                <Rect width={width} height={height} fill="url(#bidBevel)" />
                <Rect
                  width={width}
                  height={height}
                  fill="url(#bidShine)"
                  opacity={pressed ? 1 : 0.6}
                />
              </Svg>
              <Text
                style={[styles.bidButtonText, { fontSize, color: textColor }]}>
                {label}
              </Text>
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

function BidControls({
  legalMoves,
  onMove,
}: {
  legalMoves: BatakMove[];
  onMove: (move: BatakMove) => void;
}) {
  const bidMoves = legalMoves.filter(
    (m): m is Extract<BatakMove, { type: "bid" }> => m.type === "bid",
  );
  const hasPass = legalMoves.some(m => m.type === "pass");
  return (
    <View style={styles.modalCard} testID="bid-controls">
      <PlatformWoodBackground />
      <View style={styles.bidGrid}>
        {bidMoves.map(move => (
          <BidButton
            key={move.amount}
            label={`${move.amount}`}
            onPress={() => onMove(move)}
            palette={BID_NUMBER_PALETTE}
            width={BID_BUTTON_SIZE}
            height={BID_BUTTON_SIZE}
            fontSize={20}
          />
        ))}
      </View>
      {hasPass && (
        <View style={styles.passRow}>
          <BidButton
            label="Pass"
            onPress={() => onMove({ type: "pass" })}
            palette={BID_PASS_PALETTE}
            width={BID_GRID_WIDTH}
            height={PASS_BUTTON_HEIGHT}
            fontSize={14}
          />
        </View>
      )}
    </View>
  );
}

// One human-hand card's slot: which row it's in, its index within that row, and how many cards
// currently share that row (rowCount, not the initial deal size — the fan recenters as the row
// shrinks, matching the pre-existing recentering behavior, just now animated instead of snapped).
interface HandSlot {
  card: Card;
  row: "top" | "bottom";
  indexInRow: number;
  rowCount: number;
}

function slotStep(row: "top" | "bottom"): number {
  return row === "top" ? HUMAN_HAND_TOP_ROW_STEP : HUMAN_HAND_BOTTOM_ROW_STEP;
}

// Horizontal offset from the row's own center — negative/positive symmetric around 0, so the row
// stays centered under styles.fanCardSlot's left:'50%' anchor regardless of rowCount.
function slotTargetX(slot: HandSlot): number {
  const mid = (slot.rowCount - 1) / 2;
  return (slot.indexInRow - mid) * slotStep(slot.row);
}

// Vertical offset from the fan's own top edge — the bottom row overlaps up into the top row by
// HAND_ROW_OVERLAP_PX, matching the pre-existing two-row imbrication.
function slotTargetY(slot: HandSlot): number {
  return slot.row === "top" ? 0 : HUMAN_CARD_HEIGHT - HAND_ROW_OVERLAP_PX;
}

// A single human-hand card, absolutely positioned within the shared fan container and animated
// (via its own persistent Animated.Value pair) whenever its target slot changes — e.g. a card
// played elsewhere in the hand shifts every card after it to a new index, and shrinking a row can
// even move a card from the top row to the bottom row (or vice versa). Because every card in both
// rows now lives under one shared parent (HumanHandFan) instead of two separate row containers,
// that row-crossing case animates smoothly too, rather than unmounting from one row's tree and
// remounting in the other's.
function AnimatedFanCard({
  slot,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  registerCardRef,
}: {
  slot: HandSlot;
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
}) {
  const { card } = slot;
  const targetX = slotTargetX(slot);
  const targetY = slotTargetY(slot);
  const x = useRef(new Animated.Value(targetX)).current;
  const y = useRef(new Animated.Value(targetY)).current;
  const mounted = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!mounted.current) {
      // First render for this card (the initial deal): jump straight to its slot — nothing to
      // reflow from, and EntranceCard supplies the deal's own fade/scale/rise flourish.
      mounted.current = true;
      return;
    }
    if (reducedMotion) {
      x.setValue(targetX);
      y.setValue(targetY);
      return;
    }
    Animated.parallel([
      Animated.timing(x, {
        toValue: targetX,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: targetY,
        duration: HAND_CARD_REPOSITION_DURATION_MS,
        easing: HAND_CARD_REPOSITION_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [targetX, targetY, reducedMotion, x, y]);

  const interactive = isHumanInteractive && legalCardIds.has(card.id);

  return (
    <Animated.View
      style={[
        styles.fanCardSlot,
        { transform: [{ translateX: x }, { translateY: y }] },
      ]}>
      <View ref={node => registerCardRef(card.id, node)}>
        <EntranceCard index={slot.indexInRow} playEntrance={playEntrance}>
          <SelectableCard
            card={card}
            size="normal"
            selected={selectedCardId === card.id}
            disabled={!interactive}
            onPress={() => selectCard(card.id)}
            rotateDeg={fanRotationDeg(
              slot.indexInRow,
              slot.rowCount,
              HUMAN_HAND_DEGREES_PER_STEP,
            )}
            curveOffsetY={fanCurveY(
              slot.indexInRow,
              slot.rowCount,
              1,
              HUMAN_HAND_CURVE_MULTIPLIER,
            )}
            liftDistance={SELECTED_LIFT_DISTANCE}
            // Kept even without the front-stacking zIndex below: it independently shrinks
            // the selected card's own touch bounds, which is what actually prevents a stray
            // tap from landing on it instead of an exposed neighbor — orthogonal to stacking
            // order.
            hitSlop={
              selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined
            }
          />
        </EntranceCard>
      </View>
    </Animated.View>
  );
}

// Renders every human-hand card (both rows) under one shared parent — see AnimatedFanCard's doc
// comment for why that matters for the top/bottom row-crossing case. Render order (top row's
// slots first) preserves the pre-existing "bottom row paints over the top row where they overlap"
// stacking, since later JSX siblings paint on top with no zIndex needed.
function HumanHandFan({
  slots,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  registerCardRef,
}: {
  slots: HandSlot[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  registerCardRef: (cardId: string, node: View | null) => void;
}) {
  return (
    <View style={styles.handFan} testID="human-hand">
      {slots.map(slot => (
        <AnimatedFanCard
          key={slot.card.id}
          slot={slot}
          legalCardIds={legalCardIds}
          isHumanInteractive={isHumanInteractive}
          selectedCardId={selectedCardId}
          selectCard={selectCard}
          playEntrance={playEntrance}
          registerCardRef={registerCardRef}
        />
      ))}
    </View>
  );
}

// Plays a one-shot fade+scale+rise entrance the first time `playEntrance` becomes true (the
// moment the deal sequence reaches 'revealing'), then stays static — re-renders after that
// (card removed by a play, selection state changing) must not replay it, hence the `played` ref.
function EntranceCard({
  index,
  playEntrance,
  children,
}: {
  index: number;
  playEntrance: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(playEntrance ? 1 : 0)).current;
  const played = useRef(playEntrance);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (playEntrance && !played.current) {
      played.current = true;
      if (reducedMotion) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: 350,
        delay: index * 40,
        useNativeDriver: true,
      }).start();
    }
  }, [playEntrance, index, progress, reducedMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-40, 0],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

export function BatakTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  legalMoves,
  onMove,
  onPlayCard,
  pendingPlay,
  gatheringTrick,
  dealPhase,
}: BatakTableProps) {
  const seats = assignSeats(opponentPlayerIds);
  // Deal order: human first, then opponents in existing turn order (right, top, left for the
  // fixed 4-player table) — see docs/superpowers/specs/2026-07-17-batak-deal-selection-and-
  // trick-motion-polish-design.md section D2. Card counts come from the real dealt hand size,
  // not a hardcoded 13, so this stays correct if hand size ever varies (e.g. the gömmeli variant).
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
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  // No trick-completing pause happens during bidding/trump-selection (pendingPlay is always null
  // there), so this single check correctly gates interactivity across every phase: whenever a
  // trick-completing move (human's own or an AI's) is staged, engine state hasn't advanced past
  // the player who made it yet, so disabling on pendingPlay alone — not "is it revealing for the
  // human specifically" — is both correct and simpler than tracking whose reveal it is.
  const isHumanInteractive =
    isHumanTurn && pendingPlay == null && gatheringTrick == null;

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(
    playWithMeasuredOrigin,
  );
  useEffect(() => {
    if (!isHumanInteractive) clearSelection();
  }, [isHumanInteractive, clearSelection]);

  const isPendingHuman =
    pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanGatheringCardId = gatheringTrick?.entries.find(
    entry => entry.playerId === humanPlayerId,
  )?.card.id;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    card =>
      !(isPendingHuman && card.id === pendingPlay!.card.id) &&
      card.id !== humanGatheringCardId,
  );
  const sortedHand = sortHandForDisplay(humanHand);
  // Each card is assigned to a fixed top/bottom layer once — the first time this component sees
  // it with a non-empty hand, i.e. the initial deal — and never reassigned afterward, so a card
  // never crosses from one layer to the other as the hand shrinks (only its position *within* its
  // own layer reflows). splitTwoRows returns the larger half first; the bottom layer (closer to
  // the viewer) gets the extra card on an odd-sized hand, not the top — e.g. 13 cards is 6 top /
  // 7 bottom.
  const handLayerRef = useRef<Map<string, "top" | "bottom">>(new Map());
  if (handLayerRef.current.size === 0 && sortedHand.length > 0) {
    const [largerLayerCount] = splitTwoRows(sortedHand.length);
    const initialTopCount = sortedHand.length - largerLayerCount;
    sortedHand.forEach((card, i) => {
      handLayerRef.current.set(card.id, i < initialTopCount ? "top" : "bottom");
    });
  }
  const topRow = sortedHand.filter(
    card => handLayerRef.current.get(card.id) === "top",
  );
  const bottomRow = sortedHand.filter(
    card => handLayerRef.current.get(card.id) === "bottom",
  );
  const handSlots: HandSlot[] = [
    ...topRow.map(
      (card, i): HandSlot => ({
        card,
        row: "top",
        indexInRow: i,
        rowCount: topRow.length,
      }),
    ),
    ...bottomRow.map(
      (card, i): HandSlot => ({
        card,
        row: "bottom",
        indexInRow: i,
        rowCount: bottomRow.length,
      }),
    ),
  ];
  const legalCardIds = new Set(
    legalMoves
      .filter(
        (m): m is Extract<BatakMove, { type: "play" }> => m.type === "play",
      )
      .map(m => m.cardId),
  );

  // Destination for the human's play-travel origin delta: the 'bottom' trick slot's on-screen
  // center, measured live and re-measured on every layout pass. See
  // docs/superpowers/specs/2026-07-18-human-hand-real-position-card-travel-design.md.
  const destRef = useRef<View>(null);
  const [destCenter, setDestCenter] = useState<{ x: number; y: number } | null>(
    null,
  );
  function handleDestLayout() {
    destRef.current?.measureInWindow((x, y, width, height) => {
      setDestCenter({ x: x + width / 2, y: y + height / 2 });
    });
  }

  // One ref per currently-rendered human hand card, keyed by card id.
  const handCardRefs = useRef(new Map<string, View>()).current;
  function registerHandCardRef(cardId: string, node: View | null) {
    if (node) {
      handCardRefs.set(cardId, node);
    } else {
      handCardRefs.delete(cardId);
    }
  }

  // Replaces a direct onPlayCard(cardId) call: measures the tapped card's real on-screen
  // position relative to the trick slot's, so the travel animation starts from where the card
  // actually was. Falls back to a plain onPlayCard(cardId) call (no origin — TravelCard then
  // uses the fixed 'bottom' offset, same as today) whenever either measurement isn't ready.
  function playWithMeasuredOrigin(cardId: string) {
    const node = handCardRefs.get(cardId);
    if (!node || !destCenter) {
      onPlayCard(cardId);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      onPlayCard(cardId, {
        x: x + width / 2 - destCenter.x,
        y: y + height / 2 - destCenter.y,
      });
    });
  }

  // Anchored below the screen's true bottom edge (covers the full bottom side with margin to
  // spare — the overshoot itself is off-screen) while keeping the peak at the same height as
  // before. Width stays exactly windowWidth; only height is stretched (via HandFrame's `height`
  // prop + resizeMode="stretch") to satisfy both constraints — see HandFrame's prop doc.
  const handFramePeakTarget =
    TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM + HAND_FRAME_REVEAL_MARGIN;
  const handFrameBottomOffset = -HAND_FRAME_BOTTOM_OVERSHOOT;
  const handFrameHeight =
    (handFramePeakTarget + HAND_FRAME_BOTTOM_OVERSHOOT) /
    (1 - HAND_FRAME_PEAK_FRACTION);

  return (
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      <TableFelt />
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        pendingPlay={pendingPlay}
      />

      <View style={styles.middleRow}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          state={state}
          playerNames={playerNames}
          pendingPlay={pendingPlay}
        />

        {state.phase === "bidding" && (
          <BiddingCenter state={state} playerNames={playerNames} />
        )}
        {state.phase === "trump-selection" &&
          state.bidWinner !== humanPlayerId && (
            <TrumpWaitingCenter state={state} playerNames={playerNames} />
          )}
        {state.phase === "playing" && (
          <TrickCenter
            state={state}
            seats={seats}
            humanPlayerId={humanPlayerId}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
            gatheringTrick={gatheringTrick}
            destRef={destRef}
            onDestLayout={handleDestLayout}
          />
        )}

        <OpponentSeatGroup
          position="right"
          seats={seats}
          state={state}
          playerNames={playerNames}
          pendingPlay={pendingPlay}
        />
      </View>

      <HandFrame
        bottomOffset={handFrameBottomOffset}
        height={handFrameHeight}
      />
      <View style={styles.handArea}>
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? "You"}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
        <HumanHandFan
          slots={handSlots}
          legalCardIds={legalCardIds}
          isHumanInteractive={isHumanInteractive}
          selectedCardId={selectedCardId}
          selectCard={selectCard}
          playEntrance={dealPhase === "revealing"}
          registerCardRef={registerHandCardRef}
        />
      </View>
      {dealPhase !== "revealing" && <DealFlightOverlay seats={dealSeats} />}
      <CenteredDecisionModal
        raiseBy={PLATFORM_RAISE_BY}
        visible={
          state.phase === "bidding" &&
          isHumanInteractive &&
          dealPhase === "revealing"
        }>
        <BidControls legalMoves={legalMoves} onMove={onMove} />
      </CenteredDecisionModal>
      <CenteredDecisionModal
        raiseBy={PLATFORM_RAISE_BY}
        visible={
          state.phase === "trump-selection" &&
          state.bidWinner === humanPlayerId &&
          dealPhase === "revealing"
        }>
        <TrumpSuitPicker state={state} onMove={onMove} />
      </CenteredDecisionModal>
    </DeselectableSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: {
    minHeight: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 4,
  },
  opponentAreaSide: { minHeight: 0, width: 96, paddingVertical: 4 },
  // 300 hugs the playing-phase content at 'normal' card size (two 120px rows + 6px fan gap +
  // 4px area gap + badge ≈ 296). BidControls now renders in a CenteredDecisionModal rather than
  // here, so this height applies uniformly across every phase.
  handArea: {
    minHeight: 300,
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 4,
    gap: 4,
  },
  // zIndex only orders direct siblings sharing a parent (here: the top opponent group, this row,
  // and handArea, all children of the root container) — it does not let a deeply nested
  // descendant "escape" and outrank an entirely different sibling subtree on its own. Without
  // this, TravelCard's own zIndex (scoped to its trickSlot siblings) has no effect on whether it
  // paints above or below handArea's cards, so mid-flight — since the human's play now travels
  // from the card's real hand position, which visually overlaps handArea — it looked like it
  // emerged from underneath the neighboring hand cards instead of lifting above them.
  middleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.22)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  badgeActive: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    ...glowShadow("#4ade80", 8),
  },
  badgeCompact: { gap: 3, paddingHorizontal: 5 },
  playerLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f5f0e6",
    textAlign: "center",
  },
  playerLabelCompact: { fontSize: 11 },
  // Same cross-subtree reasoning as middleRow above, one level down: outranks the left/right
  // OpponentSeatGroup siblings within middleRow, so a card traveling from either side seat paints
  // above that seat's own remaining cards too.
  centerPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 10,
  },
  centerHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f5f0e6",
    textAlign: "center",
  },
  centerLine: { fontSize: 14, color: "#f5f0e6", textAlign: "center" },
  trumpRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  suitRow: { flexDirection: "row", gap: 12 },
  suitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Fixed-size relative box (RN Views are relatively-positioned by default) so the 4 absolutely-
  // positioned trickSlot children can be offset from a shared center point — see
  // TRICK_SLOT_OFFSETS. Sized generously around the small card's 64x86 footprint plus the loose
  // cross-overlap offsets; confirm via screenshot in the final verification pass.
  trickCross: { width: 160, height: 180, alignSelf: "center" },
  trickSlot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -32,
    marginTop: -43,
    width: 64,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
  },
  // The wood-grain fill (PlatformWoodBackground, rendered as this View's first child) needs
  // overflow:'hidden' to clip to the rounded corners; it also makes this the single wood
  // treatment shared by both decision modals (bid + trump), so they read as one cohesive
  // wooden-table identity instead of two separately-styled cards.
  modalCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PLATFORM_TRIM_COLOR,
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxWidth: 320,
    alignItems: "center",
    overflow: "hidden",
  },
  // Only the trump modal's heading needs breathing room above the suit row — the bid modal has no
  // heading of its own, and the ambient centerPanel instances already get spacing from their own
  // `gap`, so this stays scoped here rather than added to the shared centerHeading style.
  trumpModalHeading: { marginBottom: 12 },
  // Fixed 3-column grid (5/6/7, 8/9/10, 11/12/13 — Batak's real bid range) rather than a
  // flex-wrap row, so the layout stays a clean 3-wide rectangle regardless of how many bid
  // amounts are currently legal, per the bid-button redesign spec.
  bidGrid: {
    width: BID_GRID_WIDTH,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BID_GRID_GAP,
  },
  passRow: { width: BID_GRID_WIDTH, marginTop: BID_GRID_GAP },
  // Outer wrapper carries the drop shadow only (no overflow/borderRadius) — combining overflow:
  // 'hidden' with an elevation-based Android shadow on the same View clips the shadow itself.
  bidButtonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 3,
  },
  // Inner wrapper clips the SVG fill/bevel/shine layers to the rounded border.
  bidButtonClip: {
    borderRadius: BID_BUTTON_RADIUS,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bidButtonText: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontWeight: "700",
    textAlign: "center",
  },
  noPointerEvents: { pointerEvents: "none" },
  // Fixed height since every card inside is now absolutely positioned (see AnimatedFanCard) and
  // can no longer contribute to an auto-computed height the way normal-flow children would.
  handFan: { height: HAND_FAN_HEIGHT },
  // Each human-hand card's positioning anchor: centered horizontally (left:50% + a negative
  // marginLeft of half the card's own width, the same "center-relative" convention already used
  // by TrickCenter's trickSlot below), with AnimatedFanCard supplying the actual per-card
  // translateX/Y offset from that center point. No zIndex — natural render order (HumanHandFan
  // renders the top row's slots before the bottom row's) already makes a lifted bottom-row card
  // paint over the top row on its own, with no per-card override needed.
  fanCardSlot: {
    position: "absolute",
    left: "50%",
    top: 0,
    marginLeft: -HUMAN_CARD_WIDTH / 2,
  },
});
