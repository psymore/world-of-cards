import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Card } from '@world-cards/engine';
import type { PistiState } from '@world-cards/engine/games/pisti';
import { PlayingCard, TableFelt, TableWoodCorners, glowShadow } from '@world-cards/ui';
import { SelectableCard } from '../../components/SelectableCard';
import { useCardSelection } from '../../components/useCardSelection';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { useReducedMotion } from '../../components/useReducedMotion';
import {
  assignSeats,
  fillWidthMarginPx,
  resolveRevealOrigin,
  revealOriginOffset,
} from './pistiSeating';
import type { RevealOrigin, Seat } from './pistiSeating';
import { DealFlightOverlay } from '../../table/DealFlightOverlay';
import type { DealFlightSeat } from '../../table/DealFlightOverlay';
import type { DealPhase } from '../../hooks/useDealSequence';

export interface PistiRevealCard {
  card: Card;
  playerId: string;
}

export interface PistiTableProps {
  state: PistiState;
  humanPlayerId: string;
  // Ordered opponent seats: 1 entry seats them at the top (2-player table), 3 entries seat
  // them left/top/right around the human (4-player table).
  opponentPlayerIds: string[];
  playerNames: Record<string, string>;
  onPlayCard: (cardId: string) => void;
  bannerText?: string | null;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
}

// How many of the most recent pile cards to render stacked, plus one extra slot reserved
// for the in-flight reveal card. Older cards are fully covered anyway, so capping this
// keeps the pile view cheap even late in a hand.
const MAX_STACKED_PILE_CARDS = 5;

// Precomputed per-index offsets so stacking cost is a plain array lookup, not per-render math.
const PILE_CARD_OFFSETS = Array.from({ length: MAX_STACKED_PILE_CARDS + 1 }, (_, i) => ({
  x: i * 6,
  y: i * -4.5,
}));

const SMALL_CARD_WIDTH = 54; // matches PlayingCard's 'small' size width
const SMALL_CARD_HEIGHT = 78; // matches PlayingCard's 'small' size height
// Opponent hands render flat (no rotation/curve). Spacing auto-scales via fillWidthMarginPx: a
// small hand (Pişti's max-4 opponent cards) spreads into an evenly-gapped row (capped at
// *_MAX_GAP so it doesn't look sparse); a larger hand compresses into overlap automatically as
// count grows — one continuous rule instead of two separate "row" vs. "fan" modes.
const TOP_FAN_WIDTH_FRACTION = 0.85; // fraction of window width the top seat's row may use
const TOP_FAN_MAX_GAP = 10;
const SIDE_STACK_HEIGHT_FRACTION = 0.82; // fraction of the measured middle-row height the side stack may use
const SIDE_FAN_MAX_GAP = 10;

function RevealCard({
  revealCard,
  label,
  originDirection,
}: {
  revealCard: PistiRevealCard;
  label: string;
  originDirection: RevealOrigin;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // With reduce-motion on, the card appears already at rest instead of traveling in — an
    // instant transition rather than the full directional-travel effect.
    if (reducedMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 530,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealCard.card.id, reducedMotion]);

  const offset = PILE_CARD_OFFSETS[MAX_STACKED_PILE_CARDS];
  const origin = revealOriginOffset(originDirection);

  return (
    <>
      <Text style={styles.revealLabel}>{label}</Text>
      <Animated.View
        style={[
          styles.pileCardSlot,
          {
            zIndex: MAX_STACKED_PILE_CARDS + 1,
            opacity: anim,
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [offset.x + origin.x, offset.x],
                }),
              },
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [offset.y + origin.y, offset.y],
                }),
              },
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            ],
          },
        ]}
      >
        <PlayingCard card={revealCard.card} highlighted />
      </Animated.View>
    </>
  );
}

function PlayerBadge({
  name,
  capturedCount,
  active,
  isHuman,
  compact,
}: {
  name: string;
  capturedCount: number;
  active: boolean;
  isHuman: boolean;
  // Width-constrained seats (the 96dp side seats in a 4-player table) need a smaller avatar and
  // tighter spacing so the name/capture-count text still fits without wrapping onto several lines.
  compact?: boolean;
}) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact, active && styles.badgeActive]}>
      <PlayerAvatar accent={isHuman} size={compact ? 'small' : 'normal'} />
      <Text style={[styles.playerLabel, compact && styles.playerLabelCompact]} numberOfLines={1}>{`${name} · 🂠 ${capturedCount}`}</Text>
    </View>
  );
}

interface OpponentSeatProps {
  seat: Seat;
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  // Measured height of the middle row (see PistiTable's onLayout below) — the real available
  // vertical space for a side seat's card stack, which can't be derived from window height alone
  // since the side seats live inside a centered (non-stretching) flex row.
  sideStackHeight: number;
}

