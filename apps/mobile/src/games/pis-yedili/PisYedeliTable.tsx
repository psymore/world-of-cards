import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerId, Suit } from '@world-of-cards/engine';
import { pisYedeliDescriptor, PisYedeliState, PisYedeliMove } from '@world-of-cards/engine/games/pis-yedili';
import { BODY_SEMIBOLD, DISPLAY_BOLD, PlayingCard, PressableFeedback, SUIT_COLOR, SuitIcon } from '@world-of-cards/ui';
import { PlayerBadge } from '../../table/PlayerBadge';
import { OpponentSeatGroup, seatLayoutStyles } from '../../table/OpponentSeatGroup';
import { assignSeats } from '../../table/seating';
import { PisYedeliSuitPickerModal } from './PisYedeliSuitPickerModal';

export interface PisYedeliTableProps {
  state: PisYedeliState;
  humanPlayerId: PlayerId;
  opponentPlayerIds: PlayerId[];
  playerNames: Record<PlayerId, string>;
  onPerformMove: (move: PisYedeliMove) => void;
}

const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
function suitColor(suit: Suit): string {
  return RED_SUITS.includes(suit) ? SUIT_COLOR.red : SUIT_COLOR.black;
}

export function PisYedeliTable({
  state,
  humanPlayerId,
  opponentPlayerIds,
  playerNames,
  onPerformMove,
}: PisYedeliTableProps) {
  const [pendingJackCardId, setPendingJackCardId] = useState<string | null>(null);
  const seats = assignSeats(opponentPlayerIds);
  const legalMoves = pisYedeliDescriptor.ruleEngine.getLegalMoves(state, humanPlayerId);
  const legalCardIds = new Set(legalMoves.filter((m) => m.type === 'play').map((m) => m.cardId));
  const canDraw = legalMoves.some((m) => m.type === 'draw');
  const canPass = legalMoves.some((m) => m.type === 'pass');
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;

  const hand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const discard = state.table.zones['discard'].cards;
  const stock = state.table.zones['stock'].cards;
  const topDiscard = discard[discard.length - 1];

  function handleCardTap(cardId: string, rank: string) {
    if (!isHumanTurn || !legalCardIds.has(cardId)) return;
    if (rank === 'J') {
      setPendingJackCardId(cardId);
      return;
    }
    onPerformMove({ type: 'play', cardId });
  }

  function handleDeclareSuit(suit: Suit) {
    if (!pendingJackCardId) return;
    onPerformMove({ type: 'play', cardId: pendingJackCardId, declaredSuit: suit });
    setPendingJackCardId(null);
  }

  function handleDraw() {
    if (!isHumanTurn || !canDraw) return;
    onPerformMove({ type: 'draw' });
  }

  function handlePass() {
    if (!isHumanTurn || !canPass) return;
    onPerformMove({ type: 'pass' });
  }

  function opponentSeatContent(seatPlayerId: string, compact: boolean) {
    const cardCount = state.table.zones[`hand-${seatPlayerId}`].cards.length;
    return (
      <PlayerBadge
        name={playerNames[seatPlayerId] ?? seatPlayerId}
        statusText={`${cardCount} card${cardCount === 1 ? '' : 's'}`}
        isHuman={false}
        compact={compact}
      />
    );
  }

  return (
    <View style={styles.container}>
      <OpponentSeatGroup
        position="top"
        seats={seats}
        renderSeat={(seat) => <View style={styles.opponentAreaTop}>{opponentSeatContent(seat.playerId, false)}</View>}
      />
      <View style={seatLayoutStyles.middleRow}>
        <OpponentSeatGroup
          position="left"
          seats={seats}
          renderSeat={(seat) => (
            <View style={seatLayoutStyles.opponentAreaSide}>{opponentSeatContent(seat.playerId, true)}</View>
          )}
        />

        <View style={styles.centerArea}>
          <PressableFeedback onPress={handleDraw} disabled={!isHumanTurn || !canDraw} style={styles.stockPile}>
            <PlayingCard faceDown size="normal" />
            <Text style={styles.stockCount}>{stock.length}</Text>
          </PressableFeedback>
          <View style={styles.discardPile}>
            {topDiscard ? (
              <PlayingCard card={topDiscard} size="normal" />
            ) : (
              <View style={styles.emptyDiscard} />
            )}
            {state.activeSuit && (
              <View style={styles.activeSuitBadge}>
                <SuitIcon suit={state.activeSuit} size={18} color={suitColor(state.activeSuit)} />
              </View>
            )}
          </View>
          {state.pendingDraw > 0 && <Text style={styles.pendingDrawText}>Draw {state.pendingDraw}</Text>}
        </View>

        <OpponentSeatGroup
          position="right"
          seats={seats}
          renderSeat={(seat) => (
            <View style={seatLayoutStyles.opponentAreaSide}>{opponentSeatContent(seat.playerId, true)}</View>
          )}
        />
      </View>

      <View style={styles.handArea}>
        <PlayerBadge
          name={playerNames[humanPlayerId] ?? 'You'}
          statusText={`${hand.length} card${hand.length === 1 ? '' : 's'}`}
          isHuman
        />
        <ScrollView horizontal contentContainerStyle={styles.handRow} showsHorizontalScrollIndicator={false}>
          {hand.map((card) => {
            const interactive = isHumanTurn && legalCardIds.has(card.id);
            return (
              <PressableFeedback
                key={card.id}
                disabled={!interactive}
                onPress={() => handleCardTap(card.id, card.rank)}
                style={styles.handCard}
                testID={`pis-yedili-hand-card-${card.id}`}>
                <PlayingCard card={card} size="normal" style={!interactive && styles.dimmedCard} />
              </PressableFeedback>
            );
          })}
        </ScrollView>
        {canPass && (
          <PressableFeedback
            onPress={handlePass}
            disabled={!isHumanTurn}
            style={styles.passButton}
            overlayBorderRadius={8}
            testID="pis-yedili-pass-button">
            <Text style={styles.passButtonText}>Pass</Text>
          </PressableFeedback>
        )}
      </View>

      <PisYedeliSuitPickerModal
        visible={pendingJackCardId != null}
        onSelect={handleDeclareSuit}
        onCancel={() => setPendingJackCardId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  opponentAreaTop: { alignItems: 'center' },
  centerArea: { alignItems: 'center', gap: 8 },
  stockPile: { alignItems: 'center', gap: 4 },
  stockCount: { fontFamily: BODY_SEMIBOLD, fontSize: 14, color: '#f5f0e6' },
  discardPile: { position: 'relative' },
  emptyDiscard: {
    width: 94,
    height: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activeSuitBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#f5f0e6',
    borderRadius: 12,
    padding: 4,
  },
  pendingDrawText: { fontFamily: DISPLAY_BOLD, fontSize: 16, color: '#d64545' },
  handArea: { alignItems: 'center', paddingBottom: 12, gap: 8 },
  handRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  handCard: {},
  dimmedCard: { opacity: 0.4 },
  passButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  passButtonText: { fontFamily: BODY_SEMIBOLD, fontSize: 16, color: '#f5f0e6' },
});
