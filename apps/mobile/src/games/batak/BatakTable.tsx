import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { LayoutChangeEvent } from "react-native";
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
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
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
const HAND_ROW_OVERLAP_PX = Math.round(HUMAN_CARD_HEIGHT * HAND_ROW_OVERLAP_FRACTION);

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
// Reserve a small ~4% gutter on each side (i.e. cards span the middle 92% of the hand area's
// real width) instead of a fixed-percent overlap that doesn't adapt to device width — bumped
// from 0.7 (15% gutter) to spread much closer to the Alper Games reference.
const HUMAN_HAND_SPREAD_FRACTION = 0.92;
// Caps the per-card gap once a near-empty hand (1-2 cards left) would otherwise need to stretch
// across the full target span with unnaturally large gaps.
const HUMAN_HAND_MAX_GAP = 24;

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

function OpponentSeat({ seat, state, playerNames, pendingPlay }: OpponentSeatProps) {
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

function TrumpSelectionCenter({
  state,
  humanPlayerId,
  playerNames,
  onMove,
}: {
  state: BatakState;
  humanPlayerId: string;
  playerNames: Record<string, string>;
  onMove: (move: BatakMove) => void;
}) {
  if (state.bidWinner === humanPlayerId) {
    return (
      <View style={styles.centerPanel}>
        <Text
          style={
            styles.centerHeading
          }>{`Choose trump (contract: ${state.contract})`}</Text>
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
  return (
    <View style={styles.centerPanel}>
      <Text style={styles.centerHeading}>
        {`${playerNames[state.bidWinner ?? ""] ?? state.bidWinner} is choosing trump…`}
      </Text>
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
  destRef,
  onDestLayout,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
  destRef: React.RefObject<View | null>;
  onDestLayout: () => void;
}) {
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
    const isPending = playerId != null && pendingPlay != null && pendingPlay.playerId === playerId;
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
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            <TravelCard
              originOffset={
                pendingPlay?.originOffset ??
                revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))
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
        {(["top", "left", "bottom", "right"] as TrickPosition[]).map(slotFor)}
      </View>
    </View>
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
      <View style={styles.bidGrid}>
        {bidMoves.map(move => (
          <Pressable
            key={move.amount}
            onPress={() => onMove(move)}
            style={styles.bidButton}
            accessibilityRole="button">
            <Text style={styles.bidButtonText}>{`Bid ${move.amount}`}</Text>
          </Pressable>
        ))}
        {hasPass && (
          <Pressable
            onPress={() => onMove({ type: "pass" })}
            style={[styles.bidButton, styles.passButton]}
            accessibilityRole="button">
            <Text style={styles.bidButtonText}>Pass</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function HandRow({
  cards,
  legalCardIds,
  isHumanInteractive,
  selectedCardId,
  selectCard,
  playEntrance,
  cardMarginLeft,
  registerCardRef,
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  cardMarginLeft: number | undefined;
  registerCardRef: (cardId: string, node: View | null) => void;
}) {
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <View key={card.id} ref={(node) => registerCardRef(card.id, node)}>
            <EntranceCard index={i} playEntrance={playEntrance}>
              <SelectableCard
                card={card}
                size="normal"
                selected={selectedCardId === card.id}
                disabled={!interactive}
                onPress={() => selectCard(card.id)}
                rotateDeg={fanRotationDeg(i, cards.length, HUMAN_HAND_DEGREES_PER_STEP)}
                curveOffsetY={fanCurveY(i, cards.length, 1, HUMAN_HAND_CURVE_MULTIPLIER)}
                marginLeft={i > 0 ? cardMarginLeft : undefined}
                liftDistance={SELECTED_LIFT_DISTANCE}
                // Kept even without the front-stacking zIndex below: it independently shrinks
                // the selected card's own touch bounds, which is what actually prevents a stray
                // tap from landing on it instead of an exposed neighbor — orthogonal to stacking
                // order.
                hitSlop={selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined}
              />
            </EntranceCard>
          </View>
        );
      })}
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
  dealPhase,
}: BatakTableProps) {
  const seats = assignSeats(opponentPlayerIds);
  // Deal order: human first, then opponents in existing turn order (right, top, left for the
  // fixed 4-player table) — see docs/superpowers/specs/2026-07-17-batak-deal-selection-and-
  // trick-motion-polish-design.md section D2. Card counts come from the real dealt hand size,
  // not a hardcoded 13, so this stays correct if hand size ever varies (e.g. the gömmeli variant).
  const dealSeats: DealFlightSeat[] = [
    { origin: "bottom", cardCount: state.table.zones[`hand-${humanPlayerId}`].cards.length },
    ...opponentPlayerIds.map((playerId) => ({
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
  const isHumanInteractive = isHumanTurn && pendingPlay == null;

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(playWithMeasuredOrigin);
  useEffect(() => {
    if (!isHumanInteractive) clearSelection();
  }, [isHumanInteractive, clearSelection]);

  const isPendingHuman = pendingPlay != null && pendingPlay.playerId === humanPlayerId;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) => !(isPendingHuman && card.id === pendingPlay!.card.id)
  );
  const sortedHand = sortHandForDisplay(humanHand);
  // splitTwoRows returns the larger half first; the bottom row (closer to the viewer) should get
  // the extra card on an odd-sized hand, not the top row — e.g. 13 cards is 6 top / 7 bottom.
  const [largerRowCount] = splitTwoRows(sortedHand.length);
  const topRowCount = sortedHand.length - largerRowCount;
  const topRow = sortedHand.slice(0, topRowCount);
  const bottomRow = sortedHand.slice(topRowCount);
  const legalCardIds = new Set(
    legalMoves
      .filter(
        (m): m is Extract<BatakMove, { type: "play" }> => m.type === "play",
      )
      .map(m => m.cardId),
  );

  const { width: windowWidth } = useWindowDimensions();
  const [handAreaWidth, setHandAreaWidth] = useState(windowWidth);
  function handleHandAreaLayout(event: LayoutChangeEvent) {
    setHandAreaWidth(event.nativeEvent.layout.width);
  }
  const handSpanTarget = handAreaWidth * HUMAN_HAND_SPREAD_FRACTION;
  const topRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, topRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);
  const bottomRowMargin = fillWidthMarginPx(HUMAN_CARD_WIDTH, bottomRow.length, handSpanTarget, HUMAN_HAND_MAX_GAP);

  // Destination for the human's play-travel origin delta: the 'bottom' trick slot's on-screen
  // center, measured live and re-measured on every layout pass. See
  // docs/superpowers/specs/2026-07-18-human-hand-real-position-card-travel-design.md.
  const destRef = useRef<View>(null);
  const [destCenter, setDestCenter] = useState<{ x: number; y: number } | null>(null);
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
  const handFramePeakTarget = TOP_ROW_PEAK_DISTANCE_FROM_BOTTOM + HAND_FRAME_REVEAL_MARGIN;
  const handFrameBottomOffset = -HAND_FRAME_BOTTOM_OVERSHOOT;
  const handFrameHeight =
    (handFramePeakTarget + HAND_FRAME_BOTTOM_OVERSHOOT) / (1 - HAND_FRAME_PEAK_FRACTION);

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
        {state.phase === "trump-selection" && (
          <TrumpSelectionCenter
            state={state}
            humanPlayerId={humanPlayerId}
            playerNames={playerNames}
            onMove={onMove}
          />
        )}
        {state.phase === "playing" && (
          <TrickCenter
            state={state}
            seats={seats}
            humanPlayerId={humanPlayerId}
            playerNames={playerNames}
            pendingPlay={pendingPlay}
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

      <HandFrame bottomOffset={handFrameBottomOffset} height={handFrameHeight} />
      <View style={styles.handArea} onLayout={handleHandAreaLayout}>
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? "You"}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
        <View style={styles.handFan} testID="human-hand">
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
            cardMarginLeft={topRowMargin}
            registerCardRef={registerHandCardRef}
          />
          <View style={styles.bottomHandRow}>
            <HandRow
              cards={bottomRow}
              legalCardIds={legalCardIds}
              isHumanInteractive={isHumanInteractive}
              selectedCardId={selectedCardId}
              selectCard={selectCard}
              playEntrance={dealPhase === "revealing"}
              cardMarginLeft={bottomRowMargin}
              registerCardRef={registerHandCardRef}
            />
          </View>
        </View>
      </View>
      {dealPhase !== "revealing" && <DealFlightOverlay seats={dealSeats} />}
      <CenteredDecisionModal visible={state.phase === "bidding" && isHumanInteractive}>
        <BidControls legalMoves={legalMoves} onMove={onMove} />
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
  // 4px area gap + badge ≈ 296); during bidding the BidControls row grows the area past the
  // minimum naturally, so bidding layout is unaffected.
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
  modalCard: {
    backgroundColor: "rgba(11, 30, 20, 0.94)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(244, 197, 66, 0.5)",
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxWidth: 320,
    alignItems: "center",
  },
  bidGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  bidButton: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 197, 66, 0.5)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  passButton: { borderColor: "rgba(192, 57, 43, 0.6)" },
  bidButtonText: { fontSize: 15, fontWeight: "700", color: "#f5f0e6" },
  handFan: { alignItems: "center" },
  // Overlaps the bottom row up into the top row by HAND_ROW_OVERLAP_PX instead of the two rows
  // sitting apart with a gap, so the fan reads as one imbricated hand.
  bottomHandRow: { marginTop: -HAND_ROW_OVERLAP_PX },
  // No zIndex here — natural render order (top row's Views come before bottom row's in the
  // JSX) already makes a lifted bottom-row card paint over the top row on its own, with no
  // per-card override needed.
  handFanRow: { flexDirection: "row", justifyContent: "center" },
});
