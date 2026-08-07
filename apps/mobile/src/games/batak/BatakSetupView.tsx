import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback, TableFelt } from '@world-cards/ui';
import type { Difficulty } from '@world-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';
import type { BatakVariant } from './batakVariant';

export interface BatakSetupViewProps {
  defaultDifficulty: Difficulty;
  onStart: (difficulty: Difficulty, variant: BatakVariant) => void;
  onBack: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const VARIANTS: { value: BatakVariant; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: '4 players' },
  { value: 'gomeli', label: 'Gömmeli', description: '3 players, buried kitty' },
];

export function BatakSetupView({ defaultDifficulty, onStart, onBack }: BatakSetupViewProps) {
  const [variant, setVariant] = useState<BatakVariant>('standard');

  function handlePress(value: Difficulty) {
    useSettingsStore.getState().setDefaultDifficulty(value);
    onStart(value, variant);
  }

  return (
    <View style={styles.container}>
      <TableFelt />
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Batak</Text>
        <PressableFeedback onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.backLink}>‹ Home</Text>
        </PressableFeedback>
      </View>

      <Text style={styles.title}>Choose a variant</Text>
      {VARIANTS.map(({ value, label, description }) => (
        <PressableFeedback
          key={value}
          onPress={() => setVariant(value)}
          style={[styles.option, value === variant && styles.optionDefault]}
          overlayBorderRadius={8}
          testID={`batak-variant-${value}`}
        >
          <Text style={styles.optionText}>{label}</Text>
          <Text style={styles.variantDescription}>{description}</Text>
        </PressableFeedback>
      ))}

      <Text style={styles.title}>Choose a difficulty</Text>
      {DIFFICULTIES.map(({ value, label }) => (
        <PressableFeedback
          key={value}
          onPress={() => handlePress(value)}
          style={[styles.option, value === defaultDifficulty && styles.optionDefault]}
          overlayBorderRadius={8}
        >
          <Text style={styles.optionText}>{label}</Text>
          {value === defaultDifficulty && <Text style={styles.defaultBadge}>Last played</Text>}
        </PressableFeedback>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, backgroundColor: '#0a2e1f' },
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
  title: { fontSize: 18, fontWeight: '600', marginBottom: 16, marginTop: 8, textAlign: 'center', color: '#f5f0e6' },
  option: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionDefault: { borderColor: '#f4c542', backgroundColor: 'rgba(244, 197, 66, 0.2)' },
  optionText: { fontSize: 18, color: '#eee' },
  variantDescription: { fontSize: 13, color: '#cbb98a', marginTop: 2 },
  defaultBadge: { fontSize: 12, color: '#f4c542', marginTop: 2 },
});
