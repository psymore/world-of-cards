import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Card, Suit } from "@world-cards/engine";
import type { BatakState, BatakMove } from "@world-cards/engine/games/batak";
import { compareRanks } from "@world-cards/engine/games/batak";
import {
  PlayingCard,
  SuitIcon,
  TableFelt,
  TableWoodCorners,
  glowShadow,
} from "@world-cards/ui";
import { SelectableCard } from "../../components/SelectableCard";
import { useCardSelection } from "../../components/useCardSelection";
import { PlayerAvatar } from "../../components/PlayerAvatar";
import { useReducedMotion } from "../../components/useReducedMotion";
import { DealAnimationOverlay } from "./DealAnimationOverlay";
import {
  assignSeats,
  fanCurveY,
  fanRotationDeg,
  overlapMarginPx,
  splitTwoRows,
  OPPONENT_CARD_OVERLAP,
  HUMAN_HAND_OVERLAP_PERCENT,
} from "../../table/seating";
import type { Seat, SeatPosition } from "../../table/seating";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

function suitColor(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds" ? "#c0392b" : "#111";
}

const HUMAN_CARD_WIDTH = 84; // matches PlayingCard's 'normal' size width
const HUMAN_HAND_MARGIN = overlapMarginPx(
  HUMAN_CARD_WIDTH,
  HUMAN_HAND_OVERLAP_PERCENT,
);

// Batak-local override of seating.ts's shared SIDE_CARD_STYLES: with 13-card starting hands, the
// shared 45px flat overlap (~58% of a small card) makes each side stack ~474px tall — taller than
// the middle row on a phone screen. A tighter 85% overlap keeps the full stack ~222px. Kept local
// (rather than changing the shared constant) so Pişti's finalized side-stack look is untouched.
// overlapMarginPx is generic "dimension × percent" despite its cardWidth param name — it's already
// the established way to derive an overlap margin from a percentage (see HUMAN_HAND_MARGIN above).
const SMALL_CARD_HEIGHT = 78; // matches PlayingCard's 'small' size height
const BATAK_SIDE_OVERLAP_PERCENT = 85;
// Sized to 13 to cover Batak's full starting hand (same ceiling reasoning as seating.ts's
// MAX_SIDE_STACK_CARDS) — a stable style object per index keeps PlayingCard's React.memo effective.
const BATAK_MAX_SIDE_STACK_CARDS = 13;
const BATAK_SIDE_CARD_STYLES: ({ marginTop: number } | undefined)[] =
  Array.from({ length: BATAK_MAX_SIDE_STACK_CARDS }, (_, i) =>
    i > 0
      ? {
          marginTop: overlapMarginPx(
            SMALL_CARD_HEIGHT,
            BATAK_SIDE_OVERLAP_PERCENT,
          ),
        }
      : undefined,
  );
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

export type BatakDealPhase = "shuffling" | "cutting" | "revealing";

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

