import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Difficulty } from '@world-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';

export type PistiPlayerCount = 2 | 4;
export type PistiFourPlayerMode = 'ffa' | 'team';

export interface PistiSetupViewProps {
  defaultDifficulty: Difficulty;
  onStart: (difficulty: Difficulty, playerCount: PistiPlayerCount, fourPlayerMode: PistiFourPlayerMode) => void;
  onBack: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const PLAYER_COUNTS: { value: PistiPlayerCount; label: string }[] = [
  { value: 2, label: '2 Players' },
  { value: 4, label: '4 Players' },
];

const FOUR_PLAYER_MODES: { value: PistiFourPlayerMode; label: string }[] = [
  { value: 'ffa', label: 'Free-for-all' },
  { value: 'team', label: 'With a Partner' },
];

export function PistiSetupView({ defaultDifficulty, onStart, onBack }: PistiSetupViewProps) {
  const [playerCount, setPlayerCount] = useState<PistiPlayerCount>(2);
  const [fourPlayerMode, setFourPlayerMode] = useState<PistiFourPlayerMode>('ffa');

  function handlePress(value: Difficulty) {
    useSettingsStore.getState().setDefaultDifficulty(value);
    onStart(value, playerCount, fourPlayerMode);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Pişti</Text>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Table size</Text>
      <View style={styles.playerCountRow}>
        {PLAYER_COUNTS.map(({ value, label }) => (
          <Pressable
            key={value}
            onPress={() => setPlayerCount(value)}
            style={[styles.playerCountOption, value === playerCount && styles.optionDefault]}
          >
            <Text style={styles.optionText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {playerCount === 4 && (
        <>
          <Text style={styles.title}>4-player mode</Text>
          <View style={styles.playerCountRow}>
            {FOUR_PLAYER_MODES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setFourPlayerMode(value)}
                style={[styles.playerCountOption, value === fourPlayerMode && styles.optionDefault]}
              >
                <Text style={styles.optionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.title}>Choose a difficulty</Text>
      {DIFFICULTIES.map(({ value, label }) => (
        <Pressable
          key={value}
          onPress={() => handlePress(value)}
          style={[styles.option, value === defaultDifficulty && styles.optionDefault]}
        >
          <Text style={styles.optionText}>{label}</Text>
          {value === defaultDifficulty && <Text style={styles.defaultBadge}>Last played</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#12121f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  backLink: { fontSize: 15, fontWeight: '600', color: '#cbb98a' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center', color: '#f5f0e6' },
  option: {
    backgroundColor: '#1e1e33',
    borderWidth: 1,
    borderColor: 'rgba(244, 197, 66, 0.35)',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#f4c542', backgroundColor: 'rgba(244, 197, 66, 0.14)' },
  optionText: { fontSize: 18, color: '#eee' },
  defaultBadge: { fontSize: 12, color: '#f4c542', marginTop: 2 },
  playerCountRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  playerCountOption: {
    flex: 1,
    backgroundColor: '#1e1e33',
    borderWidth: 1,
    borderColor: 'rgba(244, 197, 66, 0.35)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