function OpponentSeat({ seat, state, playerNames, revealCard, dealPhase, sideStackHeight }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  // No face-down cards render until the deal-flight animation finishes, so the opponent's hand
  // doesn't pop in ahead of the cards that are still visually traveling toward them.
  const count = dealPhase !== 'revealing' ? 0 : Math.max(isRevealing ? hand.length - 1 : hand.length, 0);
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const isCurrentTurn = state.players[state.currentPlayerIndex] === playerId;

  const { width: windowWidth } = useWindowDimensions();
  const cardMargin = isSide
    ? fillWidthMarginPx(SMALL_CARD_HEIGHT, count, sideStackHeight * SIDE_STACK_HEIGHT_FRACTION, SIDE_FAN_MAX_GAP)
    : fillWidthMarginPx(SMALL_CARD_WIDTH, count, windowWidth * TOP_FAN_WIDTH_FRACTION, TOP_FAN_MAX_GAP);
  // Precomputed per-index style array (stable reference when count/cardMargin/isSide don't
  // change) so PlayingCard's React.memo can still skip re-rendering unchanged face-down cards —
  // the same reasoning as the PILE_CARD_OFFSETS array above, just computed dynamically instead
  // of statically since the margin now depends on measured layout.
  const cardStyles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        i === 0 ? undefined : isSide ? { marginTop: cardMargin } : { marginLeft: cardMargin }
      ),
    [count, cardMargin, isSide]
  );

  return (
    <View style={[styles.opponentArea, isSide && styles.opponentAreaSide, isCurrentTurn && styles.activeArea]}>
      <PlayerBadge
        name={playerNames[playerId] ?? playerId}
        capturedCount={capturedCount}
        active={isCurrentTurn}
        isHuman={false}
        compact={isSide}
      />
      <View style={isSide ? styles.opponentColumn : styles.opponentRow} testID={`opponent-hand-${playerId}`}>
        {cardStyles.map((style, i) => (
          <PlayingCard key={i} faceDown size="small" style={style} />
        ))}
      </View>
    </View>
  );
}