function OpponentSeat({
  seat,
  state,
  playerNames,
  pendingPlay,
}: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== "top";
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isPending = pendingPlay != null && pendingPlay.playerId === playerId;
  const count = Math.max(isPending ? hand.length - 1 : hand.length, 0);
  const isCurrentTurn =
    state.players[state.currentPlayerIndex] === playerId && pendingPlay == null;

  return (
    <View
      style={[
        styles.opponentArea,
        // The top seat's fan is convex (ends rise, see fanCurveY(..., -1) below) — pad it down so
        // the raised end cards don't tuck under the navigation header at full 13-card hand size.
        !isSide && styles.opponentAreaTop,
        isSide && styles.opponentAreaSide,
        isCurrentTurn && styles.activeArea,
      ]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        statusText={statusTextFor(state, playerId)}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View
        style={isSide ? styles.opponentColumn : styles.opponentRow}
        testID={`opponent-hand-${playerId}`}>
        {Array.from({ length: count }).map((_, i, arr) =>
          isSide ? (
            <PlayingCard
              key={i}
              faceDown
              size="small"
              style={BATAK_SIDE_CARD_STYLES[i]}
            />
          ) : (
            <PlayingCard
              key={i}
              faceDown
              size="small"
              style={[
                i > 0 && { marginLeft: -OPPONENT_CARD_OVERLAP },
                {
                  transform: [
                    { rotate: `${fanRotationDeg(i, arr.length)}deg` },
                    // direction -1 flips the top seat's fan convex: end cards rise instead of
                    // drooping, so the fan arcs away from the side stacks below it.
                    { translateY: fanCurveY(i, arr.length, -1) },
                  ],
                },
              ]}
            />
          ),
        )}
      </View>
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

  function slotFor(position: "bottom" | SeatPosition) {
    const playerId =
      position === "bottom"
        ? humanPlayerId
        : seats.find(s => s.position === position)?.playerId;
    const card = playerId ? cardFor(playerId) : null;
    return (
      <View style={styles.trickSlot} testID={`trick-slot-${position}`}>
        {card ? <PlayingCard card={card} size="small" /> : null}
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
        <View style={styles.trickTopRow}>{slotFor("top")}</View>
        <View style={styles.trickMiddleRow}>
          {slotFor("left")}
          {slotFor("bottom")}
          {slotFor("right")}
        </View>
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
}: {
  cards: Card[];
  legalCardIds: Set<string>;
  isHumanInteractive: boolean;
  selectedCardId: string | null;
  selectCard: (cardId: string) => void;
  playEntrance: boolean;
}) {
  return (
    <View style={styles.handFanRow}>
      {cards.map((card, i) => {
        const interactive = isHumanInteractive && legalCardIds.has(card.id);
        return (
          <EntranceCard
            key={card.id}
            index={i}
            playEntrance={playEntrance}
            // While a card is selected, unselected neighbors take paint/hit priority over it.
            // In this overlapping fan, the raised card's lower corners jut over the neighboring
            // cards' territory (rotation widens the negative-marginLeft overlap to ~25px at the
            // fan's edges), so a tap aimed at the adjacent card could land on the selected card
            // instead — which reads as a second tap on it and PLAYS it instantly, i.e. the
            // "selected card sometimes disappears when I tap a different card" bug (confirmed
            // empirically via elementFromPoint hit-mapping). With neighbors on top, a boundary
            // tap resolves to the neighbor — a harmless selection switch — while deliberate
            // second taps on the selected card's exposed face still play it.
            zIndex={selectedCardId === card.id ? 0 : 1}>
            <SelectableCard
              card={card}
              size="normal"
              selected={selectedCardId === card.id}
              disabled={!interactive}
              onPress={() => selectCard(card.id)}
              rotateDeg={fanRotationDeg(i, cards.length)}
              curveOffsetY={fanCurveY(i, cards.length)}
              marginLeft={i > 0 ? HUMAN_HAND_MARGIN : undefined}
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
  zIndex,
  children,
}: {
  index: number;
  playEntrance: boolean;
  // Stacking order among the row's cards (see HandRow's selected-card comment). Applied here
  // because this Animated.View is the row's direct flex child — anything deeper sits inside
  // this card's own stacking context and can't reorder against sibling cards.
  zIndex?: number;
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
        zIndex,
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

  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const sortedHand = sortHandForDisplay(humanHand);
  const [topRowCount] = splitTwoRows(sortedHand.length);
  const topRow = sortedHand.slice(0, topRowCount);
  const bottomRow = sortedHand.slice(topRowCount);
  const legalCardIds = new Set(
    legalMoves
      .filter(
        (m): m is Extract<BatakMove, { type: "play" }> => m.type === "play",
      )
      .map(m => m.cardId),
  );

  return (
    <View style={styles.container}>
      <TableFelt />
      <TableWoodCorners />
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

      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handFan} testID="human-hand">
          <HandRow
            cards={topRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
          />
          <HandRow
            cards={bottomRow}
            legalCardIds={legalCardIds}
            isHumanInteractive={isHumanInteractive}
            selectedCardId={selectedCardId}
            selectCard={selectCard}
            playEntrance={dealPhase === "revealing"}
          />
        </View>
        {state.phase === "bidding" && isHumanInteractive && (
          <BidControls legalMoves={legalMoves} onMove={onMove} />
        )}
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? "You"}
          statusText={statusTextFor(state, humanPlayerId)}
          active={isHumanTurn}
          isHuman
        />
      </View>
      {dealPhase !== "revealing" && <DealAnimationOverlay phase={dealPhase} />}
    </View>
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
  opponentAreaTop: { paddingTop: 32 },
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
  activeArea: { backgroundColor: "rgba(244, 197, 66, 0.14)" },
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
  opponentRow: { flexDirection: "row", justifyContent: "center" },
  opponentColumn: { flexDirection: "column", alignItems: "center" },
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
  trickCross: { alignItems: "center", gap: 8 },
  trickTopRow: { flexDirection: "row", justifyContent: "center" },
  trickMiddleRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  trickSlot: {
    minWidth: 54,
    minHeight: 78,
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
  // zIndex: 0 makes each row its own stacking context (rows are flex items), so the per-card
  // zIndex 0/1 dance in HandRow reorders cards only within their row — a selected (zIndex 0)
  // bottom-row card must not slip behind the top row's cards where its lifted top overlaps them.
  // Row-over-row order is unchanged: equal zIndex falls back to render order (bottom row last).
  handFanRow: { flexDirection: "row", justifyContent: "center", zIndex: 0 },
});
