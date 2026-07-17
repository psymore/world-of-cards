import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
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
  TableWoodCorners,
  TableEdgeRails,
  glowShadow,
} from "@world-cards/ui";
import { SelectableCard } from "../../components/SelectableCard";
import { DeselectableSurface } from "../../components/DeselectableSurface";
import { useCardSelection } from "../../components/useCardSelection";
import { PlayerAvatar } from "../../components/PlayerAvatar";
import { useReducedMotion } from "../../components/useReducedMotion";
import { DealFlightOverlay } from "../../table/DealFlightOverlay";
import type { DealFlightSeat } from "../../table/DealFlightOverlay";
import type { DealPhase } from "../../hooks/useDealSequence";
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from "../../table/travelAnimation";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  splitTwoRows,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from "../../table/seating";
import type { Seat, SeatPosition, RevealOrigin } from "../../table/seating";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

function suitColor(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds" ? "#c0392b" : "#111";
}

const HUMAN_CARD_WIDTH = 94; // matches PlayingCard's 'normal' size width
// A flatter arc than the opponents' default fan (half the rotation-per-card and curve
// multiplier) — first-pass values, tune during the manual visual verification pass if needed.
const HUMAN_HAND_DEGREES_PER_STEP = 4;
const HUMAN_HAND_CURVE_MULTIPLIER = 1.5;
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

// Animates a just-played card traveling from its seat's direction to its resting position in the
// trick cross — the parent slot (see TrickCenter) already sits at the resting TRICK_SLOT_OFFSETS
// position, so this only needs to interpolate from the origin vector down to (0, 0) relative to
// that slot. Mirrors Pişti's PistiTable.RevealCard, sharing the same timing constants
// (../../table/travelAnimation) so both games' play-travel motion feels consistent.
function TravelCard({ card, origin }: { card: Card; origin: RevealOrigin }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [card.id, reducedMotion]);

  const originVector = revealOriginOffset(origin);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [originVector.x, 0] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [originVector.y, 0] }) },
        ],
      }}>
      <PlayingCard card={card} size="small" />
    </Animated.View>
  );
}

function TrickCenter({
  state,
  seats,
  humanPlayerId,
  playerNames,
  pendingPlay,
}: {
  state: BatakState;
  seats: Seat[];
  humanPlayerId: string;
  playerNames: Record<string, string>;
  pendingPlay?: PendingBatakPlay | null;
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
        style={[
          styles.trickSlot,
          { zIndex, transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        ]}>
        {card ? (
          isPending ? (
            <TravelCard card={card} origin={resolveRevealOrigin(playerId!, humanPlayerId, seats)} />
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
    <ScrollView
      horizontal
      contentContainerStyle={styles.bidRow}
      testID="bid-controls">
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
    </ScrollView>
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
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
  cardMarginLeft: number | undefined;
}) {
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <EntranceCard key={card.id} index={i} playEntrance={playEntrance}>
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
              // Kept even without the front-stacking zIndex below: it independently shrinks the
              // selected card's own touch bounds, which is what actually prevents a stray tap
              // from landing on it instead of an exposed neighbor — orthogonal to stacking order.
              hitSlop={selectedCardId === card.id ? SELECTED_CARD_HIT_SLOP : undefined}
            />
          </EntranceCard>
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

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(
    cardId => onMove({ type: "play", cardId }),
  );
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

  return (
    <DeselectableSurface style={styles.container} onDeselect={clearSelection}>
      <TableFelt />
      <TableWoodCorners />
      <TableEdgeRails />
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

      <View style={styles.handArea} onLayout={handleHandAreaLayout}>
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? "You"}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
        {state.phase === "bidding" && isHumanInteractive && (
          <BidControls legalMoves={legalMoves} onMove={onMove} />
        )}
        <View style={styles.handFan} testID="human-hand">
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
            cardMarginLeft={topRowMargin}
          />
          <HandRow
            cards={bottomRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
            cardMarginLeft={bottomRowMargin}
          />
        </View>
      </View>
      {dealPhase !== "revealing" && <DealFlightOverlay seats={dealSeats} />}
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
  middleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  centerPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  bidRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
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
  handFan: { alignItems: "center", gap: 6 },
  // No zIndex here — natural render order (top row's Views come before bottom row's in the
  // JSX) already makes a lifted bottom-row card paint over the top row on its own, with no
  // per-card override needed.
  handFanRow: { flexDirection: "row", justifyContent: "center" },
});
