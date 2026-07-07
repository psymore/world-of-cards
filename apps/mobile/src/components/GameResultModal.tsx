import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlayerId, ScoreBoard } from '@world-cards/engine';

export interface GameResultModalProps {
  scores: ScoreBoard;
  winners: PlayerId[];
  playerNames: Record<PlayerId, string>;
  humanPlayerId: PlayerId;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

export function GameResultModal({
  scores,
  winners,
  playerNames,
  humanPlayerId,
  onPlayAgain,
  onBackHome,
}: GameResultModalProps) {
  const isTie = winners.length > 1;
  const humanWon = !isTie && winners.includes(humanPlayerId);
  const headline = isTie ? "It's a tie!" : humanWon ? 'You win!' : 'You lose';

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.headline}>{headline}</Text>
          {Object.keys(scores).map((playerId) => (
            <Text key={playerId} style={styles.scoreLine}>
              {(playerNames[playerId] ?? playerId) + ': ' + scores[playerId]}
            </Text>
          ))}
          <View style={styles.actions}>
            <Pressable onPress={onPlayAgain} accessibilityRole="button">
              <Text style={styles.actionText}>Play Again</Text>
            </Pressable>
            <Pressable onPress={onBackHome} accessibilityRole="button">
              <Text style={styles.actionText}>Back to Home</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 260 },
  headline: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  scoreLine: { fontSize: 16, marginBottom: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  actionText: { fontSize: 16, color: '#2f5fa8', fontWeight: '600' },
});
