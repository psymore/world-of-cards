import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Difficulty } from '@world-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';

export interface PistiSetupViewProps {
  defaultDifficulty: Difficulty;
  onStart: (difficulty: Difficulty) => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export function PistiSetupView({ defaultDifficulty, onStart }: PistiSetupViewProps) {
  function handlePress(value: Difficulty) {
    useSettingsStore.getState().setDefaultDifficulty(value);
    onStart(value);
  }

  return (
    <View style={styles.container}>
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
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  option: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#2f5fa8', backgroundColor: '#e8f0fb' },
  optionText: { fontSize: 18 },
  defaultBadge: { fontSize: 12, color: '#2f5fa8', marginTop: 2 },
});
