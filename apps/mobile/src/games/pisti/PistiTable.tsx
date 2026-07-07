import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PistiState } from '@world-cards/engine/games/pisti';
import { PlayingCard } from '../../components/PlayingCard';

export interface PistiTableProps {
  state: PistiState;
  humanPlayerId: string;
  aiPlayerId: string;
  onPlayCard: (cardId: string) => void;
  bannerText?: string | null;
}

export function PistiTable({ state, humanPlayerId, aiPlayerId, onPlayCard, bannerText }: PistiTableProps) {
  const isHumanTurn = state.players[state.currentPlayerIndex] === humanPlayerId;
  const aiHand = state.table.zones[`hand-${aiPlayerId}`].cards;
  const humanHand = state.table.zones[`hand-${humanPlayerId}`].cards;
  const pile = state.table.zones['pile'].cards;
  const topPileCard = pile[pile.length - 1];

  return (
    <View style={styles.container}>
      <View style={styles.opponentRow} testID="opponent-hand">
        {aiHand.map((card) => (
          <PlayingCard key={card.id} faceDown size="small" />
        ))}
      </View>

      <View style={styles.pileArea}>
        {topPileCard ? <PlayingCard card={topPileCard} /> : <View style={styles.emptyPileSlot} />}
        <Text style={styles.pileCount}>{`${pile.length} card${pile.length === 1 ? '' : 's'}`}</Text>
      </View>

      <View style={styles.bannerArea}>{bannerText ? <Text style={styles.banner}>{bannerText}</Text> : null}</View>

      <View style={styles.handRow} testID="human-hand">
        {humanHand.map((card) => (
          <Pressable
            key={card.id}
            disabled={!isHumanTurn}
            onPress={() => {
              if (isHumanTurn) onPlayCard(card.id);
            }}
            style={[styles.cardSlot, !isHumanTurn && styles.disabledCard]}
          >
            <PlayingCard card={card} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingVertical: 16 },
  opponentRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  pileArea: { alignItems: 'center' },
  emptyPileSlot: { width: 56, height: 80 },
  pileCount: { marginTop: 4, fontSize: 14, color: '#555' },
  bannerArea: { minHeight: 24, alignItems: 'center' },
  banner: { fontSize: 16, fontWeight: '600', color: '#2f5fa8' },
  handRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  cardSlot: {},
  disabledCard: { opacity: 0.5 },
});
