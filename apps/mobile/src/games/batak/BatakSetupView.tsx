import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BODY_REGULAR,
  BODY_SEMIBOLD,
  DISPLAY_BOLD,
  IconButton,
  ICON_HOME_IMAGE,
  PressableFeedback,
  TableFelt,
} from '@world-cards/ui';
import type { Difficulty } from '@world-cards/engine';
import { useSettingsStore } from '../../state/settingsStore';
import { DifficultyStars } from '../../components/DifficultyStars';
import type { BatakVariant } from './batakVariant';

const HOME_ICON_SIZE = 32;

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
        <IconButton
          source={ICON_HOME_IMAGE}
          size={HOME_ICON_SIZE}
          onPress={onBack}
          accessibilityLabel="Home"
          testID="batak-setup-home-button"
        />
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
          <View style={styles.difficultyRow}>
            <Text style={styles.optionText}>{label}</Text>
            <DifficultyStars difficulty={value} />
          </View>
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
    fontFamily: DISPLAY_BOLD,
    fontSize: 26,
    color: '#f4c542',
    letterSpacing: 1,
    textShadowColor: '#7a5c00',
    textShadowRadius: 6,
  },
  title: {
    fontFamily: BODY_SEMIBOLD,
    fontSize: 18,
    marginBottom: 16,
    marginTop: 8,
    textAlign: 'center',
    color: '#f5f0e6',
  },
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
  difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionText: { fontFamily: BODY_REGULAR, fontSize: 18, color: '#eee' },
  variantDescription: { fontFamily: BODY_REGULAR, fontSize: 13, color: '#cbb98a', marginTop: 2 },
  defaultBadge: { fontFamily: BODY_SEMIBOLD, fontSize: 12, color: '#f4c542', marginTop: 2 },
});
