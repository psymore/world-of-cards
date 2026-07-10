import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import type { PistiState } from '@world-cards/engine/games/pisti';
import { PlayingCard } from '../../components/PlayingCard';
import { SelectableCard } from '../../components/SelectableCard';
import { useCardSelection } from '../../components/useCardSelection';
import { TableFelt } from '../../components/TableFelt';
import { TableWoodCorners } from '../../components/TableWoodCorners';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { glowShadow } from '../../components/glowShadow';
import { assignSeats, fanCurveY, fanRotationDeg, OPPONENT_CARD_OVERLAP, SIDE_CARD_STYLES } from './pistiSeating';
import type { Seat } from './pistiSeating';

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
}

// How many of the most recent pile cards to render stacked, plus one extra slot reserved
// for the in-flight reveal card. Older cards are fully covered anyway, so capping this
// keeps the pile view cheap even late in a hand.
const MAX_STACKED_PILE_CARDS = 5;

// Precomputed per-index offsets so stacking cost is a plain array lookup, not per-render math.
const PILE_CARD_OFFSETS = Array.from({ length: MAX_STACKED_PILE_CARDS + 1 }, (_, i) => ({
  x: i * 4,
  y: i * -3,
}));

function RevealCard({ revealCard, label }: { revealCard: PistiRevealCard; label: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealCard.card.id]);

  const offset = PILE_CARD_OFFSETS[MAX_STACKED_PILE_CARDS];

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
              { translateX: offset.x },
              { translateY: offset.y },
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
  // Width-constrained seats (the 64dp side seats in a 4-player table) need a smaller avatar and
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
}

function OpponentSeat({ seat, state, playerNames, revealCard }: OpponentSeatProps) {
  const { position, playerId } = seat;
  const isSide = position !== 'top';
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const isRevealing = revealCard != null && revealCard.playerId === playerId;
  const count = Math.max(isRevealing ? hand.length - 1 : hand.length, 0);
  const capturedCount = state.table.zones[`captured-${playerId}`].cards.length;
  const isCurrentTurn = state.players[state.currentPlayerIndex] === playerId;

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
        {Array.from({ length: count }).map((_, i, arr) =>
          isSide ? (
            <PlayingCard key={i} faceDown size="small" style={SIDE_CARD_STYLES[i]} />
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
                    { translateY: fanCurveY(i, arr.length) },
                  ],
                },
              ]}
            />
          )
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
  revealCard,
}: {
  position: Seat['position'];
  seats: Seat[];
  state: PistiState;
  playerNames: Record<string, string>;
  revealCard?: PistiRevealCard | null;
}) {
  return (
    <>
      {seats
        .filter((seat) => seat.position === position)
        .map((seat) => (
          <OpponentSeat key={seat.playerId} seat={seat} state={state} playerNames={playerNames} revealCard={revealCard} />
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
}: PistiTableProps) {
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const pile = state.table.zones['pile'].cards;
  const stackedPile = pile.slice(-MAX_STACKED_PILE_CARDS);
  const capturedHuman = state.table.zones[`captured-${humanPlayerId}`].cards.length;

  const { selectedCardId, selectCard, clearSelection } = useCardSelection(onPlayCard);
  useEffect(() => {
    if (!isHumanTurn) clearSelection();
  }, [isHumanTurn, clearSelection]);

  const seats = assignSeats(opponentPlayerIds);

  return (
    <View style={styles.container}>
      <TableFelt />
      <TableWoodCorners />
      <OpponentSeatGroup position="top" seats={seats} state={state} playerNames={playerNames} revealCard={revealCard} />

      <View style={styles.middleRow}>
        <OpponentSeatGroup position="left" seats={seats} state={state} playerNames={playerNames} revealCard={revealCard} />

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
                />
              )}
            </View>
            <Text style={styles.pileCount}>{`${pile.length} card${pile.length === 1 ? '' : 's'}`}</Text>
          </View>
        </View>

        <OpponentSeatGroup position="right" seats={seats} state={state} playerNames={playerNames} revealCard={revealCard} />
      </View>

      <View style={styles.bannerArea}>{bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}</View>

      <View style={[styles.handArea, isHumanTurn && styles.activeArea]}>
        <View style={styles.handRow} testID="human-hand">
          {humanHand.map((card) => (
            <View key={card.id} style={!isHumanTurn && styles.disabledCard}>
              <SelectableCard
                card={card}
                selected={selectedCardId === card.id}
                disabled={!isHumanTurn}
                onPress={() => selectCard(card.id)}
              />
            </View>
          ))}
        </View>
        <PlayerBadge name={playerNames[humanPlayerId] ?? 'You'} capturedCount={capturedHuman} active={isHumanTurn} isHuman />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 12 },
  opponentArea: { minHeight: 90, justifyContent: 'center', alignItems: 'center', borderRadius: 12, paddingVertical: 4 },
  opponentAreaSide: { minHeight: 0, width: 64, paddingVertical: 4 },
  handArea: { minHeight: 118, justifyContent: 'center', borderRadius: 12, paddingVertical: 4 },
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
  // The 64dp side seats have too little room for the default gap/padding plus a full-size
  // avatar without the name/capture-count text wrapping onto several cramped lines.
  badgeCompact: { gap: 3, paddingHorizontal: 5 },
  playerLabel: { fontSize: 13, fontWeight: '700', color: '#f5f0e6', textAlign: 'center' },
  playerLabelCompact: { fontSize: 11 },
  opponentRow: { flexDirection: 'row', justifyContent: 'center' },
  opponentColumn: { flexDirection: 'column', alignItems: 'center' },
  pileArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pileMat: {
    width: 130,
    height: 150,
    borderRadius: 65,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pileStack: { width: 76, height: 96 },
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
  disabledCard: { opacity: 0.5 },
});
