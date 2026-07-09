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
  // Partnerships, if this game has any (e.g. 4-player "with a partner" mode). When two
  // teammates both win, they share one pooled score and both appear in `winners` — that's a
  // clean win for their team, not a tie, so tie detection needs to count distinct *teams*
  // among the winners rather than just the number of winning player ids.
  teams?: PlayerId[][];
}

function teamKey(playerId: PlayerId, teams: PlayerId[][] | undefined): string {
  const team = teams?.find((t) => t.includes(playerId));
  return team ? team.slice().sort().join('+') : playerId;
}

export function GameResultModal({
  scores,
  winners,
  playerNames,
  humanPlayerId,
  onPlayAgain,
  onBackHome,
  teams,
}: GameResultModalProps) {
  const winningTeamKeys = new Set(winners.map((w) => teamKey(w, teams)));
  const isTie = winningTeamKeys.size > 1;
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