function OpponentSeatGroup({
  position,
  seats,
  state,
  playerNames,
  revealCard,
  dealPhase,
  sideStackHeight,
}: {
  position: Seat['position'];
  seats: Seat[];
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
  dealPhase: DealPhase;
  sideStackHeight: number;
}) {
  return (
    <>
      {seats
        .filter((seat) => seat.position === position)
        .map((seat) => (
          <OpponentSeat
            key={seat.playerId}
            seat={seat}
            state={state}
            playerNames={playerNames}
            revealCard={revealCard}
            dealPhase={dealPhase}
            sideStackHeight={sideStackHeight}
          />
        ))}
    </>
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
}: PistiTableProps) {
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  // While the human's own play is revealing (traveling to the pile), the engine state hasn't
  // committed the move yet, so `isHumanTurn` alone would still say it's their turn. Hide the
  // in-flight card from the hand row (it's already rendered by RevealCard at the pile) and treat
  // the hand as non-interactive until the move actually commits.
  const isHumanRevealing = revealCard != null && revealCard.playerId === humanPlayerId;
  const isHumanInteractive = isHumanTurn && !isHumanRevealing;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards.filter(
    (card) => !(isHumanRevealing && card.id === revealCard!.card.id)
  );
  const pile = state.table.zones['pile'].cards;
  const stackedPile = pile.slice(-MAX_STACKED_PILE_CARDS);
  const capturedHuman = state.table.zones[`captured-${humanPlayerId}`].cards.length;

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(onPlayCard);
  useEffect(() => {
    if (!isHumanTurn) clearSelection();
  }, [isHumanTurn, clearSelection]);

  const seats = assignSeats(opponentPlayerIds);

  // Side seats live inside a centered (non-stretching) flex row, so there's no way to derive
  // their available vertical space from window height alone — measure the row itself. 280 is a
  // reasonable pre-layout guess (corrected after the first onLayout pass), the same pattern
  // BatakTable's handAreaWidth already uses for its own width-fill measurement.
  const [middleRowHeight, setMiddleRowHeight] = useState(280);
  function handleMiddleRowLayout(event: LayoutChangeEvent) {
    setMiddleRowHeight(event.nativeEvent.layout.height);
  }

  // Deal order: human first, then opponents in existing turn order. Card counts come from the
  // real dealt hand size, not a hardcoded 4, so this stays correct for both the 2-player and
  // 4-player table.
  const dealSeats: DealFlightSeat[] = [
    { origin: 'bottom', cardCount: state.table.zones[`hand-${humanPlayerId}`].cards.length },
    ...opponentPlayerIds.map((playerId) => ({
      origin: resolveRevealOrigin(playerId, humanPlayerId, seats),
      cardCount: state.table.zones[`hand-${playerId}`].cards.length,
    })),
  ];

  return (
    <View style={styles.container}>
      <TableFelt />
      <TableWoodCorners />
      <OpponentSeatGroup
        position="top"
        seats={seats}
        state={state}
        playerNames={playerNames}
        revealCard={revealCard}
        dealPhase={dealPhase}
        sideStackHeight={middleRowHeight}
      />

      <View style={styles.middleRow} onLayout={handleMiddleRowLayout}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          dealPhase={dealPhase}
          sideStackHeight={middleRowHeight}
        />

        <View style={styles.pileArea}>
          <View style={styles.pileMat}>
            <View style={styles.pileStack}>
              {stackedPile.map((card, i) => (
                <View
                  key={card.id}
                  style={[
                    styles.pileCardSlot,
                    {
                      zIndex: i,
                      transform: [{ translateX: PILE_CARD_OFFSETS[i].x }, { translateY: PILE_CARD_OFFSETS[i].y }],
                    },
                  ]}
                >
                  <PlayingCard card={card} />
                </View>
              ))}
              {revealCard && (
                <RevealCard
                  revealCard={revealCard}
                  label={
                    revealCard.playerId === humanPlayerId
                      ? 'You played'
                      : `${playerNames[revealCard.playerId] ?? revealCard.playerId} played`
                  }
                  originDirection={resolveRevealOrigin(revealCard.playerId, humanPlayerId, seats)}
                />
              )}
            </View>
            <Text style={styles.pileCount}>{`${pile.length} card${pile.length === 1 ? '' : 's'}`}</Text>
          </View>
        </View>

        <OpponentSeatGroup
          position="right"
          seats={seats}
          state={state}
          playerNames={playerNames}
          revealCard={revealCard}
          dealPhase={dealPhase}
          sideStackHeight={middleRowHeight}
        />
      </View>

      <View style={styles.bannerArea}>{bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}</View>

      <View style={[styles.handArea, isHumanInteractive && styles.activeArea]}>
        <View style={styles.handRow} testID="human-hand">
          {dealPhase === 'revealing' &&
            humanHand.map((card) => (
              // Off-turn "not tappable" styling comes from SelectableCard's own disabled scrim
              // now (a dark overlay keeping the card art fully visible), replacing the old
              // 0.5-opacity wrapper — keeping both would double-dim the hand.
              <View key={card.id}>
                <SelectableCard
                  card={card}
                  selected={selectedCardId === card.id}
                  disabled={!isHumanInteractive}
                  onPress={() => selectCard(card.id)}
                />
              </View>
            ))}
        </View>
        <PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} capturedCount={capturedHuman} active={isHumanTurn} isHuman />
      </View>
      {dealPhase !== 'revealing' && <DealFlightOverlay seats={dealSeats} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: { minHeight: 135, justifyContent: 'center', alignItems: 'center', borderRadius: 12, paddingVertical: 4 },
  opponentAreaSide: { minHeight: 0, width: 96, paddingVertical: 4 },
  handArea: { minHeight: 177, justifyContent: 'center', borderRadius: 12, paddingVertical: 4 },
  activeArea: { backgroundColor: 'rgba(244, 197, 66, 0.14)' },
  middleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  badgeActive: {
    borderColor: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    ...glowShadow('#4ade80', 8),
  },
  // The 96dp side seats have too little room for the default gap/padding plus a full-size
  // avatar without the name/capture-count text wrapping onto several cramped lines.
  badgeCompact: { gap: 3, paddingHorizontal: 5 },
  playerLabel: { fontSize: 13, fontWeight: '700', color: '#f5f0e6', textAlign: 'center' },
  playerLabelCompact: { fontSize: 11 },
  opponentRow: { flexDirection: 'row', justifyContent: 'center' },
  opponentColumn: { flexDirection: 'column', alignItems: 'center' },
  pileArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pileMat: {
    width: 195,
    height: 225,
    borderRadius: 98,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pileStack: { width: 114, height: 144 },
  pileCardSlot: { position: 'absolute', left: 0, bottom: 0 },
  revealLabel: {
    position: 'absolute',
    top: -24,
    left: -32,
    width: 140,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff8dc',
    textAlign: 'center',
  },
  pileCount: { marginTop: 8, fontSize: 13, color: '#f5f0e6' },
  bannerArea: { minHeight: 24, alignItems: 'center', justifyContent: 'center' },
  banner: { fontSize: 16, fontWeight: '700', color: '#ffd966' },
  handRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 8 },
});
