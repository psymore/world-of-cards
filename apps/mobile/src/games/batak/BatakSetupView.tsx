import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Difficulty } from '@world-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';

export interface BatakSetupViewProps {
  defaultDifficulty: Difficulty;
  onStart: (difficulty: Difficulty) => void;
  onBack: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export function BatakSetupView({ defaultDifficulty, onStart, onBack }: BatakSetupViewProps) {
  function handlePress(value: Difficulty) {
    useSettingsStore.getState().setDefaultDifficulty(value);
    onStart(value);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Batak</Text>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </Pressable>
      </View>

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
});
